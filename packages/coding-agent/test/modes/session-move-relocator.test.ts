/**
 * `session_move` host relocators for the TUI (command controller + interactive mode) and RPC. Both hosts run a real
 * `AgentSession` with the mock provider; the tool is a stand-in that records the move request and stops the batch
 * exactly as the real `session_move` tool does, so the host relocator is the unit under test.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, setDefaultTimeout, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import type { ToolCall } from "@oh-my-pi/pi-ai";
import { createMockModel, type MockModel, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { InteractiveMode } from "@oh-my-pi/pi-coding-agent/modes/interactive-mode";
import { RpcClient } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { getProjectDir, removeWithRetries, setProjectDir } from "@oh-my-pi/pi-utils";
import { initTheme } from "@oh-my-pi/pi-tui/theme";
import { Type } from "@sinclair/typebox";

setDefaultTimeout(30_000);

// Relocation chdirs the process; restore it before any temp dir is removed so later files keep a valid cwd.
const ORIGINAL_PROJECT_DIR = getProjectDir();

function call(id: string, name: string, args: Record<string, unknown> = {}): ToolCall {
	return { type: "toolCall", id, name, arguments: args };
}

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
	return (result.content ?? []).map(block => (block.type === "text" ? (block.text ?? "") : "")).join("\n");
}

describe("tui session move", () => {
	const RULE_CANARY = "DESTINATION_ONLY_RULE_CANARY";
	let root: string;
	let authStorage: AuthStorage;
	let session: AgentSession | undefined;
	let mode: InteractiveMode | undefined;

	beforeAll(() => initTheme());

	beforeEach(async () => {
		resetSettingsForTest();
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-tui-session-move-")));
		await Settings.init({ inMemory: true, cwd: root });
		authStorage = await AuthStorage.create(path.join(root, "auth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
	});

	afterEach(async () => {
		setProjectDir(ORIGINAL_PROJECT_DIR);
		vi.restoreAllMocks();
		mode?.stop();
		mode = undefined;
		await session?.dispose();
		session = undefined;
		authStorage.close();
		resetSettingsForTest();
		await removeWithRetries(root);
	});

	it("tui session move: the rebuilt prompt, relative reads and the resume list follow the moved session", async () => {
		const source = path.join(root, "source");
		const target = path.join(root, "worktree");
		const agentDir = path.join(root, "agent");
		fs.mkdirSync(source, { recursive: true });
		fs.writeFileSync(path.join(source, "a.txt"), "source file");
		const git = (cwd: string, ...args: string[]) => {
			const result = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
			if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
		};
		git(source, "init", "-q", "-b", "main");
		git(source, "-c", "user.name=t", "-c", "user.email=t@t", "add", "a.txt");
		git(source, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
		git(source, "worktree", "add", "-q", "-b", "feature", target);
		// Tracked in the worktree only: the rule and the changed file are absent from the main checkout.
		fs.mkdirSync(path.join(target, ".omp", "rules"), { recursive: true });
		fs.writeFileSync(path.join(target, "a.txt"), "worktree file");
		fs.writeFileSync(
			path.join(target, ".omp", "rules", "destination-only.md"),
			`---\nalwaysApply: true\n---\n${RULE_CANARY}\n`,
		);
		expect(fs.existsSync(path.join(source, ".omp", "rules"))).toBe(false);

		const sessionManager = SessionManager.create(source, SessionManager.getDefaultSessionDir(source, agentDir));
		const created = await createAgentSession({
			cwd: source,
			agentDir,
			sessionManager,
			authStorage,
			modelRegistry: new ModelRegistry(authStorage, path.join(root, "models.yml")),
			settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false, "async.enabled": false }),
			model: getBundledModel("anthropic", "claude-sonnet-4-5"),
			toolNames: ["read"],
			customTools: [
				{
					name: "session_move",
					label: "session_move",
					description: "move",
					parameters: Type.Object({}),
					async execute() {
						session?.requestSessionMove({ path: target });
						return { content: [{ type: "text" as const, text: "scheduled" }], stopAfterBatch: true };
					},
				},
			],
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			skipPythonPreflight: true,
			preloadedCustomToolPaths: [],
		});
		session = created.session;
		const mock: MockModel = createMockModel({
			responses: [{ content: [call("m1", "session_move")] }, { content: ["moved"] }] as MockResponse[],
		});
		session.agent.streamFn = mock.stream;
		mode = new InteractiveMode(session, "test");
		mode.ui.requestRender = vi.fn();
		mode.ui.requestComponentRender = vi.fn();
		mode.ui.setFocus = vi.fn();
		vi.spyOn(mode, "reloadTodos").mockResolvedValue(undefined);
		vi.spyOn(mode, "showError").mockImplementation(() => {});

		await session.prompt("move to the worktree");
		await session.waitForIdle();

		expect(mock.calls).toHaveLength(2);
		expect(mock.calls[0]!.context.systemPrompt!.join("\n")).not.toContain(RULE_CANARY);
		expect(mock.calls[1]!.context.systemPrompt!.join("\n")).toContain(RULE_CANARY);
		expect(session.sessionManager.getCwd()).toBe(target);

		const readTool = session.getToolByName("read");
		if (!readTool) throw new Error("Expected read tool");
		expect(textOf(await readTool.execute("read-after-move", { path: "a.txt" }))).toContain("worktree file");

		const id = session.sessionManager.getSessionId();
		const targetDir = SessionManager.getDefaultSessionDir(target, agentDir);
		const sourceDir = SessionManager.getDefaultSessionDir(source, agentDir);
		expect(path.dirname(session.sessionManager.getSessionFile()!)).toBe(targetDir);
		const inTarget = await SessionManager.listForPicker(target, targetDir);
		expect(inTarget.map(info => info.id)).toContain(id);
		const sourceFiles = fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : [];
		expect(sourceFiles.filter(file => file.endsWith(".jsonl") && file.includes(id))).toEqual([]);
	});

	describe("goal continuation timer", () => {
		let timerSession: AgentSession;
		let timerMode: InteractiveMode;
		let timerRoot: string;

		beforeEach(async () => {
			timerRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-tui-session-move-goal-")));
			const registry = new ModelRegistry(authStorage, path.join(timerRoot, "models.yml"));
			const model = registry.find("anthropic", "claude-sonnet-4-5");
			if (!model) throw new Error("Expected bundled model");
			timerSession = new AgentSession({
				agent: new Agent({ initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] } }),
				sessionManager: SessionManager.create(timerRoot, timerRoot),
				settings: Settings.isolated({ "compaction.enabled": false, "goal.enabled": true }),
				modelRegistry: registry,
				rebuildSystemPrompt: async () => ({ systemPrompt: ["Test"] }),
			});
			timerMode = new InteractiveMode(timerSession, "test");
		});

		afterEach(async () => {
			vi.useRealTimers();
			timerMode.stop();
			await timerSession.dispose();
			await removeWithRetries(timerRoot);
		});

		async function flush(): Promise<void> {
			for (let i = 0; i < 4; i++) await Promise.resolve();
		}

		it("tui session move: goal timer waits for the transition", async () => {
			await timerMode.handleGoalModeCommand("Ship the release");
			vi.useFakeTimers();
			let transitioning = true;
			Object.defineProperty(timerSession, "isSessionTransitioning", {
				configurable: true,
				get: () => transitioning,
			});

			let resolved = undefined as { customType?: string } | undefined;
			const first = timerMode.getUserInput().then(input => {
				resolved = input;
			});
			await flush();
			vi.advanceTimersByTime(800);
			await flush();
			expect(resolved).toBeUndefined();

			// The fence is closed: unblock the armed waiter, then re-arm and let the timer fire.
			transitioning = false;
			timerMode.onInputCallback?.(timerMode.startPendingSubmission({ text: "cleanup" }));
			await first;
			timerMode.finishPendingSubmission(resolved as never);
			resolved = undefined;
			const second = timerMode.getUserInput().then(input => {
				resolved = input;
			});
			await flush();
			vi.advanceTimersByTime(800);
			await flush();
			expect((resolved as { customType?: string } | undefined)?.customType).toBe("goal-continuation");
			await second;
		});
	});
});

describe("rpc session move", () => {
	let client: RpcClient | undefined;
	let root: string | undefined;

	afterEach(async () => {
		setProjectDir(ORIGINAL_PROJECT_DIR);
		await client?.stop();
		client = undefined;
		if (root) await removeWithRetries(root);
		root = undefined;
	});

	it("rpc session move: the continuation turn's events are emitted and get_state reports the target cwd", async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-session-move-")));
		const target = path.join(root, "moved-to");
		fs.mkdirSync(target);
		client = new RpcClient({
			command: [
				process.execPath,
				path.join(import.meta.dir, "..", "fixtures", "session-move-rpc-agent.ts"),
				root,
				target,
			],
			cwd: root,
			env: { PI_CODING_AGENT_DIR: root, PI_NO_TITLE: "1" },
		});
		await client.start();
		expect((await client.getState()).cwd).toBe(root);

		const events: Array<{ type: string; message?: { role?: string; customType?: string } }> = [];
		client.onEvent(event => events.push(event as (typeof events)[number]));
		await client.promptAndWait("move to the target");
		await client.waitForSettled();

		const state = await client.getState();
		expect(state.cwd).toBe(target);
		const moveResultAt = events.findIndex(
			event => event.type === "message_start" && event.message?.customType === "session-move-result",
		);
		expect(moveResultAt).toBeGreaterThan(0);
		// The continuation turn streams its assistant reply and ends after the move-result message.
		expect(
			events.slice(moveResultAt).some(event => event.type === "message_end" && event.message?.role === "assistant"),
		).toBe(true);
		expect(events.at(-1)?.type).toBe("agent_end");
		expect(
			events.some(
				event =>
					event.type === "message_start" &&
					event.message?.role === "custom" &&
					event.message.customType === "session-move-result",
			),
		).toBe(true);
		const messages = JSON.stringify(await client.getMessages());
		expect(messages).toContain("continued after the move");
	});
});
