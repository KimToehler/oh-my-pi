/**
 * Contract (relocation-admission-lease, design D2): a guest's `agent-cmd` `chat`
 * revives and prompts through `AgentLifecycleManager.promptLive`. The revival waits
 * while a relocation holds the agent's tree, the admission ticket stays open until
 * the prompt is called or the room guard rejects it, and a room that ended while the
 * revival waited prompts nothing.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn, vi } from "bun:test";
import { CollabHost } from "@oh-my-pi/pi-coding-agent/collab/host";
import { COLLAB_PROTO, parseCollabLink } from "@oh-my-pi/pi-coding-agent/collab/protocol";
import { CollabSocket } from "@oh-my-pi/pi-coding-agent/collab/relay-client";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { installInMemoryRelay, uninstallInMemoryRelay } from "./helpers/in-memory-relay";

const ROOT = "Main";
const WORKER = "Worker";

function makeContext(): InteractiveModeContext {
	const sessionId = `sess-${crypto.randomUUID()}`;
	return {
		settings: Settings.isolated(),
		sessionManager: {
			getSessionId: () => sessionId,
			getCwd: () => "/tmp/collab-agent-chat-admission",
			snapshotForReplication: () => ({
				header: {
					type: "session",
					id: sessionId,
					timestamp: "2026-07-20T00:00:00Z",
					cwd: "/tmp/collab-agent-chat-admission",
				},
				entries: [],
			}),
			onEntryAppended: undefined,
		},
		session: {
			isSessionTransitioning: false,
			isStreaming: false,
			queuedMessageCount: 0,
			sessionName: "agent-chat-admission",
			model: undefined,
			thinkingLevel: undefined,
			subscribe: () => () => {},
			emitNotice: () => {},
			promptCustomMessage: () => Promise.resolve(),
			abort: () => Promise.resolve(),
		},
		eventBus: undefined,
		statusLine: {
			setCollabStatus: () => {},
			invalidate: () => {},
			getCachedContextBreakdown: () => ({ usedTokens: 0, contextWindow: 0 }),
		},
		ui: { requestRender: () => {} },
		showStatus: () => {},
		collabHost: undefined,
	} as unknown as InteractiveModeContext;
}

/** Track whether a promise has settled after pending continuations ran. */
function track<T>(promise: Promise<T>): { readonly settled: boolean } {
	const state = { settled: false };
	void promise.then(() => {
		state.settled = true;
	});
	return state;
}

/** Drain pending promise continuations; nothing on these paths waits on a timer. */
async function flush(): Promise<void> {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

let host: CollabHost | undefined;

beforeEach(() => {
	AgentRegistry.resetGlobalForTests();
	AgentLifecycleManager.resetGlobalForTests();
	installInMemoryRelay();
	host = undefined;
});

afterEach(async () => {
	vi.restoreAllMocks();
	if (host) await host.stop("test cleanup").catch(() => {});
	uninstallInMemoryRelay();
	AgentLifecycleManager.resetGlobalForTests();
	AgentRegistry.resetGlobalForTests();
});

async function startHost(ctx: InteractiveModeContext): Promise<CollabSocket> {
	const originalConnect = CollabSocket.prototype.connect;
	let transport: CollabSocket | undefined;
	const capture = spyOn(CollabSocket.prototype, "connect").mockImplementation(function (this: CollabSocket) {
		transport = this;
		return originalConnect.call(this);
	});
	host = new CollabHost(ctx);
	try {
		await host.start("ws://localhost:8788");
	} finally {
		capture.mockRestore();
	}
	if (!transport) throw new Error("host transport missing");
	return transport;
}

describe("collab guest agent chat admission", () => {
	it("collab chat: a guest chat whose room ends while revival waits for a relocation prompts nothing and releases its ticket", async () => {
		const transport = await startHost(makeContext());
		spyOn(transport, "send").mockImplementation(() => {});
		spyOn(transport, "sendBatch").mockImplementation(() => {});
		const parsed = parseCollabLink(host!.link);
		if ("error" in parsed) throw new Error(parsed.error);
		const writeToken = parsed.writeToken ? Buffer.from(parsed.writeToken).toString("base64url") : undefined;
		transport.onFrame!({ t: "hello", proto: COLLAB_PROTO, name: "writer", writeToken }, 1);

		const registry = AgentRegistry.global();
		registry.register({
			id: WORKER,
			displayName: WORKER,
			kind: "sub",
			parentId: ROOT,
			session: null,
			sessionFile: "/tmp/collab-agent-chat-admission/Worker.jsonl",
			status: "parked",
		});
		const prompts: string[] = [];
		const revivals: string[] = [];
		const session = {
			prompt: async (text: string) => {
				prompts.push(text);
				return true;
			},
			subscribe: () => () => {},
			dispose: async () => {},
		} as unknown as AgentSession;
		const lifecycle = AgentLifecycleManager.global();
		lifecycle.setPersistedSubagentReviverFactory(
			async ref => async () => {
				revivals.push(ref.id);
				return session;
			},
			() => 0,
		);
		// Hold the revived session just after the revival, before the prompt decision.
		const realEnsureLive = lifecycle.ensureLive.bind(lifecycle);
		const afterRevival = Promise.withResolvers<void>();
		vi.spyOn(lifecycle, "ensureLive").mockImplementation(async (id, options) => {
			const live = await realEnsureLive(id, options);
			await afterRevival.promise;
			return live;
		});
		const tree = { rootId: ROOT, isMember: (ref: { id: string }) => ref.id === WORKER };

		const lease = registry.relocationAdmission.hold(tree);
		transport.onFrame!({ t: "agent-cmd", cmd: "chat", agentId: WORKER, text: "hello" }, 1);
		await flush();
		expect(revivals).toEqual([]);

		// The room ends while the revival waits for the relocation.
		const stopping = host!.stop("test room ends");
		expect(host!.ending).toBe(true);
		lease[Symbol.dispose]();
		await flush();
		expect(revivals).toEqual([WORKER]);

		// The revival is done but the chat has not decided yet: its ticket is still open.
		using later = registry.relocationAdmission.hold(tree);
		const ready = track(later.ready);
		await flush();
		expect(ready.settled).toBe(false);

		afterRevival.resolve();
		await flush();
		expect(prompts).toEqual([]);
		expect(ready.settled).toBe(true);
		await stopping;
	});
});
