import { afterEach, describe, expect, it, vi } from "bun:test";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { AdmissionTicket, RelocationTree } from "@oh-my-pi/pi-coding-agent/registry/relocation-admission";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

function registryWith(...ids: string[]): AgentRegistry {
	const registry = new AgentRegistry();
	for (const id of ids) registry.register({ id, displayName: id, kind: "sub", session: null, status: "parked" });
	return registry;
}

function tree(rootId: string, members: string[]): RelocationTree {
	return { rootId, isMember: ref => members.includes(ref.id) };
}

/** Track whether a promise has settled after pending microtasks and timers ran. */
function track<T>(promise: Promise<T>): { readonly settled: boolean; readonly value: T | undefined } {
	const state: { settled: boolean; value: T | undefined } = { settled: false, value: undefined };
	void promise.then(value => {
		state.settled = true;
		state.value = value;
	});
	return state;
}

/** Drain pending promise continuations; every path under test settles through microtasks only. */
async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

interface PromptFixture {
	registry: AgentRegistry;
	lifecycle: AgentLifecycleManager;
	/** Prompts the revived stub session received. */
	prompts: { text: string; streamingBehavior: unknown }[];
	/** Gates the persisted revival of the parked `Worker`. */
	revival: PromiseWithResolvers<void>;
}

const lifecycles: AgentLifecycleManager[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
	for (const lifecycle of lifecycles.splice(0)) await lifecycle.dispose();
});

/** A parked `Worker` whose persisted revival waits on `revival` and yields a prompt-recording stub session. */
function promptFixture(): PromptFixture {
	const registry = new AgentRegistry();
	registry.register({
		id: "Worker",
		displayName: "Worker",
		kind: "sub",
		parentId: "Main",
		session: null,
		sessionFile: "/tmp/relocation-admission/Worker.jsonl",
		status: "parked",
	});
	const prompts: PromptFixture["prompts"] = [];
	const revival = Promise.withResolvers<void>();
	const session = {
		prompt: async (text: string, options: { streamingBehavior?: unknown }) => {
			prompts.push({ text, streamingBehavior: options.streamingBehavior });
			return true;
		},
		subscribe: () => () => {},
		dispose: async () => {},
	} as unknown as AgentSession;
	const lifecycle = new AgentLifecycleManager(registry);
	lifecycles.push(lifecycle);
	lifecycle.setPersistedSubagentReviverFactory(
		async () => async () => {
			await revival.promise;
			return session;
		},
		() => 0,
	);
	return { registry, lifecycle, prompts, revival };
}

describe("relocation admission", () => {
	it("relocation admission: an admit for a member of a leased tree waits until the last hold is disposed", async () => {
		const { relocationAdmission: admission } = registryWith("root", "sub");
		const lease = admission.hold(tree("root", ["sub"]));
		await lease.ready;
		const forSub = track(admission.admit("sub"));
		const forRoot = track(admission.admit("root"));
		await flush();
		expect(forSub.settled).toBe(false);
		expect(forRoot.settled).toBe(false);
		lease[Symbol.dispose]();
		await flush();
		expect(forSub.value?.agentId).toBe("sub");
		expect(forRoot.value?.agentId).toBe("root");
	});

	it("relocation admission: two waiting admits resume in admit order", async () => {
		const { relocationAdmission: admission } = registryWith("root", "a", "b");
		const lease = admission.hold(tree("root", ["a", "b"]));
		const order: string[] = [];
		const first = admission.admit("b").then(ticket => order.push(ticket.agentId));
		const second = admission.admit("a").then(ticket => order.push(ticket.agentId));
		lease[Symbol.dispose]();
		await Promise.all([first, second]);
		expect(order).toEqual(["b", "a"]);
	});

	it("relocation admission: an admit for a ref outside the tree resolves at once", async () => {
		const { relocationAdmission: admission } = registryWith("root", "sub", "other");
		using _lease = admission.hold(tree("root", ["sub"]));
		const forOther = track(admission.admit("other"));
		const forUnknown = track(admission.admit("nobody"));
		await flush();
		expect(forOther.value?.agentId).toBe("other");
		expect(forUnknown.value?.agentId).toBe("nobody");
	});

	it("relocation admission: a nested hold of a leased tree is ready at once and the tree stays leased until both holds are disposed", async () => {
		const { relocationAdmission: admission } = registryWith("root", "sub");
		const before = await admission.admit("sub");
		const outer = admission.hold(tree("root", ["sub"]));
		const outerReady = track(outer.ready);
		const inner = admission.hold(tree("root", ["sub"]));
		const innerReady = track(inner.ready);
		await flush();
		expect(outerReady.settled).toBe(false);
		expect(innerReady.settled).toBe(true);
		before[Symbol.dispose]();
		await outer.ready;

		const waiting = track(admission.admit("sub"));
		inner[Symbol.dispose]();
		await flush();
		expect(admission.isLeased("sub")).toBe(true);
		expect(waiting.settled).toBe(false);
		outer[Symbol.dispose]();
		await flush();
		expect(admission.isLeased("sub")).toBe(false);
		expect(waiting.settled).toBe(true);
	});

	it("relocation admission: ready waits for tickets opened by members before the hold and ignores tickets of non-members", async () => {
		const { relocationAdmission: admission } = registryWith("root", "sub", "other");
		const member = await admission.admit("sub");
		const outsider = await admission.admit("other");
		const lease = admission.hold(tree("root", ["sub"]));
		const ready = track(lease.ready);
		await flush();
		expect(ready.settled).toBe(false);
		member[Symbol.dispose]();
		await flush();
		expect(ready.settled).toBe(true);
		outsider[Symbol.dispose]();
		lease[Symbol.dispose]();
	});

	it("relocation admission: a waiter that resumes into a newly taken lease waits again", async () => {
		const { relocationAdmission: admission } = registryWith("one", "two", "shared", "onlyTwo");
		const first = admission.hold(tree("one", ["shared"]));
		const order: string[] = [];
		const waiting = admission.admit("shared").then(() => order.push("shared"));
		const second = admission.hold(tree("two", ["shared", "onlyTwo"]));
		const queuedInSecond = admission.admit("onlyTwo").then(() => order.push("onlyTwo"));
		first[Symbol.dispose]();
		await flush();
		expect(order).toEqual([]);
		expect(admission.isLeased("shared")).toBe(true);
		second[Symbol.dispose]();
		await Promise.all([waiting, queuedInSecond]);
		// The earlier arrival keeps its place ahead of the second tree's own waiter.
		expect(order).toEqual(["shared", "onlyTwo"]);
	});

	it("relocation admission: isLeased covers only members of a leased tree, and release runs every whenReleased continuation before the first waiting admit resumes", async () => {
		const { relocationAdmission: admission } = registryWith("root", "sub", "other");
		expect(admission.isLeased("sub")).toBe(false);
		const lease = admission.hold(tree("root", ["sub"]));
		expect(admission.isLeased("root")).toBe(true);
		expect(admission.isLeased("sub")).toBe(true);
		expect(admission.isLeased("other")).toBe(false);

		const order: string[] = [];
		const admitted: Promise<AdmissionTicket>[] = [admission.admit("sub")];
		void admitted[0].then(() => order.push("admit"));
		void admission.whenReleased("sub").then(() => order.push("released sub"));
		void admission.whenReleased("root").then(() => order.push("released root"));
		lease[Symbol.dispose]();
		await Promise.all(admitted);
		await flush();
		expect(order).toEqual(["released sub", "released root", "admit"]);
	});

	it("relocation admission: promptLive paused between revival and prompt keeps the lease from becoming ready until the prompt is submitted", async () => {
		const { registry, lifecycle, prompts, revival } = promptFixture();
		const realEnsureLive = lifecycle.ensureLive.bind(lifecycle);
		const afterRevival = Promise.withResolvers<void>();
		vi.spyOn(lifecycle, "ensureLive").mockImplementation(async (id, options) => {
			const session = await realEnsureLive(id, options);
			await afterRevival.promise;
			return session;
		});
		const prompted = track(lifecycle.promptLive("Worker", "hello", { streamingBehavior: "steer" }));
		using lease = registry.relocationAdmission.hold(tree("Main", ["Worker"]));
		const ready = track(lease.ready);
		revival.resolve();
		await flush();
		expect(prompts).toEqual([]);
		expect(ready.settled).toBe(false);

		afterRevival.resolve();
		await flush();
		expect(prompts).toEqual([{ text: "hello", streamingBehavior: "steer" }]);
		expect(prompted.settled).toBe(true);
		expect(ready.settled).toBe(true);
	});

	it("relocation admission: promptLive with a rejecting beforePrompt prompts nothing and releases its ticket", async () => {
		const { registry, lifecycle, prompts, revival } = promptFixture();
		const seen: unknown[] = [];
		const prompted = track(
			lifecycle.promptLive("Worker", "hello", { streamingBehavior: "steer" }, session => {
				seen.push(session);
				return false;
			}),
		);
		using lease = registry.relocationAdmission.hold(tree("Main", ["Worker"]));
		const ready = track(lease.ready);
		await flush();
		expect(ready.settled).toBe(false);

		revival.resolve();
		await flush();
		expect(seen).toHaveLength(1);
		expect(prompts).toEqual([]);
		expect(prompted.settled).toBe(true);
		expect(ready.settled).toBe(true);
	});
});
