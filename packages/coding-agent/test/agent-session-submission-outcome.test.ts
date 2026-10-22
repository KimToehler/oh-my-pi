/**
 * `PromptOptions.onSubmissionOutcome`: every submission that passes the callback and does not
 * reject reports exactly one outcome — `inserted` (with the persisted user entry id), `command`,
 * or `dropped` — at the moment the session knows, never inferred from queue absence mid-run.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import type { ImageContent } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { ExtensionRuntime, loadExtensionFromFactory } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { SubmissionOutcome } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm, USER_INTERRUPT_LABEL } from "@oh-my-pi/pi-coding-agent/session/messages";
import { sessionEntryIdOf } from "@oh-my-pi/pi-coding-agent/session/session-entry-id";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TurnRecovery } from "@oh-my-pi/pi-coding-agent/session/turn-recovery";
import * as imageLoading from "@oh-my-pi/pi-coding-agent/utils/image-loading";
import { EventBus } from "@oh-my-pi/pi-coding-agent/utils/event-bus";

interface CallGate {
	reached: PromiseWithResolvers<void>;
	release: PromiseWithResolvers<void>;
}

const IMAGE: ImageContent = { type: "image", mimeType: "image/png", data: "AAAA" };

function track() {
	const outcomes: SubmissionOutcome[] = [];
	const first = Promise.withResolvers<SubmissionOutcome>();
	return {
		outcomes,
		first: first.promise,
		cb: (outcome: SubmissionOutcome) => {
			outcomes.push(outcome);
			first.resolve(outcome);
		},
	};
}

describe("AgentSession submission outcome", () => {
	let session: AgentSession;
	let authStorage: AuthStorage | undefined;
	let tempDir: string | undefined;
	const gates = new Map<number, CallGate>();
	const held = new Set<number>();

	function gate(n: number): CallGate {
		let existing = gates.get(n);
		if (!existing) {
			existing = { reached: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
			gates.set(n, existing);
		}
		return existing;
	}

	afterEach(async () => {
		for (const g of gates.values()) g.release.resolve();
		vi.restoreAllMocks();
		AsyncJobManager.resetForTests();
		await session?.dispose();
		authStorage?.close();
		authStorage = undefined;
		gates.clear();
		held.clear();
		if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	});

	/** Model call `n` (0-based) blocks on `gate(n).release` when `hold`-ed. */
	async function createSession(options?: {
		hold?: number[];
		sessionManager?: SessionManager;
		extensionRunner?: ExtensionRunner;
		modelRegistry?: ModelRegistry;
		agentId?: string;
		asyncJobManager?: AsyncJobManager;
	}): Promise<{ session: AgentSession; manager: SessionManager; modelRegistry: ModelRegistry }> {
		for (const n of options?.hold ?? []) held.add(n);
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");
		let calls = 0;
		const mock = createMockModel({
			handler: async () => {
				const n = calls++;
				gate(n).reached.resolve();
				if (held.has(n)) await gate(n).release.promise;
				return { content: [`reply ${n}`] };
			},
		});
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		authStorage = await AuthStorage.create(":memory:");
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = options?.modelRegistry ?? new ModelRegistry(authStorage);
		const manager = options?.sessionManager ?? SessionManager.inMemory();
		session = new AgentSession({
			agent,
			sessionManager: manager,
			settings: Settings.isolated({ "compaction.enabled": false }),
			modelRegistry,
			extensionRunner: options?.extensionRunner,
			agentId: options?.agentId,
			asyncJobManager: options?.asyncJobManager,
		});
		return { session, manager, modelRegistry };
	}

	function userTexts(manager: SessionManager): string[] {
		return manager.getEntries().flatMap(entry => {
			if (entry.type !== "message" || entry.message.role !== "user") return [];
			const content = entry.message.content;
			return [
				typeof content === "string" ? content : content.flatMap(b => (b.type === "text" ? [b.text] : [])).join(""),
			];
		});
	}

	it("reports inserted with the persisted user entry id while the turn still streams", async () => {
		const { manager } = await createSession({ hold: [0] });
		let ended = false;
		session.subscribe(event => {
			if (event.type === "agent_end") ended = true;
		});
		const outcome = track();
		const run = session.prompt("hello", { onSubmissionOutcome: outcome.cb });
		const reported = await outcome.first;
		expect(ended).toBe(false);
		expect(session.isStreaming).toBe(true);
		expect(reported.kind).toBe("inserted");
		if (reported.kind !== "inserted") throw new Error("unreachable");
		const entry = manager.getEntry(reported.entryId);
		expect(entry?.type === "message" && entry.message.role).toBe("user");
		expect(userTexts(manager)).toEqual(["hello"]);

		gate(0).release.resolve();
		await run;
		expect(outcome.outcomes).toEqual([reported]);
	});

	it("reports dropped, with no entry, when the usage preflight denies the prompt", async () => {
		const { manager } = await createSession();
		let aborting: Promise<void> | undefined;
		vi.spyOn(TurnRecovery.prototype, "maybeApplyUsageAwareFallback").mockImplementation(async () => {
			// A denial: the setup generation moves on before preflight resolves.
			aborting = session.abort();
			return false;
		});
		const outcome = track();
		await session.prompt("denied", { onSubmissionOutcome: outcome.cb });
		await aborting;
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).toEqual([]);
	});

	it("reports dropped when an abort lands while a streaming steer's images are prepared", async () => {
		const { manager } = await createSession({ hold: [0] });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		let aborting: Promise<void> | undefined;
		vi.spyOn(imageLoading, "normalizeModelContextImages").mockImplementation(async () => {
			aborting = session.abort();
			return undefined;
		});
		const outcome = track();
		await session.prompt("steer with image", {
			streamingBehavior: "steer",
			images: [IMAGE],
			onSubmissionOutcome: outcome.cb,
		});
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		gate(0).release.resolve();
		await aborting;
		await run;
		await session.waitForIdle();
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).not.toContain("steer with image");
	});

	it("reports dropped synchronously, before agent_end, for a queued steer removed by clearQueue", async () => {
		const { manager } = await createSession({ hold: [0] });
		let ended = false;
		session.subscribe(event => {
			if (event.type === "agent_end") ended = true;
		});
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const outcome = track();
		await session.prompt("queued", { streamingBehavior: "steer", onSubmissionOutcome: outcome.cb });
		expect(outcome.outcomes).toEqual([]);

		session.clearQueue();
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		expect(ended).toBe(false);

		gate(0).release.resolve();
		await run;
		await session.waitForIdle();
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).toEqual(["first"]);
	});

	it("reports exactly one dropped for a queued steer removed by popLastQueuedMessage", async () => {
		await createSession({ hold: [0] });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const outcome = track();
		await session.prompt("queued", { streamingBehavior: "steer", onSubmissionOutcome: outcome.cb });

		expect(session.popLastQueuedMessage()?.text).toBe("queued");
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);

		gate(0).release.resolve();
		await run;
		await session.waitForIdle();
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
	});

	it.each(["followUp", "aside"] as const)("rejects %s with a callback as TypeError and queues nothing", async mode => {
		await createSession({ hold: [0] });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const outcome = track();
		await expect(
			session.prompt("nope", { streamingBehavior: mode, onSubmissionOutcome: outcome.cb }),
		).rejects.toBeInstanceOf(TypeError);
		expect(session.agent.peekSteeringQueue()).toEqual([]);
		expect(session.agent.peekFollowUpQueue()).toEqual([]);
		gate(0).release.resolve();
		await run;
		await session.waitForIdle();
		expect(outcome.outcomes).toEqual([]);
	});

	it("keeps a claimed steer pending when an unrelated queued steer is taken", async () => {
		const { manager } = await createSession({ hold: [0] });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const a = track();
		const b = track();
		await session.prompt("steer A", { streamingBehavior: "steer", onSubmissionOutcome: a.cb });
		await session.prompt("steer B", { streamingBehavior: "steer", onSubmissionOutcome: b.cb });

		const claimed = Promise.withResolvers<void>();
		const releasePrepare = Promise.withResolvers<void>();
		const prepare = session.agent.prepareQueuedMessages;
		if (!prepare) throw new Error("Expected queued message preparation hook");
		session.agent.prepareQueuedMessages = async (...args) => {
			claimed.resolve();
			await releasePrepare.promise;
			return prepare(...args);
		};
		// The run takes steer A for its next model call and holds it in preparation.
		gate(0).release.resolve();
		await claimed.promise;

		expect(session.takeQueuedMessage("steer B", "steering")?.text).toBe("steer B");
		expect(b.outcomes).toEqual([{ kind: "dropped" }]);
		expect(a.outcomes).toEqual([]);

		releasePrepare.resolve();
		await run;
		await a.first;
		await session.waitForIdle();
		expect(a.outcomes.map(outcome => outcome.kind)).toEqual(["inserted"]);
		expect(b.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).toEqual(["first", "steer A"]);
	});

	it("settles a steer lost with its delivery record at quiescence, and never inserts it afterwards", async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-submission-record-"));
		const manager = SessionManager.create(tempDir, tempDir);
		await createSession({ hold: [0], sessionManager: manager });
		// The run dequeues steer A for its next model call and holds that call here, before the
		// transcript records A: A sits in the agent's delivery record, in no queue.
		const held = Promise.withResolvers<void>();
		const releaseHeld = Promise.withResolvers<void>();
		let hookCalls = 0;
		const removeGate = session.agent.addBeforeModelCallHook(async () => {
			if (hookCalls++ === 0) return;
			held.resolve();
			await releaseHeld.promise;
		});
		const a = track();
		const run = session.prompt("first");
		await gate(0).reached.promise;
		await session.prompt("steer A", { streamingBehavior: "steer", onSubmissionOutcome: a.cb });
		await manager.flush();
		const sessionFile = manager.getSessionFile();
		if (!sessionFile) throw new Error("Expected a file-backed session");
		gate(0).release.resolve();
		await held.promise;
		expect(session.agent.peekSteeringQueue()).toEqual([]);

		// A switch disconnects the run from the transcript, so the run's emission of A is never
		// recorded; the forced failure then rolls back to queues that never held A's record.
		vi.spyOn(manager, "setSessionFile").mockRejectedValueOnce(new Error("forced switch failure"));
		const switching = session.switchSession(sessionFile);
		releaseHeld.resolve();
		await expect(switching).rejects.toThrow("forced switch failure");
		await run;
		removeGate();
		await session.waitForIdle();
		expect(a.outcomes).toEqual([]);
		expect(session.agent.peekSteeringQueue()).toEqual([]);

		session.settlePendingSubmissions();
		expect(a.outcomes).toEqual([{ kind: "dropped" }]);
		await session.waitForIdle();
		expect(a.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).not.toContain("steer A");
	});

	it("reports dropped for a queued steer when resetSessionContext clears the conversation", async () => {
		await createSession({ hold: [0] });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const outcome = track();
		await session.prompt("queued", { streamingBehavior: "steer", onSubmissionOutcome: outcome.cb });
		// The idle queue drain fails, so the steer stays queued on the idle session.
		const drainFailed = Promise.withResolvers<void>();
		vi.spyOn(session.agent, "continue").mockImplementation(async () => {
			drainFailed.resolve();
			throw new Error("drain blocked");
		});
		const abort = session.abort({ reason: USER_INTERRUPT_LABEL });
		gate(0).release.resolve();
		await abort;
		await run;
		await drainFailed.promise;
		await session.waitForIdle();
		expect(session.agent.peekSteeringQueue()).toHaveLength(1);
		expect(outcome.outcomes).toEqual([]);

		expect(await session.resetSessionContext()).toBeDefined();
		expect(outcome.outcomes).toEqual([{ kind: "dropped" }]);
		expect(session.agent.peekSteeringQueue()).toEqual([]);
	});

	it("never inserts a settled submission that a still-running turn later emits", async () => {
		const { manager } = await createSession({ hold: [0, 1] });
		const a = track();
		const run = session.prompt("first");
		await gate(0).reached.promise;
		await session.prompt("steer A", { streamingBehavior: "steer", onSubmissionOutcome: a.cb });
		gate(0).release.resolve();
		await gate(1).reached.promise;
		// The run holds A in a delivery record; settle drops it while the run is still alive.
		expect(session.agent.peekSteeringQueue()).toEqual([]);
		session.settlePendingSubmissions();
		expect(a.outcomes).toEqual([{ kind: "dropped" }]);

		gate(1).release.resolve();
		await run;
		await session.waitForIdle();
		expect(a.outcomes).toEqual([{ kind: "dropped" }]);
		expect(userTexts(manager)).toEqual(["first"]);
	});

	it("keeps a queued steer pending across a failed switchSession and inserts it later", async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-submission-outcome-"));
		const manager = SessionManager.create(tempDir, tempDir);
		await createSession({ hold: [0], sessionManager: manager });
		const run = session.prompt("first");
		await gate(0).reached.promise;
		const outcome = track();
		await session.prompt("steer A", { streamingBehavior: "steer", onSubmissionOutcome: outcome.cb });
		await manager.flush();
		const sessionFile = manager.getSessionFile();
		if (!sessionFile) throw new Error("Expected a file-backed session");
		vi.spyOn(manager, "setSessionFile").mockRejectedValueOnce(new Error("forced switch failure"));

		const switching = session.switchSession(sessionFile);
		gate(0).release.resolve();
		await expect(switching).rejects.toThrow("forced switch failure");
		await run;
		expect(outcome.outcomes).toEqual([]);
		expect(session.agent.peekSteeringQueue()).toHaveLength(1);

		await session.prompt("next");
		await session.waitForIdle();
		await outcome.first;
		expect(outcome.outcomes.map(o => o.kind)).toEqual(["inserted"]);
		expect(userTexts(manager)).toContain("steer A");
	});

	it("reports command for an extension command", async () => {
		const runtime = new ExtensionRuntime();
		const extension = await loadExtensionFromFactory(
			pi => pi.registerCommand("noop", { handler: async () => {} }),
			process.cwd(),
			new EventBus(),
			runtime,
			"noop-command",
		);
		authStorage = await AuthStorage.create(":memory:");
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		const manager = SessionManager.inMemory();
		const extensionRunner = new ExtensionRunner([extension], runtime, process.cwd(), manager, modelRegistry);
		await createSession({ sessionManager: manager, extensionRunner, modelRegistry });
		const outcome = track();
		expect(await session.prompt("/noop", { onSubmissionOutcome: outcome.cb })).toBe(false);
		expect(outcome.outcomes).toEqual([{ kind: "command" }]);
		expect(userTexts(manager)).toEqual([]);
	});

	it("persists two identical same-millisecond prompts under distinct ids that survive a reload", async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-submission-identity-"));
		const manager = SessionManager.create(tempDir, tempDir);
		await createSession({ sessionManager: manager });
		vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		const first = track();
		const second = track();
		await session.prompt("same words", { onSubmissionOutcome: first.cb });
		await session.prompt("same words", { onSubmissionOutcome: second.cb });

		expect(first.outcomes).toHaveLength(1);
		expect(second.outcomes).toHaveLength(1);
		const ids = [first.outcomes[0], second.outcomes[0]].map(o => (o.kind === "inserted" ? o.entryId : undefined));
		expect(ids[0]).toBeDefined();
		expect(ids[1]).toBeDefined();
		expect(ids[0]).not.toBe(ids[1]);
		expect(userTexts(manager)).toEqual(["same words", "same words"]);

		await manager.flush();
		const sessionFile = manager.getSessionFile();
		if (!sessionFile) throw new Error("Expected a file-backed session");
		const reloaded = await SessionManager.open(sessionFile);
		const reloadedIds = reloaded
			.buildSessionContext()
			.messages.filter(message => message.role === "user")
			.map(message => sessionEntryIdOf(message));
		expect(reloadedIds).toEqual(ids);
	});

	it("gates agent-initiated async-result wakes on allowAgentInitiatedTurns", async () => {
		const manager = new AsyncJobManager({});
		AsyncJobManager.setInstance(manager);
		await createSession({ agentId: "GateOwner", asyncJobManager: manager });
		let allow = false;
		session.setClientBridge({ capabilities: {}, allowAgentInitiatedTurns: () => allow });
		await session.prompt("First");
		const callsAfterFirst = gates.size;

		manager.register("bash", "parked job", async () => "PARKED", { id: "parked-job", ownerId: "GateOwner" });
		await session.settleAsyncWork();
		expect(gates.size).toBe(callsAfterFirst);

		allow = true;
		manager.register("bash", "owned job", async () => "WAKE", { id: "wake-job", ownerId: "GateOwner" });
		await session.settleAsyncWork();
		expect(gates.size).toBeGreaterThan(callsAfterFirst);
	});
});
