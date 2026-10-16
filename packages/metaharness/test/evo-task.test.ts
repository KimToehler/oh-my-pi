import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseMakeArgs } from "../scripts/evo-task";
import { type MakeOptions, makeTask } from "../scripts/evo-task-make";
import { verifyTask } from "../scripts/evo-task-verify";

let tmp = "";

async function sh(cwd: string, ...cmd: string[]): Promise<string> {
	const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
	if (code !== 0) throw new Error(`${cmd.join(" ")} failed: ${err}`);
	return out.trim();
}

async function commit(
	repo: string,
	files: Record<string, string>,
	message: string,
	remove: string[] = [],
	executable: string[] = [],
	symlinks: Record<string, string> = {},
) {
	for (const [rel, content] of Object.entries(files)) {
		await fs.mkdir(path.dirname(path.join(repo, rel)), { recursive: true });
		await Bun.write(path.join(repo, rel), content);
	}
	for (const rel of executable) await fs.chmod(path.join(repo, rel), 0o755);
	for (const [rel, target] of Object.entries(symlinks)) {
		await fs.mkdir(path.dirname(path.join(repo, rel)), { recursive: true });
		await fs.symlink(target, path.join(repo, rel));
	}
	for (const rel of remove) await fs.rm(path.join(repo, rel));
	await sh(repo, "git", "add", "-A");
	await sh(repo, "git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", message);
	return sh(repo, "git", "rev-parse", "HEAD");
}

interface Fixture {
	repo: string;
	base: string;
	fix: string;
}

async function makeRepo(): Promise<Fixture> {
	const repo = path.join(tmp, "repo");
	await fs.mkdir(repo);
	await sh(repo, "git", "init", "-q", "-b", "main");
	const base = await commit(
		repo,
		{ "src/value.txt": "broken\n", "src/old.txt": "obsolete\n", "README.md": "readme\n" },
		"base",
	);
	const fix = await commit(
		repo,
		{
			"src/value.txt": "fixed\n",
			"tests/check.sh": "#!/usr/bin/env bash\ngrep -qx fixed src/value.txt && [ ! -e src/old.txt ]\n",
		},
		"fix",
		["src/old.txt"],
	);
	return { repo, base, fix };
}

function opts(f: Fixture, over: Partial<MakeOptions> = {}): MakeOptions {
	return {
		repo: f.repo,
		base: f.base,
		fix: f.fix,
		name: "synthetic",
		instruction: "Make src/value.txt contain `fixed` and delete src/old.txt.",
		testCommand: "bash tests/check.sh",
		testGlobs: ["tests/**"],
		baseImage: "debian:stable-slim",
		output: path.join(tmp, "out"),
		...over,
	};
}

beforeEach(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), "evo-task-test-"));
});
afterEach(async () => {
	await fs.rm(tmp, { recursive: true, force: true });
});

describe("evo-task make", () => {
	it("emits Harbor 1.3 layout with hidden tests and solution split", async () => {
		const f = await makeRepo();
		const meta = await makeTask(opts(f));
		const out = path.join(tmp, "out");
		expect(meta.testFiles).toEqual(["tests/check.sh"]);
		expect(meta.solutionFiles).toEqual(["src/value.txt"]);
		expect(meta.deletedFiles).toEqual(["src/old.txt"]);

		const toml = await Bun.file(path.join(out, "task.toml")).text();
		expect(toml).toContain('schema_version = "1.3"');
		expect(toml).toContain('[verifier]\ntimeout_sec = 900.0\nnetwork_mode = "no-network"');
		expect(toml).toContain('[environment]\nbuild_timeout_sec = 900.0\nnetwork_mode = "public"');
		expect(toml).not.toContain("[verifier.environment]");
		expect(await Bun.file(path.join(out, "instruction.md")).text()).toContain("src/value.txt");
		const dockerfile = await Bun.file(path.join(out, "environment", "Dockerfile")).text();
		expect(dockerfile).toContain("FROM debian:stable-slim");
		expect(dockerfile).toContain("COPY repo/ /workspace/repo/");
		expect(await Bun.file(path.join(out, "tests", "test.sh")).text()).toContain("/logs/verifier");
		expect(await Bun.file(path.join(out, "tests", "test.sh")).text()).toContain("reward.txt");
		expect(await Bun.file(path.join(out, "tests", "files", "tests", "check.sh")).exists()).toBe(true);
		expect(await Bun.file(path.join(out, "solution", "files", "src", "value.txt")).text()).toBe("fixed\n");

		// Full base snapshot lives only under environment/repo; fix-only content never leaks into it.
		const snap = path.join(out, "environment", "repo");
		expect(await Bun.file(path.join(snap, "README.md")).text()).toBe("readme\n");
		expect(await Bun.file(path.join(snap, "src", "value.txt")).text()).toBe("broken\n");
		expect(await Bun.file(path.join(snap, "src", "old.txt")).exists()).toBe(true);
		expect(await Bun.file(path.join(snap, "tests", "check.sh")).exists()).toBe(false);
		const all = (await fs.readdir(out, { recursive: true })).map(p => p.toString());
		expect(all.some(p => p.includes("README.md") && !p.startsWith("environment/repo/"))).toBe(false);
		expect(all.some(p => p.startsWith("solution/files/tests"))).toBe(false);
		expect(
			all.some(
				p => p.startsWith("environment/") && !p.startsWith("environment/repo") && p !== "environment/Dockerfile",
			),
		).toBe(false);
	});

	it("verify: reward 0 before solution, 1 after", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		const result = await verifyTask(path.join(tmp, "out"));
		expect(result).toEqual({ before: 0, after: 1 });
	});

	it("verify rejects a task whose solution does not fix the tests (GREEN discriminates)", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		await fs.rm(path.join(tmp, "out", "solution", "files", "src", "value.txt"));
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/GREEN check failed/);
	});

	it("verify rejects a task that already passes before solution (RED discriminates)", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		await Bun.write(path.join(tmp, "out", "tests", "command.txt"), "true\n");
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/RED check failed/);
	});

	it("rejects identical refs", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { fix: f.base }))).rejects.toThrow(/same commit/);
	});

	it("rejects merge fix commits", async () => {
		const f = await makeRepo();
		await sh(f.repo, "git", "checkout", "-q", "-b", "side", f.base);
		await commit(f.repo, { "side.txt": "s\n" }, "side");
		await sh(f.repo, "git", "checkout", "-q", "main");
		await sh(
			f.repo,
			"git",
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"merge",
			"-q",
			"--no-ff",
			"-m",
			"merge",
			"side",
		);
		const merge = await sh(f.repo, "git", "rev-parse", "HEAD");
		await expect(makeTask(opts(f, { fix: merge }))).rejects.toThrow(/merge commit/);
	});

	it("rejects when no changed file matches a test glob", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testGlobs: ["nomatch/**"] }))).rejects.toThrow(/no changed files match/);
	});

	it("rejects when every changed file is a hidden test (no solution to ship)", async () => {
		const f = await makeRepo();
		// Globs claim all changed files, so tests and solution cannot be separated.
		await expect(makeTask(opts(f, { testGlobs: ["tests/**", "src/value.txt", "src/old.txt"] }))).rejects.toThrow(
			/no solution/,
		);
	});

	it("rejects dirty repo", async () => {
		const f = await makeRepo();
		await Bun.write(path.join(f.repo, "untracked.txt"), "x");
		await expect(makeTask(opts(f))).rejects.toThrow(/dirty/);
	});

	it("rejects traversal and absolute globs", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testGlobs: ["../x"] }))).rejects.toThrow(/traversal/);
		await expect(makeTask(opts(f, { testGlobs: ["/etc/passwd"] }))).rejects.toThrow(/absolute/);
	});

	it("rejects NUL/newline in test command", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testCommand: "true\nrm -rf /" }))).rejects.toThrow(/NUL or newline/);
		await expect(makeTask(opts(f, { testCommand: "true\u0000" }))).rejects.toThrow(/NUL or newline/);
	});

	it("parseMakeArgs requires every flag and accepts repeated --test-glob", () => {
		const base = [
			"--repo",
			"r",
			"--base",
			"b",
			"--fix",
			"f",
			"--name",
			"n",
			"--instruction",
			"i",
			"--test-command",
			"c",
			"--test-glob",
			"a",
			"--test-glob",
			"b",
			"--base-image",
			"img",
			"--output",
			"o",
		];
		expect(parseMakeArgs(base).testGlobs).toEqual(["a", "b"]);
		expect(() => parseMakeArgs(base.slice(2))).toThrow(/--repo is required/);
	});
});

describe("evo-task git file modes", () => {
	async function execRepo(): Promise<Fixture> {
		const repo = path.join(tmp, "repo");
		await fs.mkdir(repo);
		await sh(repo, "git", "init", "-q", "-b", "main");
		const base = await commit(repo, { "README.md": "readme\n" }, "base");
		const fix = await commit(
			repo,
			{
				"src/tool.sh": "#!/usr/bin/env bash\necho ok > out.txt\n",
				"src/data.txt": "plain\n",
				"tests/check.sh": "#!/usr/bin/env bash\n./src/tool.sh && grep -qx ok out.txt\n",
			},
			"fix",
			[],
			["src/tool.sh", "tests/check.sh"],
		);
		return { repo, base, fix };
	}

	it("preserves executable bit on hidden tests and solution files; verify runs 0 then 1", async () => {
		const f = await execRepo();
		await makeTask(opts(f, { testCommand: "./tests/check.sh" }));
		const out = path.join(tmp, "out");
		const mode = async (rel: string): Promise<number> => (await fs.stat(path.join(out, rel))).mode & 0o111;
		expect(await mode("tests/files/tests/check.sh")).not.toBe(0);
		expect(await mode("solution/files/src/tool.sh")).not.toBe(0);
		expect(await mode("solution/files/src/data.txt")).toBe(0);
		expect(await verifyTask(out)).toEqual({ before: 0, after: 1 });
	});

	it("rejects symlink tree entries in the fixed snapshot", async () => {
		const f = await execRepo();
		const fix = await commit(f.repo, {}, "link", [], [], { "src/link": "data.txt" });
		await expect(makeTask(opts(f, { fix, testCommand: "./tests/check.sh" }))).rejects.toThrow(/symlink|non-regular/);
	});
});

describe("example descriptor", () => {
	it("read-limited-text pins the planned refs, hidden test, and command", async () => {
		const d: unknown = await Bun.file(path.join(import.meta.dir, "fixtures/evo-task/read-limited-text.json")).json();
		expect(d).toMatchObject({
			base: "63b339b814^",
			fix: "63b339b814",
			testCommand: "bun test packages/coding-agent/test/web/search/read-limited-text.test.ts",
			testGlobs: ["packages/coding-agent/test/web/search/read-limited-text.test.ts"],
		});
	});
});
