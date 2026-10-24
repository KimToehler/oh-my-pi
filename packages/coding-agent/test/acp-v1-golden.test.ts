/**
 * ACP v1 golden transcripts.
 *
 * Each scenario drives the real `AcpAgent` over in-memory NDJSON byte streams and records every frame the agent
 * writes (responses, notifications, agent-to-client requests) in wire order. The normalised frames are compared with
 * `fixtures/acp-v1-golden/<scenario>.ndjson`, one frame per line. Any difference fails the test.
 *
 * Regenerate deliberately with `ACP_GOLDEN_UPDATE=1 bun test test/acp-v1-golden.test.ts` and review the fixture diff.
 */
import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import { AgentBusyError, type AgentTool, type AgentToolContext } from "@oh-my-pi/pi-agent-core";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { ExtensionToolWrapper } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/wrapper";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { RequestPermissionRequest } from "@oh-my-pi/pi-utils/acp";
import {
	cleanupHarnessState,
	createWireHarness,
	eventLoopTurns,
	FakeAgentSession,
	makeAssistantMessage,
	type WireHarness,
} from "./acp-test-harness";

const FIXTURE_DIR = path.join(import.meta.dir, "fixtures", "acp-v1-golden");
const UPDATE_MODE = Bun.env.ACP_GOLDEN_UPDATE === "1";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;
/** Keys whose numeric value is a clock reading or elapsed time and therefore differs per run. */
const VOLATILE_NUMBER_KEYS: Record<string, true> = {
	timestamp: true,
	durationMs: true,
	elapsedMs: true,
	duration: true,
	startedAt: true,
	endedAt: true,
};

/**
 * The single normaliser for recorded frames. Everything that varies between runs is replaced by a stable token;
 * everything else is kept verbatim so a real protocol change shows up as a fixture diff.
 *
 * Rules, applied to every string and number in a parsed frame:
 *  1. Absolute temp paths: the per-test temp root (and its realpath, e.g. `/private/var/...` on macOS) becomes
 *     `<ROOT>`; session files embed the root, so a literal path would differ on every run.
 *  2. UUIDs (session ids are UUIDv7, message ids are UUIDv4, both random): replaced by `<UUID-n>` where `n` is the
 *     order of first appearance in this transcript. Numbering keeps distinct ids distinguishable, so a frame that
 *     reuses or mixes up ids still differs from the fixture.
 *  3. ISO-8601 timestamps (session `updatedAt`, header timestamps, file-name timestamps): replaced by `<TIMESTAMP>`.
 *     Session file names carry a compact timestamp too; it is replaced with the same token.
 *  4. Clock/duration numbers: values under keys in {@link VOLATILE_NUMBER_KEYS} become `<NUMBER>`.
 *  5. The string under a `version` key (`agentInfo.version` is the package version, bumped every release):
 *     replaced by `<VERSION>` so a release does not invalidate the fixtures.
 */
function createNormalizer(roots: string[]): (frame: unknown) => unknown {
	const uuids = new Map<string, string>();
	const rootPatterns = roots.map(root => new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
	const normalizeString = (value: string): string => {
		let result = value;
		for (const pattern of rootPatterns) result = result.replace(pattern, "<ROOT>");
		result = result.replace(UUID_PATTERN, match => {
			const key = match.toLowerCase();
			let token = uuids.get(key);
			if (!token) {
				token = `<UUID-${uuids.size + 1}>`;
				uuids.set(key, token);
			}
			return token;
		});
		result = result.replace(ISO_TIMESTAMP_PATTERN, "<TIMESTAMP>");
		// Compact file-name timestamp, e.g. `2026-10-22T12-30-45-123Z_<uuid>.jsonl`.
		return result.replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d+)?Z/g, "<TIMESTAMP>");
	};
	const visit = (value: unknown, key?: string): unknown => {
		if (typeof value === "string") return key === "version" ? "<VERSION>" : normalizeString(value);
		if (typeof value === "number")
			return key !== undefined && Object.hasOwn(VOLATILE_NUMBER_KEYS, key) ? "<NUMBER>" : value;
		if (Array.isArray(value)) return value.map(item => visit(item));
		if (typeof value === "object" && value !== null) {
			const out: Record<string, unknown> = {};
			for (const [childKey, child] of Object.entries(value)) out[normalizeString(childKey)] = visit(child, childKey);
			return out;
		}
		return value;
	};
	return frame => visit(frame);
}

function normalizedTranscript(harness: WireHarness): string {
	const roots = [harness.root];
	try {
		roots.push(fs.realpathSync(harness.root));
	} catch {
		// Root already removed; the literal root still applies.
	}
	// Longest first so a realpath is never partially rewritten by its shorter alias.
	roots.sort((a, b) => b.length - a.length);
	const normalize = createNormalizer(roots);
	return `${harness.recorder
		.frames()
		.map(frame => JSON.stringify(normalize(frame)))
		.join("\n")}\n`;
}

function expectGolden(scenario: string, harness: WireHarness): void {
	const actual = normalizedTranscript(harness);
	const fixture = path.join(FIXTURE_DIR, `${scenario}.ndjson`);
	if (UPDATE_MODE) {
		fs.mkdirSync(FIXTURE_DIR, { recursive: true });
		fs.writeFileSync(fixture, actual);
		return;
	}
	if (!fs.existsSync(fixture)) {
		throw new Error(`missing golden fixture ${fixture}; generate it with ACP_GOLDEN_UPDATE=1`);
	}
	expect(actual).toBe(fs.readFileSync(fixture, "utf8"));
}

/** Waits until the session's bootstrap notifications (sent after the race-guard timer) have been written. */
async function awaitBootstrap(harness: WireHarness, sessionId: string): Promise<void> {
	await harness.recorder.waitForFrame(frame => {
		const record = frame as { method?: string; params?: { sessionId?: string; update?: { sessionUpdate?: string } } };
		return (
			record.method === "session/update" &&
			record.params?.sessionId === sessionId &&
			record.params.update?.sessionUpdate === "session_info_update"
		);
	});
	// Anything the bootstrap emits after session_info_update (usage) is already queued behind it.
	await eventLoopTurns(3);
}

async function startSession(harness: WireHarness): Promise<{ sessionId: string; session: FakeAgentSession }> {
	await harness.client.initialize({ protocolVersion: harness.protocolVersion, clientCapabilities: {} });
	const created = await harness.client.newSession({ cwd: harness.cwdA, mcpServers: [] });
	await awaitBootstrap(harness, created.sessionId);
	return { sessionId: created.sessionId, session: harness.findSession(created.sessionId)! };
}

async function finish(harness: WireHarness): Promise<void> {
	await eventLoopTurns(5);
	await harness.close();
}

function emitter(session: FakeAgentSession): (event: AgentSessionEvent) => void {
	return event => {
		for (const listener of session.listeners()) listener(event);
	};
}

afterEach(cleanupHarnessState);

describe("ACP v1 golden transcripts", () => {
	it("initialize", async () => {
		const harness = await createWireHarness();
		await harness.client.initialize({ protocolVersion: harness.protocolVersion, clientCapabilities: {} });
		await finish(harness);
		expectGolden("initialize", harness);
	});

	it("session-new", async () => {
		const harness = await createWireHarness();
		await startSession(harness);
		await finish(harness);
		expectGolden("session-new", harness);
	});

	it("prompt-text-tool-diff-plan", async () => {
		const harness = await createWireHarness();
		const { sessionId, session } = await startSession(harness);
		const emit = emitter(session);
		const filePath = path.join(harness.cwdA, "src", "greeting.ts");
		session.contextUsage = { tokens: 1234, contextWindow: 200_000, percent: 0.6 };
		session.prompt = async text => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			const reply = makeAssistantMessage("Updating the greeting.");
			emit({
				type: "message_update",
				message: reply,
				assistantMessageEvent: { type: "text_delta", delta: "Updating the greeting." },
			} as AgentSessionEvent);
			emit({
				type: "tool_execution_start",
				toolCallId: "call_edit_1",
				toolName: "edit",
				args: { path: filePath },
				intent: "Update greeting",
			} as AgentSessionEvent);
			emit({
				type: "tool_execution_end",
				toolCallId: "call_edit_1",
				toolName: "edit",
				isError: false,
				result: {
					content: [{ type: "text", text: "edited" }],
					details: {
						perFileResults: [{ path: filePath, oldText: "hello\n", newText: "hello, world\n" }],
					},
				},
			} as AgentSessionEvent);
			emit({
				type: "tool_execution_end",
				toolCallId: "call_todo_1",
				toolName: "todo",
				isError: false,
				result: {
					content: [{ type: "text", text: "updated" }],
					details: {
						phases: [
							{
								name: "Work",
								tasks: [
									{ content: "Edit greeting", status: "completed" },
									{ content: "Run tests", status: "in_progress" },
								],
							},
						],
					},
				},
			} as AgentSessionEvent);
			session.sessionManager.appendMessage(reply);
			emit({ type: "agent_end", messages: [reply] } as AgentSessionEvent);
			session.isStreaming = false;
			return true;
		};
		const response = await harness.client.prompt({ sessionId, prompt: [{ type: "text", text: "greet the world" }] });
		expect(response.stopReason).toBe("end_turn");
		await finish(harness);
		expectGolden("prompt-text-tool-diff-plan", harness);
	});

	it("prompt-during-streaming", async () => {
		const harness = await createWireHarness();
		const { sessionId, session } = await startSession(harness);
		const emit = emitter(session);
		// An autonomous turn is streaming; a bare prompt is busy, a steer prompt is queued and drained by a later turn.
		session.isStreaming = true;
		const queued = Promise.withResolvers<void>();
		session.prompt = async (_text, options) => {
			if (session.isStreaming && !options?.streamingBehavior) throw new AgentBusyError();
			queued.resolve();
			return true;
		};
		const idleWaitEntered = Promise.withResolvers<void>();
		const drainDone = Promise.withResolvers<void>();
		session.waitForIdleBlocker = () => {
			idleWaitEntered.resolve();
			return drainDone.promise;
		};
		const response = harness.client.prompt({ sessionId, prompt: [{ type: "text", text: "ping" }] });
		await queued.promise;
		emit({ type: "agent_end", messages: [makeAssistantMessage("autonomous")] } as AgentSessionEvent);
		await idleWaitEntered.promise;
		const answer = makeAssistantMessage("pong to ping");
		emit({
			type: "message_update",
			message: answer,
			assistantMessageEvent: { type: "text_delta", delta: "pong to ping" },
		} as AgentSessionEvent);
		emit({ type: "agent_end", messages: [answer] } as AgentSessionEvent);
		session.isStreaming = false;
		drainDone.resolve();
		expect((await response).stopReason).toBe("end_turn");
		await finish(harness);
		expectGolden("prompt-during-streaming", harness);
	});

	it("cancel", async () => {
		const harness = await createWireHarness();
		const { sessionId, session } = await startSession(harness);
		session.promptGate = Promise.withResolvers<void>().promise;
		const response = harness.client.prompt({ sessionId, prompt: [{ type: "text", text: "long task" }] });
		await session.promptEntered.promise;
		await harness.client.cancel({ sessionId });
		expect((await response).stopReason).toBe("cancelled");
		await finish(harness);
		expectGolden("cancel", harness);
	});

	/**
	 * Runs one ordinary `bash` call in `write` mode through the approval gate over the session's runner, whose UI the
	 * ACP agent configured; the client answers the permission request with `optionId`.
	 */
	async function gatedBash(optionId: string) {
		const requests: RequestPermissionRequest[] = [];
		const harness = await createWireHarness({
			extensionRunners: true,
			clientHandlers: {
				requestPermission: async request => {
					requests.push(request);
					return { outcome: { outcome: "selected", optionId } };
				},
			},
		});
		const { session } = await startSession(harness);
		const runner = session.extensionRunner;
		if (!runner) throw new Error("expected the session's extension runner");
		let runs = 0;
		const bash = new ExtensionToolWrapper(
			{
				name: "bash",
				label: "bash",
				description: "Fake bash",
				parameters: type({ "command?": "string" }),
				approval: "exec",
				execute: async () => (runs++, { content: [{ type: "text" as const, text: "ok" }] }),
			} as AgentTool,
			runner,
		);
		const call = bash.execute("call_bash_1", { command: "echo hi" }, undefined, undefined, {
			settings: Settings.isolated({ "tools.approvalMode": "write" }),
		} as AgentToolContext);
		return { harness, requests, call, runs: () => runs };
	}

	it("permission-request", async () => {
		const { harness, requests, call, runs } = await gatedBash("allow_once");
		await call;
		expect(runs()).toBe(1);
		expect(requests.map(request => request.options.map(option => option.optionId))).toEqual([
			["allow_once", "allow_always", "reject_once", "reject_always"],
		]);
		await finish(harness);
		expectGolden("permission-request", harness);
	});

	it("permission-request rejected once fails the call", async () => {
		const { harness, call, runs } = await gatedBash("reject_once");
		await expect(call).rejects.toThrow("Tool call denied by user: bash");
		expect(runs()).toBe(0);
		await finish(harness);
	});

	it("session-load-replay", async () => {
		const harness = await createWireHarness();
		await harness.client.initialize({ protocolVersion: harness.protocolVersion, clientCapabilities: {} });
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
		stored.sessionManager.appendMessage(makeAssistantMessage("reply", "reasoning"));
		stored.sessionManager.appendMessage({
			role: "toolResult",
			toolCallId: "todo_replay",
			toolName: "todo",
			content: [{ type: "text", text: "updated" }],
			details: { phases: [{ name: "Replay", tasks: [{ content: "Restore plan", status: "pending" }] }] },
			isError: false,
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();
		await harness.client.loadSession({ sessionId: stored.sessionId, cwd: harness.cwdA, mcpServers: [] });
		await awaitBootstrap(harness, stored.sessionId);
		await finish(harness);
		expectGolden("session-load-replay", harness);
	});

	it("background-wake-inside-open-prompt", async () => {
		const harness = await createWireHarness();
		const { sessionId, session } = await startSession(harness);
		const emit = emitter(session);
		const settleEntered = Promise.withResolvers<void>();
		const jobDone = Promise.withResolvers<void>();
		session.pendingAsyncWork = true;
		session.settleAsyncWork = async () => {
			settleEntered.resolve();
			await jobDone.promise;
			const wake = makeAssistantMessage("job wake");
			emit({
				type: "message_update",
				message: wake,
				assistantMessageEvent: { type: "text_delta", delta: "job wake" },
			} as AgentSessionEvent);
			emit({ type: "agent_end", messages: [wake] } as AgentSessionEvent);
			session.pendingAsyncWork = false;
		};
		const response = harness.client.prompt({ sessionId, prompt: [{ type: "text", text: "start a background job" }] });
		await settleEntered.promise;
		jobDone.resolve();
		expect((await response).stopReason).toBe("end_turn");
		await finish(harness);
		expectGolden("background-wake-inside-open-prompt", harness);
	});
});
