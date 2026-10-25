import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const cli = path.resolve(import.meta.dir, "../../src/cli.ts");
const GIT = ["-c", "user.name=Probe", "-c", "user.email=probe@example.invalid", "-c", "commit.gpgsign=false"];

describe.skipIf(process.platform === "win32")("worktree add modes", () => {
	let root: string;
	let repo: string;
	let first: string;
	let second: string;

	async function git(...args: string[]): Promise<string> {
		return (await $`git -C ${repo} ${GIT} ${args}`.text()).trim();
	}

	beforeEach(async () => {
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "omp-wt-modes-")));
		repo = path.join(root, "repo");
		await $`git init -q ${repo}`.quiet();
		await git("commit", "--allow-empty", "-qm", "first");
		first = await git("rev-parse", "HEAD");
		await git("commit", "--allow-empty", "-qm", "second");
		second = await git("rev-parse", "HEAD");
	});

	afterEach(async () => {
		await fs.rm(root, { recursive: true, force: true });
	});

	it("-B over an existing branch resets it to the given commit", async () => {
		await git("branch", "topic", second);
		const target = path.join(root, "reset");
		const result = await $`bun ${cli} worktree add -B topic ${target} ${first}`.cwd(repo).quiet().nothrow();
		expect(result.exitCode).toBe(0);
		expect(await git("rev-parse", "refs/heads/topic")).toBe(first);
		expect((await $`git -C ${target} rev-parse HEAD`.text()).trim()).toBe(first);
	});

	it("-b and -B together exit non-zero with no worktree", async () => {
		const target = path.join(root, "both");
		const result = await $`bun ${cli} worktree add -b one -B two ${target}`.cwd(repo).quiet().nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(await fs.stat(target).catch(() => undefined)).toBeUndefined();
		expect(await git("branch", "--list", "one", "two")).toBe("");
	});

	it("a missing derived branch is created at HEAD", async () => {
		const target = path.join(root, "derived");
		const result = await $`bun ${cli} worktree add ${target}`.cwd(repo).quiet().nothrow();
		expect(result.exitCode).toBe(0);
		expect(await git("rev-parse", "refs/heads/derived")).toBe(second);
		expect((await $`git -C ${target} rev-parse --abbrev-ref HEAD`.text()).trim()).toBe("derived");
	});
});
