import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { VcsGitRepo } from "@oh-my-pi/pi-natives";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { META_FILE } from "../src/evo/calibration";
import { readFixedModes } from "./evo-task-modes";
import { assertSafeRef, assertSafeRelPath, fail, type TaskMeta } from "./evo-task-shared";
import { dockerfile, SOLVE_SH, TEST_SH, taskToml } from "./evo-task-templates";

export interface MakeOptions {
	repo: string;
	base: string;
	fix: string;
	name: string;
	instruction: string;
	testCommand: string;
	testGlobs: string[];
	baseImage: string;
	output: string;
}

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

export function validateOptions(o: MakeOptions): void {
	if (!NAME_RE.test(o.name)) fail(`--name must match ${NAME_RE}`);
	if (o.instruction.trim().length === 0) fail("--instruction must not be empty");
	if (o.instruction.includes("\u0000")) fail("--instruction must not contain NUL");
	if (o.testCommand.trim().length === 0) fail("--test-command must not be empty");
	if (/[\u0000\n\r]/.test(o.testCommand)) fail("--test-command must not contain NUL or newline");
	if (o.testGlobs.length === 0) fail("at least one --test-glob is required");
	for (const g of o.testGlobs) assertSafeRelPath(g, "--test-glob");
	if (!/^[^\s\u0000]+$/.test(o.baseImage)) fail("--base-image must be a single token without whitespace");
	assertSafeRef(o.base);
	assertSafeRef(o.fix);
}

async function resolveCommit(git: VcsGitRepo, ref: string): Promise<string> {
	return (await git.resolveRef(`${ref}^{commit}`)) ?? fail(`cannot resolve ref ${ref}`);
}

async function writeFixedFile(
	git: VcsGitRepo,
	fix: string,
	rel: string,
	destRoot: string,
	mode: number,
): Promise<void> {
	const blob = await git.showBlob(`${fix}:${rel}`);
	if (blob.truncated) fail(`blob ${rel} truncated`);
	const dest = path.join(destRoot, rel);
	await fs.mkdir(path.dirname(dest), { recursive: true });
	await Bun.write(dest, blob.data);
	await fs.chmod(dest, mode);
}

/**
 * Materialize the full `base` tree into `dest`. `@oh-my-pi/pi-natives/vcs` exposes blob reads but not
 * `git archive`, and per-blob writes would drop file modes and symlinks the Docker image needs, so this
 * is the one raw git spawn (read-only, fixed argv, no shell).
 */
async function archiveBase(repo: string, base: string, dest: string): Promise<void> {
	await fs.mkdir(dest, { recursive: true });
	const archive = Bun.spawn(["git", "-C", repo, "archive", "--format=tar", base], { stdout: "pipe", stderr: "pipe" });
	const extract = Bun.spawn(["tar", "-x", "-C", dest], { stdin: archive.stdout, stdout: "ignore", stderr: "pipe" });
	const [archiveErr, extractErr, archiveCode, extractCode] = await Promise.all([
		archive.stderr.text(),
		extract.stderr.text(),
		archive.exited,
		extract.exited,
	]);
	if (archiveCode !== 0 || extractCode !== 0)
		fail(`failed to archive ${base}: ${archiveErr.trim()} ${extractErr.trim()}`);
}

export async function makeTask(o: MakeOptions): Promise<TaskMeta> {
	validateOptions(o);
	const repo = path.resolve(o.repo);
	const git = vcs.git(repo) ?? fail(`${repo} is not a git repository`);
	if (await git.isDirty()) fail(`repo ${repo} is dirty; commit or stash first`);
	const base = await resolveCommit(git, o.base);
	const fix = await resolveCommit(git, o.fix);
	if (base === fix) fail("--base and --fix resolve to the same commit");
	if ((await git.commitDetails(fix)).parents.length > 1) fail(`fix commit ${fix} is a merge commit`);

	const globs = o.testGlobs.map(g => new Bun.Glob(g));
	const testFiles: string[] = [];
	const solutionFiles: string[] = [];
	const deletedFiles: string[] = [];
	for (const file of await git.changedFiles({ base, head: fix })) {
		assertSafeRelPath(file, "changed file");
		const deleted = (await git.lsTree(fix, [file])).length === 0;
		if (globs.some(g => g.match(file))) {
			if (!deleted) testFiles.push(file);
		} else if (deleted) {
			deletedFiles.push(file);
		} else {
			solutionFiles.push(file);
		}
	}
	if (testFiles.length === 0) fail("no changed files match --test-glob between base and fix");
	if (solutionFiles.length + deletedFiles.length === 0) fail("fix changes only test files; no solution to verify");

	const modes = await readFixedModes(repo, fix, [...testFiles, ...solutionFiles]);
	const out = path.resolve(o.output);
	const existing = await fs.readdir(out).catch(() => null);
	if (existing && existing.length > 0) fail(`output ${out} exists and is not empty`);
	await fs.mkdir(path.join(out, "tests", "files"), { recursive: true });
	await fs.mkdir(path.join(out, "solution", "files"), { recursive: true });
	await archiveBase(repo, base, path.join(out, "environment", "repo"));

	await Bun.write(path.join(out, "task.toml"), taskToml(o.name));
	await Bun.write(path.join(out, "instruction.md"), `${o.instruction.trim()}\n`);
	await Bun.write(path.join(out, "environment", "Dockerfile"), dockerfile(o.baseImage));
	await Bun.write(path.join(out, "tests", "test.sh"), TEST_SH);
	await Bun.write(path.join(out, "tests", "command.txt"), `${o.testCommand}\n`);
	await Bun.write(path.join(out, "solution", "solve.sh"), SOLVE_SH);
	await Bun.write(path.join(out, "solution", "deleted.txt"), deletedFiles.map(f => `${f}\n`).join(""));
	await fs.chmod(path.join(out, "tests", "test.sh"), 0o755);
	await fs.chmod(path.join(out, "solution", "solve.sh"), 0o755);
	for (const f of testFiles) await writeFixedFile(git, fix, f, path.join(out, "tests", "files"), modes[f]);
	for (const f of solutionFiles) await writeFixedFile(git, fix, f, path.join(out, "solution", "files"), modes[f]);

	const meta: TaskMeta = { base, fix, testFiles, solutionFiles, deletedFiles };
	await Bun.write(path.join(out, META_FILE), `${JSON.stringify(meta, null, 2)}\n`);
	return meta;
}
