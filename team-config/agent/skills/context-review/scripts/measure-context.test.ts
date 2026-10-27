import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { attribute, lintRule, parseRule } from "./measure-context";

const prompt = (parts: { files?: string; rules?: string[]; skills?: string[]; tail?: string }) =>
	[
		"You are omp.",
		"<skills>",
		...(parts.skills ?? []),
		"</skills>",
		"<domain-rules>",
		...(parts.rules ?? []),
		"</domain-rules>",
		"<repo-rules>",
		parts.files ?? "",
		"</repo-rules>",
		"# Memory Guidance",
		"Rules:",
		parts.tail ?? "",
	].join("\n");

const userFile = '<file path="/home/u/.omp/agent/AGENTS.md">\n# Global\nBe terse.\n</file>';
const projectFile =
	'<file path="/repo/AGENTS.md">\n# Repo\nintro\n## Testing\nwrite tests\nmore tests\n## Build\nrun make\n</file>';

describe("attribute", () => {
	const baseline = prompt({
		files: userFile,
		rules: ["- worktrees (**/*): one worktree per lane"],
		skills: ["- git-master: commits"],
	});
	const repo = prompt({
		files: `${userFile}\n${projectFile}`,
		rules: ["- worktrees (**/*): one worktree per lane", "- db-migrations (server/**): Flyway order"],
		skills: ["- git-master: commits", "- release: cut a release"],
		tail: "- lesson: the repo builds with make",
	});
	const result = attribute(repo, baseline, "/repo");

	it("splits context files by scope and sizes each ## section", () => {
		expect(result.files.map(file => [file.path, file.scope])).toEqual([
			["/home/u/.omp/agent/AGENTS.md", "user"],
			["/repo/AGENTS.md", "project"],
		]);
		const sections = result.files[1].sections.map(section => [section.heading, section.chars]);
		expect(sections).toEqual([
			["(preamble)", "# Repo\nintro\n".length],
			["Testing", "## Testing\nwrite tests\nmore tests\n".length],
			["Build", "## Build\nrun make\n".length],
		]);
	});

	it("counts only rules and skills the empty repo does not list as project entries", () => {
		expect(result.projectRules.map(rule => rule.name)).toEqual(["db-migrations"]);
		expect(result.userRules.map(rule => rule.name)).toEqual(["worktrees"]);
		expect(result.projectSkills.map(skill => skill.name)).toEqual(["release"]);
		expect(result.userSkills.map(skill => skill.name)).toEqual(["git-master"]);
	});

	it("attributes leftover project-only lines to the heading above them and ignores shared lines", () => {
		expect(result.otherProject).toEqual([
			{ heading: "Memory Guidance", chars: "- lesson: the repo builds with make\n".length },
		]);
		const projectFileChars = result.files[1].chars;
		const listed = [...result.projectRules, ...result.projectSkills].reduce((n, entry) => n + entry.chars, 0);
		expect(result.projectChars).toBe(projectFileChars + listed + result.otherProject[0].chars);
	});

	describe("repository reached through a symlink", () => {
		const real = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "measure-context-real-")));
		const alias = `${real}-alias`;
		fs.symlinkSync(real, alias);
		fs.writeFileSync(path.join(real, "AGENTS.md"), "# Repo\n");
		afterAll(() => {
			fs.rmSync(alias, { force: true });
			fs.rmSync(real, { recursive: true, force: true });
		});

		it("counts a context file omp prints under the alias path as project scope", () => {
			const aliased = `<file path="${alias}/AGENTS.md">\n# Repo\n</file>`;
			const viaAlias = attribute(prompt({ files: `${userFile}\n${aliased}` }), prompt({ files: userFile }), real);
			expect(viaAlias.files.map(file => file.scope)).toEqual(["user", "project"]);
		});
	});
});

describe("lintRule", () => {
	const tracked = ["server/src/Main.kt", "docs/README.md"];

	it("flags an always-apply body and a glob that matches no tracked file", () => {
		const rule = parseRule("---\ndescription: gate\nalwaysApply: true\nglobs:\n  - \"client/**\"\n---\nBody text\n");
		expect(lintRule("gate", "/r/gate.md", rule, tracked, true).map(finding => finding.code)).toEqual([
			"ALWAYS_APPLY",
			"DEAD_GLOB",
		]);
	});

	it("accepts a listed rule whose inline globs match a tracked file", () => {
		const rule = parseRule('---\ndescription: Kotlin style\nglobs: ["server/src/**/*.kt", "x/**"]\n---\nUse detekt.\n');
		expect(rule.globs).toEqual(["server/src/**/*.kt", "x/**"]);
		expect(lintRule("kotlin", "/r/kotlin.md", rule, tracked, true)).toEqual([]);
	});

	it("flags a rule omp never offers and a description long enough to cost every request", () => {
		const silent = parseRule("---\nglobs:\n  - \"docs/**\"\n---\nnobody reads this\n");
		expect(lintRule("silent", "/r/silent.md", silent, tracked, false).map(finding => finding.code)).toEqual([
			"NOT_LISTED",
		]);
		const verbose = parseRule(`---\ndescription: ${"x".repeat(300)}\n---\nbody\n`);
		expect(lintRule("verbose", "/r/verbose.md", verbose, tracked, true).map(finding => finding.code)).toEqual([
			"LONG_DESCRIPTION",
		]);
	});
});
