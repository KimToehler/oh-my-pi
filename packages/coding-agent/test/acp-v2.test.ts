/**
 * ACP protocol v2 over the wire.
 *
 * Every test drives `createAcpConnection(..., { maxVersion })` through a raw NDJSON client, so the exact bytes the
 * agent writes are what is asserted. Insertion and identity scenarios use a real `AgentSession` with the mock
 * provider. Every v2 frame is validated against the vendored schema; the last test asserts the suite-wide
 * mapping conformance (plan Verification 7).
 *
 * "Plan N" below is the numbered item in `.omo/plans/ACP_V2_BASELINE_PLAN.md` Verification.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, setDefaultTimeout, vi } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { SimpleStreamOptions } from "@oh-my-pi/pi-ai";
import { createMockModel, type MockCall, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { ExtensionRuntime, loadExtensionFromFactory } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import type { ExtensionUIContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import * as skillsModule from "@oh-my-pi/pi-coding-agent/extensibility/skills";
import { singleShotOutcome } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-foreground";
import type { AcpSessionFactory } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { SubmissionOutcome } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TurnRecovery } from "@oh-my-pi/pi-coding-agent/session/turn-recovery";
import { EventBus } from "@oh-my-pi/pi-coding-agent/utils/event-bus";
import { getAgentDbPath, isRecord } from "@oh-my-pi/pi-utils";
import {
	cleanupHarnessState,
	createV2WireHarness,
	eventLoopTurns,
	type RawAcpClient,
	type RawAcpRequestHandler,
	type RawAcpResponse,
	v2SuiteFrames,
	v2SuiteSchemaIssues,
	type V2WireHarness,
} from "./acp-test-harness";

setDefaultTimeout(20_000);

// ---------------------------------------------------------------------------
// Real-session rig: AgentSession + mock provider behind the ACP session factory
// ---------------------------------------------------------------------------

interface ModelCallGate {
	reached: PromiseWithResolvers<void>;
	release: PromiseWithResolvers<void>;
}

interface RigOptions {
	/** Model calls (0-based, across the rig) that block until released or aborted. */
	hold?: number[];
	/** Held calls keep waiting through an abort (a provider stream that does not honour the signal). */
	heldIgnoresAbort?: boolean;
	/** Scripted responses by model call index; other calls reply `reply <n>`. */
	script?: Record<number, MockResponse>;
	tools?: AgentTool[];
	/** Registers an extension command with this name; its handler does nothing. */
	extensionCommand?: string;
	/** Registers a `/skill:<name>` command backed by a real SKILL.md in the session cwd. */
	skill?: string;
	asyncJobManager?: AsyncJobManager;
	agentId?: string;
	settings?: Record<string, unknown>;
	/** Delays every `tool_execution_start` delivery to session subscribers until resolved. */
	holdToolStarts?: PromiseWithResolvers<void>;
	/** Receives the extension UI context the ACP layer installs for tools (it does so only for a form-capable client). */
	toolUi?: { current?: ExtensionUIContext };
}

class RealSessionRig {
	readonly sessions: AgentSession[] = [];
	/** Every `onSubmissionOutcome` report the ACP layer's `session.prompt` calls received, in order. */
	readonly outcomes: SubmissionOutcome[] = [];
	readonly mockCalls: MockCall[][] = [];
	readonly #held: Set<number>;
	readonly #gates = new Map<number, ModelCallGate>();
	readonly #storages: AuthStorage[] = [];
	#calls = 0;

	constructor(readonly options: RigOptions = {}) {
		this.#held = new Set(options.hold ?? []);
	}

	get modelCalls(): number {
		return this.#calls;
	}

	gate(n: number): ModelCallGate {
		let gate = this.#gates.get(n);
		if (!gate) {
			gate = { reached: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
			this.#gates.set(n, gate);
		}
		return gate;
	}

	sessionById(sessionId: string): AgentSession {
		const session = this.sessions.find(candidate => candidate.sessionId === sessionId);
		if (!session) throw new Error(`no session ${sessionId}`);
		return session;
	}

	readonly factory: AcpSessionFactory = async cwd => {
		const options = this.options;
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");
		// Reply as the session's own model so a resumed transcript records a restorable model, as in production.
		const mock = createMockModel({
			provider: model.provider,
			id: model.id,
			handler: async (_context, streamOptions?: SimpleStreamOptions) => {
				const n = this.#calls++;
				this.gate(n).reached.resolve();
				if (this.#held.has(n)) {
					if (options.heldIgnoresAbort) {
						await this.gate(n).release.promise;
					} else {
						const aborted = Promise.withResolvers<void>();
						streamOptions?.signal?.addEventListener("abort", () => aborted.resolve(), { once: true });
						await Promise.race([this.gate(n).release.promise, aborted.promise]);
						if (streamOptions?.signal?.aborted) return { throw: "aborted" };
					}
				}
				return options.script?.[n] ?? { content: [`reply ${n}`] };
			},
		});
		this.mockCalls.push(mock.calls as MockCall[]);
		const tools = options.tools ?? [];
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		this.#storages.push(authStorage);
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		const manager = SessionManager.create(cwd);
		let extensionRunner: ExtensionRunner | undefined;
		if (options.extensionCommand) {
			const runtime = new ExtensionRuntime();
			const extension = await loadExtensionFromFactory(
				pi => pi.registerCommand(options.extensionCommand!, { handler: async () => {} }),
				cwd,
				new EventBus(),
				runtime,
				"v2-test-command",
			);
			extensionRunner = new ExtensionRunner([extension], runtime, cwd, manager, modelRegistry);
		}
		const skillDir = options.skill ? path.join(cwd, "skills", options.skill) : undefined;
		if (skillDir) {
			fs.mkdirSync(skillDir, { recursive: true });
			fs.writeFileSync(
				path.join(skillDir, "SKILL.md"),
				`---\nname: ${options.skill}\ndescription: test skill\n---\nDo the review.\n`,
			);
		}
		const session = new AgentSession({
			skillsSettings: { enableSkillCommands: true },
			skills:
				options.skill && skillDir
					? [
							{
								name: options.skill,
								description: "test skill",
								filePath: path.join(skillDir, "SKILL.md"),
								baseDir: skillDir,
								source: "project",
							},
						]
					: [],
			agent,
			sessionManager: manager,
			settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false, ...options.settings }),
			modelRegistry,
			extensionRunner,
			agentId: options.agentId,
			asyncJobManager: options.asyncJobManager,
			toolRegistry: new Map(tools.map(tool => [tool.name, tool])),
		});
		// Observe the submission-outcome seam without changing it: every report is recorded, then forwarded.
		const prompt = session.prompt.bind(session);
		session.prompt = (text, promptOptions) =>
			prompt(text, {
				...promptOptions,
				onSubmissionOutcome: outcome => {
					this.outcomes.push(outcome);
					promptOptions?.onSubmissionOutcome?.(outcome);
				},
			});
		const { holdToolStarts } = options;
		if (holdToolStarts) {
			// Delay `tool_execution_start` delivery to subscribers (the ACP surface) until released.
			const subscribe = session.subscribe.bind(session);
			session.subscribe = listener =>
				subscribe(event => {
					if (event.type === "tool_execution_start") void holdToolStarts.promise.then(() => listener(event));
					else listener(event);
				});
		}
		this.sessions.push(session);
		if (!options.toolUi) return session;
		const { toolUi } = options;
		return {
			session,
			setToolUIContext: uiContext => {
				toolUi.current = uiContext;
			},
		};
	};

	async dispose(): Promise<void> {
		for (const gate of this.#gates.values()) gate.release.resolve();
		for (const session of this.sessions) await session.dispose();
		for (const storage of this.#storages) storage.close();
	}
}

function fakeBashTool(): AgentTool & { executeCalls: number } {
	const tool = {
		name: "bash",
		label: "bash",
		description: "Fake bash",
		parameters: type({ "command?": "string" }),
		executeCalls: 0,
		async execute() {
			tool.executeCalls++;
			return { content: [{ type: "text" as const, text: "ok" }] };
		},
	};
	return tool;
}

// ---------------------------------------------------------------------------
// Wire helpers
// ---------------------------------------------------------------------------

const INFO = { name: "acp-v2-test", version: "0" };
const BASH_CALL: MockResponse = {
	content: [{ type: "toolCall", id: "call-bash", name: "bash", arguments: { command: "echo hi" } }],
};

interface Started {
	h: V2WireHarness;
	rig: RealSessionRig;
	client: RawAcpClient;
	sessionId: string;
	session: AgentSession;
}

const teardown: Array<() => Promise<void>> = [];

afterEach(async () => {
	for (const step of teardown.splice(0)) await step();
	await cleanupHarnessState();
	AsyncJobManager.resetForTests();
});

function resultOf(response: RawAcpResponse): Record<string, unknown> {
	if (response.error) throw new Error(`unexpected error ${response.error.code}: ${response.error.message}`);
	if (!isRecord(response.result)) throw new Error("expected an object result");
	return response.result;
}

async function initialize(
	client: RawAcpClient,
	capabilities: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
	return resultOf(await client.request("initialize", { protocolVersion: 2, info: INFO, capabilities }));
}

async function startReal(
	rigOptions: RigOptions = {},
	onRequest?: RawAcpRequestHandler,
	capabilities: Record<string, unknown> = {},
): Promise<Started> {
	const rig = new RealSessionRig(rigOptions);
	const h = await createV2WireHarness({ factory: rig.factory, onRequest });
	teardown.push(async () => {
		await h.close();
		await rig.dispose();
	});
	await initialize(h.client, capabilities);
	const created = resultOf(await h.client.request("session/new", { cwd: h.cwd, mcpServers: [] }));
	const sessionId = String(created.sessionId);
	return { h, rig, client: h.client, sessionId, session: rig.sessionById(sessionId) };
}

function sendPrompt(client: RawAcpClient, sessionId: string, text: string): Promise<RawAcpResponse> {
	return client.request("session/prompt", { sessionId, prompt: [{ type: "text", text }] });
}

function messageIdOf(response: RawAcpResponse): string {
	const id = resultOf(response).messageId;
	if (typeof id !== "string" || id.length === 0) throw new Error("prompt result has no messageId");
	return id;
}

function userEntryIds(session: AgentSession): string[] {
	return session.sessionManager
		.getEntries()
		.filter(entry => entry.type === "message" && entry.message.role === "user")
		.map(entry => entry.id);
}

function contentText(content: unknown): string {
	if (Array.isArray(content)) return content.map(contentText).join("");
	if (isRecord(content) && typeof content.text === "string") return content.text;
	return "";
}

function kindOf(update: Record<string, unknown>): string {
	return String(update.sessionUpdate);
}

/** `user_message` (or chunk) updates for the session, in wire order. */
function userMessages(client: RawAcpClient, sessionId: string) {
	return client
		.updates(sessionId)
		.filter(entry => ["user_message", "user_message_chunk"].includes(kindOf(entry.update)))
		.map(entry => ({
			index: entry.index,
			messageId: entry.update.messageId,
			text: contentText(entry.update.content),
		}));
}

function agentChunkTexts(client: RawAcpClient, sessionId: string): Array<{ index: number; text: string }> {
	return client
		.updates(sessionId)
		.filter(entry => kindOf(entry.update) === "agent_message_chunk")
		.map(entry => ({ index: entry.index, text: contentText(entry.update.content) }));
}

function waitForIdle(client: RawAcpClient, sessionId: string, afterIndex = -1, count = 1): Promise<void> {
	return client.waitFor(
		c => c.states(sessionId).filter(state => state.state === "idle" && state.index > afterIndex).length >= count,
		"idle state_update",
	);
}

function stateNames(client: RawAcpClient, sessionId: string): string[] {
	return client.states(sessionId).map(state => state.state);
}

function allowOnceOptionId(params: unknown): string {
	if (isRecord(params) && Array.isArray(params.options)) {
		for (const option of params.options) {
			if (isRecord(option) && option.kind === "allow_once" && typeof option.optionId === "string") {
				return option.optionId;
			}
		}
	}
	throw new Error("permission request has no allow_once option");
}

function errorCode(response: RawAcpResponse): number | undefined {
	return response.error?.code;
}

beforeAll(() => {
	v2SuiteFrames.length = 0;
	v2SuiteSchemaIssues.length = 0;
});

afterAll(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Plan 1: negotiation
// ---------------------------------------------------------------------------

describe("negotiation (plan 1)", () => {
	it("answers a v2 initialize with a v2 InitializeResponse", async () => {
		// Guards: a client that asks for v2 gets a v1 response and never sees v2 semantics.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		const result = await initialize(h.client);
		expect(result.protocolVersion).toBe(2);
		expect(isRecord(result.info) && result.info.name).toBe("omp");
		expect(result.authMethods).toContainEqual(expect.objectContaining({ methodId: "agent", type: "agent" }));
		// v2 initialize omits the v1 steering extension.
		expect(isRecord(result._meta) && "steering" in result._meta).toBe(false);
		expect(h.client.schemaIssues).toEqual([]);
	});

	it("answers a request for a newer version with 2", async () => {
		// Guards: a client built for a later version is rejected instead of downgraded.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		const response = resultOf(
			await h.client.request("initialize", { protocolVersion: 3, info: INFO, capabilities: {} }),
		);
		expect(response.protocolVersion).toBe(2);
	});

	it("rejects a missing, zero, or non-integer protocolVersion with -32602", async () => {
		// Guards: a malformed handshake is silently accepted as v1.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		for (const params of [{ info: INFO }, { protocolVersion: 0, info: INFO }, { protocolVersion: "2", info: INFO }]) {
			expect(errorCode(await h.client.request("initialize", params))).toBe(-32602);
		}
		// The failed handshakes left the connection uninitialized, so a valid one still succeeds.
		expect((await initialize(h.client)).protocolVersion).toBe(2);
	});

	it("rejects a second initialize with -32600", async () => {
		// Guards: a re-initialize swaps protocol versions mid-session.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		await initialize(h.client);
		expect(errorCode(await h.client.request("initialize", { protocolVersion: 2, info: INFO }))).toBe(-32600);
	});

	it("stays on v1 when the agent's maximum is 1 (GUARD)", async () => {
		// Guards: flag-off users are moved to v2.
		const h = await createV2WireHarness({ maxVersion: 1, validate: false });
		teardown.push(() => h.close());
		const result = resultOf(await h.client.request("initialize", { protocolVersion: 2, clientCapabilities: {} }));
		expect(result.protocolVersion).toBe(1);
		expect(result.agentCapabilities).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Plan 2: submission outcome, acknowledged over the wire
// ---------------------------------------------------------------------------

describe("prompt acknowledgement (plan 2)", () => {
	it("resolves with the persisted user entry id while the turn still streams; user_message follows", async () => {
		// Guards: the client's message id differs from the replayed one, or the prompt blocks until turn end.
		const { rig, client, sessionId, session } = await startReal({ hold: [0] });
		const response = await sendPrompt(client, sessionId, "hello");
		const messageId = messageIdOf(response);
		expect(session.isStreaming).toBe(true);
		expect(client.states(sessionId).some(state => state.state === "idle")).toBe(false);
		expect(userEntryIds(session)).toEqual([messageId]);
		expect(rig.outcomes).toEqual([{ kind: "inserted", entryId: messageId }]);
		// Not before the response: the id was unknown to the client until it arrived.
		expect(userMessages(client, sessionId).filter(message => message.index < response.index)).toEqual([]);

		rig.gate(0).release.resolve();
		await waitForIdle(client, sessionId);
		const echoed = userMessages(client, sessionId);
		expect(echoed).toHaveLength(1);
		expect(echoed[0]).toMatchObject({ messageId, text: "hello" });
		expect(echoed[0]!.index).toBeGreaterThan(response.index);
		expect(rig.outcomes).toHaveLength(1);
	});

	it("maps a usage-preflight denial to a JSON-RPC error and does not block the next prompt", async () => {
		// Guards: a denied prompt is acknowledged (client shows a message that never exists) or wedges the session.
		const { rig, client, sessionId, session } = await startReal();
		let aborting: Promise<void> | undefined;
		const spy = vi.spyOn(TurnRecovery.prototype, "maybeApplyUsageAwareFallback").mockImplementation(async () => {
			aborting = session.abort();
			return false;
		});
		const denied = await sendPrompt(client, sessionId, "denied");
		await aborting;
		expect(denied.error).toBeDefined();
		expect(denied.error?.code).not.toBe(-32800);
		expect(userEntryIds(session)).toEqual([]);
		expect(userMessages(client, sessionId)).toEqual([]);
		expect(rig.outcomes).toEqual([{ kind: "dropped" }]);

		spy.mockRestore();
		const next = await sendPrompt(client, sessionId, "after denial");
		expect(userEntryIds(session)).toEqual([messageIdOf(next)]);
		await waitForIdle(client, sessionId);
	});

	it("answers requestCancelled for a steer cancelled before insertion and persists no entry", async () => {
		// Guards: a cancelled queued prompt is acknowledged, leaving the client with a phantom message.
		const { rig, client, sessionId, session } = await startReal({ hold: [0] });
		const first = messageIdOf(await sendPrompt(client, sessionId, "first"));
		const queued = sendPrompt(client, sessionId, "queued steer");
		await eventLoopTurns(10);
		await client.notify("session/cancel", { sessionId });
		expect(errorCode(await queued)).toBe(-32800);
		await waitForIdle(client, sessionId);
		expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "cancelled" });
		expect(userEntryIds(session)).toEqual([first]);
		expect(userMessages(client, sessionId).map(message => message.text)).not.toContain("queued steer");
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);
	});

	it("acknowledges an extension command with a live-only id and persists no entry", async () => {
		// Guards: `prompt() === false` mapped to an error, or the id pointing at a nonexistent entry.
		const { rig, client, sessionId, session } = await startReal({ extensionCommand: "noop" });
		const response = await sendPrompt(client, sessionId, "/noop");
		const messageId = messageIdOf(response);
		expect(session.sessionManager.getEntry(messageId)).toBeUndefined();
		expect(userEntryIds(session)).toEqual([]);
		expect(rig.outcomes).toEqual([{ kind: "command" }]);
		await waitForIdle(client, sessionId);
		expect(userMessages(client, sessionId).find(message => message.messageId === messageId)).toBeDefined();
	});

	it("acknowledges an ACP builtin with a live-only id framed by running and idle(end_turn)", async () => {
		// Guards: builtins leave the session `running` forever, or never reach the client as a message.
		const { client, sessionId, session } = await startReal();
		const response = await sendPrompt(client, sessionId, "/jobs");
		const messageId = messageIdOf(response);
		await waitForIdle(client, sessionId);
		expect(session.sessionManager.getEntry(messageId)).toBeUndefined();
		expect(stateNames(client, sessionId)).toEqual(["running", "idle"]);
		expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "end_turn" });
		expect(userMessages(client, sessionId).find(message => message.messageId === messageId)).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Plan 3: overlap
// ---------------------------------------------------------------------------

describe("overlapping prompts (plan 3)", () => {
	it("resolves a second prompt at its own insertion, with no idle between the two", async () => {
		// Guards: the second prompt waits for the first turn to finish, or the UI flickers idle between prompts.
		const { rig, client, sessionId, session } = await startReal({ hold: [0, 1] });
		const first = messageIdOf(await sendPrompt(client, sessionId, "one"));
		const secondPending = sendPrompt(client, sessionId, "two");
		await eventLoopTurns(10);
		rig.gate(0).release.resolve();
		const secondResponse = await secondPending;
		const second = messageIdOf(secondResponse);
		expect(second).not.toBe(first);
		expect(userEntryIds(session)).toEqual([first, second]);
		// The foreground is still running when the second prompt is acknowledged.
		expect(client.states(sessionId).filter(state => state.state === "idle")).toEqual([]);

		rig.gate(1).release.resolve();
		await waitForIdle(client, sessionId);
		expect(stateNames(client, sessionId)).toEqual(["running", "idle"]);
	});
});

describe("ordered state emission (F3 wave 3)", () => {
	it("sends a locally handled command's idle before the next foreground's running", async () => {
		// Guards: the command's deferred idle (behind its echo) lands after the successor's running, so the UI shows idle while the turn runs.
		const { rig, client, sessionId } = await startReal({ extensionCommand: "noop", hold: [0] });
		resultOf(await sendPrompt(client, sessionId, "/noop"));
		resultOf(await sendPrompt(client, sessionId, "work"));
		await rig.gate(0).reached.promise;
		await eventLoopTurns(20);
		expect(stateNames(client, sessionId)).toEqual(["running", "idle", "running"]);
		rig.gate(0).release.resolve();
		await waitForIdle(client, sessionId, -1, 2);
		expect(stateNames(client, sessionId)).toEqual(["running", "idle", "running", "idle"]);
	});
});

describe("skill command stop (F3 wave 3)", () => {
	it("runs nothing and sends no frame after idle(cancelled) when Stop arrives during the skill read", async () => {
		// Guards: a skill whose file read was in flight at Stop still calls the model and persists its message.
		const { rig, client, sessionId, session } = await startReal({ skill: "reviewer" });
		const original = skillsModule.buildSkillPromptMessage;
		const reading = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const spy = vi.spyOn(skillsModule, "buildSkillPromptMessage").mockImplementation(async (...args) => {
			reading.resolve();
			await release.promise;
			return original(...args);
		});
		const dispatched: Array<Promise<unknown>> = [];
		const promptCustomMessage = session.promptCustomMessage.bind(session);
		session.promptCustomMessage = (...args) => {
			const result = promptCustomMessage(...args);
			dispatched.push(result);
			return result;
		};
		try {
			const pending = sendPrompt(client, sessionId, "/skill:reviewer go");
			await reading.promise;
			await client.notify("session/cancel", { sessionId });
			await waitForIdle(client, sessionId);
			expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "cancelled" });
			release.resolve();
			await pending;
			// If the skill wrongly proceeds it reaches promptCustomMessage right after the read; await that dispatch.
			await eventLoopTurns(30);
			await Promise.all(dispatched);
			await Promise.race([rig.gate(0).reached.promise, eventLoopTurns(200)]);
			await session.waitForIdle();
			expect(rig.modelCalls).toBe(0);
			expect(session.sessionManager.getEntries().filter(entry => entry.type === "custom_message")).toEqual([]);
			expect(client.updates(sessionId).at(-1)!.update).toMatchObject({
				sessionUpdate: "state_update",
				state: "idle",
				stopReason: "cancelled",
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// Plan 4: agent-initiated work
// ---------------------------------------------------------------------------

describe("agent-initiated work (plan 4)", () => {
	it("frames a background-job wake after idle with running, chunks, idle(end_turn) and no open prompt", async () => {
		// Guards: a wake turn streams into a session the client believes is idle, with no running/idle framing.
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);
		const { rig, client, sessionId, session } = await startReal({ asyncJobManager: manager, agentId: "AcpOwner" });
		await sendPrompt(client, sessionId, "first");
		await waitForIdle(client, sessionId);
		const base = client.frames.length;
		const callsBefore = rig.modelCalls;

		manager.register("bash", "owned job", async () => "WAKE RESULT", { id: "wake-job", ownerId: "AcpOwner" });
		await session.settleAsyncWork();
		await waitForIdle(client, sessionId, base - 1);

		expect(rig.modelCalls).toBe(callsBefore + 1);
		const wake = client.updates(sessionId).filter(entry => entry.index >= base);
		const firstWakeFrame = wake[0]!;
		expect(firstWakeFrame.update).toMatchObject({ sessionUpdate: "state_update", state: "running" });
		const chunks = agentChunkTexts(client, sessionId).filter(chunk => chunk.index >= base);
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks[0]!.index).toBeGreaterThan(firstWakeFrame.index);
		const idle = client.states(sessionId).at(-1)!;
		expect(idle).toMatchObject({ state: "idle", stopReason: "end_turn" });
		expect(idle.index).toBeGreaterThan(chunks.at(-1)!.index);
		// No prompt was open: the only requests the client sent are the earlier ones.
		expect(client.frames.slice(base).some(frame => "id" in frame && typeof frame.method === "string")).toBe(false);
	});

	it("streams a Goal continuation after the prompt returned, bounded by one running/idle pair", async () => {
		// Guards: continuation frames are lost (prompt-scoped subscription) or each continuation shows idle.
		const { rig, client, sessionId } = await startReal();
		resultOf(
			await client.request("session/set_config_option", {
				sessionId,
				configId: "mode",
				type: "id",
				value: "goal",
			}),
		);
		const response = await sendPrompt(client, sessionId, "Ship feature X");
		messageIdOf(response);
		await waitForIdle(client, sessionId);

		expect(rig.modelCalls).toBe(2);
		const texts = agentChunkTexts(client, sessionId);
		expect(texts.map(chunk => chunk.text)).toEqual(expect.arrayContaining(["reply 0", "reply 1"]));
		expect(texts.find(chunk => chunk.text === "reply 1")!.index).toBeGreaterThan(response.index);
		expect(stateNames(client, sessionId)).toEqual(["running", "idle"]);
		expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "end_turn" });
	});

	it("ends the foreground with idle(end_turn) while a background job runs, then frames the wake separately", async () => {
		// Guards: a v2 foreground stays `running` for as long as an owner-scoped background job is pending.
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);
		const jobGate = Promise.withResolvers<string>();
		// The job is started by a tool executing inside the prompt's turn, not before the prompt.
		const startJob: AgentTool = {
			name: "startjob",
			label: "startjob",
			description: "Starts an owner-scoped background job",
			parameters: type({}),
			async execute() {
				manager.register("bash", "slow job", async () => await jobGate.promise, {
					id: "slow-job",
					ownerId: "AcpOwner",
				});
				return { content: [{ type: "text" as const, text: "started" }] };
			},
		};
		const { rig, client, sessionId } = await startReal({
			asyncJobManager: manager,
			agentId: "AcpOwner",
			tools: [startJob],
			script: { 0: { content: [{ type: "toolCall", id: "call-job", name: "startjob", arguments: {} }] } },
		});
		await sendPrompt(client, sessionId, "start work");
		await waitForIdle(client, sessionId);
		const firstIdle = client.states(sessionId).at(-1)!;
		expect(firstIdle).toMatchObject({ state: "idle", stopReason: "end_turn" });
		expect(rig.modelCalls).toBe(2);

		jobGate.resolve("JOB RESULT");
		await waitForIdle(client, sessionId, firstIdle.index);
		expect(rig.modelCalls).toBe(3);
		const wake = client.states(sessionId).filter(state => state.index > firstIdle.index);
		expect(wake.map(state => state.state)).toEqual(["running", "idle"]);
		const chunks = agentChunkTexts(client, sessionId).filter(chunk => chunk.index > firstIdle.index);
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks[0]!.index).toBeGreaterThan(wake[0]!.index);
		expect(chunks.at(-1)!.index).toBeLessThan(wake[1]!.index);
	});
});

// ---------------------------------------------------------------------------
// Plan 5: cancel and errors
// ---------------------------------------------------------------------------

describe("cancel and errors (plan 5)", () => {
	it("emits idle(cancelled) after the pending updates, as the last frame", async () => {
		// Guards: idle(cancelled) overtakes in-flight updates, so the client renders a chunk after idle.
		const { client, sessionId } = await startReal({ hold: [0] });
		await sendPrompt(client, sessionId, "long task");
		await client.notify("session/cancel", { sessionId });
		await waitForIdle(client, sessionId);
		const states = client.states(sessionId);
		expect(states.at(-1)).toMatchObject({ state: "idle", stopReason: "cancelled" });
		await eventLoopTurns(20);
		const lastUpdate = client.updates(sessionId).at(-1)!;
		expect(lastUpdate.update).toMatchObject({
			sessionUpdate: "state_update",
			state: "idle",
			stopReason: "cancelled",
		});
	});

	it("emits no running and no wake frames for a background job that completes after a cancel", async () => {
		// Guards: a stopped session restarts itself when a background job that was already running settles.
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);
		const jobGate = Promise.withResolvers<string>();
		const startJob: AgentTool = {
			name: "startjob",
			label: "startjob",
			description: "Starts an owner-scoped background job",
			parameters: type({}),
			async execute() {
				manager.register("bash", "late job", async () => await jobGate.promise, {
					id: "late-job",
					ownerId: "AcpOwner",
				});
				return { content: [{ type: "text" as const, text: "started" }] };
			},
		};
		// Call 0 starts the job; call 1 (the turn that follows) is held, so the job is running when Stop arrives.
		const { rig, client, sessionId, session } = await startReal({
			hold: [1],
			asyncJobManager: manager,
			agentId: "AcpOwner",
			tools: [startJob],
			script: { 0: { content: [{ type: "toolCall", id: "call-job", name: "startjob", arguments: {} }] } },
		});
		await sendPrompt(client, sessionId, "work");
		await rig.gate(1).reached.promise;
		await client.notify("session/cancel", { sessionId });
		await waitForIdle(client, sessionId);
		// The gate `AgentSession` reads before starting agent-initiated work is closed by the Stop itself.
		expect(session.clientBridge?.allowAgentInitiatedTurns?.()).toBe(false);
		const frames = client.frames.length;
		const calls = rig.modelCalls;

		jobGate.resolve("LATE RESULT");
		await session.settleAsyncWork();
		await eventLoopTurns(30);
		expect(rig.modelCalls).toBe(calls);
		expect(client.frames.length).toBe(frames);
		expect(client.states(sessionId).filter(state => state.state === "running")).toHaveLength(1);
	});

	it("keeps the prompt successful and ends with idle(error) carrying the message when the run fails after insertion", async () => {
		// Guards: a post-insertion failure rejects the already-acknowledged prompt or leaves the client `running`.
		const { client, sessionId } = await startReal({ script: { 0: { throw: "provider exploded" } } });
		const response = await sendPrompt(client, sessionId, "will fail");
		messageIdOf(response);
		await waitForIdle(client, sessionId);
		const idle = client.states(sessionId).at(-1)!;
		expect(idle.state).toBe("idle");
		expect(idle.stopReason).toBe("error");
		expect(typeof idle.error?.message).toBe("string");
		expect(idle.error?.message?.length).toBeGreaterThan(0);
	});

	it("settles a prompt whose Goal admission is held when Stop arrives and admits the next prompt before the hold is released", async () => {
		// Guards: Stop waits for the held admission to finish, so the request and the serialised prompt queue stay blocked.
		const { client, sessionId, session } = await startReal({ extensionCommand: "noop" });
		resultOf(
			await client.request("session/set_config_option", { sessionId, configId: "mode", type: "id", value: "goal" }),
		);
		// Hold the objective's Goal admission inside `createGoal`, before `session.prompt` can register an outcome.
		const entered = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const runtime = session.goalRuntime;
		const createGoal = runtime.createGoal.bind(runtime);
		let heldCalls = 0;
		runtime.createGoal = async (...args: Parameters<typeof createGoal>) => {
			if (heldCalls++ === 0) {
				entered.resolve();
				await release.promise;
			}
			return await createGoal(...args);
		};
		teardown.unshift(async () => release.resolve());
		const held = sendPrompt(client, sessionId, "Ship feature X");
		await entered.promise;
		await client.notify("session/cancel", { sessionId });
		// Stop settles the request while the admission is still held.
		expect(errorCode(await held)).toBe(-32800);
		await waitForIdle(client, sessionId);
		expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "cancelled" });

		// The queue slot is free: the next prompt (an extension command, which needs no Goal admission) is
		// answered while the first admission is still held.
		const answered = messageIdOf(await sendPrompt(client, sessionId, "/noop"));
		expect(answered.length).toBeGreaterThan(0);

		// The late continuation neither inserts the cancelled objective nor reports a second outcome.
		release.resolve();
		await eventLoopTurns(40);
		expect(userMessages(client, sessionId).map(message => message.text)).not.toContain("Ship feature X");
		expect(userEntryIds(session)).toEqual([]);
	});

	it("reports a submission outcome at most once", () => {
		// Guards: a builtin finishing after Stop invokes the submission callback twice (command, then dropped).
		const seen: SubmissionOutcome[] = [];
		const report = singleShotOutcome(outcome => seen.push(outcome));
		report?.({ kind: "command" });
		report?.({ kind: "dropped" });
		expect(seen).toEqual([{ kind: "command" }]);
		expect(singleShotOutcome(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Plan 2 at the adapter boundary: submission lifecycle guarantees with a held provider
// ---------------------------------------------------------------------------

describe("submission lifecycle at the adapter boundary (plan 2)", () => {
	it("settles a steer lost with its delivery record at foreground end with one dropped, never inserting it", async () => {
		// Guards: a steer in the agent's delivery record (in no queue) leaves its request pending and later persists.
		const { rig, client, sessionId, session } = await startReal({ hold: [0] });
		// The run dequeues the steer for its next model call and holds that call before the transcript records the steer.
		const held = Promise.withResolvers<void>();
		const releaseHeld = Promise.withResolvers<void>();
		let hookCalls = 0;
		const removeGate = session.agent.addBeforeModelCallHook(async () => {
			if (hookCalls++ === 0) return;
			held.resolve();
			await releaseHeld.promise;
		});
		teardown.push(async () => releaseHeld.resolve());
		const first = messageIdOf(await sendPrompt(client, sessionId, "first"));
		await rig.gate(0).reached.promise;
		const steer = sendPrompt(client, sessionId, "steer A");
		await eventLoopTurns(10);
		await session.sessionManager.flush();
		const sessionFile = session.sessionManager.getSessionFile();
		if (!sessionFile) throw new Error("Expected a file-backed session");
		rig.gate(0).release.resolve();
		await held.promise;
		expect(session.agent.peekSteeringQueue()).toEqual([]);

		// A switch disconnects the run from the transcript, so its emission of the steer is never recorded;
		// the forced failure then rolls back to queues that never held the steer's record.
		vi.spyOn(session.sessionManager, "setSessionFile").mockRejectedValueOnce(new Error("forced switch failure"));
		const switching = session.switchSession(sessionFile);
		releaseHeld.resolve();
		await expect(switching).rejects.toThrow("forced switch failure");
		removeGate();
		await eventLoopTurns(20);
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(0);

		// Stop ends the foreground; only the closure there settles a steer that sits in no queue.
		await client.notify("session/cancel", { sessionId });
		expect(errorCode(await steer)).toBe(-32800);
		await waitForIdle(client, sessionId);
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);
		expect(rig.outcomes.filter(outcome => outcome.kind === "inserted")).toHaveLength(1);
		await eventLoopTurns(20);
		expect(userEntryIds(session)).toEqual([first]);
		expect(userMessages(client, sessionId).map(message => message.text)).not.toContain("steer A");
	});

	it("drops a steer once when the cleanup timeout closes the session, and a late emission persists nothing and sends no frame", async () => {
		// Guards: a cancel whose cleanup times out never closes the session, or a run released after the close writes to a closed client.
		// Negative control (RED): removing the `#closeManagedSession` call in `AcpAgent.cancel` leaves the session undisposed.
		// The held steer is already withdrawn by Stop, so the tombstone control lives in the dispose-under-a-held-turn test below.
		const { h, rig, client, sessionId, session } = await startReal({ hold: [0, 1], heldIgnoresAbort: true });
		const appendSpy = vi.spyOn(session.sessionManager, "appendMessage");
		h.agent()?.setCancelCleanupTimeoutForTesting(1);
		// The abort never completes, so the cleanup barrier is still pending when its timeout fires.
		const stuckAbort = Promise.withResolvers<void>();
		const abort = session.abort.bind(session);
		session.abort = async options => {
			await stuckAbort.promise;
			return await abort(options);
		};
		teardown.push(async () => stuckAbort.resolve());
		messageIdOf(await sendPrompt(client, sessionId, "first"));
		await client.waitFor(c => userMessages(c, sessionId).length === 1, "user_message echo of the first prompt");
		await rig.gate(0).reached.promise;
		const steer = sendPrompt(client, sessionId, "steer A");
		await eventLoopTurns(10);
		rig.gate(0).release.resolve();
		await rig.gate(1).reached.promise;
		// The run holds the steer in its delivery record while the provider stream ignores the abort.
		expect(session.agent.peekSteeringQueue()).toEqual([]);

		await client.notify("session/cancel", { sessionId });
		expect(errorCode(await steer)).toBeDefined();
		// The cleanup timeout elapses and the adapter closes (disposes) the session.
		while (!session.isDisposed) await eventLoopTurns(1);
		const framesAtClose = client.frames.length;
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);

		rig.gate(1).release.resolve();
		await eventLoopTurns(40);
		expect(client.frames.length).toBe(framesAtClose);
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);
		expect(rig.outcomes.filter(outcome => outcome.kind === "inserted")).toHaveLength(1);
		const appendedUserTexts = appendSpy.mock.calls
			.map(([message]) => message)
			.filter(message => message.role === "user")
			.map(message => contentText(message.content));
		expect(appendedUserTexts).toEqual(["first"]);
	});

	it("drops a held steer once when the connection closes under a running turn, and a late emission persists nothing", async () => {
		// Guards: the tombstone is missing, so a run released after close inserts the steer the closure already dropped.
		const { h, rig, client, sessionId, session } = await startReal({ hold: [0, 1], heldIgnoresAbort: true });
		const appendSpy = vi.spyOn(session.sessionManager, "appendMessage");
		messageIdOf(await sendPrompt(client, sessionId, "first"));
		await client.waitFor(c => userMessages(c, sessionId).length === 1, "user_message echo of the first prompt");
		await rig.gate(0).reached.promise;
		const steer = sendPrompt(client, sessionId, "steer A");
		await eventLoopTurns(10);
		rig.gate(0).release.resolve();
		await rig.gate(1).reached.promise;
		// The run holds the steer in its delivery record while the provider stream ignores the abort.
		expect(session.agent.peekSteeringQueue()).toEqual([]);

		const closing = h.agent()?.dispose();
		expect(errorCode(await steer)).toBeDefined();
		while (!session.isDisposed) await eventLoopTurns(1);
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);
		const framesAtClose = client.frames.length;

		rig.gate(1).release.resolve();
		await closing;
		await eventLoopTurns(40);
		expect(client.frames.length).toBe(framesAtClose);
		expect(rig.outcomes.filter(outcome => outcome.kind === "dropped")).toHaveLength(1);
		expect(rig.outcomes.filter(outcome => outcome.kind === "inserted")).toHaveLength(1);
		const appendedUserTexts = appendSpy.mock.calls
			.map(([message]) => message)
			.filter(message => message.role === "user")
			.map(message => contentText(message.content));
		expect(appendedUserTexts).toEqual(["first"]);
	});
});

// ---------------------------------------------------------------------------
// Plan 6: requires_action
// ---------------------------------------------------------------------------

describe("requires_action (plan 6)", () => {
	interface PendingPermission {
		answer: PromiseWithResolvers<unknown>;
		requests: unknown[];
		onRequest: (method: string, params: unknown) => Promise<unknown>;
	}

	function pendingPermission(outcome: (params: unknown) => unknown): PendingPermission {
		const answer = Promise.withResolvers<unknown>();
		const requests: unknown[] = [];
		return {
			answer,
			requests,
			onRequest: async (method, params) => {
				if (method !== "session/request_permission") throw new Error(`unexpected agent request ${method}`);
				requests.push(params);
				await answer.promise;
				return { outcome: outcome(params) };
			},
		};
	}

	const allow = (params: unknown) => ({ outcome: "selected", optionId: allowOnceOptionId(params) });

	it("reports requires_action while a permission is pending and running once it is answered", async () => {
		// Guards: the client shows a spinner while the agent silently waits for the user.
		const permission = pendingPermission(allow);
		const bash = fakeBashTool();
		const { client, sessionId } = await startReal({ tools: [bash], script: { 0: BASH_CALL } }, permission.onRequest);
		await sendPrompt(client, sessionId, "run it");
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		expect(client.states(sessionId).at(-1)?.state).toBe("requires_action");
		const request = client.agentRequests().find(frame => frame.method === "session/request_permission")!;
		const params = request.params;
		expect(isRecord(params) && typeof params.title === "string" && params.title.length > 0).toBe(true);
		expect(isRecord(params) && isRecord(params.subject) && params.subject.type).toBe("tool_call");

		const pendingIndex = client.states(sessionId).at(-1)!.index;
		permission.answer.resolve(undefined);
		await waitForIdle(client, sessionId);
		const after = client.states(sessionId).filter(state => state.index > pendingIndex);
		expect(after[0]).toMatchObject({ state: "running" });
		expect(after.at(-1)).toMatchObject({ state: "idle", stopReason: "end_turn" });
		expect(bash.executeCalls).toBe(1);
	});

	it("sends a v2 elicitation/create for a tool question, reports requires_action while open, and returns the answer", async () => {
		// Guards: a v2 client that negotiated elicitation.form never gets the question (UI disabled) or gets a v1-shaped one.
		const toolUi: { current?: ExtensionUIContext } = {};
		const answers: boolean[] = [];
		const asker: AgentTool = {
			name: "asker",
			label: "asker",
			description: "Asks the user to confirm",
			parameters: type({}),
			async execute() {
				const confirmed = (await toolUi.current?.confirm("Proceed?", "This is irreversible.")) ?? "no ui";
				answers.push(confirmed === true);
				return { content: [{ type: "text" as const, text: String(confirmed) }] };
			},
		};
		const answer = Promise.withResolvers<void>();
		const requests: unknown[] = [];
		const { client, sessionId } = await startReal(
			{
				tools: [asker],
				toolUi,
				script: { 0: { content: [{ type: "toolCall", id: "call-ask", name: "asker", arguments: {} }] } },
			},
			async (method, params) => {
				if (method !== "elicitation/create") throw new Error(`unexpected agent request ${method}`);
				requests.push(params);
				await answer.promise;
				return { action: "accept", content: { value: true } };
			},
			{ elicitation: { form: {} } },
		);
		await sendPrompt(client, sessionId, "ask me");
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			mode: "form",
			sessionId,
			requestedSchema: { type: "object", properties: { value: { type: "boolean" } }, required: ["value"] },
		});
		expect(client.states(sessionId).at(-1)?.state).toBe("requires_action");
		// The outbound request was validated against the alpha.9 request schema by the harness.
		expect(client.agentRequests().some(frame => frame.method === "elicitation/create")).toBe(true);
		expect(client.schemaIssues).toEqual([]);

		answer.resolve();
		await waitForIdle(client, sessionId);
		expect(answers).toEqual([true]);
		expect(client.states(sessionId).map(state => state.state)).toEqual([
			"running",
			"requires_action",
			"running",
			"idle",
		]);
	});

	it("counts a plan-approval elicitation as an open interaction, live and on resume", async () => {
		// Guards: the v2 plan approval waits on the client but the aggregate state stays `running`.
		const approval = Promise.withResolvers<void>();
		const { h, rig, client, sessionId, session } = await startReal(
			{ hold: [0] },
			async method => {
				if (method !== "elicitation/create") throw new Error(`unexpected agent request ${method}`);
				await approval.promise;
				return { action: "cancel" };
			},
			{ elicitation: { form: {} } },
		);
		resultOf(
			await client.request("session/set_config_option", { sessionId, configId: "mode", type: "id", value: "plan" }),
		);
		await sendPrompt(client, sessionId, "plan it");
		await client.waitFor(() => rig.modelCalls === 1, "held model call");
		const handler = session.peekPlanProposalHandler();
		if (!handler) throw new Error("expected a plan proposal handler in plan mode");
		const proposal = handler(
			{ planFilePath: "local://words-counter-plan.md", planContent: "# Words counter", title: "words-counter" },
			() => true,
		);
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		const base = client.frames.length;
		const resumed = await client.request("session/resume", { sessionId, cwd: h.cwd });
		resultOf(resumed);
		const snapshot = client.states(sessionId).filter(state => state.index >= base && state.index < resumed.index);
		expect(snapshot.at(-1)).toMatchObject({ state: "requires_action" });

		const pendingIndex = client.states(sessionId).at(-1)!.index;
		approval.resolve();
		await proposal;
		await client.waitFor(
			c => c.states(sessionId).some(s => s.index > pendingIndex && s.state === "running"),
			"running after the answer",
		);
		expect(client.schemaIssues).toEqual([]);
		rig.gate(0).release.resolve();
		await waitForIdle(client, sessionId);
	});

	it("snapshots requires_action when a session is resumed while its permission is pending", async () => {
		// Guards: a client that reconnects mid-permission sees `idle` and never learns it must act.
		const permission = pendingPermission(allow);
		const { h, client, sessionId } = await startReal(
			{ tools: [fakeBashTool()], script: { 0: BASH_CALL } },
			permission.onRequest,
		);
		await sendPrompt(client, sessionId, "run it");
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		const base = client.frames.length;

		const resumed = await client.request("session/resume", { sessionId, cwd: h.cwd });
		resultOf(resumed);
		const snapshot = client.states(sessionId).filter(state => state.index >= base && state.index < resumed.index);
		expect(snapshot.at(-1)).toMatchObject({ state: "requires_action" });

		permission.answer.resolve(undefined);
		await waitForIdle(client, sessionId);
	});

	it("treats an unknown permission outcome as a rejection (PORT)", async () => {
		// Guards: a malformed client answer executes the gated tool.
		const permission = pendingPermission(() => ({ outcome: "bogus" }));
		const bash = fakeBashTool();
		const { client, sessionId } = await startReal({ tools: [bash], script: { 0: BASH_CALL } }, permission.onRequest);
		await sendPrompt(client, sessionId, "run it");
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		permission.answer.resolve(undefined);
		await waitForIdle(client, sessionId);
		expect(bash.executeCalls).toBe(0);
	});

	it("stays running while another tool still runs, then reports requires_action, then running once answered", async () => {
		// Guards: an open permission flips the aggregate state although a sibling tool is still progressing.
		const permission = pendingPermission(allow);
		const bash = fakeBashTool();
		const slowGate = Promise.withResolvers<void>();
		const slowStarted = Promise.withResolvers<void>();
		const slow: AgentTool = {
			name: "slow",
			label: "slow",
			description: "Slow tool",
			parameters: type({}),
			async execute() {
				slowStarted.resolve();
				await slowGate.promise;
				return { content: [{ type: "text" as const, text: "done" }] };
			},
		};
		const script: MockResponse = {
			content: [
				{ type: "toolCall", id: "call-bash", name: "bash", arguments: { command: "echo hi" } },
				{ type: "toolCall", id: "call-slow", name: "slow", arguments: {} },
			],
		};
		const { client, sessionId } = await startReal(
			{ tools: [bash, slow], script: { 0: script } },
			permission.onRequest,
		);
		await sendPrompt(client, sessionId, "run both");
		await slowStarted.promise;
		await client.waitFor(() => permission.requests.length > 0, "permission request");
		await eventLoopTurns(20);
		expect(stateNames(client, sessionId)).not.toContain("requires_action");

		slowGate.resolve();
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		const pendingIndex = client.states(sessionId).at(-1)!.index;
		permission.answer.resolve(undefined);
		await waitForIdle(client, sessionId);
		const after = client.states(sessionId).filter(state => state.index > pendingIndex);
		expect(after[0]).toMatchObject({ state: "running" });
		expect(after.at(-1)).toMatchObject({ state: "idle", stopReason: "end_turn" });
	});

	it("reevaluates on every interaction change when two tools wait on separate permissions", async () => {
		// Guards: the aggregate state only follows the 0→1 and 1→0 interaction boundaries, so answering one of two
		// pending permissions leaves `requires_action` visible while that tool progresses.
		const requests: { answer: PromiseWithResolvers<unknown>; params: unknown }[] = [];
		const onRequest = async (method: string, params: unknown): Promise<unknown> => {
			if (method !== "session/request_permission") throw new Error(`unexpected agent request ${method}`);
			const answer = Promise.withResolvers<unknown>();
			requests.push({ answer, params });
			await answer.promise;
			return { outcome: allow(params) };
		};
		const bashGate = Promise.withResolvers<void>();
		const bash = fakeBashTool();
		const gatedExecute = bash.execute.bind(bash);
		bash.execute = async (...args) => {
			await bashGate.promise;
			return await gatedExecute(...args);
		};
		const slowGate = Promise.withResolvers<void>();
		const slowStarted = Promise.withResolvers<void>();
		const slow: AgentTool = {
			name: "slow",
			label: "slow",
			description: "Slow tool",
			parameters: type({}),
			async execute() {
				slowStarted.resolve();
				await slowGate.promise;
				return { content: [{ type: "text" as const, text: "done" }] };
			},
		};
		const script: MockResponse = {
			content: [
				{ type: "toolCall", id: "call-a", name: "bash", arguments: { command: "echo a" } },
				{ type: "toolCall", id: "call-b", name: "bash", arguments: { command: "echo b" } },
				{ type: "toolCall", id: "call-c", name: "slow", arguments: {} },
			],
		};
		const { h, client, sessionId } = await startReal({ tools: [bash, slow], script: { 0: script } }, onRequest);
		await sendPrompt(client, sessionId, "run three");
		await slowStarted.promise;
		await client.waitFor(() => requests.length === 2, "both permission requests");
		await eventLoopTurns(20);
		// C still runs: two open permissions do not make the aggregate wait on the client.
		expect(stateNames(client, sessionId)).not.toContain("requires_action");

		/** Resumes the session and returns the snapshot `state_update` that precedes the resume response. */
		const snapshotNow = async () => {
			const base = client.frames.length;
			const resumed = await client.request("session/resume", { sessionId, cwd: h.cwd });
			resultOf(resumed);
			return client.states(sessionId).filter(state => state.index >= base && state.index < resumed.index);
		};

		slowGate.resolve();
		await client.waitFor(c => c.states(sessionId).some(s => s.state === "requires_action"), "requires_action");
		expect((await snapshotNow()).at(-1)).toMatchObject({ state: "requires_action" });

		// A is answered and executes (held by the gate) while B still waits: the aggregate progresses again.
		const countBefore = client.states(sessionId).length;
		requests[0]!.answer.resolve(undefined);
		await client.waitFor(
			c =>
				c
					.states(sessionId)
					.slice(countBefore)
					.some(s => s.state === "running"),
			"running",
		);
		await eventLoopTurns(20);
		expect(
			client
				.states(sessionId)
				.slice(countBefore)
				.map(s => s.state),
		).not.toContain("requires_action");
		expect((await snapshotNow()).at(-1)).toMatchObject({ state: "running" });

		requests[1]!.answer.resolve(undefined);
		bashGate.resolve();
		await waitForIdle(client, sessionId);
		expect(client.states(sessionId).at(-1)).toMatchObject({ state: "idle", stopReason: "end_turn" });
	});

	it("snapshots the settled state when resumed between an interaction opening and its settle callback", async () => {
		// Guards: a resume in the settle window announces `requires_action` while the live stream still says `running`,
		// exposing the transient blocked state the settle delay exists to hide (sibling starts not yet delivered).
		const permission = pendingPermission(allow);
		const slowGate = Promise.withResolvers<void>();
		const slow: AgentTool = {
			name: "slow",
			label: "slow",
			description: "Slow tool",
			parameters: type({}),
			async execute() {
				await slowGate.promise;
				return { content: [{ type: "text" as const, text: "done" }] };
			},
		};
		const script: MockResponse = {
			content: [
				{ type: "toolCall", id: "call-bash", name: "bash", arguments: { command: "echo hi" } },
				{ type: "toolCall", id: "call-slow", name: "slow", arguments: {} },
			],
		};
		// Hold the settle callback and the sibling `tool_execution_start` deliveries so the window is deterministic.
		const settleCallbacks: Array<() => void> = [];
		const realSetTimeout = globalThis.setTimeout;
		vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: () => void, ms?: number) => {
			if (typeof handler === "function" && new Error().stack?.includes("#reevaluateState")) {
				settleCallbacks.push(handler);
				return realSetTimeout(() => {}, 0);
			}
			return realSetTimeout(handler, ms);
		}) as unknown as typeof setTimeout);
		const holdToolStarts = Promise.withResolvers<void>();
		const { h, client, sessionId } = await startReal(
			{ tools: [fakeBashTool(), slow], script: { 0: script }, holdToolStarts },
			permission.onRequest,
		);
		await sendPrompt(client, sessionId, "run both");
		await client.waitFor(() => permission.requests.length > 0, "permission request");
		expect(settleCallbacks.length).toBeGreaterThan(0);

		const base = client.frames.length;
		const resumed = await client.request("session/resume", { sessionId, cwd: h.cwd });
		resultOf(resumed);
		const snapshot = client.states(sessionId).filter(state => state.index >= base && state.index < resumed.index);
		expect(snapshot.at(-1)).toMatchObject({ state: "running" });

		holdToolStarts.resolve();
		await eventLoopTurns(20);
		for (const callback of settleCallbacks) callback();
		await eventLoopTurns(20);
		expect(stateNames(client, sessionId)).not.toContain("requires_action");
		permission.answer.resolve(undefined);
		slowGate.resolve();
		await waitForIdle(client, sessionId);
		expect(stateNames(client, sessionId)).not.toContain("requires_action");
	});
});

// ---------------------------------------------------------------------------
// Plan 8: identity across resume
// ---------------------------------------------------------------------------

describe("identity across resume (plan 8)", () => {
	/** Two identical same-millisecond prompts on a real file-backed session; returns the ids the client received. */
	async function seedTwoIdenticalPrompts() {
		const started = await startReal({ hold: [0] });
		const { rig, client, sessionId, session } = started;
		const now = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		const first = messageIdOf(await sendPrompt(client, sessionId, "same words"));
		const secondPending = sendPrompt(client, sessionId, "same words");
		await eventLoopTurns(10);
		rig.gate(0).release.resolve();
		const second = messageIdOf(await secondPending);
		now.mockRestore();
		await waitForIdle(client, sessionId);
		await session.sessionManager.flush();
		return { ...started, ids: [first, second] };
	}

	it("gives two identical same-millisecond prompts two entries and two distinct messageIds", async () => {
		// Guards: dedup of a pending submission drops the second prompt and its acknowledgement.
		const { ids, session } = await seedTwoIdenticalPrompts();
		expect(ids[0]).not.toBe(ids[1]);
		expect(userEntryIds(session)).toEqual(ids);
	});

	it("replays both messages with the live ids after a reload when replayFrom is start", async () => {
		// Guards: replayed ids differ from live ids, so a client cannot match its own transcript after reconnect.
		const { ids, sessionId, h } = await seedTwoIdenticalPrompts();
		const reconnected = await h.reconnect();
		await initialize(reconnected);
		resultOf(
			await reconnected.request("session/resume", {
				sessionId,
				cwd: h.cwd,
				replayFrom: { type: "start" },
			}),
		);
		const replayed = userMessages(reconnected, sessionId);
		expect(replayed.map(message => message.messageId)).toEqual(ids);
		expect(replayed.map(message => message.text)).toEqual(["same words", "same words"]);
		// Guards: replay spells user messages as chunks while the live echo is one `user_message`.
		const kinds = reconnected.updates(sessionId).map(entry => kindOf(entry.update));
		expect(kinds.filter(kind => kind === "user_message")).toHaveLength(2);
		expect(kinds).not.toContain("user_message_chunk");
	});

	it("sends only the state snapshot when resume has no cursor", async () => {
		// Guards: every reconnect re-streams the whole transcript.
		const { sessionId, h } = await seedTwoIdenticalPrompts();
		const reconnected = await h.reconnect();
		await initialize(reconnected);
		resultOf(await reconnected.request("session/resume", { sessionId, cwd: h.cwd }));
		const kinds = reconnected.updates(sessionId).map(entry => kindOf(entry.update));
		expect(kinds).not.toContain("user_message");
		expect(kinds).not.toContain("user_message_chunk");
		expect(kinds).not.toContain("agent_message_chunk");
		expect(reconnected.states(sessionId).at(-1)).toMatchObject({ state: "idle" });
	});

	it("rejects an unknown replayFrom cursor with -32602", async () => {
		// Guards: an unsupported cursor silently replays from the start (or nothing).
		const { sessionId, h } = await seedTwoIdenticalPrompts();
		const reconnected = await h.reconnect();
		await initialize(reconnected);
		const response = await reconnected.request("session/resume", {
			sessionId,
			cwd: h.cwd,
			replayFrom: { type: "_custom" },
		});
		expect(errorCode(response)).toBe(-32602);
	});
});

// ---------------------------------------------------------------------------
// Plan 9: auth
// ---------------------------------------------------------------------------

describe("auth (plan 9)", () => {
	it("advertises the terminal method only to a client with capabilities.auth.terminal", async () => {
		// Guards: clients that cannot open a terminal are offered a method they cannot run.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		const without = await initialize(h.client);
		expect(JSON.stringify(without.authMethods)).not.toContain('"terminal"');

		const second = await h.reconnect();
		const withTerminal = await initialize(second, { auth: { terminal: {} } });
		expect(withTerminal.authMethods).toContainEqual(
			expect.objectContaining({ methodId: "terminal", type: "terminal", args: ["--acp-terminal-auth"] }),
		);
		expect(withTerminal.authMethods).toContainEqual(expect.objectContaining({ methodId: "agent", type: "agent" }));
	});

	it("leaves the credential store byte-identical on logout", async () => {
		// Guards: auth/logout wipes the user's shared provider credentials.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		const dbPath = getAgentDbPath(h.agentDir);
		const storage = await AuthStorage.create(dbPath);
		await storage.credentials.set("anthropic", { type: "api_key", key: "sk-keep-me" });
		storage.close();
		const before = fs.readFileSync(dbPath);
		expect(path.dirname(dbPath).startsWith(h.root)).toBe(true);

		await initialize(h.client);
		const logout = resultOf(await h.client.request("auth/logout", {}));
		expect(logout).toEqual({ _meta: { omp: { credentialsRetained: true } } });
		expect(Buffer.compare(before, fs.readFileSync(dbPath))).toBe(0);
	});

	it("rejects an unknown login method and accepts the agent method (PORT)", async () => {
		// Guards: a bogus method id looks authenticated and fails later as a model error.
		const h = await createV2WireHarness();
		teardown.push(() => h.close());
		await initialize(h.client);
		expect((await h.client.request("auth/login", { methodId: "nope" })).error).toBeDefined();
		expect((await h.client.request("auth/login", { methodId: "agent" })).error).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Plan 10: resource links (v2 side)
// ---------------------------------------------------------------------------

describe("resource links (plan 10)", () => {
	it("forwards a resource_link uri to the model", async () => {
		// Guards: the link's title replaces its uri, so the model never learns which file the user attached.
		const { rig, client, sessionId } = await startReal();
		const response = await client.request("session/prompt", {
			sessionId,
			prompt: [{ type: "resource_link", name: "n", title: "t", uri: "file:///x" }],
		});
		messageIdOf(response);
		await waitForIdle(client, sessionId);
		const seen = rig.mockCalls.flat().map(call => JSON.stringify(call.context.messages));
		expect(seen.some(messages => messages.includes("file:///x"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Plan 7: suite-wide mapping conformance. Must stay the last test in the file.
// ---------------------------------------------------------------------------

describe("mapping conformance across the suite (plan 7)", () => {
	it("emitted no schema issues, no v1-only updates, and no fs/terminal client requests", () => {
		// Guards: any v2 frame the suite produced that a spec-following client would reject or misread.
		expect(v2SuiteFrames.length).toBeGreaterThan(0);
		expect(v2SuiteSchemaIssues).toEqual([]);
		const kinds = new Set<string>();
		for (const frame of v2SuiteFrames) {
			if (frame.method === "session/update" && isRecord(frame.params) && isRecord(frame.params.update)) {
				kinds.add(kindOf(frame.params.update));
			}
			if (typeof frame.method === "string" && "id" in frame) {
				expect(frame.method.startsWith("fs/") || frame.method.startsWith("terminal/")).toBe(false);
			}
		}
		for (const forbidden of ["tool_call", "plan", "current_mode_update"]) expect(kinds.has(forbidden)).toBe(false);
		// Not vacuous: the suite exercised state and message frames.
		expect(kinds.has("state_update")).toBe(true);
		expect(kinds.has("agent_message_chunk")).toBe(true);
	});
});
