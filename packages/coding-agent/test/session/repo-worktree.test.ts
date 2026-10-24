import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { Settings } from "../../src/config/settings";
import { addRepoWorktree } from "../../src/session/session-worktree";
import { cfgWorktreeRepoDir, resolveRepoWorktreeDir } from "../../src/task/settings";

const GIT = ["-c", "user.name=Probe", "-c", "user.email=probe@example.invalid", "-c", "commit.gpgsign=false"];

describe.skipIf(process.platform === "win32")("repo worktree", () => {
	let root: string;
	let repo: string;
	let first: string;
	let second: string;

	async function git(...args: string[]): Promise<string> {
		return (await $`git -C ${repo} ${GIT} ${args}`.text()).trim();
	}

	beforeEach(async () => {
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "omp-repo-wt-")));
		repo = path.join(root, "repo");
		await $`git init -q ${repo}`.quiet();
		await Bun.write(path.join(repo, "a.txt"), "one\n");
		await git("add", "a.txt");
		await git("commit", "-qm", "first");
		first = await git("rev-parse", "HEAD");
		await Bun.write(path.join(repo, "a.txt"), "two\n");
		await git("commit", "-qam", "second");
		second = await git("rev-parse", "HEAD");
	});

	afterEach(async () => {
		await fs.rm(root, { recursive: true, force: true });
	});

	function run(
		target: string,
		checkout: Parameters<typeof addRepoWorktree>[0]["checkout"],
		settings = Settings.isolated(),
	) {
		return addRepoWorktree({ repository: vcs.requireGit(repo), path: target, checkout, settings });
	}

	it("new-branch from an explicit commit checks the branch out at that commit", async () => {
		const target = path.join(root, "wt-new");
		const result = await run(target, { kind: "new-branch", name: "feat/x", from: first, force: false });
		expect(result.createdBranch).toBe("feat/x");
		expect(result.detached).toBe(false);
		expect(result.ref).toBe("feat/x");
		expect(result.commit.sha).toBe(first);
		expect(await $`git -C ${target} rev-parse --abbrev-ref HEAD`.text()).toBe("feat/x\n");
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${first}\n`);
	});

	it("new-branch with force resets an existing branch to from", async () => {
		await git("branch", "feat/y", second);
		const target = path.join(root, "wt-force");
		const result = await run(target, { kind: "new-branch", name: "feat/y", from: first, force: true });
		expect(result.createdBranch).toBe("feat/y");
		expect(await git("rev-parse", "refs/heads/feat/y")).toBe(first);
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${first}\n`);
	});

	it("ref with detach checks the commit out detached", async () => {
		const target = path.join(root, "wt-detached");
		const result = await run(target, { kind: "ref", ref: first, detach: true });
		expect(result.detached).toBe(true);
		expect(result.createdBranch).toBeUndefined();
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${first}\n`);
		expect((await $`git -C ${target} symbolic-ref -q HEAD`.quiet().nothrow()).exitCode).not.toBe(0);
	});

	it("non-empty target is refused and nothing is created", async () => {
		const target = path.join(root, "wt-busy");
		await Bun.write(path.join(target, "keep.txt"), "x\n");
		await expect(run(target, { kind: "new-branch", name: "feat/busy", from: first, force: false })).rejects.toThrow(
			/already exists/,
		);
		expect(await git("branch", "--list", "feat/busy")).toBe("");
		expect(await fs.readdir(target)).toEqual(["keep.txt"]);
	});

	it("non-zero post-checkout hook is reported and the worktree is kept", async () => {
		const hooks = path.join(repo, ".git", "hooks");
		await $`git -C ${repo} config core.hooksPath ${hooks}`.quiet();
		const file = path.join(hooks, "post-checkout");
		await Bun.write(file, "#!/bin/sh\necho hook-out; echo hook-err >&2; exit 17\n");
		await fs.chmod(file, 0o755);
		const target = path.join(root, "wt-hook");
		const result = await run(target, { kind: "ref", ref: first, detach: true });
		expect(result.hook.exitCode).toBe(17);
		// git routes a hook's stdout to stderr.
		expect(result.hook.stderr).toContain("hook-out");
		expect(result.hook.stderr).toContain("hook-err");
		expect(await Bun.file(path.join(target, "a.txt")).exists()).toBe(true);
	});

	it("in-repo target does not copy sibling worktrees", async () => {
		const settings = Settings.isolated({ "worktree.clone": true });
		const a = path.join(repo, ".worktrees", "a");
		const b = path.join(repo, ".worktrees", "b");
		await fs.mkdir(path.dirname(a), { recursive: true });
		await run(a, { kind: "new-branch", name: "wt-a", from: first, force: false }, settings);
		await Bun.write(path.join(a, "untracked-a.txt"), "sibling\n");
		const result = await run(b, { kind: "new-branch", name: "wt-b", from: first, force: false }, settings);
		expect(result.clonedWith).toBeUndefined();
		expect(result.cloneError).toContain("inside the source checkout");
		expect(await Bun.file(path.join(b, "a.txt")).exists()).toBe(true);
		expect(await fs.readdir(b)).not.toContain(".worktrees");
		expect(await Bun.file(path.join(b, ".worktrees", "a", "untracked-a.txt")).exists()).toBe(false);
	});
});

describe("worktree repoDir", () => {
	it("defaults to .worktrees", () => {
		expect(cfgWorktreeRepoDir.get(Settings.isolated())).toBe(".worktrees");
		expect(resolveRepoWorktreeDir(".worktrees")).toEqual({ ok: true, dir: ".worktrees" });
	});

	it("accepts a valid nested value", () => {
		expect(resolveRepoWorktreeDir("wt/agents")).toEqual({ ok: true, dir: "wt/agents" });
	});

	for (const value of ["/tmp/wt", "~/wt", "C:wt", "a\\b", "../wt", "a/../../wt", "./wt", "a//b", "", "a\0b"]) {
		it(`rejects ${JSON.stringify(value)} naming the setting`, () => {
			const result = resolveRepoWorktreeDir(value);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("worktree.repoDir");
				expect(result.error).toContain(JSON.stringify(value));
			}
		});
	}
});
