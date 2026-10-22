#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const GATE_FIELDS = [
	"Mandatory class",
	"Review tier",
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
const REVIEW_TIERS = new Set(["standard", "full"]);
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

function validateSpecs(files, texts, skipSpecs, errors) {
	if (files.length === 0) {
		if (!skipSpecs) errors.push("specs: at least one Markdown spec is required");
		return;
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
}

// Mirrors OpenSpec 1.14.3 utils/task-progress.js TASK_LINE_PATTERN: any checkbox it counts as a tracked task must satisfy the team contract.
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

function validateGate(text, errors) {
	const values = new Map();
	const lines = text.split(/\r?\n/);
	for (const field of GATE_FIELDS) {
		const prefix = `- **${field.toLowerCase()}**:`;
		const matches = lines
			.filter(line => line.toLowerCase().startsWith(prefix))
			.map(line => line.slice(prefix.length).trim());
		if (matches.length !== 1 || !matches[0]) {
			errors.push(`${field}: expected exactly one nonempty top-level bullet`);
			continue;
		}
		const value = matches[0];
		values.set(field, value);
		if (PLACEHOLDER.test(value)) errors.push(`${field}: placeholder text is forbidden`);
	}

	const mandatory = values.get("Mandatory class");
	const mandatoryName = mandatory?.split(/\s+/, 1)[0];
	if (mandatory && !MANDATORY_CLASSES.has(mandatoryName))
		errors.push(`Mandatory class: unsupported value ${mandatoryName}`);
	if (mandatoryName === "none" && !/^none\s*\(.+\)$/.test(mandatory))
		errors.push("Mandatory class: none requires a concrete parenthesized reason");

	const tier = values.get("Review tier");
	if (tier && !REVIEW_TIERS.has(tier)) errors.push(`Review tier: unsupported value ${tier}`);
	if (mandatoryName && mandatoryName !== "none" && tier && tier !== "full")
		errors.push(`Review tier: ${mandatoryName} requires full`);

	const wholeDiff = values.get("Whole-diff review");
	if (wholeDiff && wholeDiff !== "needed" && !/^not needed\s*\(.+\)$/.test(wholeDiff))
		errors.push("Whole-diff review: use needed or not needed (<concrete reason>)");
	for (const field of ["Accepted residual risks", "Out of scope for blocking"]) {
		const value = values.get(field);
		if (value?.toLowerCase() === "none") errors.push(`${field}: none requires a concrete parenthesized reason`);
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

export async function validateOpenSpecChange(changeDir) {
	const errors = [];
	const root = path.resolve(changeDir);
	for (const file of ["proposal.md", "gate.md", "tasks.md"]) {
		if (!(await regularFile(path.join(root, file)))) errors.push(`${file}: required regular file is missing`);
	}
	if (await regularFile(path.join(root, "proposal.md")))
		validateProposal(await fs.readFile(path.join(root, "proposal.md"), "utf8"), errors);
	const specs = await markdownFiles(path.join(root, "specs"));
	const texts = new Map(await Promise.all(specs.map(async file => [file, await fs.readFile(file, "utf8")])));
	const metadata = path.join(root, ".openspec.yaml");
	const skipSpecs = (await regularFile(metadata)) && parseSkipSpecs(await fs.readFile(metadata, "utf8"), errors);
	validateSpecs(specs, texts, skipSpecs, errors);
	if (await regularFile(path.join(root, "tasks.md")))
		validateTasks(await fs.readFile(path.join(root, "tasks.md"), "utf8"), errors);
	if (await regularFile(path.join(root, "gate.md")))
		validateGate(await fs.readFile(path.join(root, "gate.md"), "utf8"), errors);
	return errors;
}

async function main() {
	const changeDir = process.argv[2];
	if (!changeDir || process.argv.length !== 3) {
		console.error("usage: validate-openspec-change.mjs <change-dir>");
		process.exitCode = 2;
		return;
	}
	const errors = await validateOpenSpecChange(changeDir);
	if (errors.length > 0) {
		for (const error of errors) console.error(error);
		process.exitCode = 1;
		return;
	}
	console.log("passed");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
