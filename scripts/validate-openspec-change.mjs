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

function validateSpecs(files, texts, errors) {
	if (files.length === 0) {
		errors.push("specs: at least one Markdown spec is required");
		return;
	}
	let requirementCount = 0;
	for (const file of files) {
		const lines = texts.get(file).split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const match = /^### Requirement:\s*(.+?)\s*$/.exec(lines[i]);
			if (!match) continue;
			requirementCount++;
			const name = match[1];
			let end = i + 1;
			while (end < lines.length && !/^### Requirement:/.test(lines[end])) end++;
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
	if (requirementCount === 0) errors.push("specs: at least one Requirement is required");
}

function validateTasks(text, errors) {
	const tasks = [...text.matchAll(/^- \[[ xX]\]\s+(\d+(?:\.\d+)*)\s+(.+)$/gm)];
	if (tasks.length === 0) {
		errors.push("tasks: at least one tracked task is required");
		return;
	}
	for (const task of tasks) {
		if (!/Verify:\s*`[^`\r\n]+`\s*$/.test(task[2]))
			errors.push(`task ${task[1]}: expected trailing Verify: \`<deterministic command>\``);
		else if (PLACEHOLDER.test(task[2])) errors.push(`task ${task[1]}: placeholder text is forbidden`);
	}
}

function validateGate(text, errors) {
	const values = new Map();
	for (const field of GATE_FIELDS) {
		const matches = [...text.matchAll(new RegExp(`^- \\*\\*${field}\\*\\*:\\s*(.+?)\\s*$`, "gmi"))];
		if (matches.length !== 1) {
			errors.push(`${field}: expected exactly one top-level bullet`);
			continue;
		}
		const value = matches[0][1].trim();
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

export async function validateOpenSpecChange(changeDir) {
	const errors = [];
	const root = path.resolve(changeDir);
	for (const file of ["proposal.md", "gate.md", "tasks.md"]) {
		if (!(await regularFile(path.join(root, file)))) errors.push(`${file}: required regular file is missing`);
	}
	const specs = await markdownFiles(path.join(root, "specs"));
	const texts = new Map(await Promise.all(specs.map(async file => [file, await fs.readFile(file, "utf8")])));
	validateSpecs(specs, texts, errors);
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
