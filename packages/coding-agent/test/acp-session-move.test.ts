/**
 * ACP `session_move`: the ACP host installs a session relocator per session record, so a move requested by the
 * agent-callable tool relocates the real session and its continuation turn streams to the client under the same
 * session id. Driven over the raw NDJSON wire client with a real `AgentSession` and the mock provider; the tool is a
 * stand-in that records the request and stops the batch exactly as the real `session_move` tool does.
 */
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { type AgentTool } from "@oh-my-pi/pi-agent-core";
import { createMockModel, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { Agent } from "@oh-my-pi/pi-agent-core";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { AcpSessionFactory } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { getProjectDir, isRecord, setProjectDir } from "@oh-my-pi/pi-utils";
import { Type } from "@sinclair/typebox";
import { cleanupHarnessState, createV2WireHarness, type RawAcpClient, type RawAcpResponse } from "./acp-test-harness";

setDefaultTimeout(20_000);

const teardown: Array<() => Promise<void>> = [];
// A relocation `chdir`s the process and the project-dir cache into the target; restore both per test.
const originalProjectDir = getProjectDir();

afterEach(async () => {
	setProjectDir(originalProjectDir);
	for (const step of teardown.splice(0)) await step();
	await cleanupHarnessState();
	AsyncJobManager.resetForTests();
});

interface MoveRig {
	client: RawAcpClient;
	sessionId: string;
	session: AgentSession;
	/** Existing directory, outside the session's starting cwd, the move targets. */
	target: string;
	source: string;
	/** Model call count (0 = the prompt's call, 1 = the continuation). */
	modelCalls(): number;
	/** Whether the move reservation was committed (a relocator was installed). */
	requested: boolean[];
}

function contentText(content: unknown): string {
	if (isRecord(content) && typeof content.text === "string") return content.text;
	return "";
}

async function startMoveRig(version: 1 | 2, script: Record<number, MockResponse>): Promise<MoveRig> {
	const sessions: AgentSession[] = [];
	const storages: AuthStorage[] = [];
	const requested: boolean[] = [];
	let calls = 0;
	let current: AgentSession | undefined;
	const moveTool: AgentTool = {
		name: "session_move",
		label: "session_move",
		description: "move",
		parameters: Type.Object({}),
		async execute() {
			requested.push(current?.reserveSessionMove()?.commit({ path: targetPath }) ?? false);
			return { content: [{ type: "text", text: "scheduled" }] };
		},
	};
	let targetPath = "";
	const factory: AcpSessionFactory = async cwd => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");
		const mock = createMockModel({
			provider: model.provider,
			id: model.id,
			handler: async () => script[calls++] ?? { content: [`reply ${calls - 1}`] },
		});
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [moveTool] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		storages.push(authStorage);
		authStorage.keys.setRuntime("anthropic", "test-key");
		const session = new AgentSession({
			agent,
			sessionManager: SessionManager.create(cwd),
			settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false }),
			modelRegistry: new ModelRegistry(authStorage),
			toolRegistry: new Map([[moveTool.name, moveTool]]),
		});
		current = session;
		sessions.push(session);
		return session;
	};
	const h = await createV2WireHarness({ factory, maxVersion: version, validate: version === 2 });
	teardown.push(async () => {
		await h.close();
		for (const session of sessions) await session.dispose();
		for (const storage of storages) storage.close();
	});
	const init = await h.client.request(
		"initialize",
		version === 2
			? { protocolVersion: 2, info: { name: "acp-session-move", version: "0" }, capabilities: {} }
			: { protocolVersion: 1, clientCapabilities: {} },
	);
	if (init.error) throw new Error(`initialize failed: ${init.error.message}`);
	expect((init.result as { protocolVersion: number }).protocolVersion).toBe(version);
	targetPath = fs.realpathSync(fs.mkdtempSync(path.join(h.root, "move-target-")));
	const created = await h.client.request("session/new", { cwd: h.cwd, mcpServers: [] });
	if (created.error || !isRecord(created.result)) throw new Error("session/new failed");
	const sessionId = String(created.result.sessionId);
	const session = sessions.find(candidate => candidate.sessionId === sessionId);
	if (!session) throw new Error(`no session ${sessionId}`);
	return {
		client: h.client,
		sessionId,
		session,
		target: targetPath,
		source: h.cwd,
		modelCalls: () => calls,
		requested,
	};
}

const MOVE_CALL: MockResponse = { content: [{ type: "toolCall", id: "m1", name: "session_move", arguments: {} }] };

function prompt(rig: MoveRig): Promise<RawAcpResponse> {
	return rig.client.request("session/prompt", { sessionId: rig.sessionId, prompt: [{ type: "text", text: "go" }] });
}

function chunkIndex(rig: MoveRig, text: string): number {
	return (
		rig.client
			.updates(rig.sessionId)
			.filter(
				entry => entry.update.sessionUpdate === "agent_message_chunk" && contentText(entry.update.content) === text,
			)
			.map(entry => entry.index)[0] ?? -1
	);
}

describe("acp session move", () => {
	it("acp session move: v1 streams the continuation inside the open prompt, in the same session, in the target cwd", async () => {
		const rig = await startMoveRig(1, { 0: MOVE_CALL, 1: { content: ["continued"] } });
		const response = await prompt(rig);
		expect(response.error).toBeUndefined();
		expect(rig.requested).toEqual([true]);
		expect(rig.modelCalls()).toBe(2);
		// The continuation's chunk reaches the client for the same session id, before the prompt response.
		const continued = chunkIndex(rig, "continued");
		expect(continued).toBeGreaterThan(-1);
		expect(response.index).toBeGreaterThan(continued);
		// Every session/update of the exchange carried the one session id the client opened.
		expect(rig.client.updates(rig.sessionId).length).toBeGreaterThan(0);
		expect(rig.session.sessionId).toBe(rig.sessionId);
		expect(rig.session.sessionManager.getCwd()).toBe(rig.target);
		expect(rig.session.sessionManager.getCwd()).not.toBe(rig.source);
		// The continuation was not parked: the prompt turn already settled it (nothing left streaming or queued).
		expect(rig.session.isStreaming).toBe(false);
		expect(rig.session.isSessionTransitioning).toBe(false);
	});

	it("acp session move: v2 streams the continuation as agent-origin work in the same session and target cwd", async () => {
		const rig = await startMoveRig(2, { 0: MOVE_CALL, 1: { content: ["continued"] } });
		const response = await prompt(rig);
		expect(response.error).toBeUndefined();
		await rig.client.waitFor(
			c => c.states(rig.sessionId).at(-1)?.state === "idle" && chunkIndex(rig, "continued") > -1,
			"continuation streamed and idle",
		);
		expect(rig.requested).toEqual([true]);
		expect(rig.modelCalls()).toBe(2);
		expect(chunkIndex(rig, "continued")).toBeGreaterThan(-1);
		expect(rig.session.sessionManager.getCwd()).toBe(rig.target);
		// v2 acknowledges the prompt at insertion; the work stays "running" through the relocation and the
		// continuation, and goes idle once, after the continuation's chunk.
		const states = rig.client.states(rig.sessionId);
		expect(states.map(state => state.state)).toEqual(["running", "idle"]);
		expect(states[1]!.stopReason).toBe("end_turn");
		expect(states[1]!.index).toBeGreaterThan(chunkIndex(rig, "continued"));
	});

	it("acp session move: closing the session clears the relocator", async () => {
		const rig = await startMoveRig(1, {});
		expect(rig.session.reserveSessionMove()?.commit({ path: rig.target })).toBe(true);
		const closed = await rig.client.request("session/close", { sessionId: rig.sessionId });
		expect(closed.error).toBeUndefined();
		expect(rig.session.reserveSessionMove()).toBeUndefined();
	});
});
