/**
 * `omp --resume <id>` of a session whose recorded directory is gone: a removed
 * `.worktrees/<slug>` of the current checkout's repository moves into the
 * checkout without a prompt; any other missing directory still needs the
 * interactive prompt and fails without a TTY.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Args } from "@oh-my-pi/pi-coding-agent/cli/args";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { createSessionManager } from "@oh-my-pi/pi-coding-agent/main";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { getConfigRootDir, removeSyncWithRetries, setAgentDir } from "@oh-my-pi/pi-utils";
import { $ } from "bun";
import { makeAssistantMessage } from "./session-manager/helpers";

const TEST_ENV_KEYS = [
	"GIT_CONFIG_GLOBAL",
	"GIT_CONFIG_NOSYSTEM",
	"GIT_AUTHOR_NAME",
	"GIT_AUTHOR_EMAIL",
	"GIT_COMMITTER_NAME",
	"GIT_COMMITTER_EMAIL",
] as const;

describe.skipIf(process.platform === "win32")("cli resume of a session from a missing directory", () => {
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
	const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map(key => [key, process.env[key]]));
	let root: string;
	let repo: string;
	let worktree: string;
	let prompts: string[];

	beforeEach(async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-cli-resume-wt-")));
		Object.assign(process.env, {
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "test@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "test@example.com",
		});
		setAgentDir(path.join(root, "agent"));
		repo = path.join(root, "repo");
		fs.mkdirSync(repo, { recursive: true });
		await $`git init -q && git commit -q --allow-empty -m init`.cwd(repo).quiet();
		worktree = path.join(repo, ".worktrees", "a");
		await $`git worktree add -q -b a ${worktree}`.cwd(repo).quiet();
		prompts = [];
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

	/** A persisted session recorded in `cwd`; returns its id and file. */
	async function storedSession(cwd: string): Promise<{ id: string; file: string }> {
		fs.mkdirSync(cwd, { recursive: true });
		const session = SessionManager.create(cwd);
		session.appendMessage({ role: "user", content: `work in ${cwd}`, timestamp: 1 });
		session.appendMessage(makeAssistantMessage());
		await session.flush();
		await session.close();
		return { id: session.getSessionId(), file: session.getSessionFile()! };
	}

	/** `omp --resume <id prefix>` in the primary checkout, without a TTY for the move prompt. */
	function resumeInRepo(id: string): Promise<SessionManager | undefined> {
		const args: Args = {
			resume: id.slice(0, 13),
			messages: [],
			fileArgs: [],
			unknownFlags: new Map(),
			unrecognizedFlags: [],
			invalidFlagValues: [],
		};
		return createSessionManager(args, repo, Settings.isolated({ "marketplace.autoUpdate": "off" }), async session => {
			prompts.push(session.id);
			return "unavailable";
		});
	}

	it("cli resume: a removed .worktrees session moves into the checkout without asking", async () => {
		const { id } = await storedSession(worktree);
		await $`git worktree remove --force ${worktree} && git worktree prune`.cwd(repo).quiet();

		const manager = await resumeInRepo(id);
		if (!manager) throw new Error("Expected a resumed session manager");
		try {
			expect(manager.getCwd()).toBe(repo);
			expect(path.dirname(manager.getSessionFile()!)).toBe(SessionManager.getDefaultSessionDir(repo));
			expect(prompts).toEqual([]);
		} finally {
			await manager.close();
		}
	});

	for (const [name, dir] of [
		["a deleted directory inside a live worktree", () => path.join(worktree, "pkg", "old")],
		["a deleted plain subdirectory", () => path.join(repo, "pkg", "old")],
		["a missing directory outside the repository", () => path.join(root, "gone")],
	] as const) {
		it(`cli resume: ${name} still fails without a TTY`, async () => {
			const gone = dir();
			const { id, file } = await storedSession(gone);
			fs.rmSync(gone, { recursive: true });
			const before = fs.readFileSync(file, "utf8");

			await expect(resumeInRepo(id)).rejects.toThrow("belongs to a directory that no longer exists");
			expect(fs.readFileSync(file, "utf8")).toBe(before);
		});
	}
});
