import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { resolveResumeLocation } from "@oh-my-pi/pi-coding-agent/session/session-resume-location";
import { createSessionWorktree } from "@oh-my-pi/pi-coding-agent/session/session-worktree";
import { getConfigRootDir, removeSyncWithRetries, setAgentDir } from "@oh-my-pi/pi-utils";
import { $ } from "bun";
import { makeAssistantMessage } from "../session-manager/helpers";

/** Host git config (signing, hooks) must not leak into the fixture repos; worktrees stay under the temp root. */
const TEST_ENV_KEYS = [
	"GIT_CONFIG_GLOBAL",
	"GIT_CONFIG_NOSYSTEM",
	"GIT_AUTHOR_NAME",
	"GIT_AUTHOR_EMAIL",
	"GIT_COMMITTER_NAME",
	"GIT_COMMITTER_EMAIL",
	"OMP_WORKTREE_DIR",
] as const;

/**
 * Where a stored session reopens when a host asks from `requestCwd`: in its
 * own directory inside the same repository, moved into the request after its
 * worktree was removed, or refused.
 */
describe.skipIf(process.platform === "win32")("resume location", () => {
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
	const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map(key => [key, process.env[key]]));
	let root: string;
	let repo: string;
	let worktree: string;

	beforeEach(async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-resume-loc-")));
		Object.assign(process.env, {
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "test@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "test@example.com",
			OMP_WORKTREE_DIR: path.join(root, "wt-base"),
		});
		setAgentDir(path.join(root, "agent"));
		repo = path.join(root, "repo");
		fs.mkdirSync(repo, { recursive: true });
		await $`git init -q && git commit -q --allow-empty -m init`.cwd(repo).quiet();
		worktree = path.join(repo, ".worktrees", "a");
		await $`git worktree add -q -b a ${worktree}`.cwd(repo).quiet();
	});

	afterEach(() => {
		if (originalAgentDir) {
			setAgentDir(originalAgentDir);
		} else {
			setAgentDir(path.join(getConfigRootDir(), "agent"));
			delete process.env.PI_CODING_AGENT_DIR;
		}
		for (const key of TEST_ENV_KEYS) {
			if (originalEnv[key] === undefined) delete process.env[key];
			else process.env[key] = originalEnv[key];
		}
		removeSyncWithRetries(root);
	});

	/** A persisted session recorded in `cwd`. */
	async function storedSession(cwd: string): Promise<{ path: string; cwd: string }> {
		fs.mkdirSync(cwd, { recursive: true });
		const session = SessionManager.create(cwd);
		session.appendMessage({ role: "user", content: `work in ${cwd}`, timestamp: 1 });
		session.appendMessage(makeAssistantMessage());
		await session.flush();
		await session.close();
		return { path: session.getSessionFile()!, cwd };
	}

	/** A persisted session recorded in `cwd`, whose directory is deleted afterwards. */
	async function sessionOfDeletedDir(cwd: string): Promise<{ path: string; cwd: string }> {
		const session = await storedSession(cwd);
		fs.rmSync(cwd, { recursive: true });
		return session;
	}

	it("resume location: an old session without a recorded directory opens at the request", async () => {
		const session = { path: path.join(root, "old.jsonl"), cwd: "" };
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "open", cwd: repo });
	});

	it("resume location: the same directory opens at the recorded spelling", async () => {
		expect(await resolveResumeLocation(await storedSession(repo), repo)).toEqual({ kind: "open", cwd: repo });
	});

	it("resume location: a linked worktree session opens in the worktree from the primary checkout", async () => {
		expect(await resolveResumeLocation(await storedSession(worktree), repo)).toEqual({ kind: "open", cwd: worktree });
	});

	it("resume location: a primary checkout session opens in the primary checkout from a worktree", async () => {
		expect(await resolveResumeLocation(await storedSession(repo), worktree)).toEqual({ kind: "open", cwd: repo });
	});

	it("resume location: a symlinked spelling of the request directory opens at the recorded spelling", async () => {
		const link = path.join(root, "link-a");
		fs.symlinkSync(worktree, link);
		const session = await storedSession(link);
		expect(await resolveResumeLocation(session, worktree)).toEqual({ kind: "open", cwd: link });
	});

	it("resume location: a pruned .worktrees session relocates into the request", async () => {
		const session = await storedSession(worktree);
		await $`git worktree remove --force ${worktree} && git worktree prune`.cwd(repo).quiet();
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "relocate", from: worktree, to: repo });
	});

	it("resume location: a removed agent-managed /wt worktree session relocates into the request", async () => {
		const { path: managed } = await createSessionWorktree(repo, Settings.isolated(), "wt/gone");
		const session = await storedSession(managed);
		await $`git worktree remove --force ${managed} && git worktree prune`.cwd(repo).quiet();
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "relocate", from: managed, to: repo });
	});

	it("resume location: a deleted directory inside a live worktree is refused as missing", async () => {
		const gone = path.join(worktree, "pkg", "old");
		const session = await sessionOfDeletedDir(gone);
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "refuse", recordedCwd: gone, missing: true });
	});

	it("resume location: a deleted plain subdirectory of the checkout is refused as missing", async () => {
		const gone = path.join(repo, "pkg", "old");
		const session = await sessionOfDeletedDir(gone);
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "refuse", recordedCwd: gone, missing: true });
	});

	it("resume location: a checkout of another repository is refused", async () => {
		const other = path.join(root, "other");
		fs.mkdirSync(other);
		await $`git init -q && git commit -q --allow-empty -m init`.cwd(other).quiet();
		const session = await storedSession(other);
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "refuse", recordedCwd: other, missing: false });
	});

	it("resume location: a missing directory outside the repository is refused as missing", async () => {
		const gone = path.join(root, "gone");
		const session = await sessionOfDeletedDir(gone);
		expect(await resolveResumeLocation(session, repo)).toEqual({ kind: "refuse", recordedCwd: gone, missing: true });
	});

	it("resume location: a differing directory is refused when the request is outside any repository", async () => {
		const plain = path.join(root, "plain");
		const elsewhere = path.join(root, "elsewhere");
		fs.mkdirSync(elsewhere);
		const session = await storedSession(plain);
		expect(await resolveResumeLocation(session, elsewhere)).toEqual({
			kind: "refuse",
			recordedCwd: plain,
			missing: false,
		});
	});
});
