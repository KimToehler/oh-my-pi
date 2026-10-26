/**
 * Peer messages and revivals wait while a relocation holds the recipient's
 * agent tree (relocation-admission-lease, design D2): `IrcBus.#deliver` and
 * `AgentLifecycleManager.ensureLive` admit through the registry's
 * `RelocationAdmission` before they hand off or revive.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import type { IrcMessage } from "@oh-my-pi/pi-tui/tools/irc";
import { IrcBus } from "@oh-my-pi/pi-coding-agent/irc/bus";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { RelocationLease } from "@oh-my-pi/pi-coding-agent/registry/relocation-admission";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

const ROOT = "Main";

interface Fixture {
	registry: AgentRegistry;
	lifecycle: AgentLifecycleManager;
	bus: IrcBus;
	/** Bodies each stub session received, in delivery order. */
	delivered: Map<string, string[]>;
	revivals: string[];
	holdTree(members: string[]): RelocationLease;
}

const lifecycles: AgentLifecycleManager[] = [];

function stubSession(id: string, delivered: Map<string, string[]>): AgentSession {
	return {
		deliverIrcMessage: vi.fn(async (message: IrcMessage) => {
			delivered.set(id, [...(delivered.get(id) ?? []), message.body]);
			return "woken" as const;
		}),
		subscribe: () => () => {},
		dispose: async () => {},
	} as unknown as AgentSession;
}

function fixture(agents: { id: string; status: "idle" | "parked" }[]): Fixture {
	const registry = new AgentRegistry();
	const delivered = new Map<string, string[]>();
	const revivals: string[] = [];
	for (const agent of agents) {
		registry.register({
			id: agent.id,
			displayName: agent.id,
			kind: "sub",
			parentId: ROOT,
			session: agent.status === "idle" ? stubSession(agent.id, delivered) : null,
			sessionFile: `/tmp/irc-relocation-admission/${agent.id}.jsonl`,
			status: agent.status,
		});
	}
	const lifecycle = new AgentLifecycleManager(registry);
	lifecycles.push(lifecycle);
	lifecycle.setPersistedSubagentReviverFactory(
		async ref => async () => {
			revivals.push(ref.id);
			return stubSession(ref.id, delivered);
		},
		() => 0,
	);
	return {
		registry,
		lifecycle,
		bus: new IrcBus(registry, lifecycle),
		delivered,
		revivals,
		holdTree: members => registry.relocationAdmission.hold({ rootId: ROOT, isMember: ref => members.includes(ref.id) }),
	};
}

/** Track whether a promise has settled after pending continuations ran. */
function track<T>(promise: Promise<T>): { readonly settled: boolean; readonly value: T | undefined } {
	const state: { settled: boolean; value: T | undefined } = { settled: false, value: undefined };
	void promise.then(value => {
		state.settled = true;
		state.value = value;
	});
	return state;
}

/** Drain pending promise continuations; nothing on these paths waits on a timer. */
async function flush(): Promise<void> {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

afterEach(async () => {
	for (const lifecycle of lifecycles.splice(0)) await lifecycle.dispose();
});

describe("irc admission", () => {
	it("irc admission: a message to an idle live member starts no turn and the send stays pending until the lease is disposed", async () => {
		const { bus, delivered, holdTree } = fixture([{ id: "Worker", status: "idle" }]);
		const lease = holdTree(["Worker"]);
		await lease.ready;
		const send = track(bus.send({ from: "Peer", to: "Worker", body: "hello" }));
		await flush();
		expect(send.settled).toBe(false);
		expect(delivered.get("Worker")).toBeUndefined();

		lease[Symbol.dispose]();
		await flush();
		expect(send.value?.outcome).toBe("woken");
		expect(delivered.get("Worker")).toEqual(["hello"]);
	});

	it("irc admission: a message to a parked member does not revive it until release", async () => {
		const { bus, delivered, revivals, holdTree } = fixture([{ id: "Parked", status: "parked" }]);
		const lease = holdTree(["Parked"]);
		const send = track(bus.send({ from: "Peer", to: "Parked", body: "wake up" }));
		await flush();
		expect(revivals).toEqual([]);
		expect(send.settled).toBe(false);

		lease[Symbol.dispose]();
		await flush();
		expect(revivals).toEqual(["Parked"]);
		expect(send.value?.outcome).toBe("revived");
		expect(delivered.get("Parked")).toEqual(["wake up"]);
	});

	it("irc admission: two messages to one member arrive in send order", async () => {
		const { bus, delivered, holdTree } = fixture([{ id: "Worker", status: "idle" }]);
		const lease = holdTree(["Worker"]);
		const first = bus.send({ from: "PeerA", to: "Worker", body: "first" });
		const second = bus.send({ from: "PeerB", to: "Worker", body: "second" });
		await flush();
		expect(delivered.get("Worker")).toBeUndefined();
		lease[Symbol.dispose]();
		await Promise.all([first, second]);
		expect(delivered.get("Worker")).toEqual(["first", "second"]);
	});

	it("irc admission: a message to a member of another tree is delivered while the lease is held", async () => {
		const { bus, delivered, holdTree } = fixture([
			{ id: "Worker", status: "idle" },
			{ id: "Elsewhere", status: "idle" },
		]);
		using _lease = holdTree(["Worker"]);
		const receipt = await bus.send({ from: "Peer", to: "Elsewhere", body: "unrelated" });
		expect(receipt.outcome).toBe("woken");
		expect(delivered.get("Elsewhere")).toEqual(["unrelated"]);
	});

	it("irc admission: ensureLive called directly for a parked member resolves only after release", async () => {
		const { lifecycle, revivals, holdTree } = fixture([{ id: "Parked", status: "parked" }]);
		const lease = holdTree(["Parked"]);
		const live = track(lifecycle.ensureLive("Parked"));
		await flush();
		expect(live.settled).toBe(false);
		expect(revivals).toEqual([]);

		lease[Symbol.dispose]();
		await flush();
		expect(live.settled).toBe(true);
		expect(revivals).toEqual(["Parked"]);
	});
});
