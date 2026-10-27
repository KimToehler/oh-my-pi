#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { buildBundle, bundleDigest, FolderPlanError, snapshotFolder } from "./folder-plan.mjs";
import {
	abortRuleDefects,
	planContent,
	readRiskTier,
	scanMarkdown,
	substantiveCriteriaDefects,
	topLevelField,
	valueDefect,
} from "./plan-contract.mjs";

const GATE_FIELDS = [
	"Mandatory class",
	"Risk tier",
	"Author's risk assessment",
	"Whole-diff review",
	"Accepted residual risks",
	"Out of scope for blocking",
];
const MANDATORY_CLASSES = new Set([
	"none",
	"auth-secrets-pii",
	"schema-migration",
	"wire-contract-api",
	"concurrency-state",
]);
const PLACEHOLDER = /<[^>]+>|\b(?:TBD|TODO)\b/i;

async function regularFile(file) {
	try {
		const stat = await fs.lstat(file);
		return stat.isFile() && !stat.isSymbolicLink();
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

async function markdownFiles(root) {
	const out = [];
	async function walk(dir) {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			const file = path.join(dir, entry.name);
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) await walk(file);
			else if (entry.isFile() && entry.name.endsWith(".md")) out.push(file);
		}
	}
	try {
		await walk(root);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
	return out.sort();
}

// Returns whether the specs hold a requirement, counted by the same per-line parse that validates it, so the gate.md
// criteria fallback applies exactly when no requirement supplies the review criteria.
function validateSpecs(files, texts, skipSpecs, errors) {
	if (files.length === 0) {
		if (!skipSpecs) errors.push("specs: at least one Markdown spec is required");
		return false;
	}
	if (skipSpecs) errors.push("specs: skip_specs requires no Markdown specs");
	let renameCount = 0;
	let requirementCount = 0;
	for (const file of files) {
		const lines = texts.get(file).split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			if (!/^## RENAMED Requirements[ \t]*$/i.test(lines[i])) continue;
			const section = [];
			for (i++; i < lines.length && !/^## /.test(lines[i]); i++) section.push(lines[i]);
			if (
				section.some(line => /^- FROM:[ \t]*`### Requirement: [^`]+`[ \t]*$/.test(line)) &&
				section.some(line => /^- TO:[ \t]*`### Requirement: [^`]+`[ \t]*$/.test(line))
			)
				renameCount++;
			i--;
		}
		for (let i = 0; i < lines.length; i++) {
			const match = /^### Requirement:\s*(.+?)\s*$/.exec(lines[i]);
			if (!match) continue;
			requirementCount++;
			const name = match[1];
			let end = i + 1;
			while (end < lines.length && !/^#{2,3} /.test(lines[end])) end++;
			const block = lines.slice(i + 1, end);
			const controls = [];
			for (let j = 0; j < block.length; j++) {
				if (/^#### Scenario:\s*Negative control\s*$/i.test(block[j])) controls.push(j);
			}
			if (controls.length !== 1) {
				errors.push(`${name}: exactly one Scenario: Negative control is required`);
				continue;
			}
			const start = controls[0] + 1;
			let controlEnd = start;
			while (controlEnd < block.length && !/^#### Scenario:/.test(block[controlEnd])) controlEnd++;
			const control = block.slice(start, controlEnd);
			if (!control.some(line => /^- \*\*WHEN\*\*:?[ \t]+\S/.test(line) && !PLACEHOLDER.test(line)))
				errors.push(`${name}: Negative control needs a concrete WHEN`);
			if (!control.some(line => /^- \*\*THEN\*\*:?[ \t]+[^\n]*\bMUST fail\b/i.test(line) && !PLACEHOLDER.test(line)))
				errors.push(`${name}: Negative control THEN must state what MUST fail`);
		}
	}
	if (requirementCount === 0 && renameCount === 0)
		errors.push("specs: at least one Requirement or rename is required");
	return requirementCount > 0;
}

// Mirrors OpenSpec 1.15.0 utils/task-progress.js TASK_LINE_PATTERN: any checkbox it counts as a tracked task must satisfy the team contract.
const TASK_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;

function validateTasks(text, errors) {
	const tasks = text.split("\n").flatMap(line => {
		const match = TASK_LINE.exec(line);
		return match ? [match[2].trim()] : [];
	});
	if (tasks.length === 0) {
		errors.push("tasks: at least one tracked task is required");
		return;
	}
	for (const body of tasks) {
		const numbered = /^(\d+(?:\.\d+)*)[ \t]+(.+)$/.exec(body);
		if (!numbered) {
			errors.push(`task: expected numbered tracked task: ${body}`);
			continue;
		}
		const description = numbered[2];
		if (!/Verify:[ \t]*`[^`\r\n]+`$/.test(description) || (description.match(/Verify:/g) ?? []).length !== 1)
			errors.push(`task ${numbered[1]}: expected trailing Verify: \`<deterministic command>\``);
		else if (PLACEHOLDER.test(description)) errors.push(`task ${numbered[1]}: placeholder text is forbidden`);
	}
}

/**
 * Checks gate.md as the merge-gate section of the change, on content-only text (code fences and HTML comments are not
 * gate content). The class, tier and abort-field rules are the gate validator's own, imported from plan-contract.mjs.
 * `hasRequirements` says whether the specs carry review criteria; when they do not (skip_specs, rename-only deltas),
 * gate.md must.
 */
function validateGate(text, hasRequirements, errors) {
	const content = planContent(scanMarkdown(text));
	const values = new Map();
	for (const field of GATE_FIELDS) {
		const found = topLevelField(content, field);
		if (found.count !== 1 || !found.value) {
			errors.push(`${field}: expected exactly one nonempty top-level bullet`);
			continue;
		}
		values.set(field, found.value);
		if (field !== "Author's risk assessment" && PLACEHOLDER.test(found.value))
			errors.push(`${field}: placeholder text is forbidden`);
	}
	if (topLevelField(content, "Review tier").count > 0)
		errors.push("Review tier: removed; the gate reads - **Risk tier**: product or internal-tooling");

	const mandatory = values.get("Mandatory class");
	if (mandatory && !MANDATORY_CLASSES.has(mandatory.replace(/`/g, ""))) {
		errors.push(`Mandatory class: unsupported value ${mandatory}; use exactly one class, with no reason (it goes in Author's risk assessment)`);
	}
	if (values.has("Risk tier")) {
		const parsed = readRiskTier(content);
		if (parsed.error) errors.push(`Risk tier: ${parsed.error}`);
	}
	const assessment = values.get("Author's risk assessment");
	const defect = assessment === undefined ? undefined : valueDefect(assessment);
	if (defect) errors.push(`Author's risk assessment: ${defect}; say what could break and how badly`);

	const wholeDiff = values.get("Whole-diff review");
	if (wholeDiff && wholeDiff !== "needed" && !/^not needed\s*\(.+\)$/.test(wholeDiff))
		errors.push("Whole-diff review: use needed or not needed (<concrete reason>)");
	for (const message of abortRuleDefects(content)) {
		if (!message.endsWith(": missing") && !message.endsWith(": duplicate")) errors.push(message);
	}
	if (!hasRequirements) {
		for (const { field, detail } of substantiveCriteriaDefects(content, "gate.md criteria")) errors.push(`${field}: ${detail}`);
	}
}

const PROPOSAL_SECTIONS = ["Why", "What Changes", "Capabilities", "Impact"];

const FENCE_OPEN = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;

/**
 * Reads Markdown in one pass as headings (`{ level, title }`, ATX or setext) and visible text lines (`{ text }`).
 * Fenced code, HTML comments and thematic breaks are dropped; fences and comment blocks hide each other's markers, and a
 * comment block that starts a line and never closes hides the rest of the file, as a renderer does.
 */
function markdownBlocks(markdown) {
	const blocks = [];
	let fence = null;
	let comment = false;
	let paragraph = false;
	for (const line of markdown.split(/\r?\n/)) {
		if (fence !== null) {
			const close = FENCE_CLOSE.exec(line)?.[1];
			if (close && close[0] === fence[0] && close.length >= fence.length) fence = null;
			continue;
		}
		if (comment || /^ {0,3}<!--/.test(line)) {
			const end = line.indexOf("-->", comment ? 0 : line.indexOf("<!--") + 4);
			comment = end < 0;
			paragraph = false;
			const rest = comment ? "" : line.slice(end + 3).replace(/<!--[\s\S]*?-->/g, "");
			if (rest.trim()) blocks.push({ text: rest });
			continue;
		}
		const open = FENCE_OPEN.exec(line)?.[1];
		if (open) {
			fence = open;
			paragraph = false;
			continue;
		}
		const visible = line.replace(/<!--[\s\S]*?-->/g, "");
		const atx = ATX_HEADING.exec(visible);
		const underline = SETEXT_UNDERLINE.exec(visible)?.[1];
		if (atx) {
			blocks.push({ level: atx[1].length, title: (atx[2] ?? "").replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trim() });
		} else if (underline && paragraph && !LIST_ITEM.test(blocks.at(-1).text)) {
			blocks.push({ level: underline[0] === "=" ? 1 : 2, title: blocks.pop().text.trim() });
		} else if (visible.trim() && !THEMATIC_BREAK.test(visible)) {
			blocks.push({ text: visible });
			paragraph = true;
			continue;
		}
		paragraph = false;
	}
	return blocks;
}

/**
 * Requires each proposal section once as a level-2 heading. Only visible text counts as content (no headings, HTML
 * comments, fenced code or thematic breaks); the Capabilities subsections may stay empty.
 */
function validateProposal(text, errors) {
	const blocks = markdownBlocks(text);
	for (const name of PROPOSAL_SECTIONS) {
		const starts = blocks.flatMap((block, i) =>
			block.level === 2 && block.title.replace(/\s+/g, " ").toLowerCase() === name.toLowerCase() ? [i] : [],
		);
		if (starts.length !== 1) {
			errors.push(`proposal ${name}: expected exactly one ## ${name} section`);
			continue;
		}
		let end = starts[0] + 1;
		while (end < blocks.length && !(blocks[end].level <= 2)) end++;
		const body = blocks
			.slice(starts[0] + 1, end)
			.flatMap(block => (block.level === undefined ? [block.text] : []))
			.join("\n");
		if (name === "Capabilities") {
			if (PLACEHOLDER.test(body)) errors.push(`proposal ${name}: placeholder text is forbidden`);
		} else if (!body.trim()) errors.push(`proposal ${name}: section needs content`);
	}
}

const FLAT_METADATA_LINE = /^([A-Za-z0-9_][A-Za-z0-9_.-]*): +(.*)$/;
const PLAIN_SCALAR = /^[^\s"'[\]{}&*!|>%@`#,?:-]\S*(?: +[^\s#]\S*)*$/;

/** Parses one flat `key: value` line (optional trailing ` # comment`); null for anything else. */
function parseFlatLine(line) {
	const match = line.includes("\t") ? null : FLAT_METADATA_LINE.exec(line);
	if (!match) return null;
	const value = match[2].replace(/ +#.*$/, "");
	if (!PLAIN_SCALAR.test(value) || value.includes(": ") || value.endsWith(":")) return null;
	return { key: match[1], value };
}

/**
 * Fail-closed gate for `skip_specs` in `.openspec.yaml`. A plain text test on the key name decides whether the file is
 * inspected at all; once it is, every line must be a flat `key: value` pair so no YAML construct can hide or alter the
 * declaration. Returns true only for a unique `skip_specs: true`.
 */
function parseSkipSpecs(text, errors) {
	if (!text.includes("skip_specs")) return false;
	const seen = new Set();
	let skipSpecs = false;
	for (const line of text.split(/\r?\n/)) {
		if (/^\s*(?:#.*)?$/.test(line)) continue;
		const entry = parseFlatLine(line);
		const flat =
			entry !== null && !seen.has(entry.key) && (entry.key !== "skip_specs" || /^(?:true|false)$/.test(entry.value));
		if (!flat) {
			errors.push(
				`.openspec.yaml: skip_specs requires flat key: value metadata (unquoted keys, plain scalar values, no repeated keys, skip_specs exactly true or false); offending line: ${line}`,
			);
			return false;
		}
		seen.add(entry.key);
		if (entry.key === "skip_specs") skipSpecs = entry.value === "true";
	}
	return skipSpecs;
}

/**
 * Pure checker over a snapshot: a Map of change-relative path (`/`-separated) to file bytes. It reads nothing from disk,
 * so a caller that digests the same snapshot validates exactly the bytes it pins.
 */
export function validateOpenSpecFiles(snapshot) {
	const errors = [];
	const text = name => snapshot.get(name)?.toString("utf8");
	for (const file of ["proposal.md", "gate.md", "tasks.md"]) {
		if (!snapshot.has(file)) errors.push(`${file}: required regular file is missing`);
	}
	if (snapshot.has("proposal.md")) validateProposal(text("proposal.md"), errors);
	const specs = [...snapshot.keys()].filter(name => name.startsWith("specs/") && name.endsWith(".md")).sort();
	const texts = new Map(specs.map(file => [file, text(file)]));
	const skipSpecs = snapshot.has(".openspec.yaml") && parseSkipSpecs(text(".openspec.yaml"), errors);
	const hasRequirements = validateSpecs(specs, texts, skipSpecs, errors);
	if (snapshot.has("tasks.md")) validateTasks(text("tasks.md"), errors);
	if (snapshot.has("gate.md")) validateGate(text("gate.md"), hasRequirements, errors);
	return errors;
}

export async function validateOpenSpecChange(changeDir) {
	const root = path.resolve(changeDir);
	const snapshot = new Map();
	for (const file of ["proposal.md", "gate.md", "tasks.md", ".openspec.yaml"]) {
		if (await regularFile(path.join(root, file))) snapshot.set(file, await fs.readFile(path.join(root, file)));
	}
	for (const file of await markdownFiles(path.join(root, "specs"))) {
		snapshot.set(path.relative(root, file).split(path.sep).join("/"), await fs.readFile(file));
	}
	return validateOpenSpecFiles(snapshot);
}

const REVIEW_FILE = "review.md";
// The checkbox of a line TASK_LINE counts as a tracked task, with everything before it kept.
const TASK_BOX = /^(\s*(?:[-*+]|\d{1,9}[.)])\s*)\[(?:\s*[^\]\s]?\s*\]|\s+\])/;

/**
 * The digest a review is bound to: the change folder's bundle without the review record itself, with every tracked
 * task's checkbox reset to `[ ]`. Ticking tasks during apply keeps the review valid; any other byte, file added or
 * file removed invalidates it.
 */
export function reviewDigest(snapshot) {
	const reviewed = new Map(snapshot);
	reviewed.delete(REVIEW_FILE);
	const tasks = reviewed.get("tasks.md");
	if (tasks !== undefined) {
		const lines = tasks.toString("utf8").split("\n");
		const reset = lines.map(line => (TASK_LINE.test(line) ? line.replace(TASK_BOX, "$1[ ]") : line));
		reviewed.set("tasks.md", Buffer.from(reset.join("\n")));
	}
	return bundleDigest(buildBundle(reviewed));
}

/** The trimmed body of the one top-level `## Blockers` section, or undefined when there is none or more than one. */
function blockersSection(content) {
	const lines = content.split("\n");
	const starts = lines.flatMap((line, index) => (/^##\s+Blockers\s*$/.test(line) ? [index] : []));
	if (starts.length !== 1) return undefined;
	const rest = lines.slice(starts[0] + 1);
	const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
	return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

/** Checks review.md against the current digest; returns the defects and, when it passes, the line to print. */
export function checkReview(snapshot) {
	const errors = [];
	if (!snapshot.has(REVIEW_FILE)) return { errors: [`${REVIEW_FILE}: required regular file is missing; run the review`] };
	const content = planContent(scanMarkdown(snapshot.get(REVIEW_FILE).toString("utf8")));
	const values = new Map();
	for (const field of ["Verdict", "Reviewed digest", "Reviewer", "Round", "Override"]) {
		const found = topLevelField(content, field);
		if (found.count !== 1 || !found.value) {
			errors.push(`${REVIEW_FILE} ${field}: expected exactly one nonempty top-level bullet`);
			continue;
		}
		values.set(field, found.value.replace(/`/g, "").trim());
	}
	const verdict = values.get("Verdict");
	if (verdict !== undefined && verdict !== "OKAY" && verdict !== "REJECT")
		errors.push(`${REVIEW_FILE} Verdict: expected OKAY or REJECT, got ${verdict}`);
	const reviewedDigest = values.get("Reviewed digest");
	if (reviewedDigest !== undefined && !/^[0-9a-f]{64}$/.test(reviewedDigest))
		errors.push(`${REVIEW_FILE} Reviewed digest: expected the 64-hex digest printed by --digest`);
	const reviewer = values.get("Reviewer");
	if (reviewer !== undefined && !/^plan-reviewer\s*,\s*[A-Za-z0-9][\w.-]*$/.test(reviewer))
		errors.push(`${REVIEW_FILE} Reviewer: expected plan-reviewer and the subagent id the task tool returned (plan-reviewer, <id>)`);
	const round = values.get("Round");
	if (round !== undefined && !/^[1-9]\d*$/.test(round))
		errors.push(`${REVIEW_FILE} Round: expected a positive integer`);
	const override = values.get("Override");
	const overridden = override !== undefined && override.toLowerCase() !== "none";
	if (overridden && (valueDefect(override) || PLACEHOLDER.test(override)))
		errors.push(`${REVIEW_FILE} Override: none, or the user's reason in their words`);
	const blockers = blockersSection(content);
	if (blockers === undefined) errors.push(`${REVIEW_FILE} Blockers: expected exactly one "## Blockers" section`);
	else if (/^<[^>\n]*>$/.test(blockers))
		errors.push(`${REVIEW_FILE} Blockers: replace the template placeholder with the reviewer's blockers verbatim, or none`);
	else if (verdict === "REJECT" && (blockers === "" || /^none\.?$/i.test(blockers.replace(/`/g, ""))))
		errors.push(`${REVIEW_FILE} Blockers: a REJECT needs the reviewer's blockers verbatim`);
	if (errors.length > 0) return { errors };

	const current = reviewDigest(snapshot);
	if (reviewedDigest !== current)
		errors.push(
			`${REVIEW_FILE}: stale: the change changed after review (reviewed ${reviewedDigest}, current ${current}); re-run the review`,
		);
	if (verdict === "REJECT" && !overridden)
		errors.push(`${REVIEW_FILE} Verdict: REJECT without a user override; fix the blockers and re-run the review, or ask the user`);
	if (errors.length > 0) return { errors };
	return {
		errors,
		summary: verdict === "REJECT" ? `reviewed: REJECT overridden by the user: ${override}` : `reviewed: OKAY in round ${round}`,
	};
}

const USAGE = "usage: validate-openspec-change.mjs [--digest | --reviewed] <change-dir>";

async function main() {
	const args = process.argv.slice(2);
	const mode = args[0] === "--digest" || args[0] === "--reviewed" ? args.shift() : undefined;
	if (args.length !== 1 || args[0].startsWith("--")) {
		console.error(USAGE);
		process.exitCode = 2;
		return;
	}
	const [changeDir] = args;
	if (mode === undefined) {
		const errors = await validateOpenSpecChange(changeDir);
		if (errors.length > 0) {
			for (const error of errors) console.error(error);
			process.exitCode = 1;
			return;
		}
		console.log("passed");
		return;
	}
	// One race-checked snapshot feeds the checks, the digest and the review record, so all three see the same bytes.
	let snapshot;
	try {
		snapshot = snapshotFolder(path.resolve(changeDir));
	} catch (error) {
		if (!(error instanceof FolderPlanError) && error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
		console.error(error.message);
		process.exitCode = 1;
		return;
	}
	const errors = validateOpenSpecFiles(snapshot);
	if (mode === "--digest") {
		if (errors.length === 0) console.log(reviewDigest(snapshot));
	} else if (errors.length === 0) {
		const review = checkReview(snapshot);
		errors.push(...review.errors);
		if (review.summary) console.log(review.summary);
	}
	if (errors.length > 0) {
		for (const error of errors) console.error(error);
		process.exitCode = 1;
	}
}

// Node resolves the entry module's URL to its real path; a symlinked argv[1] (e.g. a linked agent dir) must too.
const entry = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => process.argv[1]) : "";
if (import.meta.url === pathToFileURL(entry).href) await main();
