import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolContext } from "@oh-my-pi/pi-agent-core";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async/job-manager";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { BUILTIN_TOOLS, type ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { createMockModel, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionMoveTool } from "@oh-my-pi/pi-coding-agent/tools/session-move";

const GIT = ["-c", "user.name=Probe", "-c", "user.email=probe@example.invalid", "-c", "commit.gpgsign=false"];

function textOf(result: { content?: ReadonlyArray<{ type: string; text?: string }> }): string {
	return (result.content ?? []).map(block => (block.type === "text" ? (block.text ?? "") : "")).join("\n");
}

async function exists(target: string): Promise<boolean> {
	try {
		await fs.lstat(target);
		return true;
	} catch {
		return false;
	}
}

interface StubOptions {
	settings?: Record<string, unknown>;
	relocator?: boolean;
	pending?: () => boolean;
	asyncJobManager?: AsyncJobManager;
	agentRegistry?: AgentRegistry;
	agentId?: string;
	sessionFile?: string | null;
}

describe.skipIf(process.platform === "win32")("session_move", () => {
	let root: string;
	let repo: string;
	let first: string;
	let second: string;
	const requests: string[] = [];
	const cleanup: Array<() => Promise<void> | void> = [];

	async function git(...args: string[]): Promise<string> {
		return (await $`git -C ${repo} ${GIT} ${args}`.text()).trim();
	}

	async function initRepo(dir: string): Promise<void> {
		await $`git init -q ${dir}`.quiet();
		await Bun.write(path.join(dir, "a.txt"), "one\n");
		await $`git -C ${dir} ${GIT} add a.txt`.quiet();
		await $`git -C ${dir} ${GIT} commit -qm first`.quiet();
	}

	beforeEach(async () => {
		requests.length = 0;
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "omp-session-move-")));
		repo = path.join(root, "repo");
		await initRepo(repo);
		first = await git("rev-parse", "HEAD");
		await Bun.write(path.join(repo, "a.txt"), "two\n");
		await git("commit", "-qam", "second");
		second = await git("rev-parse", "HEAD");
	});

	afterEach(async () => {
		for (const fn of cleanup.splice(0)) await fn();
		await fs.rm(root, { recursive: true, force: true });
	});

	function stub(cwd: string, options: StubOptions = {}): ToolSession {
		return {
			cwd,
			settings: Settings.isolated({ "worktree.clone": false, ...options.settings }),
			taskDepth: 0,
			sessionRelocation: true,
			getSessionFile: () =>
				options.sessionFile === undefined ? path.join(root, "sessions", "s.jsonl") : options.sessionFile,
			getAgentId: () => options.agentId ?? "Main",
			asyncJobManager: options.asyncJobManager,
			agentRegistry: options.agentRegistry ?? new AgentRegistry(),
			requestSessionMove: (request: { path: string }) => {
				if (options.relocator === false) return false;
				requests.push(request.path);
				return true;
			},
			hasPendingSessionMove: options.pending,
		} as unknown as ToolSession;
	}

	function toolFor(cwd: string, options: StubOptions = {}): SessionMoveTool {
		const tool = SessionMoveTool.createIf(stub(cwd, options));
		if (!tool) throw new Error("session_move tool was not built");
		return tool;
	}

	async function branches(): Promise<string> {
		return git("branch", "--list");
	}

	async function expectRefused(
		args: { path: string; branch?: string; base?: string },
		pattern: RegExp,
		options: StubOptions = {},
	): Promise<void> {
		const before = await branches();
		await expect(toolFor(repo, options).execute("call", args)).rejects.toThrow(pattern);
		expect(requests).toEqual([]);
		expect(await branches()).toBe(before);
	}

	it("session_move: a fresh repository without .worktrees gets the directory and a branch from the primary HEAD", async () => {
		const target = path.join(repo, ".worktrees", "feat");
		expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
		const result = await toolFor(repo).execute("call", { path: target, branch: "feat" });
		expect(requests).toEqual([target]);
		expect(result.stopAfterBatch).toBe(true);
		expect(textOf(result)).toContain(target);
		expect(await $`git -C ${target} rev-parse --abbrev-ref HEAD`.text()).toBe("feat\n");
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${second}\n`);
	});

	it("session_move: a relative path resolves from the session cwd", async () => {
		const result = await toolFor(repo).execute("call", { path: ".worktrees/rel", branch: "rel" });
		expect(requests).toEqual([path.join(repo, ".worktrees", "rel")]);
		expect(result.stopAfterBatch).toBe(true);
	});

	it("session_move: the default base is the primary checkout HEAD, not the session's HEAD", async () => {
		await git("branch", "old", first);
		const oldWorktree = path.join(root, "old-wt");
		await git("worktree", "add", oldWorktree, "old");
		const target = path.join(repo, ".worktrees", "from-primary");
		await toolFor(oldWorktree).execute("call", { path: target, branch: "from-primary" });
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${second}\n`);
	});

	it("session_move: an explicit base is honoured", async () => {
		const target = path.join(repo, ".worktrees", "based");
		await toolFor(repo).execute("call", { path: target, branch: "based", base: first });
		expect(requests).toEqual([target]);
		expect(await $`git -C ${target} rev-parse HEAD`.text()).toBe(`${first}\n`);
	});

	it("session_move: an existing branch is checked out without detaching and is never reset", async () => {
		await git("branch", "keep", first);
		const target = path.join(repo, ".worktrees", "keep");
		await toolFor(repo).execute("call", { path: target, branch: "keep" });
		expect(requests).toEqual([target]);
		expect(await $`git -C ${target} rev-parse --abbrev-ref HEAD`.text()).toBe("keep\n");
		expect(await git("rev-parse", "refs/heads/keep")).toBe(first);
	});

	it("session_move: an existing branch plus base is refused with nothing created", async () => {
		await git("branch", "keep", first);
		const target = path.join(repo, ".worktrees", "keep");
		await expectRefused({ path: target, branch: "keep", base: second }, /base/);
		expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
	});

	it("session_move: a missing target without a branch is refused with nothing created", async () => {
		const target = path.join(repo, ".worktrees", "nobranch");
		await expectRefused({ path: target }, /branch/);
		expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
	});

	it("session_move: an unresolvable base is refused with nothing created", async () => {
		const target = path.join(repo, ".worktrees", "badbase");
		await expectRefused({ path: target, branch: "badbase", base: "no-such-ref" }, /base/);
		expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
	});

	it("session_move: the repository root and registered worktrees are accepted as they are", async () => {
		const linked = path.join(root, "linked");
		await git("worktree", "add", "-b", "linked", linked);
		const result = await toolFor(linked).execute("call", { path: repo });
		expect(result.stopAfterBatch).toBe(true);
		await toolFor(repo).execute("call", { path: linked });
		expect(requests).toEqual([repo, linked]);
	});

	it("session_move: a registered worktree reached through a symlink resolves to its real path", async () => {
		const linked = path.join(root, "linked");
		await git("worktree", "add", "-b", "linked", linked);
		const alias = path.join(root, "alias");
		await fs.symlink(linked, alias);
		await toolFor(repo).execute("call", { path: alias });
		expect(requests).toEqual([linked]);
	});

	it("session_move: a symlink to a registered worktree outside the main checkout is accepted", async () => {
		const external = path.join(root, "external-wt");
		await git("worktree", "add", "-b", "external", external);
		await fs.mkdir(path.join(repo, ".worktrees"));
		const link = path.join(repo, ".worktrees", "link");
		await fs.symlink(external, link);
		const result = await toolFor(repo).execute("call", { path: link });
		expect(result.stopAfterBatch).toBe(true);
		expect(requests).toEqual([await fs.realpath(external)]);
	});

	it("session_move: an existing directory that is not a registered worktree is refused", async () => {
		const stray = path.join(repo, ".worktrees", "stray");
		await fs.mkdir(stray, { recursive: true });
		await expectRefused({ path: stray, branch: "stray" }, /\/move/);
	});

	it("session_move: a session outside a git repository gets an error naming /move", async () => {
		const plain = path.join(root, "plain");
		await fs.mkdir(plain);
		await expect(toolFor(plain).execute("call", { path: repo })).rejects.toThrow(/git repository/);
		expect(requests).toEqual([]);
	});

	describe("negative controls", () => {
		it("session_move: a path outside the repository is refused", async () => {
			const elsewhere = path.join(root, "elsewhere");
			await expectRefused({ path: elsewhere, branch: "e" }, /\/move/);
			expect(await exists(elsewhere)).toBe(false);
		});

		it("session_move: another repository is refused", async () => {
			const other = path.join(root, "other");
			await initRepo(other);
			await expectRefused({ path: other }, /\/move/);
		});

		it("session_move: a nested target below the worktree directory is refused", async () => {
			await expectRefused({ path: path.join(repo, ".worktrees", "a", "b"), branch: "nested" }, /\/move/);
			expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
		});

		it("session_move: a symlink at the target is refused", async () => {
			await fs.mkdir(path.join(repo, ".worktrees"));
			const outside = path.join(root, "outside");
			await fs.mkdir(outside);
			const link = path.join(repo, ".worktrees", "link");
			await fs.symlink(outside, link);
			await expectRefused({ path: link, branch: "link" }, /\/move/);
			expect((await fs.readdir(outside)).length).toBe(0);
		});

		it("session_move: a dangling symlink at the target is refused", async () => {
			await fs.mkdir(path.join(repo, ".worktrees"));
			const link = path.join(repo, ".worktrees", "dangling");
			await fs.symlink(path.join(root, "not-there"), link);
			await expectRefused({ path: link, branch: "dangling" }, /\/move/);
			expect(await exists(path.join(root, "not-there"))).toBe(false);
		});

		it("session_move: .worktrees itself being a symlink out of the repository is refused", async () => {
			const outside = path.join(root, "outside");
			await fs.mkdir(outside);
			await fs.symlink(outside, path.join(repo, ".worktrees"));
			await expectRefused({ path: path.join(repo, ".worktrees", "esc"), branch: "esc" }, /\/move/);
			expect((await fs.readdir(outside)).length).toBe(0);
		});

		it("session_move: .worktrees being a file is refused", async () => {
			await Bun.write(path.join(repo, ".worktrees"), "file\n");
			await expectRefused({ path: path.join(repo, ".worktrees", "x"), branch: "x" }, /\/move/);
		});

		it("session_move: an intermediate worktree.repoDir component that is a symlink is refused", async () => {
			const outside = path.join(root, "outside");
			await fs.mkdir(outside);
			await fs.symlink(outside, path.join(repo, "a"));
			await expectRefused({ path: path.join(repo, "a", "b", "x"), branch: "x" }, /\/move/, {
				settings: { "worktree.repoDir": "a/b" },
			});
			expect((await fs.readdir(outside)).length).toBe(0);
		});
	});

	describe("worktree.repoDir", () => {
		it("session_move: a configured repoDir places new worktrees and creates its components", async () => {
			const target = path.join(repo, "wt", "nested", "x");
			await toolFor(repo, { settings: { "worktree.repoDir": "wt/nested" } }).execute("call", {
				path: target,
				branch: "x",
			});
			expect(requests).toEqual([target]);
		});

		for (const [label, value] of [
			["absolute", () => path.join(root, "abs-wt")],
			["home-relative", () => "~/wt"],
			["parent", () => "../wt"],
			["embedded parent", () => "a/../../wt"],
		] as const) {
			it(`session_move: a ${label} worktree.repoDir is refused naming the setting and creates nothing`, async () => {
				const rootBefore = await fs.readdir(root);
				const repoBefore = await fs.readdir(repo);
				const target = path.join(repo, ".worktrees", "x");
				await expectRefused({ path: target, branch: "x" }, /worktree\.repoDir/, {
					settings: { "worktree.repoDir": value() },
				});
				expect(await fs.readdir(root)).toEqual(rootBefore);
				expect(await fs.readdir(repo)).toEqual(repoBefore);
			});
		}

		it("session_move: an invalid worktree.repoDir does not block a move to an existing registered target", async () => {
			const linked = path.join(root, "linked");
			await git("worktree", "add", "-b", "linked", linked);
			await toolFor(repo, { settings: { "worktree.repoDir": "../wt" } }).execute("call", { path: linked });
			expect(requests).toEqual([linked]);
		});
	});

	it("session_move: a failing post-checkout hook is reported with its output, keeps the worktree and schedules no move", async () => {
		const hook = path.join(repo, ".git", "hooks", "post-checkout");
		await Bun.write(hook, "#!/bin/sh\necho hook-says-no >&2\nexit 3\n");
		await fs.chmod(hook, 0o755);
		const target = path.join(repo, ".worktrees", "hooked");
		await expect(toolFor(repo).execute("call", { path: target, branch: "hooked" })).rejects.toThrow(/hook-says-no/);
		expect(requests).toEqual([]);
		expect(await exists(path.join(target, ".git"))).toBe(true);
	});

	it("session_move: a branch checked out in another worktree is refused with git's error and nothing is left behind", async () => {
		const elsewhere = path.join(root, "elsewhere-wt");
		await git("worktree", "add", "-b", "x", elsewhere);
		const target = path.join(repo, ".worktrees", "b");
		let message = "";
		try {
			await toolFor(repo).execute("call", { path: target, branch: "x" });
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toMatch(/already (checked out|used by worktree)|is checked out/);
		expect(requests).toEqual([]);
		expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
	});

	it("session_move: a missing relocator is reported as an error", async () => {
		await expect(toolFor(repo, { relocator: false }).execute("call", { path: repo })).rejects.toThrow(/relocat/);
	});

	it("session_move: a second move while one is pending is refused and records nothing", async () => {
		const linked = path.join(root, "linked");
		await git("worktree", "add", "-b", "linked", linked);
		let pending = false;
		const tool = toolFor(repo, { pending: () => pending });
		const ok = await tool.execute("one", { path: linked });
		expect(ok.stopAfterBatch).toBe(true);
		pending = true;
		await expect(tool.execute("two", { path: repo })).rejects.toThrow(/already pending/);
		expect(requests).toEqual([linked]);
	});

	describe("background work", () => {
		it("session_move: a running bash job is named and nothing is created", async () => {
			const manager = new AsyncJobManager({ retentionMs: 1000 });
			cleanup.push(async () => void (await manager.dispose()));
			const hold = Promise.withResolvers<string>();
			cleanup.push(() => hold.resolve("done"));
			const jobId = manager.register("bash", "sleeper", () => hold.promise, { ownerId: "Main" });
			const target = path.join(repo, ".worktrees", "bg");
			await expectRefused({ path: target, branch: "bg" }, new RegExp(jobId), { asyncJobManager: manager });
			expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
		});

		it("session_move: a running async subagent job is named and nothing is created", async () => {
			const manager = new AsyncJobManager({ retentionMs: 1000 });
			cleanup.push(async () => void (await manager.dispose()));
			const hold = Promise.withResolvers<string>();
			cleanup.push(() => hold.resolve("done"));
			const jobId = manager.register("task", "child", () => hold.promise, {
				ownerId: "Main",
				agentId: "Main.Child",
			});
			const target = path.join(repo, ".worktrees", "bg");
			await expectRefused({ path: target, branch: "bg" }, new RegExp(jobId), { asyncJobManager: manager });
			expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
		});

		it("session_move: a registry subagent marked running without an async job is named and nothing is created", async () => {
			const registry = new AgentRegistry();
			const sessionFile = path.join(root, "sessions", "s.jsonl");
			registry.register({
				id: "Main.Wake",
				displayName: "Wake",
				kind: "sub",
				session: null,
				sessionFile: path.join(root, "sessions", "s", "Main.Wake.jsonl"),
				status: "running",
			});
			const target = path.join(repo, ".worktrees", "bg");
			await expectRefused({ path: target, branch: "bg" }, /Main\.Wake/, { agentRegistry: registry, sessionFile });
			expect(await exists(path.join(repo, ".worktrees"))).toBe(false);
		});

		it("session_move: the error names every job id and agent id", async () => {
			const manager = new AsyncJobManager({ retentionMs: 1000 });
			cleanup.push(async () => void (await manager.dispose()));
			const hold = Promise.withResolvers<string>();
			cleanup.push(() => hold.resolve("done"));
			const a = manager.register("bash", "a", () => hold.promise, { ownerId: "Main" });
			const b = manager.register("bash", "b", () => hold.promise, { ownerId: "Main" });
			const registry = new AgentRegistry();
			registry.register({
				id: "Main.Wake",
				displayName: "Wake",
				kind: "sub",
				session: null,
				sessionFile: path.join(root, "sessions", "s", "Main.Wake.jsonl"),
				status: "running",
			});
			let message = "";
			try {
				await toolFor(repo, { asyncJobManager: manager, agentRegistry: registry }).execute("call", { path: repo });
			} catch (error) {
				message = (error as Error).message;
			}
			for (const id of [a, b, "Main.Wake"]) expect(message).toContain(id);
			expect(requests).toEqual([]);
		});

		it("session_move: another session's subagents on a shared registry do not block this session", async () => {
			const registry = new AgentRegistry();
			const sessionB = path.join(root, "sessions", "B.jsonl");
			registry.register({
				id: "B.Sub",
				displayName: "B sub",
				kind: "sub",
				session: null,
				sessionFile: path.join(root, "sessions", "B", "B.Sub.jsonl"),
				status: "running",
			});
			registry.register({
				id: "B.Temp",
				displayName: "B temp",
				kind: "sub",
				session: null,
				sessionFile: null,
				status: "running",
			});
			const sessionA = path.join(root, "sessions", "A.jsonl");
			const result = await toolFor(repo, { agentRegistry: registry, sessionFile: sessionA, agentId: "A" }).execute(
				"call",
				{ path: repo },
			);
			expect(result.stopAfterBatch).toBe(true);
			// Control: the same registry blocks B for the subagent under B's artifacts directory only.
			await expect(
				toolFor(repo, { agentRegistry: registry, sessionFile: sessionB, agentId: "B" }).execute("call", {
					path: repo,
				}),
			).rejects.toThrow(/B\.Sub/);
		});
	});

	describe("approval", () => {
		it("session_move: approval is exec for a missing creatable target and write otherwise", async () => {
			const tool = toolFor(repo);
			const linked = path.join(root, "linked");
			await git("worktree", "add", "-b", "linked", linked);
			expect(tool.approval({ path: path.join(repo, ".worktrees", "new"), branch: "new" })).toBe("exec");
			expect(tool.approval({ path: repo })).toBe("write");
			expect(tool.approval({ path: linked })).toBe("write");
			expect(tool.approval({ path: path.join(root, "elsewhere") })).toBe("write");
			expect(tool.approval({ path: path.join(repo, ".worktrees", "a", "b") })).toBe("write");
			expect(tool.approval({})).toBe("write");
			const badDir = toolFor(repo, { settings: { "worktree.repoDir": "../wt" } });
			expect(badDir.approval({ path: path.join(repo, ".worktrees", "new"), branch: "new" })).toBe("write");
		});

		it("session_move: under tools.approvalMode write an existing target is unprompted and creation is prompted", async () => {
			const created = await createAgentSession({
				cwd: repo,
				agentDir: root,
				sessionManager: SessionManager.create(repo, path.join(root, "sessions")),
				settings: Settings.isolated({ "tools.approvalMode": "write", "worktree.clone": false }),
				model: getBundledModel("openai", "gpt-4o-mini"),
				disableExtensionDiscovery: true,
				skills: [],
				contextFiles: [],
				workspaceTree: { rootPath: repo, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] },
				promptTemplates: [],
				slashCommands: [],
				enableMCP: false,
				enableLsp: false,
				toolNames: ["session_move"],
				sessionRelocation: true,
			});
			cleanup.push(() => created.session.dispose());
			created.session.setSessionRelocator(async () => ({ ok: true }));
			const tool = created.session.getToolByName("session_move");
			if (!tool) throw new Error("Expected session_move tool");
			const context = {
				settings: Settings.isolated({ "tools.approvalMode": "write" }),
			} as AgentToolContext;

			const before = await branches();
			await expect(
				tool.execute(
					"creating",
					{ path: path.join(repo, ".worktrees", "prompted"), branch: "prompted" },
					undefined,
					undefined,
					context,
				),
			).rejects.toThrow(/requires approval but no interactive UI available/);
			expect(await branches()).toBe(before);
			expect(await exists(path.join(repo, ".worktrees"))).toBe(false);

			await expect(
				tool.execute("invalid", { path: path.join(root, "elsewhere") }, undefined, undefined, context),
			).rejects.toThrow(/\/move/);
			const existing = await tool.execute("existing", { path: repo }, undefined, undefined, context);
			expect(existing.stopAfterBatch).toBe(true);
		});

		it("session_move: a second creating call in the same batch creates nothing", async () => {
			const authStorage = await AuthStorage.create(path.join(root, "testauth.db"));
			cleanup.push(() => authStorage.close());
			authStorage.keys.setRuntime("anthropic", "anthropic-test-key");
			const created = await createAgentSession({
				cwd: repo,
				authStorage,
				modelRegistry: new ModelRegistry(authStorage, path.join(root, "models.yml")),
				agentDir: root,
				sessionManager: SessionManager.create(repo, path.join(root, "sessions")),
				settings: Settings.isolated({
					"worktree.clone": false,
					"compaction.enabled": false,
					"retry.enabled": false,
				}),
				model: getBundledModel("anthropic", "claude-sonnet-4-5"),
				disableExtensionDiscovery: true,
				skills: [],
				contextFiles: [],
				workspaceTree: { rootPath: repo, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] },
				promptTemplates: [],
				slashCommands: [],
				enableMCP: false,
				enableLsp: false,
				toolNames: ["session_move"],
				sessionRelocation: true,
			});
			cleanup.push(() => created.session.dispose());
			created.session.setSessionRelocator(async () => ({ ok: true }));
			const firstTarget = path.join(repo, ".worktrees", "one");
			const secondTarget = path.join(repo, ".worktrees", "two");
			const mock = createMockModel({
				responses: [
					{
						content: [
							{
								type: "toolCall",
								id: "m1",
								name: "session_move",
								arguments: { path: firstTarget, branch: "one" },
							},
							{
								type: "toolCall",
								id: "m2",
								name: "session_move",
								arguments: { path: secondTarget, branch: "two" },
							},
						],
					},
					{ content: ["done"] },
				] as MockResponse[],
			});
			created.session.agent.streamFn = mock.stream;

			await created.session.prompt("move twice");
			await created.session.waitForIdle();

			expect(await exists(firstTarget)).toBe(true);
			expect(await exists(secondTarget)).toBe(false);
			const branchNames = (await branches()).split("\n").map(line => line.replace(/^[*+]?\s+/, ""));
			expect(branchNames).toContain("one");
			expect(branchNames).not.toContain("two");
			const results = mock.calls
				.at(-1)!
				.context.messages.filter(message => message.role === "toolResult")
				.map(message => ({ id: message.toolCallId, isError: message.isError }));
			expect(results).toEqual([
				{ id: "m1", isError: false },
				{ id: "m2", isError: true },
			]);
		});
	});
});

describe("session_move availability", () => {
	let root: string;
	const sessions: AgentSession[] = [];

	beforeEach(async () => {
		root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "omp-session-move-avail-")));
	});

	afterEach(async () => {
		for (const session of sessions.splice(0)) await session.dispose();
		await fs.rm(root, { recursive: true, force: true });
	});

	function baseOptions(sessionManager: SessionManager) {
		return {
			cwd: root,
			agentDir: root,
			sessionManager,
			settings: Settings.isolated({ "worktree.clone": false }),
			model: getBundledModel("openai", "gpt-4o-mini"),
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			workspaceTree: { rootPath: root, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] },
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			toolNames: ["read", "session_move"],
		};
	}

	async function create(
		extra: { sessionRelocation?: boolean; taskDepth?: number; inMemory?: boolean } = {},
	): Promise<AgentSession> {
		const sessionManager = extra.inMemory
			? SessionManager.inMemory(root)
			: SessionManager.create(root, path.join(root, "sessions"));
		const { session } = await createAgentSession({
			...baseOptions(sessionManager),
			sessionRelocation: extra.sessionRelocation,
			taskDepth: extra.taskDepth,
		});
		sessions.push(session);
		return session;
	}

	function toolSessionStub(overrides: Record<string, unknown>): ToolSession {
		return {
			cwd: root,
			settings: Settings.isolated(),
			taskDepth: 0,
			sessionRelocation: true,
			getSessionFile: () => path.join(root, "s.jsonl"),
			requestSessionMove: () => true,
			...overrides,
		} as unknown as ToolSession;
	}

	it("session_move availability: present for a session that declares a relocator and has a session file", async () => {
		const session = await create({ sessionRelocation: true });
		expect(session.getToolByName("session_move")?.name).toBe("session_move");
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({}))).not.toBeNull();
	});

	it("session_move availability: absent for a task subagent", async () => {
		const session = await create({ sessionRelocation: true, taskDepth: 1 });
		expect(session.getToolByName("session_move")).toBeUndefined();
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({ taskDepth: 1 }))).toBeNull();
	});

	it("session_move availability: absent for print mode, whose session has requestSessionMove but declares no relocation", async () => {
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({ sessionRelocation: false }))).toBeNull();
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({ sessionRelocation: undefined }))).toBeNull();
	});

	it("session_move availability: absent for an SDK session without a relocator", async () => {
		const session = await create();
		expect(session.getToolByName("session_move")).toBeUndefined();
		const explicitFalse = await create({ sessionRelocation: false });
		expect(explicitFalse.getToolByName("session_move")).toBeUndefined();
	});

	it("session_move availability: absent for a session without a session file", async () => {
		const session = await create({ sessionRelocation: true, inMemory: true });
		expect(session.getToolByName("session_move")).toBeUndefined();
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({ getSessionFile: () => null }))).toBeNull();
	});

	it("session_move availability: absent without requestSessionMove on the tool session", async () => {
		expect(BUILTIN_TOOLS.session_move(toolSessionStub({ requestSessionMove: undefined }))).toBeNull();
	});

	it("session_move availability: an advisor never gets the tool, even when its config lists it", async () => {
		const session = await create({ sessionRelocation: true });
		expect(session.getToolByName("session_move")).toBeDefined();
		const advisorTools = session.getAdvisorAvailableToolNames();
		expect(advisorTools.length).toBeGreaterThan(0);
		expect(advisorTools).not.toContain("session_move");
	});
});
