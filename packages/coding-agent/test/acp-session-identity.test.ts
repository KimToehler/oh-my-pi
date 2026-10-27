import { afterEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as headlessRelocation from "@oh-my-pi/pi-coding-agent/session/headless-relocation";
import type { SubmissionOutcome } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { isRecord } from "@oh-my-pi/pi-utils";
import { AgentSideConnection, AgentSideConnectionV2 } from "@oh-my-pi/pi-utils/acp";
import {
	cleanupHarnessState,
	createHarness,
	createV2WireHarness,
	eventLoopTurns,
	type FakeAgentSession,
	makeAssistantMessage,
	type RawAcpClient,
	type RawAcpResponse,
	type V2WireHarness,
} from "./acp-test-harness";

const rigs: V2WireHarness[] = [];

afterEach(async () => {
	// Connections close before the roots they write to are removed.
	for (const h of rigs.splice(0)) await h.close();
	await cleanupHarnessState();
});

async function storedSessionFile(cwd: string): Promise<string> {
	const manager = SessionManager.create(cwd);
	await manager.newSession();
	manager.appendMessage({ role: "user", content: "other conversation", timestamp: Date.now() });
	manager.appendMessage(makeAssistantMessage("other reply"));
	await manager.flush();
	const file = manager.getSessionFile();
	await manager.close();
	if (!file) throw new Error("Expected a persisted session file");
	return file;
}

describe("ACP session identity", () => {
	it("refuses extension actions that would replace the session's transcript", async () => {
		const harness = await createHarness({ extensionRunners: true });
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session?.extensionRunner) throw new Error("Expected a session with an extension runner");
		const ctx = session.extensionRunner.createCommandContext();
		const otherFile = await storedSessionFile(harness.cwdA);
		const fileBefore = session.sessionManager.getSessionFile();
		const setup = vi.fn(async () => {});

		expect(await ctx.newSession({ setup })).toEqual({ cancelled: true });
		expect(await ctx.branch("earlier-user-entry")).toEqual({ cancelled: true });
		expect(await ctx.switchSession(otherFile)).toEqual({ cancelled: true });

		expect(setup).not.toHaveBeenCalled();
		expect(session.sessionId).toBe(created.sessionId);
		expect(session.sessionManager.getSessionFile()).toBe(fileBefore);

		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "still A?" }] });
		const chunks = harness.updates.filter(update => update.update.sessionUpdate === "agent_message_chunk");
		expect(chunks.length).toBeGreaterThan(0);
		expect(new Set(harness.updates.map(update => update.sessionId))).toEqual(new Set([created.sessionId]));

		await harness.agent.dispose();
	});

	it("keeps tree navigation and reload on the same session", async () => {
		const harness = await createHarness({ extensionRunners: true });
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session?.extensionRunner) throw new Error("Expected a session with an extension runner");
		const ctx = session.extensionRunner.createCommandContext();
		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "first" }] });
		const fileBefore = session.sessionManager.getSessionFile();
		const entriesBefore = session.sessionManager.getEntries().length;
		const navigate = vi.spyOn(session, "navigateTree");
		const reload = vi.spyOn(session, "reload");

		expect(await ctx.navigateTree("earlier-entry")).toEqual({ cancelled: false });
		await ctx.reload();

		expect(navigate).toHaveBeenCalledWith("earlier-entry", { summarize: undefined });
		expect(reload).toHaveBeenCalledTimes(1);
		expect(session.sessionId).toBe(created.sessionId);
		expect(session.sessionManager.getSessionFile()).toBe(fileBefore);
		expect(session.sessionManager.getEntries().length).toBe(entriesBefore);

		harness.updates.length = 0;
		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "second" }] });
		expect(harness.updates.length).toBeGreaterThan(0);
		expect(new Set(harness.updates.map(update => update.sessionId))).toEqual(new Set([created.sessionId]));

		await harness.agent.dispose();
	});
});

// ---------------------------------------------------------------------------
// `/session delete` over the wire, once per protocol surface
// ---------------------------------------------------------------------------

type Surface = 1 | 2;

interface DeleteRig {
	surface: Surface;
	h: V2WireHarness;
	client: RawAcpClient;
	sessionId: string;
	session: FakeAgentSession;
	file: string;
}

interface Turn {
	/** The `session/prompt` response (v2: the insertion acknowledgement). */
	ack: Promise<RawAcpResponse>;
	/** The turn's end: v1 the prompt response's `stopReason`, v2 the foreground's `idle` state update. */
	ended: Promise<string | undefined>;
}

function resultOf(response: RawAcpResponse): Record<string, unknown> {
	if (response.error) throw new Error(`unexpected error ${response.error.code}: ${response.error.message}`);
	if (!isRecord(response.result)) throw new Error("expected an object result");
	return response.result;
}

async function startDeleteRig(surface: Surface): Promise<DeleteRig> {
	const h = await createV2WireHarness({ maxVersion: surface });
	rigs.push(h);
	const client = h.client;
	resultOf(
		await client.request(
			"initialize",
			surface === 1
				? { protocolVersion: 1, clientCapabilities: {} }
				: { protocolVersion: 2, info: { name: "acp-session-identity", version: "0" }, capabilities: {} },
		),
	);
	const created = resultOf(await client.request("session/new", { cwd: h.cwd, mcpServers: [] }));
	const sessionId = String(created.sessionId);
	const session = h.sessions.find(candidate => candidate.sessionId === sessionId);
	if (!session) throw new Error("Expected the factory to have created the session");
	// The fake session never reports a submission outcome, which a v2 prompt waits for before it answers.
	const prompt = session.prompt.bind(session);
	session.prompt = async (text, options) => {
		(options as { onSubmissionOutcome?: (outcome: SubmissionOutcome) => void } | undefined)?.onSubmissionOutcome?.({
			kind: "inserted",
			entryId: crypto.randomUUID(),
		});
		return await prompt(text, options);
	};
	const rig: DeleteRig = { surface, h, client, sessionId, session, file: "" };
	// An existing conversation on disk. (The fake session's plain turns never reach a v2 `idle`.)
	session.sessionManager.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
	session.sessionManager.appendMessage(makeAssistantMessage("hi"));
	const file = session.sessionManager.getSessionFile();
	if (!file) throw new Error("Expected a persisted session file");
	await session.sessionManager.flush();
	expect(fs.existsSync(file)).toBe(true);
	rig.file = file;
	return rig;
}

function startTurn(rig: DeleteRig, text: string, sessionId = rig.sessionId): Turn {
	const { client } = rig;
	const idlesBefore = client.states(sessionId).filter(state => state.state === "idle").length;
	const ack = client.request("session/prompt", { sessionId, prompt: [{ type: "text", text }] });
	if (rig.surface === 1) {
		return { ack, ended: ack.then(response => (response.error ? undefined : String(resultOf(response).stopReason))) };
	}
	const ended = ack.then(async response => {
		if (response.error) return undefined;
		await client.waitFor(
			c => c.states(sessionId).filter(state => state.state === "idle").length > idlesBefore,
			"idle state_update",
		);
		return client
			.states(sessionId)
			.filter(state => state.state === "idle")
			.at(-1)?.stopReason;
	});
	return { ack, ended };
}

function chunkTexts(client: RawAcpClient, sessionId: string): string[] {
	return client
		.updates(sessionId)
		.filter(entry => entry.update.sessionUpdate === "agent_message_chunk")
		.map(entry => {
			const content = entry.update.content;
			return isRecord(content) && typeof content.text === "string" ? content.text : "";
		});
}

async function until(condition: () => boolean, what: string): Promise<void> {
	for (let turn = 0; turn < 400; turn++) {
		if (condition()) return;
		await eventLoopTurns(1);
	}
	throw new Error(`timed out waiting for ${what}`);
}

/**
 * Holds the write of the `/session delete` confirmation. The confirmation is emitted after the drop succeeded and the
 * session was queued for closing, and the turn cannot end before the write returns, so this is the window between the
 * successful delete and the end of its turn.
 */
function holdDeleteConfirmation(): { reached: Promise<void>; release(): void } {
	const reached = Promise.withResolvers<void>();
	const released = Promise.withResolvers<void>();
	const isConfirmation = (notification: { update: { sessionUpdate: string } }): boolean => {
		const update = notification.update as { sessionUpdate: string; content?: { text?: string } };
		return (
			update.sessionUpdate === "agent_message_chunk" && update.content?.text?.startsWith("Session deleted") === true
		);
	};
	const originalV1 = AgentSideConnection.prototype.sessionUpdate;
	vi.spyOn(AgentSideConnection.prototype, "sessionUpdate").mockImplementation(
		async function (this: AgentSideConnection, notification) {
			if (isConfirmation(notification)) {
				reached.resolve();
				await released.promise;
			}
			return await originalV1.call(this, notification);
		},
	);
	const originalV2 = AgentSideConnectionV2.prototype.sessionUpdate;
	vi.spyOn(AgentSideConnectionV2.prototype, "sessionUpdate").mockImplementation(
		async function (this: AgentSideConnectionV2, notification) {
			if (isConfirmation(notification)) {
				reached.resolve();
				await released.promise;
			}
			return await originalV2.call(this, notification);
		},
	);
	return { reached: reached.promise, release: released.resolve };
}

function normalized(response: RawAcpResponse, sessionId: string): unknown {
	return JSON.parse(JSON.stringify({ result: response.result, error: response.error }).replaceAll(sessionId, "<id>"));
}

interface SessionState {
	entries: number;
	planMode: unknown;
	goalMode: unknown;
	model: string | undefined;
	thinkingLevel: string | undefined;
	factorySessions: number;
}

function snapshot(rig: DeleteRig): SessionState {
	const { session } = rig;
	return {
		entries: session.sessionManager.getEntries().length,
		planMode: session.getPlanModeState(),
		goalMode: session.getGoalModeState(),
		model: session.model?.id,
		thinkingLevel: session.thinkingLevel,
		factorySessions: rig.h.sessions.length,
	};
}

describe.each([1, 2] as const)("ACP /session delete on protocol v%d", surface => {
	it("confirms, ends the turn normally, then refuses the session and leaves no file", async () => {
		const rig = await startDeleteRig(surface);
		const { client, sessionId, session, file } = rig;

		expect(await startTurn(rig, "/session delete").ended).toBe("end_turn");
		expect(chunkTexts(client, sessionId).some(text => text.startsWith("Session deleted:"))).toBe(true);

		const refused = await startTurn(rig, "after delete").ack;
		expect(refused.error).toMatchObject({ code: -32002, message: `Resource not found: ${sessionId}` });
		const listed = resultOf(await client.request("session/list", { cwd: rig.h.cwd }));
		const ids = (Array.isArray(listed.sessions) ? listed.sessions : []).map(entry =>
			isRecord(entry) ? entry.sessionId : undefined,
		);
		expect(ids).not.toContain(sessionId);
		await until(() => session.disposed, "the deleted session to be disposed");
		expect(fs.existsSync(file)).toBe(false);
		expect(session.promptCalls).not.toContain("after delete");
	});

	it("keeps the session usable when the delete fails", async () => {
		const rig = await startDeleteRig(surface);
		const { client, sessionId, session, file } = rig;
		vi.spyOn(session.sessionManager, "dropSession").mockRejectedValue(new Error("disk is read-only"));

		expect(await startTurn(rig, "/session delete").ended).toBe("end_turn");
		expect(
			chunkTexts(client, sessionId).some(text => text.includes("Failed to delete session: disk is read-only")),
		).toBe(true);

		resultOf(await startTurn(rig, "still here").ack);
		await until(() => session.promptCalls.includes("still here"), "the prompt to run");
		expect(session.disposed).toBe(false);
		expect(session.sessionManager.getSessionFile()).toBe(file);
		await session.sessionManager.flush();
		expect(fs.readFileSync(file, "utf8")).toContain("still here");
	});

	describe("while the delete turn is still finishing", () => {
		interface Route {
			name: string;
			/** Surfaces that route the method; the others answer method-not-found, which is not a session lookup. */
			surfaces: readonly Surface[];
			/** Text the request carries, when it carries any; no update may echo it. */
			marker?: string;
			request(rig: DeleteRig, sessionId: string): Promise<RawAcpResponse>;
		}
		const routes: Route[] = [
			{
				name: "session/prompt",
				surfaces: [1, 2],
				marker: "in-window-prompt",
				request: (rig, sessionId) => startTurn(rig, "in-window-prompt", sessionId).ack,
			},
			{
				name: "_session/steering",
				// v2 does not route the `_session/steering` extension.
				surfaces: [1],
				marker: "in-window-steer",
				request: (rig, sessionId) =>
					rig.client.request("_session/steering", {
						sessionId,
						prompt: [{ type: "text", text: "in-window-steer" }],
					}),
			},
			{
				name: "session/set_mode",
				// v2 has no `session/set_mode`; its mode lives in `session/set_config_option`.
				surfaces: [1],
				request: (rig, sessionId) => rig.client.request("session/set_mode", { sessionId, modeId: "plan" }),
			},
			{
				name: "session/set_config_option",
				surfaces: [1, 2],
				request: (rig, sessionId) =>
					rig.client.request("session/set_config_option", { sessionId, configId: "thinking", value: "high" }),
			},
			{
				name: "session/load",
				// v2 has no `session/load`; `session/resume` replaces it.
				surfaces: [1],
				request: (rig, sessionId) =>
					rig.client.request("session/load", { sessionId, cwd: rig.h.cwd, mcpServers: [] }),
			},
			{
				name: "session/resume",
				surfaces: [1, 2],
				request: (rig, sessionId) =>
					rig.client.request("session/resume", { sessionId, cwd: rig.h.cwd, mcpServers: [] }),
			},
			{
				name: "unstable_session/fork",
				// v2 has no fork request; the v1 wire method is `session/fork`.
				surfaces: [1],
				request: (rig, sessionId) =>
					rig.client.request("session/fork", { sessionId, cwd: rig.h.cwd, mcpServers: [] }),
			},
		];

		for (const route of routes) {
			if (!route.surfaces.includes(surface)) continue;
			it(`answers ${route.name} for the deleted session as for a session that never existed`, async () => {
				const rig = await startDeleteRig(surface);
				const { client, sessionId } = rig;
				const hold = holdDeleteConfirmation();
				try {
					const turn = startTurn(rig, "/session delete");
					await hold.reached;
					const before = snapshot(rig);
					const framesBefore = client.frames.length;

					const forDeleted = await route.request(rig, sessionId);
					const neverIssued = crypto.randomUUID();
					const forUnknown = await route.request(rig, neverIssued);

					expect(forUnknown.error).toBeDefined();
					expect(normalized(forDeleted, sessionId)).toEqual(normalized(forUnknown, neverIssued));
					expect(snapshot(rig)).toEqual(before);
					if (route.marker) {
						const carrying = client
							.updates()
							.filter(
								entry => entry.index >= framesBefore && JSON.stringify(entry.update).includes(route.marker!),
							);
						expect(carrying).toEqual([]);
					}

					hold.release();
					expect(await turn.ended).toBe("end_turn");
					expect(chunkTexts(client, sessionId).some(text => text.startsWith("Session deleted:"))).toBe(true);
				} finally {
					hold.release();
				}
			});
		}

		it("ends the delete turn normally with its confirmation once released, then disposes the session", async () => {
			const rig = await startDeleteRig(surface);
			const hold = holdDeleteConfirmation();
			try {
				const turn = startTurn(rig, "/session delete");
				await hold.reached;
				await eventLoopTurns(20);
				expect(rig.session.disposed).toBe(false);
				hold.release();
				expect(await turn.ended).toBe("end_turn");
				expect(chunkTexts(rig.client, rig.sessionId).some(text => text.startsWith("Session deleted:"))).toBe(true);
				await until(() => rig.session.disposed, "the deleted session to be disposed");
			} finally {
				hold.release();
			}
		});

		it("accepts session/cancel and cancels the held turn", async () => {
			const rig = await startDeleteRig(surface);
			const hold = holdDeleteConfirmation();
			try {
				const turn = startTurn(rig, "/session delete");
				await hold.reached;
				await rig.client.notify("session/cancel", { sessionId: rig.sessionId });
				await eventLoopTurns(20);
				hold.release();
				expect(await turn.ended).toBe("cancelled");
				await until(() => rig.session.disposed, "the deleted session to be disposed");
			} finally {
				hold.release();
			}
		});

		it("completes session/close during the window and disposes the record", async () => {
			const rig = await startDeleteRig(surface);
			const hold = holdDeleteConfirmation();
			try {
				const turn = startTurn(rig, "/session delete");
				await hold.reached;
				const closing = rig.client.request("session/close", { sessionId: rig.sessionId });
				await eventLoopTurns(20);
				hold.release();
				resultOf(await closing);
				expect(rig.session.disposed).toBe(true);
				await turn.ended;
			} finally {
				hold.release();
			}
		});

		it("disposes the record when the agent is disposed during the window", async () => {
			const rig = await startDeleteRig(surface);
			const hold = holdDeleteConfirmation();
			try {
				const turn = startTurn(rig, "/session delete");
				await hold.reached;
				await rig.h.agent()?.dispose();
				expect(rig.session.disposed).toBe(true);
				hold.release();
				await turn.ended.catch(() => undefined);
			} finally {
				hold.release();
			}
		});
	});
});

// ---------------------------------------------------------------------------
// A relocation whose rollback fails leaves the session unusable: the record closes like a deleted one
// ---------------------------------------------------------------------------

describe.each([1, 2] as const)("ACP fatal relocation on protocol v%d", surface => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function forceFatalRelocation(): void {
		vi.spyOn(headlessRelocation, "relocateHeadlessSession").mockResolvedValue({
			ok: false,
			fatal: true,
			reason: "rollback failed (forced)",
		});
	}

	function moveTarget(rig: DeleteRig): string {
		const dir = path.join(rig.h.cwd, "move-target");
		fs.mkdirSync(dir, { recursive: true });
		return dir;
	}

	it("/move reports the failure, then refuses the session and releases its record", async () => {
		const rig = await startDeleteRig(surface);
		const { client, sessionId, session } = rig;
		forceFatalRelocation();

		expect(await startTurn(rig, `/move ${moveTarget(rig)}`).ended).toBe("end_turn");
		expect(chunkTexts(client, sessionId).some(text => text.includes("rollback failed (forced)"))).toBe(true);

		const refused = await startTurn(rig, "after the failed move").ack;
		expect(refused.error).toMatchObject({ code: -32002, message: `Resource not found: ${sessionId}` });
		await until(() => session.sessionRelocator === undefined, "the record's relocator to be released");
		expect(session.disposed).toBe(true);
		expect(session.promptCalls).not.toContain("after the failed move");
	});

	it("session_move refuses the session and releases its record", async () => {
		const rig = await startDeleteRig(surface);
		const { sessionId, session } = rig;
		forceFatalRelocation();
		const relocate = session.sessionRelocator;
		if (!relocate) throw new Error("Expected the ACP record to register a session relocator");

		expect(await relocate(moveTarget(rig))).toEqual({ ok: false, reason: "rollback failed (forced)" });

		const refused = await startTurn(rig, "after the failed move").ack;
		expect(refused.error).toMatchObject({ code: -32002, message: `Resource not found: ${sessionId}` });
		await until(() => session.sessionRelocator === undefined, "the record's relocator to be released");
		expect(session.disposed).toBe(true);
		expect(session.promptCalls).not.toContain("after the failed move");
	});
});
