/**
 * Admission barrier between a session relocation and the activity of its agent
 * tree. A relocation {@link RelocationAdmission.hold}s its tree; every peer
 * message and revival for an agent {@link RelocationAdmission.admit}s first,
 * waits while a held tree claims that agent, and keeps its ticket open until
 * its activity is visible to the relocation's running-work check or has ended.
 * Owned by the {@link AgentRegistry} whose refs it resolves.
 */
import type { AgentRef } from "./agent-registry";

/** The agents a relocation holds: the relocating session's own agent and the refs `isMember` claims. */
export interface RelocationTree {
	rootId: string;
	isMember(ref: AgentRef): boolean;
}

/** A held tree. `ready` resolves once every ticket its members held before the hold has closed. */
export interface RelocationLease extends Disposable {
	readonly ready: Promise<void>;
}

/** An admitted activity for one agent. Disposing it hands the activity off to the relocation check. */
export interface AdmissionTicket extends Disposable {
	readonly agentId: string;
}

interface OpenTicket {
	agentId: string;
	closed: PromiseWithResolvers<void>;
}

interface AdmitWaiter {
	agentId: string;
	grant: (ticket: AdmissionTicket) => void;
}

interface HeldTree {
	tree: RelocationTree;
	holds: number;
	/** Admits waiting for this tree's release, in arrival order. */
	waiters: AdmitWaiter[];
	/** `whenReleased` callers, resolved on release before any waiter is granted. */
	released: PromiseWithResolvers<void>;
}

export class RelocationAdmission {
	readonly #resolveRef: (agentId: string) => AgentRef | undefined;
	/** Held trees by root id. */
	readonly #held = new Map<string, HeldTree>();
	readonly #open = new Set<OpenTicket>();

	constructor(resolveRef: (agentId: string) => AgentRef | undefined) {
		this.#resolveRef = resolveRef;
	}

	/**
	 * Lease `tree` synchronously: from now on admits for its members wait. A
	 * nested hold of a tree that is already held shares that lease and is ready
	 * at once; the tree is released when the last hold is disposed.
	 */
	hold(tree: RelocationTree): RelocationLease {
		const existing = this.#held.get(tree.rootId);
		let ready: Promise<void>;
		if (existing) {
			existing.holds++;
			ready = Promise.resolve();
		} else {
			const pending = [...this.#open]
				.filter(ticket => this.#isMember(tree, ticket.agentId))
				.map(ticket => ticket.closed.promise);
			this.#held.set(tree.rootId, {
				tree,
				holds: 1,
				waiters: [],
				released: Promise.withResolvers<void>(),
			});
			ready = Promise.all(pending).then(() => {});
		}
		let disposed = false;
		return {
			ready,
			[Symbol.dispose]: () => {
				if (disposed) return;
				disposed = true;
				this.#releaseHold(tree.rootId);
			},
		};
	}

	/**
	 * Admit an activity for `agentId`. Resolves at once when no held tree claims
	 * the agent; otherwise waits, in arrival order, until the tree is released.
	 */
	admit(agentId: string): Promise<AdmissionTicket> {
		const claim = this.#claiming(agentId);
		if (!claim) return Promise.resolve(this.#openTicket(agentId));
		const { promise, resolve } = Promise.withResolvers<AdmissionTicket>();
		claim.waiters.push({ agentId, grant: resolve });
		return promise;
	}

	/** Whether a held tree claims `agentId`. */
	isLeased(agentId: string): boolean {
		return this.#claiming(agentId) !== undefined;
	}

	/** Resolves when the held tree that claims `agentId` is released; at once when none does. */
	whenReleased(agentId: string): Promise<void> {
		return this.#claiming(agentId)?.released.promise ?? Promise.resolve();
	}

	#releaseHold(rootId: string): void {
		const held = this.#held.get(rootId);
		if (!held) return;
		held.holds--;
		if (held.holds > 0) return;
		this.#held.delete(rootId);
		held.released.resolve();
		// Re-evaluate every waiter in arrival order. One still claimed by another
		// held tree waits there again, ahead of that tree's later arrivals.
		const requeued = new Map<HeldTree, AdmitWaiter[]>();
		for (const waiter of held.waiters) {
			const claim = this.#claiming(waiter.agentId);
			if (claim) {
				let list = requeued.get(claim);
				if (!list) {
					list = [];
					requeued.set(claim, list);
				}
				list.push(waiter);
			} else {
				waiter.grant(this.#openTicket(waiter.agentId));
			}
		}
		for (const [claim, list] of requeued) claim.waiters.unshift(...list);
	}

	#openTicket(agentId: string): AdmissionTicket {
		const record: OpenTicket = { agentId, closed: Promise.withResolvers<void>() };
		this.#open.add(record);
		return {
			agentId,
			[Symbol.dispose]: () => {
				if (!this.#open.delete(record)) return;
				record.closed.resolve();
			},
		};
	}

	#claiming(agentId: string): HeldTree | undefined {
		for (const held of this.#held.values()) {
			if (this.#isMember(held.tree, agentId)) return held;
		}
		return undefined;
	}

	#isMember(tree: RelocationTree, agentId: string): boolean {
		if (agentId === tree.rootId) return true;
		const ref = this.#resolveRef(agentId);
		return ref !== undefined && tree.isMember(ref);
	}
}
