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
import { IrcBus } from "@oh-my-pi/pi-coding-agent/irc/bus";
import { InteractiveMode } from "@oh-my-pi/pi-coding-agent/modes/interactive-mode";
import { RpcClient } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { createAgentSession, MAIN_AGENT_ID } from "@oh-my-pi/pi-coding-agent/sdk";
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
						session?.reserveSessionMove()?.commit({ path: target });
						return { content: [{ type: "text" as const, text: "scheduled" }] };
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

	describe("relocation admission", () => {
		const lifecycles: AgentLifecycleManager[] = [];
		let originalWorktreeDir: string | undefined;

		beforeEach(() => {
			originalWorktreeDir = process.env.OMP_WORKTREE_DIR;
			process.env.OMP_WORKTREE_DIR = path.join(root, "worktrees");
		});

		afterEach(async () => {
			if (originalWorktreeDir === undefined) delete process.env.OMP_WORKTREE_DIR;
			else process.env.OMP_WORKTREE_DIR = originalWorktreeDir;
			for (const lifecycle of lifecycles.splice(0)) await lifecycle.dispose();
		});

		interface Delivery {
			body: string;
			/** The session's cwd when the message reached the subagent. */
			cwd: string;
		}

		interface AdmissionFixture {
			source: string;
			target: string;
			mock: MockModel;
			bus: IrcBus;
			registry: AgentRegistry;
			/** Host relocator the interactive mode installed, that is, `CommandController.relocateForAgent`. */
			relocator: (targetPath: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
			/** `provider-request` and, from `reloadTodos`, `relocation-body-done` (the last step inside the lease). */
			events: string[];
			requestCwds: string[];
			delivered: Map<string, Delivery[]>;
			revivals: string[];
			addSubagent(id: string, status: "idle" | "parked"): void;
		}

		function git(cwd: string, ...args: string[]): void {
			const result = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
				cwd,
				stderr: "pipe",
				stdout: "pipe",
			});
			if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
		}

		async function admissionFixture(): Promise<AdmissionFixture> {
			const source = path.join(root, "source");
			const target = path.join(root, "target");
			const agentDir = path.join(root, "agent");
			fs.mkdirSync(source, { recursive: true });
			fs.mkdirSync(target, { recursive: true });
			fs.writeFileSync(path.join(source, "a.txt"), "source file");
			git(source, "init", "-q", "-b", "main");
			git(source, "add", "a.txt");
			git(source, "commit", "-q", "-m", "init");

			const registry = new AgentRegistry();
			const lifecycle = new AgentLifecycleManager(registry);
			lifecycles.push(lifecycle);
			const events: string[] = [];
			const requestCwds: string[] = [];
			const delivered = new Map<string, Delivery[]>();
			const revivals: string[] = [];
			const sessionManager = SessionManager.create(source, SessionManager.getDefaultSessionDir(source, agentDir));
			const created = await createAgentSession({
				cwd: source,
				agentDir,
				sessionManager,
				authStorage,
				modelRegistry: new ModelRegistry(authStorage, path.join(root, "models.yml")),
				settings: Settings.isolated({
					"compaction.enabled": false,
					"retry.enabled": false,
					"async.enabled": false,
				}),
				model: getBundledModel("anthropic", "claude-sonnet-4-5"),
				toolNames: ["read"],
				agentRegistry: registry,
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
			const live = session;
			const mock = createMockModel({ handler: () => ({ content: ["ok"] }) });
			live.agent.streamFn = (model, context, options) => {
				events.push("provider-request");
				requestCwds.push(live.sessionManager.getCwd());
				return mock.stream(model, context, options);
			};
			const setRelocator = vi.spyOn(live, "setSessionRelocator");
			mode = new InteractiveMode(live, "test");
			const installed = setRelocator.mock.calls[0]?.[0];
			if (!installed) throw new Error("Expected the interactive mode to install a session relocator");
			mode.ui.requestRender = vi.fn();
			mode.ui.requestComponentRender = vi.fn();
			mode.ui.setFocus = vi.fn();
			vi.spyOn(mode, "present").mockImplementation(() => {});
			vi.spyOn(mode, "showError").mockImplementation(() => {});
			vi.spyOn(mode, "reloadTodos").mockImplementation(async () => {
				events.push("relocation-body-done");
			});

			const artifactsDir = (live.sessionManager.getSessionFile() as string).slice(0, -".jsonl".length);
			const stub = (id: string): AgentSession =>
				({
					deliverIrcMessage: async (message: { body: string }) => {
						delivered.set(id, [
							...(delivered.get(id) ?? []),
							{ body: message.body, cwd: live.sessionManager.getCwd() },
						]);
						return "woken" as const;
					},
					subscribe: () => () => {},
					dispose: async () => {},
				}) as unknown as AgentSession;
			lifecycle.setPersistedSubagentReviverFactory(
				async ref => async () => {
					revivals.push(ref.id);
					return stub(ref.id);
				},
				() => 0,
			);
			return {
				source,
				target,
				mock,
				bus: new IrcBus(registry, lifecycle),
				registry,
				relocator: installed,
				events,
				requestCwds,
				delivered,
				revivals,
				addSubagent(id, status) {
					const file = path.join(artifactsDir, `${id}.jsonl`);
					fs.mkdirSync(artifactsDir, { recursive: true });
					fs.writeFileSync(file, `${id}\n`);
					registry.register({
						id,
						displayName: id,
						kind: "sub",
						parentId: MAIN_AGENT_ID,
						session: status === "idle" ? stub(id) : null,
						sessionFile: file,
						status,
					});
				},
			};
		}

		/** Drain continuations and a few file-I/O turns: nothing on the held paths waits on a timer. */
		async function settleTurns(): Promise<void> {
			for (let i = 0; i < 50; i++) await Promise.resolve();
			for (let i = 0; i < 3; i++) await fs.promises.stat(root);
		}

		function track(promise: Promise<unknown>): { readonly settled: boolean } {
			const state = { settled: false };
			void promise.then(
				() => {
					state.settled = true;
				},
				() => {
					state.settled = true;
				},
			);
			return state;
		}

		function callsMentioning(mock: MockModel, text: string): number {
			return mock.calls.filter(entry => JSON.stringify(entry.context).includes(text)).length;
		}

		/**
		 * Pause `applyCwdChange`, send the session a peer message while it is stuck there, assert no turn starts,
		 * then let the relocation finish and assert the message is delivered afterwards in the new cwd.
		 */
		async function expectHeldUntilCwdApplied(
			fx: AdmissionFixture,
			relocate: () => Promise<unknown>,
			expectCwd: (cwd: string) => void,
		): Promise<void> {
			if (!mode || !session) throw new Error("Expected the admission fixture");
			const live = session;
			const entered = Promise.withResolvers<void>();
			const gate = Promise.withResolvers<void>();
			const applyCwdChange = mode.applyCwdChange.bind(mode);
			vi.spyOn(mode, "applyCwdChange").mockImplementation(async cwd => {
				entered.resolve();
				await gate.promise;
				return applyCwdChange(cwd);
			});
			try {
				const relocation = relocate();
				await entered.promise;
				const send = fx.bus.send({ from: "Peer", to: MAIN_AGENT_ID, body: "peer-ping" });
				const sent = track(send);
				await settleTurns();
				expect(sent.settled).toBe(false);
				expect(fx.mock.calls).toHaveLength(0);

				gate.resolve();
				await relocation;
				expectCwd(live.sessionManager.getCwd());
				expect((await send).outcome).not.toBe("failed");
				await live.waitForIdle();
				expect(callsMentioning(fx.mock, "peer-ping")).toBeGreaterThan(0);
				// The turn starts after the relocation body finished, in the new directory.
				expect(fx.events.indexOf("relocation-body-done")).toBeGreaterThanOrEqual(0);
				expect(fx.events.indexOf("provider-request")).toBeGreaterThan(fx.events.indexOf("relocation-body-done"));
				expect(fx.requestCwds.every(cwd => cwd === live.sessionManager.getCwd())).toBe(true);
			} finally {
				gate.resolve();
			}
		}

		it("tui session move: /move holds relocation admission until the cwd is applied", async () => {
			const fx = await admissionFixture();
			await expectHeldUntilCwdApplied(
				fx,
				() => mode!.handleMoveCommand(fx.target),
				cwd => expect(cwd).toBe(fx.target),
			);
		});

		it("tui session move: /wt holds relocation admission until the cwd is applied", async () => {
			const fx = await admissionFixture();
			await expectHeldUntilCwdApplied(
				fx,
				() => mode!.handleWorktreeCommand("feature", { keepChanges: false }),
				cwd => {
					expect(cwd).not.toBe(fx.source);
					expect(cwd.startsWith(path.join(root, "worktrees"))).toBe(true);
				},
			);
		});

		it("tui session move: relocateForAgent holds relocation admission until the cwd is applied", async () => {
			const fx = await admissionFixture();
			await expectHeldUntilCwdApplied(
				fx,
				async () => expect(await fx.relocator(fx.target)).toEqual({ ok: true }),
				cwd => expect(cwd).toBe(fx.target),
			);
		});

		it("tui session move: /move holds relocation admission while moveSession is paused", async () => {
			const fx = await admissionFixture();
			if (!mode || !session) throw new Error("Expected the admission fixture");
			const live = session;
			fx.addSubagent("ParkedChild", "parked");
			const entered = Promise.withResolvers<void>();
			const gate = Promise.withResolvers<void>();
			const moveSession = live.moveSession.bind(live);
			vi.spyOn(live, "moveSession").mockImplementation(async (...args) => {
				entered.resolve();
				await gate.promise;
				return moveSession(...args);
			});
			try {
				const relocation = mode.handleMoveCommand(fx.target);
				await entered.promise;
				const wake = fx.bus.send({ from: "Peer", to: MAIN_AGENT_ID, body: "wake-ping" });
				const revive = fx.bus.send({ from: "Peer", to: "ParkedChild", body: "revive-ping" });
				const woken = track(wake);
				const revived = track(revive);
				await settleTurns();
				expect(woken.settled).toBe(false);
				expect(revived.settled).toBe(false);
				expect(fx.mock.calls).toHaveLength(0);
				expect(fx.revivals).toEqual([]);

				gate.resolve();
				await relocation;
				expect((await wake).outcome).not.toBe("failed");
				expect((await revive).outcome).toBe("revived");
				await live.waitForIdle();
				expect(live.sessionManager.getCwd()).toBe(fx.target);
				expect(callsMentioning(fx.mock, "wake-ping")).toBeGreaterThan(0);
				expect(fx.revivals).toEqual(["ParkedChild"]);
				expect(fx.delivered.get("ParkedChild")?.map(entry => entry.body)).toEqual(["revive-ping"]);
			} finally {
				gate.resolve();
			}
		});

		it("tui session move: a failed applyCwdChange rolls back and then delivers the held message in the unchanged cwd", async () => {
			const fx = await admissionFixture();
			if (!mode || !session) throw new Error("Expected the admission fixture");
			const live = session;
			fx.addSubagent("IdleChild", "idle");
			const entered = Promise.withResolvers<void>();
			const gate = Promise.withResolvers<void>();
			// Only the move's own apply fails; the rollback's re-apply of the source cwd runs for real.
			const applyCwdChange = mode.applyCwdChange.bind(mode);
			let failed = false;
			vi.spyOn(mode, "applyCwdChange").mockImplementation(async cwd => {
				if (failed) return applyCwdChange(cwd);
				failed = true;
				entered.resolve();
				await gate.promise;
				return false;
			});
			try {
				const relocation = mode.handleMoveCommand(fx.target);
				await entered.promise;
				const send = fx.bus.send({ from: "Peer", to: "IdleChild", body: "held-ping" });
				const sent = track(send);
				await settleTurns();
				expect(sent.settled).toBe(false);
				expect(fx.delivered.get("IdleChild")).toBeUndefined();

				gate.resolve();
				await relocation;
				expect((await send).outcome).toBe("woken");
				expect(live.sessionManager.getCwd()).toBe(fx.source);
				expect(fx.delivered.get("IdleChild")).toEqual([{ body: "held-ping", cwd: fx.source }]);
			} finally {
				gate.resolve();
			}
		});

		it("tui session move: a /move refused by a failing settings flush delivers the held message", async () => {
			const fx = await admissionFixture();
			if (!mode || !session) throw new Error("Expected the admission fixture");
			const live = session;
			fx.addSubagent("IdleChild", "idle");
			const entered = Promise.withResolvers<void>();
			const gate = Promise.withResolvers<void>();
			vi.spyOn(mode.settings, "flush").mockImplementation(async () => {
				entered.resolve();
				await gate.promise;
				throw new Error("disk full");
			});
			try {
				const relocation = mode.handleMoveCommand(fx.target);
				await entered.promise;
				const send = fx.bus.send({ from: "Peer", to: "IdleChild", body: "held-ping" });
				const sent = track(send);
				await settleTurns();
				expect(sent.settled).toBe(false);
				expect(fx.delivered.get("IdleChild")).toBeUndefined();

				gate.resolve();
				await relocation;
				expect((await send).outcome).toBe("woken");
				expect(live.sessionManager.getCwd()).toBe(fx.source);
				expect(fx.delivered.get("IdleChild")).toEqual([{ body: "held-ping", cwd: fx.source }]);
			} finally {
				gate.resolve();
			}
		});
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

	it("rpc session move: a fatal relocation starts no continuation", async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-session-move-fatal-")));
		const target = path.join(root, "moved-to");
		fs.mkdirSync(target);
		const requestLog = path.join(root, "requests.log");
		fs.writeFileSync(requestLog, "");
		client = new RpcClient({
			command: [
				process.execPath,
				path.join(import.meta.dir, "..", "fixtures", "session-move-rpc-agent.ts"),
				root,
				target,
				"fatal",
				requestLog,
			],
			cwd: root,
			env: { PI_CODING_AGENT_DIR: root, PI_NO_TITLE: "1" },
		});
		await client.start();
		const events: Array<{ type: string; message?: { customType?: string } }> = [];
		client.onEvent(event => events.push(event as (typeof events)[number]));
		await client.prompt("move to the target");
		// A subprocess exit is only observable through its log file; no in-process event or fake timer reaches it.
		const deadline = Date.now() + 20_000;
		let lines: string[] = [];
		while (Date.now() < deadline) {
			lines = fs.readFileSync(requestLog, "utf8").split("\n").filter(Boolean);
			if (lines.includes("exit")) break;
			await Bun.sleep(25);
		}

		// The process ends after exactly the one provider request of the batch; the failed move never starts a turn.
		expect(lines).toEqual(["request", "exit"]);
		expect(
			events.some(event => event.type === "message_start" && event.message?.customType === "session-move-result"),
		).toBe(false);
	});
	it("rpc session move: the rpc relocator holds relocation admission until the rescope finishes", async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-session-move-admission-")));
		const target = path.join(root, "moved-to");
		fs.mkdirSync(target);
		const requestLog = path.join(root, "requests.log");
		fs.writeFileSync(requestLog, "");
		client = new RpcClient({
			command: [
				process.execPath,
				path.join(import.meta.dir, "..", "fixtures", "session-move-rpc-agent.ts"),
				root,
				target,
				"pause",
				requestLog,
			],
			cwd: root,
			env: { PI_CODING_AGENT_DIR: root, PI_NO_TITLE: "1" },
		});
		await client.start();
		await client.promptAndWait("move to the target");
		await client.waitForSettled();
		// The held message is delivered inside the subprocess; its log file is the only observable of that.
		const deadline = Date.now() + 20_000;
		let lines: string[] = [];
		while (Date.now() < deadline) {
			lines = fs.readFileSync(requestLog, "utf8").split("\n").filter(Boolean);
			if (lines.some(line => line.startsWith("final ")) && lines.some(line => line.startsWith("relocated "))) break;
			await Bun.sleep(25);
		}

		// Only the first turn's two requests had run when the rescope was paused, and the send was still held then.
		expect(lines.filter(line => line.startsWith("paused "))).toEqual(["paused requests=2 send-settled=false"]);
		expect(lines.filter(line => line.startsWith("relocated "))).toEqual(['relocated {"ok":true}']);
		expect(lines.filter(line => line.startsWith("final "))).toEqual([`final delivered=true cwd=${target}`]);
		expect((await client.getState()).cwd).toBe(target);
	});
});
