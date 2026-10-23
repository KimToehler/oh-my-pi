import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { ASYNC_JOB_MANAGER_SHUTDOWN_REASON, AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import type { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { LoadExtensionsResult } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/types";
import { IrcBus } from "@oh-my-pi/pi-coding-agent/irc/bus";
import { RpcSubagentRegistry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-subagents";
import type { RpcSubagentFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { registerPersistedSubagents } from "@oh-my-pi/pi-coding-agent/registry/persisted-agents";
import type { CreateAgentSessionResult } from "@oh-my-pi/pi-coding-agent/sdk";
import * as sdkModule from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession, AgentSessionEvent, PromptOptions } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { CustomMessage } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import {
	buildBudgetNotice,
	buildCompactionBudgetNotice,
	resolveSoftRequestBudget,
	runSubprocess,
} from "@oh-my-pi/pi-coding-agent/task/executor";
import { cfgTaskAgentSoftRequestBudget } from "@oh-my-pi/pi-coding-agent/task/settings";
import type { AgentDefinition } from "@oh-my-pi/pi-coding-agent/task/types";
import { TASK_SUBAGENT_LIFECYCLE_CHANNEL } from "@oh-my-pi/pi-coding-agent/task/types";
import { EventBus } from "@oh-my-pi/pi-coding-agent/utils/event-bus";
import { TempDir } from "@oh-my-pi/pi-utils";
import { createSessionDefaults } from "../helpers/session-defaults";

/**
 * Contracts under test — the soft request budget must degrade gracefully
 * instead of killing scouts into an unreachable state:
 *
 * 1. Crossing 1.5x the budget stops the free-running turn and drives ONE
 *    forced final `yield`, so the run finishes as a normal completion with a
 *    partial report — not as an abort with no output.
 * 2. If the agent still refuses to yield (grace exhausted → hard abort), a
 *    kept-alive agent stays adopted (`idle`), so `irc` can message/resume it
 *    with the same RPC lifecycle/progress frames as the original run.
 * 3. Caller-signal aborts only stop the run: the agent stays resumable via
 *    `irc`.
 */

interface MockSessionHandle {
	session: AgentSession;
	prompts: Array<{ text: string; options?: PromptOptions }>;
	sentUserMessages: Array<{
		content: string | unknown[];
		options?: { deliverAs?: "steer" | "followUp" | "aside"; attribution?: "user" | "agent" };
	}>;
	abortCalls: () => number;
	disposeCalls: () => number;
}

function assistantText(text: string, stopReason: "stop" | "aborted" = "stop") {
	return { role: "assistant" as const, content: [{ type: "text" as const, text }], stopReason };
}

function createMockSession(
	onPrompt: (params: {
		promptIndex: number;
		emit: (event: AgentSessionEvent) => void;
		pushMessage: (message: unknown) => void;
	}) => void | Promise<void>,
	onAbort?: () => void | Promise<void>,
): MockSessionHandle {
	const listeners: Array<(event: AgentSessionEvent) => void> = [];
	const messages: unknown[] = [];
	const prompts: Array<{ text: string; options?: PromptOptions }> = [];
	const sentUserMessages: MockSessionHandle["sentUserMessages"] = [];
	let abortCount = 0;
	let disposeCount = 0;
	let promptIndex = 0;
	let ircWakeTurnObserver:
		| ((records: CustomMessage[]) => ((error?: unknown) => void | Promise<void>) | undefined)
		| undefined;

	const emit = (event: AgentSessionEvent) => {
		// oxlint-disable-next-line unicorn/no-useless-spread -- listeners may change during dispatch
		for (const listener of [...listeners]) listener(event);
	};

	const session: Partial<AgentSession> = {
		...createSessionDefaults(),
		state: { messages: [] } as never,
		agent: { state: { systemPrompt: ["test"] } } as never,
		model: { api: "anthropic-messages" } as never,
		extensionRunner: undefined as never,
		sessionManager: { appendSessionInit: () => {} } as never,
		getActiveToolNames: () => ["read", "yield"],
		getEnabledToolNames: () => ["read", "yield"],
		subscribe: (listener: (event: AgentSessionEvent) => void) => {
			listeners.push(listener);
			return () => {
				const index = listeners.indexOf(listener);
				if (index >= 0) listeners.splice(index, 1);
			};
		},
		prompt: async (text: string, options?: PromptOptions) => {
			promptIndex += 1;
			prompts.push({ text, options });
			await onPrompt({ promptIndex, emit, pushMessage: message => messages.push(message) });
			return true;
		},
		getLastAssistantMessage: () => messages[messages.length - 1] as never,
		sendUserMessage: async (content, options) => {
			sentUserMessages.push({ content, options });
		},
		setIrcWakeTurnObserver: observer => {
			ircWakeTurnObserver = observer;
		},
		trackIrcReply: () => {},
		isParentIrcSteer: () => false,
		deliverIrcMessage: async msg => {
			const record: CustomMessage = {
				role: "custom",
				customType: "irc:incoming",
				content: msg.body,
				display: true,
				details: { id: msg.id, from: msg.from, message: msg.body },
				attribution: "agent",
				timestamp: msg.ts,
			};
			const finishObservation = ircWakeTurnObserver?.([record]);
			const yieldMessage = {
				role: "assistant" as const,
				content: [
					{
						type: "toolCall" as const,
						id: "tool-irc-yield",
						name: "yield",
						arguments: { data: { report: "resumed findings" } },
					},
				],
				stopReason: "toolUse" as const,
			};
			messages.push(yieldMessage);
			emit({ type: "agent_start" } as AgentSessionEvent);
			emit({ type: "message_end", message: yieldMessage } as unknown as AgentSessionEvent);
			emit({
				type: "tool_execution_end",
				toolCallId: "tool-irc-yield",
				toolName: "yield",
				result: {
					content: [{ type: "text", text: "Result submitted." }],
					details: { status: "success", data: { report: "resumed findings" } },
				},
				isError: false,
			} as AgentSessionEvent);
			emit({ type: "agent_end", messages: [yieldMessage] } as unknown as AgentSessionEvent);
			await finishObservation?.();
			return "woken";
		},
		abort: async () => {
			abortCount += 1;
			await onAbort?.();
		},
		dispose: async () => {
			disposeCount += 1;
		},
	};

	return {
		session: session as AgentSession,
		prompts,
		sentUserMessages,
		abortCalls: () => abortCount,
		disposeCalls: () => disposeCount,
	};
}

function mockCreateAgentSession(session: AgentSession) {
	return vi.spyOn(sdkModule, "createAgentSession").mockResolvedValue({
		session,
		extensionsResult: {} as unknown as LoadExtensionsResult,
		setToolUIContext: () => {},
		eventBus: new EventBus(),
	} satisfies CreateAgentSessionResult);
}
// Use a bundled scout so these runSubprocess tests exercise the built-in
// ceiling together with a lower task.softRequestBudget setting.
const baseAgent: AgentDefinition = {
	name: "scout",
	description: "test",
	systemPrompt: "test",
	source: "bundled",
};

describe("runSubprocess soft request budget", () => {
	let tempDir: TempDir;

	beforeEach(() => {
		AgentRegistry.resetGlobalForTests();
		AgentLifecycleManager.resetGlobalForTests();
		AsyncJobManager.resetForTests();
		tempDir = TempDir.createSync("@pi-soft-budget-");
	});
	afterEach(() => {
		vi.restoreAllMocks();
		AgentLifecycleManager.resetGlobalForTests();
		AgentRegistry.resetGlobalForTests();
		AsyncJobManager.resetForTests();
		tempDir[Symbol.dispose]();
	});

	function baseOptions(id: string, eventBus?: EventBus, subagentEventBus?: EventBus) {
		return {
			cwd: "/tmp",
			agent: baseAgent,
			task: "inventory the api surface",
			index: 0,
			id,
			settings: Settings.isolated({ "task.softRequestBudget": 2 }),
			modelRegistry: { refresh: async () => {} } as unknown as ModelRegistry,
			enableLsp: false,
			artifactsDir: tempDir.path(),
			eventBus,
			subagentEventBus: subagentEventBus ?? eventBus,
		};
	}

	function registerRunning(id: string, session: AgentSession, sessionFile: string | null = null) {
		AgentRegistry.global().register({
			id,
			displayName: id,
			kind: "sub",
			session,
			sessionFile,
			status: "running",
		});
	}

	it("a budget stop drives one forced final yield and finishes as a normal completion", async () => {
		const id = "BudgetScout";
		let abortCallsAtReminder: number | undefined;
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex === 1) {
				// Free-running exploration: budget 2 → stop threshold 3.
				for (let i = 1; i <= 3; i++) {
					const message = assistantText(`exploring ${i}`, i === 3 ? "aborted" : "stop");
					pushMessage(message);
					emit({ type: "message_end", message } as unknown as AgentSessionEvent);
				}
				return;
			}
			// The forced wrap-up reminder: answer it with a terminal yield.
			abortCallsAtReminder = handle.abortCalls();
			const yieldMessage = {
				role: "assistant" as const,
				content: [
					{
						type: "toolCall" as const,
						id: "tool-forced-yield",
						name: "yield",
						arguments: { data: { report: "partial findings" } },
					},
				],
				stopReason: "toolUse" as const,
			};
			pushMessage(yieldMessage);
			emit({ type: "message_end", message: yieldMessage } as unknown as AgentSessionEvent);
			emit({
				type: "tool_execution_end",
				toolCallId: "tool-forced-yield",
				toolName: "yield",
				result: {
					content: [{ type: "text", text: "Result submitted." }],
					details: { status: "success", data: { report: "partial findings" } },
				},
				isError: false,
			} as AgentSessionEvent);
		});
		const createAgentSessionSpy = mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session);
		const parentSessionFile = `${tempDir.path()}/parent.jsonl`;

		const result = await runSubprocess({ ...baseOptions(id), sessionFile: parentSessionFile });

		// The budget stop aborted the free-running turn exactly once before the
		// wrap-up reminder; the second abort (after the terminal yield) is the
		// normal post-yield terminate.
		expect(abortCallsAtReminder).toBe(1);
		// The budget stop forces a synthetic terminal yield.
		expect(handle.prompts).toHaveLength(2);
		expect(handle.prompts[1]?.options?.synthetic).toBe(true);
		expect(handle.prompts[1]?.options?.toolChoice).toEqual({ type: "tool", name: "yield" });
		expect(handle.sentUserMessages).toContainEqual({
			content: buildBudgetNotice(2, 2),
			options: { deliverAs: "steer", attribution: "agent" },
		});
		const createOptions = createAgentSessionSpy.mock.calls[0]?.[0];
		expect(createOptions?.sessionManager?.getHeader()?.parentSession).toBe(parentSessionFile);
		// The forced yield finalizes as a normal completion, not an abort.
		expect(result.aborted).toBe(false);
		expect(result.exitCode).toBe(0);
		expect(result.abortReason).toBeUndefined();
		expect(JSON.parse(result.output)).toEqual({ report: "partial findings" });
		// The agent stays a live, adopted peer.
		expect(AgentRegistry.global().get(id)?.status).toBe("idle");
		expect(AgentLifecycleManager.global().has(id)).toBe(true);
		expect(handle.disposeCalls()).toBe(0);
	});

	it("a budget hard-abort keeps the kept-alive agent adopted and messageable via irc", async () => {
		const id = "StubbornScout";
		const eventBus = new EventBus();
		const frames: RpcSubagentFrame[] = [];
		let resolveFollowUpTerminal: (() => void) | undefined;
		const waitForFollowUpTerminal = (): Promise<void> => {
			const deferred = Promise.withResolvers<void>();
			resolveFollowUpTerminal = deferred.resolve;
			return deferred.promise;
		};
		const rpcRegistry = new RpcSubagentRegistry(eventBus, frame => {
			frames.push(frame);
			if (frame.type !== "subagent_lifecycle" || frame.payload.status === "started") return;
			const resolve = resolveFollowUpTerminal;
			resolveFollowUpTerminal = undefined;
			resolve?.();
		});
		rpcRegistry.setSubscriptionLevel("progress");
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			// Configuration alone must not show an advisor to remote observers.
			expect(
				frames.some(frame => frame.type === "subagent_progress" && frame.payload.progress.advisor === true),
			).toBe(false);
			// Model discovery can attach the runtime after the monitor subscribes.
			advisorActive.mockReturnValue(true);
			// Never yields: budget 2 → stop at 3, grace exhausted at 3 + 5 = 8.
			for (let i = 1; i <= 8; i++) {
				const message = assistantText(`burning request ${i}`);
				pushMessage(message);
				emit({ type: "message_end", message } as unknown as AgentSessionEvent);
				if (i === 1) {
					const advisedProgress = frames.find(
						frame => frame.type === "subagent_progress" && frame.payload.progress.advisor === true,
					);
					expect(advisedProgress).toMatchObject({ payload: { progress: { requests: 0 } } });
					// Losing the runtime later must not erase this run's advised history.
					advisorActive.mockReturnValue(false);
				}
			}
		});
		const advisorActive = vi.spyOn(handle.session, "isAdvisorActive");
		mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session);

		const result = await runSubprocess({
			...baseOptions(id, eventBus),
			agent: { ...baseAgent, advisor: true },
		});

		expect(result.aborted).toBe(true);
		expect(result.abortReason).toMatch(/Soft request budget exceeded/);
		expect(result.advisor).toBe(true);
		// Resumable stop, not a terminal kill: the ref stays adopted and live.
		expect(AgentRegistry.global().get(id)?.status).toBe("idle");
		expect(AgentLifecycleManager.global().has(id)).toBe(true);
		expect(handle.disposeCalls()).toBe(0);

		const expectRpcTurn = (advised: boolean): void => {
			expect(frames[0]).toMatchObject({
				type: "subagent_lifecycle",
				payload: { id, status: "started" },
			});
			const firstProgress = frames.find(frame => frame.type === "subagent_progress");
			expect(firstProgress).toBeDefined();
			expect(firstProgress?.payload.progress.advisor === true).toBe(advised);
			if (advised) {
				// The badge must appear before the awakened agent emits its first request.
				expect(firstProgress?.payload.progress.requests).toBe(0);
			}
			expect(frames.at(-1)).toMatchObject({
				type: "subagent_lifecycle",
				payload: { id, status: "completed" },
			});
		};

		frames.length = 0;
		advisorActive.mockReturnValue(true);
		const idleTerminal = waitForFollowUpTerminal();
		const idleReceipt = await new IrcBus().send({ from: "Main", to: id, body: "resume your inventory" });
		expect(idleReceipt.outcome).toBe("woken");
		await idleTerminal;
		expectRpcTurn(true);

		await AgentLifecycleManager.global().park(id);
		expect(AgentRegistry.global().get(id)?.status).toBe("parked");
		const parked = await SessionManager.open(`${tempDir.path()}/${id}.jsonl`);
		parked.appendMessage({
			role: "user",
			content: "inventory the api surface",
			timestamp: Date.now(),
		});
		await parked.flush();
		await parked.close();
		frames.length = 0;
		// Parking can rebuild an unadvised session; don't retain the prior turn's marker.
		advisorActive.mockReturnValue(false);
		const revivedTerminal = waitForFollowUpTerminal();
		const revivedReceipt = await new IrcBus().send({ from: "Main", to: id, body: "resume after parking" });
		expect(revivedReceipt.outcome).toBe("revived");
		await revivedTerminal;
		expectRpcTurn(false);
		rpcRegistry.dispose();
	});

	it("fails an irc wake when the parked transcript has no message history", async () => {
		const id = "BlankScout";
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			// Never yields: budget 2 → stop at 3, grace exhausted at 8.
			for (let i = 1; i <= 8; i++) {
				const message = assistantText(`burning request ${i}`);
				pushMessage(message);
				emit({ type: "message_end", message } as unknown as AgentSessionEvent);
			}
		});
		mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session);

		const result = await runSubprocess(baseOptions(id));
		expect(result.aborted).toBe(true);
		await AgentLifecycleManager.global().park(id);
		expect(AgentRegistry.global().get(id)?.status).toBe("parked");

		const receipt = await new IrcBus().send({ from: "Main", to: id, body: "resume your inventory" });
		expect(receipt.outcome).toBe("failed");
		expect(receipt.error).toContain(`Cannot revive subagent "${id}"`);
		expect(receipt.error).toContain("no message history");
		expect(AgentRegistry.global().get(id)?.session ?? null).toBeNull();
	});

	it("a shutdown racing a budget hard-abort follows the shutdown release path", async () => {
		// Regression: a process shutdown that lands right after the soft-budget
		// grace hard-aborts must supersede the budget reason, so the subagent is
		// released (disposed + unregistered, restorable as parked) instead of
		// being left adopted and alive past AgentLifecycleManager.dispose().
		const id = "RacedScout";
		const rootSessionFile = `${tempDir.path()}/main.jsonl`;
		const workerSessionFile = `${tempDir.path()}/main/${id}.jsonl`;
		await Bun.write(rootSessionFile, "");
		await Bun.write(
			workerSessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id, timestamp: "2026-08-13T17:14:48.000Z", cwd: "/tmp" }),
				JSON.stringify({
					type: "session_init",
					id: "si",
					parentId: null,
					timestamp: "2026-08-13T17:14:48.000Z",
					systemPrompt: "system",
					task: "work",
					tools: ["read"],
				}),
			].join("\n"),
		);
		const controller = new AbortController();
		// abort #1 = budget soft-stop (abortSent still false); abort #2 =
		// budget hard-abort's abortActiveSession (abortReason already "budget").
		// Fire the shutdown only on #2 so it must supersede the budget reason.
		let abortInvocations = 0;
		const handle = createMockSession(
			({ promptIndex, emit, pushMessage }) => {
				if (promptIndex !== 1) return;
				// Never yields: budget 2 → stop at 3, grace exhausted at 8.
				for (let i = 1; i <= 8; i++) {
					const message = assistantText(`burning request ${i}`);
					pushMessage(message);
					emit({ type: "message_end", message } as unknown as AgentSessionEvent);
				}
			},
			() => {
				abortInvocations += 1;
				if (abortInvocations >= 2 && !controller.signal.aborted) {
					controller.abort(ASYNC_JOB_MANAGER_SHUTDOWN_REASON);
				}
			},
		);
		mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session, workerSessionFile);

		const result = await runSubprocess({ ...baseOptions(id), signal: controller.signal });

		expect(result.aborted).toBe(true);
		expect(AgentRegistry.global().get(id)).toBeUndefined();
		expect(handle.disposeCalls()).toBeGreaterThanOrEqual(1);
		expect(await Bun.file(`${workerSessionFile}.tombstone`).exists()).toBe(false);
		const restored = new AgentRegistry();
		await registerPersistedSubagents(restored, rootSessionFile);
		expect(restored.get(id)?.status).toBe("parked");
	});

	it("manager shutdown restores a running kept-alive agent as parked without a tombstone", async () => {
		const id = "ShutdownScout";
		const rootSessionFile = `${tempDir.path()}/main.jsonl`;
		const workerSessionFile = `${tempDir.path()}/main/${id}.jsonl`;
		await Bun.write(rootSessionFile, "");
		await Bun.write(
			workerSessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id, timestamp: "2026-08-13T17:14:48.000Z", cwd: "/tmp" }),
				JSON.stringify({
					type: "session_init",
					id: "si",
					parentId: null,
					timestamp: "2026-08-13T17:14:48.000Z",
					systemPrompt: "system",
					task: "work",
					tools: ["read"],
				}),
			].join("\n"),
		);
		const promptStarted = Promise.withResolvers<void>();
		const promptStopped = Promise.withResolvers<void>();
		const handle = createMockSession(
			async ({ promptIndex }) => {
				if (promptIndex !== 1) return;
				promptStarted.resolve();
				await promptStopped.promise;
			},
			() => promptStopped.resolve(),
		);
		mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session, workerSessionFile);
		const manager = new AsyncJobManager({ maxRunningJobs: 1 });
		AsyncJobManager.setInstance(manager);
		manager.register(
			"task",
			"shutdown regression",
			async ({ signal }) => {
				const result = await runSubprocess({ ...baseOptions(id), signal });
				return result.output;
			},
			{ ownerId: "Main", agentId: id },
		);

		await promptStarted.promise;
		await manager.dispose({ timeoutMs: 1_000 });
		AsyncJobManager.setInstance(undefined);

		expect(await Bun.file(`${workerSessionFile}.tombstone`).exists()).toBe(false);
		expect(AgentRegistry.global().get(id)).toBeUndefined();
		const restoredRegistry = new AgentRegistry();
		await registerPersistedSubagents(restoredRegistry, rootSessionFile);
		expect(restoredRegistry.get(id)?.status).toBe("parked");
	});

	it("a nested spawn reaches the root RPC surface through the inherited observability bus", async () => {
		const id = "WiringScout";
		// Separate session and observability buses, the way the CLI wires them.
		const sessionBus = new EventBus();
		const treeBus = new EventBus();
		const frames: RpcSubagentFrame[] = [];
		let resolveTerminalLatch: (() => void) | undefined;
		const waitForTerminal = (): Promise<void> => {
			const deferred = Promise.withResolvers<void>();
			resolveTerminalLatch = deferred.resolve;
			return deferred.promise;
		};
		const rpcRegistry = new RpcSubagentRegistry(treeBus, frame => {
			frames.push(frame);
			if (frame.type !== "subagent_lifecycle" || frame.payload.status === "started") return;
			resolveTerminalLatch?.();
			resolveTerminalLatch = undefined;
		});
		rpcRegistry.setSubscriptionLevel("events");
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			// The depth-2 executor publishes on the bus its spawner handed down —
			// captured from the real spawn options, not the test's own bus.
			capturedOptions?.subagentEventBus?.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
				id: `${id}.Grandkid`,
				agent: "task",
				agentSource: "bundled",
				status: "started",
				parentToolCallId: "call-grandkid",
				index: 2,
			});
			const message = assistantText("settling");
			pushMessage(message);
			emit({ type: "message_end", message } as unknown as AgentSessionEvent);
		});
		let capturedOptions: { subagentEventBus?: EventBus } | undefined;
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async options => {
			capturedOptions = options;
			return {
				session: handle.session,
				extensionsResult: {} as unknown as LoadExtensionsResult,
				setToolUIContext: () => {},
				eventBus: new EventBus(),
			} satisfies CreateAgentSessionResult;
		});
		registerRunning(id, handle.session);

		const terminal = waitForTerminal();
		await runSubprocess(baseOptions(id, sessionBus, treeBus));
		await terminal;

		// The spawn wiring inherited the tree bus into the nested session.
		expect(capturedOptions?.subagentEventBus).toBe(treeBus);
		// The root RPC surface observed the depth-1 run…
		expect(frames.some(frame => frame.type === "subagent_lifecycle" && frame.payload.id === id)).toBe(true);
		// …and the depth-2 frame published on the inherited bus.
		expect(frames.some(frame => frame.type === "subagent_lifecycle" && frame.payload.id === `${id}.Grandkid`)).toBe(
			true,
		);
	});

	it("an aliased observability bus does not duplicate lifecycle frames", async () => {
		const id = "AliasScout";
		// An SDK caller wiring the same EventBus into both slots must not see
		// every frame twice — the executor skips the aliased re-emit.
		const sharedBus = new EventBus();
		const settled: string[] = [];
		const terminal = Promise.withResolvers<void>();
		sharedBus.on(TASK_SUBAGENT_LIFECYCLE_CHANNEL, frame => {
			const payload = frame as { id?: string; status?: string };
			if (payload.id !== id) return;
			if (payload.status === "started") return;
			settled.push(payload.status ?? "");
			terminal.resolve();
		});
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			const message = assistantText("settling");
			pushMessage(message);
			emit({ type: "message_end", message } as unknown as AgentSessionEvent);
		});
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async () => {
			return {
				session: handle.session,
				extensionsResult: {} as unknown as LoadExtensionsResult,
				setToolUIContext: () => {},
				eventBus: new EventBus(),
			} satisfies CreateAgentSessionResult;
		});
		registerRunning(id, handle.session);

		await runSubprocess(baseOptions(id, sharedBus, sharedBus));
		await terminal.promise;

		expect(settled).toEqual(["completed"]);
	});

	it("a caller-signal abort keeps the kept-alive agent resumable via irc", async () => {
		const id = "CancelledScout";
		const controller = new AbortController();
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			const message = assistantText("working");
			pushMessage(message);
			emit({ type: "message_end", message } as unknown as AgentSessionEvent);
			controller.abort();
		});
		mockCreateAgentSession(handle.session);
		registerRunning(id, handle.session);

		const result = await runSubprocess({ ...baseOptions(id), signal: controller.signal });

		expect(result.aborted).toBe(true);
		expect(AgentRegistry.global().get(id)?.status).toBe("idle");
		expect(AgentLifecycleManager.global().has(id)).toBe(true);
		expect(handle.disposeCalls()).toBe(0);

		const receipt = await new IrcBus().send({ from: "Main", to: id, body: "resume" });
		expect(receipt.outcome).toBe("woken");
	});
});

type CompactionEndEvent = Extract<AgentSessionEvent, { type: "auto_compaction_end" }>;

// Each fixture copies the shape of a real `auto_compaction_end` emitter in
// session/session-maintenance.ts, named after its source.
const snapcompactDone: CompactionEndEvent = {
	// #commitAutoCompactionResult: a committed threshold/overflow compaction.
	type: "auto_compaction_end",
	action: "snapcompact",
	result: { summary: "summary", firstKeptEntryId: "entry-1", tokensBefore: 120_000 },
	aborted: false,
	willRetry: false,
};
const shakeReclaimed: CompactionEndEvent = {
	// #runAutoShake success: a reclaimed shake carries no result.
	type: "auto_compaction_end",
	action: "shake",
	result: undefined,
	aborted: false,
	willRetry: true,
	skipped: false,
};
const shakeNothing: CompactionEndEvent = {
	// #runAutoShake success path when nothing was reclaimed.
	type: "auto_compaction_end",
	action: "shake",
	result: undefined,
	aborted: false,
	willRetry: false,
	skipped: true,
};
const shakeFallback: CompactionEndEvent = {
	// #runAutoShake fallback: reclaimed but still over threshold; the next method emits its own end.
	type: "auto_compaction_end",
	action: "shake",
	result: undefined,
	aborted: false,
	willRetry: false,
	skipped: false,
	errorMessage: "Auto-shake reclaimed ~1000 tokens but context is still above the threshold",
};
const abortedEnd: CompactionEndEvent = {
	// runAutoCompaction: a hook cancelled the compaction.
	type: "auto_compaction_end",
	action: "snapcompact",
	result: undefined,
	aborted: true,
	willRetry: false,
};
const failedEnd: CompactionEndEvent = {
	// #runAutoShake catch: the shake threw.
	type: "auto_compaction_end",
	action: "shake",
	result: undefined,
	aborted: false,
	willRetry: false,
	skipped: false,
	errorMessage: "shake failed",
};

describe("runSubprocess soft compaction budget", () => {
	let tempDir: TempDir;

	beforeEach(() => {
		AgentRegistry.resetGlobalForTests();
		AgentLifecycleManager.resetGlobalForTests();
		AsyncJobManager.resetForTests();
		tempDir = TempDir.createSync("@pi-compaction-budget-");
	});
	afterEach(() => {
		vi.restoreAllMocks();
		AgentLifecycleManager.resetGlobalForTests();
		AgentRegistry.resetGlobalForTests();
		AsyncJobManager.resetForTests();
		tempDir[Symbol.dispose]();
	});

	function compactionOptions(id: string, compactionBudget: number) {
		return {
			cwd: "/tmp",
			agent: baseAgent,
			task: "inventory the api surface",
			index: 0,
			id,
			settings: Settings.isolated({ "task.softRequestBudget": 0, "task.softCompactionBudget": compactionBudget }),
			modelRegistry: { refresh: async () => {} } as unknown as ModelRegistry,
			enableLsp: false,
			artifactsDir: tempDir.path(),
		};
	}

	function start(id: string, handle: MockSessionHandle) {
		mockCreateAgentSession(handle.session);
		AgentRegistry.global().register({
			id,
			displayName: id,
			kind: "sub",
			session: handle.session,
			sessionFile: null,
			status: "running",
		});
	}

	function emitYield(
		emit: (event: AgentSessionEvent) => void,
		pushMessage: (message: unknown) => void,
		report: string,
	): void {
		const yieldMessage = {
			role: "assistant" as const,
			content: [
				{ type: "toolCall" as const, id: `tool-yield-${report}`, name: "yield", arguments: { data: { report } } },
			],
			stopReason: "toolUse" as const,
		};
		pushMessage(yieldMessage);
		emit({ type: "message_end", message: yieldMessage } as unknown as AgentSessionEvent);
		emit({
			type: "tool_execution_end",
			toolCallId: `tool-yield-${report}`,
			toolName: "yield",
			result: {
				content: [{ type: "text", text: "Result submitted." }],
				details: { status: "success", data: { report } },
			},
			isError: false,
		} as AgentSessionEvent);
	}

	function emitAssistant(
		emit: (event: AgentSessionEvent) => void,
		pushMessage: (message: unknown) => void,
		text: string,
	): void {
		const message = assistantText(text);
		pushMessage(message);
		emit({ type: "message_end", message } as unknown as AgentSessionEvent);
	}

	const compactionNotices = (handle: MockSessionHandle) =>
		handle.sentUserMessages.filter(message => message.options?.deliverAs === "steer");

	/** Runs `ends` on the first prompt and answers a forced wrap-up prompt with a terminal yield. */
	async function runWithEnds(id: string, budget: number, ends: readonly CompactionEndEvent[]) {
		let abortCallsAtReminder: number | undefined;
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex === 1) {
				for (const [index, end] of ends.entries()) {
					emitAssistant(emit, pushMessage, `exploring ${index + 1}`);
					emit(end);
				}
				return;
			}
			abortCallsAtReminder = handle.abortCalls();
			emitYield(emit, pushMessage, "partial findings");
		});
		start(id, handle);
		const result = await runSubprocess(compactionOptions(id, budget));
		return { handle, result, abortCallsAtReminder };
	}

	it("#given compaction budget 2 #when a third completed compaction ends #then the turn is stopped and a forced final yield returns the partial report", async () => {
		const { handle, result, abortCallsAtReminder } = await runWithEnds("CompactingScout", 2, [
			snapcompactDone,
			snapcompactDone,
			snapcompactDone,
		]);

		// One notice, built when the count reached the budget (2), not at compaction 1.
		expect(compactionNotices(handle)).toEqual([
			{ content: buildCompactionBudgetNotice(2, 2), options: { deliverAs: "steer", attribution: "agent" } },
		]);
		expect(abortCallsAtReminder).toBe(1);
		expect(handle.prompts).toHaveLength(2);
		expect(handle.prompts[1]?.options?.synthetic).toBe(true);
		expect(handle.prompts[1]?.options?.toolChoice).toEqual({ type: "tool", name: "yield" });
		expect(handle.prompts[1]?.text).toContain("Compaction budget crossed");
		expect(result.aborted).toBe(false);
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.output)).toEqual({ report: "partial findings" });
	});

	it("#given compaction budget 2 #when reclaimed shakes end #then they count like any compaction", async () => {
		const { handle, result } = await runWithEnds("ShakingScout", 2, [shakeReclaimed, shakeReclaimed, shakeReclaimed]);

		expect(compactionNotices(handle)).toEqual([
			{ content: buildCompactionBudgetNotice(2, 2), options: { deliverAs: "steer", attribution: "agent" } },
		]);
		expect(handle.prompts).toHaveLength(2);
		expect(handle.prompts[1]?.options?.toolChoice).toEqual({ type: "tool", name: "yield" });
		expect(result.aborted).toBe(false);
		expect(JSON.parse(result.output)).toEqual({ report: "partial findings" });
	});

	for (const [name, fixture] of [
		["shakeNothing", shakeNothing],
		["shakeFallback", shakeFallback],
		["abortedEnd", abortedEnd],
		["failedEnd", failedEnd],
	] as const) {
		it(`#given compaction budget 2 #when one non-counting end (${name}) and then one completed compaction end #then no notice is sent`, async () => {
			const id = `Uncounted${name}`;
			let noticesAfterFirstCompletion: number | undefined;
			const handle = createMockSession(async ({ promptIndex, emit, pushMessage }) => {
				if (promptIndex !== 1) return;
				emitAssistant(emit, pushMessage, "exploring 1");
				emit(fixture);
				emitAssistant(emit, pushMessage, "exploring 2");
				emit(snapcompactDone);
				// The notice is sent behind one microtask boundary; let it land before counting.
				await Promise.resolve();
				noticesAfterFirstCompletion = compactionNotices(handle).length;
				emitAssistant(emit, pushMessage, "exploring 3");
				emit(snapcompactDone);
				emitYield(emit, pushMessage, "full findings");
			});
			start(id, handle);

			const result = await runSubprocess(compactionOptions(id, 2));

			expect(noticesAfterFirstCompletion).toBe(0);
			expect(compactionNotices(handle)).toEqual([
				{ content: buildCompactionBudgetNotice(2, 2), options: { deliverAs: "steer", attribution: "agent" } },
			]);
			// No stop: the run ends on its own yield, without a forced wrap-up prompt.
			expect(handle.prompts).toHaveLength(1);
			expect(result.aborted).toBe(false);
			expect(JSON.parse(result.output)).toEqual({ report: "full findings" });
		});
	}

	function emitToolTurn(
		emit: (event: AgentSessionEvent) => void,
		pushMessage: (message: unknown) => void,
		index: number,
	): void {
		const message = {
			role: "assistant" as const,
			content: [{ type: "toolCall" as const, id: `tool-read-${index}`, name: "read", arguments: { path: "a.ts" } }],
			stopReason: "toolUse" as const,
		};
		pushMessage(message);
		emit({ type: "message_end", message } as unknown as AgentSessionEvent);
	}

	it("#given an unstructured run with compaction budget 1 #when the compaction after its final report crosses the budget #then the delivered report stands without a forced wrap-up", async () => {
		const id = "ObedientScout";
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) {
				emitAssistant(emit, pushMessage, "second report");
				return;
			}
			emitToolTurn(emit, pushMessage, 1);
			emit(snapcompactDone);
			// The agent obeys the notice and ends its turn with the report; post-turn
			// maintenance then compacts once more, which crosses the budget.
			emitAssistant(emit, pushMessage, "first report");
			emit(snapcompactDone);
		});
		start(id, handle);

		const result = await runSubprocess({ ...compactionOptions(id, 1), structured: false });

		expect(compactionNotices(handle)).toHaveLength(1);
		expect(handle.prompts).toHaveLength(1);
		expect(result.aborted).toBe(false);
		expect(result.exitCode).toBe(0);
		expect(result.output).toBe("first report");
	});

	it("#given an unstructured run with compaction budget 1 #when the budget is crossed mid-turn #then a tool-less forced wrap-up returns the report", async () => {
		const id = "WanderingScout";
		const handle = createMockSession(({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) {
				emitAssistant(emit, pushMessage, "partial report");
				return;
			}
			emitToolTurn(emit, pushMessage, 1);
			emit(snapcompactDone);
			emitToolTurn(emit, pushMessage, 2);
			emit(snapcompactDone);
		});
		start(id, handle);

		const result = await runSubprocess({ ...compactionOptions(id, 1), structured: false });

		expect(handle.prompts).toHaveLength(2);
		expect(handle.prompts[1]?.options?.toolChoice).toBe("none");
		expect(handle.prompts[1]?.text).toContain("Compaction budget crossed");
		expect(result.aborted).toBe(false);
		expect(result.output).toBe("partial report");
	});

	it("#given compaction budget 0 #when five compactions end #then no notice and no stop", async () => {
		const id = "UnguardedScout";
		const handle = createMockSession(async ({ promptIndex, emit, pushMessage }) => {
			if (promptIndex !== 1) return;
			for (let i = 1; i <= 5; i++) {
				emitAssistant(emit, pushMessage, `exploring ${i}`);
				emit(snapcompactDone);
			}
			emitYield(emit, pushMessage, "full findings");
		});
		start(id, handle);

		const result = await runSubprocess(compactionOptions(id, 0));

		expect(compactionNotices(handle)).toEqual([]);
		expect(handle.prompts).toHaveLength(1);
		expect(result.aborted).toBe(false);
		expect(JSON.parse(result.output)).toEqual({ report: "full findings" });
	});

	it("#given a compaction stop #when the agent keeps answering without yield #then the run hard-aborts after 5 more requests with the compaction abort reason", async () => {
		const id = "CirclingScout";
		let emittedRequests = 0;
		const emittedAtAbort: number[] = [];
		const handle = createMockSession(
			({ promptIndex, emit, pushMessage }) => {
				if (promptIndex !== 1) return;
				// Request 1, then compactions 1-3: the stop lands at request 1.
				emittedRequests = 1;
				emitAssistant(emit, pushMessage, "exploring 1");
				emit(snapcompactDone);
				emit(snapcompactDone);
				emit(snapcompactDone);
				// Never yields: requests 2-7 would run past the grace window (1 + 5).
				for (let i = 2; i <= 7; i++) {
					emittedRequests = i;
					emitAssistant(emit, pushMessage, `circling ${i}`);
				}
			},
			() => {
				emittedAtAbort.push(emittedRequests);
			},
		);
		start(id, handle);

		const result = await runSubprocess(compactionOptions(id, 2));

		// abort #1 = compaction soft-stop at request 1; abort #2 = grace hard-abort at 1 + 5.
		expect(emittedAtAbort.slice(0, 2)).toEqual([1, 6]);
		expect(result.aborted).toBe(true);
		expect(result.abortReason).toBe(
			"Soft compaction budget exceeded (3 compactions; budget 2) — agent did not yield when force-stopped",
		);
	});
});

describe("resolveSoftRequestBudget", () => {
	it("lets a configured budget lower a bundled agent's ceiling", () => {
		expect(resolveSoftRequestBudget("scout", 20)).toBe(20);
		expect(resolveSoftRequestBudget("sonic", 20)).toBe(20);
	});

	it("keeps the bundled ceiling when the configured budget is higher", () => {
		expect(resolveSoftRequestBudget("scout", 200)).toBe(100);
		expect(resolveSoftRequestBudget("sonic", 200)).toBe(100);
	});

	it("uses the configured budget for agents without a bundled entry", () => {
		expect(resolveSoftRequestBudget("task", 20)).toBe(20);
	});

	it("keeps 0 disabled and normalizes negative or fractional budgets", () => {
		expect(resolveSoftRequestBudget("scout", 0)).toBe(0);
		expect(resolveSoftRequestBudget("scout", -5)).toBe(0);
		expect(resolveSoftRequestBudget("scout", 20.9)).toBe(20);
	});

	it("lets an agent's own entry replace the configured budget and the bundled ceiling", () => {
		expect(resolveSoftRequestBudget("lead", 200, { lead: 400 })).toBe(400);
		expect(resolveSoftRequestBudget("scout", 200, { scout: 150 })).toBe(150);
		expect(resolveSoftRequestBudget("task", 200, { task: 50 })).toBe(50);
	});

	it("keeps agents without an entry on the configured budget and bundled ceilings", () => {
		const agentBudgets = { lead: 400 };
		expect(resolveSoftRequestBudget("task", 200, agentBudgets)).toBe(200);
		expect(resolveSoftRequestBudget("scout", 200, agentBudgets)).toBe(100);
		expect(resolveSoftRequestBudget("sonic", 200, agentBudgets)).toBe(100);
	});

	it("disables only the named agent's guard with an entry of 0", () => {
		expect(resolveSoftRequestBudget("lead", 200, { lead: 0 })).toBe(0);
		expect(resolveSoftRequestBudget("task", 200, { lead: 0 })).toBe(200);
	});

	it("applies an agent's entry when the configured budget disables the guard", () => {
		expect(resolveSoftRequestBudget("lead", 0, { lead: 400 })).toBe(400);
		expect(resolveSoftRequestBudget("task", 0, { lead: 400 })).toBe(0);
	});
});

describe("task.agentSoftRequestBudget", () => {
	it("rejects entries that are not non-negative integer request counts", () => {
		for (const budget of [-1, 1.5, "400", [400]]) {
			expect(() => Settings.isolated({ "task.agentSoftRequestBudget": { lead: budget } })).toThrow(
				"Invalid task.agentSoftRequestBudget.lead",
			);
		}
		expect(() => Settings.isolated({ "task.agentSoftRequestBudget": [400] })).toThrow(
			"Invalid task.agentSoftRequestBudget:",
		);
	});

	it("lets a higher settings layer clear a lower layer's entry with null", async () => {
		using tempDir = TempDir.createSync("@pi-agent-budget-");
		const agentDir = path.join(tempDir.path(), "agent");
		const overlay = path.join(tempDir.path(), "overlay.yml");
		await Bun.write(
			path.join(agentDir, "config.yml"),
			JSON.stringify({ task: { agentSoftRequestBudget: { scout: 150, lead: 400 } } }),
		);
		await Bun.write(overlay, JSON.stringify({ task: { agentSoftRequestBudget: { scout: null } } }));

		// Ambient overlays would join the layers under test.
		const previousConfigFiles = process.env.PI_CONFIG_FILES;
		delete process.env.PI_CONFIG_FILES;
		try {
			const settings = await Settings.loadReadOnly({ agentDir, cwd: tempDir.path(), configFiles: [overlay] });
			const agentBudgets = cfgTaskAgentSoftRequestBudget.get(settings);
			expect(resolveSoftRequestBudget("scout", 200, agentBudgets)).toBe(100);
			expect(resolveSoftRequestBudget("lead", 200, agentBudgets)).toBe(400);
		} finally {
			if (previousConfigFiles === undefined) delete process.env.PI_CONFIG_FILES;
			else process.env.PI_CONFIG_FILES = previousConfigFiles;
		}
	});
});
