/**
 * ACP goal mode. Selecting mode `goal` arms the session; the next prompt that is
 * not a registered command becomes the objective. The goal lifecycle itself is
 * {@link GoalHostController}; this adapter owns only what ACP adds on top:
 * the client's mode selection and the armed-objective state, neither persisted.
 */
import { GoalHostController, type GoalHostSession } from "../../goals/host-controller";
import type { AgentSessionEvent } from "../../session/agent-session";

export class AcpGoalController {
	readonly #session: GoalHostSession;
	readonly #host: GoalHostController;
	/** The client selected goal mode; survives an interrupt pause, cleared by leaving, completion, or drop. */
	#selected = false;
	/** Goal mode is selected with no goal yet: the next ordinary prompt is its objective. */
	#objectivePending = false;
	#sessionChanges = 0;
	#transcriptBeforeChange: string | undefined;
	/** Resolves once the outermost session change owns the operation chain. */
	#changeHeld: Promise<void> = Promise.resolve();
	#releaseChange: (() => void) | undefined;
	/** Changes begun and not yet fully ended: unlike `#sessionChanges`, an ending change counts until the host's end returns. */
	#heldChanges = 0;

	/**
	 * @param canAutoContinue whether a goal continuation may start now. ACP passes
	 *   "a client prompt is open", so continuations stream into a prompt the client
	 *   can see and never run after it closed.
	 * @param onReconciled runs after every reattach, including one deferred behind a
	 *   running reconcile, once the final goal state is in place.
	 */
	constructor(session: GoalHostSession, canAutoContinue: () => boolean, onReconciled: () => Promise<void>) {
		this.#session = session;
		this.#host = new GoalHostController(session, {
			continuationMode: "acp",
			canAutoContinue,
			onReconciled: async () => {
				// The client's selection never crosses transcripts on its own: it follows the
				// reattached goal. A preserved active goal (or a completing one) stays selected, so
				// a later Stop keeps Goal and the next prompt resumes it; a paused or absent goal
				// is unselected until the client picks Goal.
				this.#objectivePending = false;
				const state = this.#session.getGoalModeState();
				this.#selected =
					state?.mode === "exiting" ||
					(state?.enabled === true && (state.goal.status === "active" || state.goal.status === "budget-limited"));
				await onReconciled();
			},
		});
	}

	/** Whether ACP reports mode `goal`: an enabled or completing goal, or the client's selection. */
	get modeSelected(): boolean {
		const state = this.#session.getGoalModeState();
		return this.#selected || state?.enabled === true || state?.mode === "exiting";
	}

	/** A continuation has been decided and not yet admitted; the open prompt must not settle. */
	get continuationPending(): boolean {
		return this.#host.continuationPending;
	}

	/**
	 * Every operation that changes selection, goal state, or tools runs on one chain in
	 * arrival order. Goal entry awaits the tool swap inside the host, so an unqueued
	 * leave/select/pause arriving meanwhile would be overwritten when the entry finishes.
	 * A failure reaches only its own caller; the chain continues.
	 *
	 * Each operation first awaits {@link GoalHostController.settled}: a session change
	 * returns while its reconcile is still queued, and that reconcile clears the selection
	 * and may replace the goal. An operation accepted after the change therefore applies
	 * after the reconcile, against the final transcript's goal state; a reconcile started
	 * by a LATER change still clears it through `onReconciled`. No deadlock: `settled()`
	 * waits only on host exits and reconciles, never on this chain, and no reconcile path
	 * (extension `onThreadResumed`, `onReconciled`, the mode re-sync) awaits an operation here.
	 */
	#op: Promise<void> = Promise.resolve();

	#run<T>(fn: () => Promise<T>): Promise<T> {
		const result = this.#op.then(fn);
		this.#op = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	/** The client selected goal mode. A stored goal (active or paused) is kept; none arms the next prompt. */
	select(): Promise<void> {
		return this.#run(async () => {
			await this.#host.settled();
			this.#selected = true;
			if (!this.#session.getGoalModeState()) this.#objectivePending = true;
		});
	}

	/** The client selected another mode: pause the goal and restore the pre-goal tools. */
	leave(): Promise<void> {
		return this.#run(async () => {
			await this.#host.settled();
			this.#selected = false;
			this.#objectivePending = false;
			const state = this.#session.getGoalModeState();
			// Also covers a reattached paused goal the client never selected: Default/Plan must still restore the pre-goal tools.
			if (!state || state.mode === "exiting") return;
			const status = state.goal.status;
			if (status !== "active" && status !== "budget-limited" && status !== "paused") return;
			await this.#host.pause();
		});
	}

	/**
	 * Prepare the goal for an ordinary (non-command) host prompt about to run:
	 * an armed objective is created from its text (an empty text throws and stays
	 * armed); a paused goal still selected resumes, the prompt being guidance.
	 * Returns the transition this prompt caused, if any.
	 *
	 * `isCancelled` is re-checked inside the same operation after the entry: a Stop
	 * that landed during the tool swap is compensated (paused, selection kept)
	 * before any later operation can run between the entry and its compensation.
	 */
	prepareHostPrompt(text: string, isCancelled: () => boolean): Promise<"created" | "resumed" | undefined> {
		return this.#run(async () => {
			await this.#host.settled();
			let transition: "created" | "resumed" | undefined;
			if (this.#objectivePending) {
				await this.#host.createForHostPrompt({ objective: text });
				this.#objectivePending = false;
				transition = "created";
			} else {
				const state = this.#session.getGoalModeState();
				if (this.#selected && state?.goal.status === "paused") {
					await this.#host.resumeForHostPrompt();
					transition = "resumed";
				}
			}
			if (transition && isCancelled()) await this.#pauseForCancel();
			return transition;
		});
	}

	/**
	 * Stop landed while {@link prepareHostPrompt} was awaiting: bring the goal it
	 * just created or resumed to the state a Stop leaves (paused, tools restored,
	 * selection kept, continuation held until the next host prompt).
	 */
	pauseAfterCancelledPrompt(): Promise<void> {
		return this.#run(async () => {
			await this.#host.settled();
			await this.#pauseForCancel();
		});
	}

	async #pauseForCancel(): Promise<void> {
		await this.#host.pause();
		this.#host.stopForHostAbort();
	}

	/** Feed session events; must run before the ACP prompt handlers see the same event. */
	observe(event: AgentSessionEvent): void {
		this.#host.observe(event);
		if (event.type === "goal_updated") {
			if (event.state?.goal.status === "dropped") {
				this.#selected = false;
				this.#objectivePending = false;
			} else if (event.state?.enabled) {
				// Created or resumed, also by the agent's own `goal` tool.
				this.#selected = true;
			}
			return;
		}
		// A completed goal is journaled at its terminal agent_end, which leaves no goal state.
		if (event.type === "agent_end" && event.isTerminal !== false) {
			if (!this.#session.getGoalModeState() && !this.#objectivePending) this.#selected = false;
		}
	}

	stopForHostAbort(): void {
		this.#host.stopForHostAbort();
	}

	/** Adopt the goal journaled in the current transcript; the client's selection does not carry over. */
	async reconcile(): Promise<void> {
		this.#selected = false;
		this.#objectivePending = false;
		await this.#host.reconcile();
		await this.#host.settled();
	}

	/** An extension session change has begun and not ended: its target transcript is not known yet. */
	get sessionChangeInFlight(): boolean {
		return this.#sessionChanges > 0;
	}

	/**
	 * The outermost change holds the operation chain from here to its matching
	 * {@link endSessionChange}, so a goal entry (create/resume, which awaits a tool swap and
	 * then writes its state back) can never straddle a transcript change: a change arriving
	 * mid-operation waits for it, an operation arriving mid-change waits for the end.
	 * A nested or overlapping change (also one beginning while the previous one's host end
	 * is still running) only counts; re-acquiring the chain would deadlock.
	 *
	 * No deadlock: a held change waits only on the previous chain tail (operations, which
	 * wait on host exits, tool swaps and reconciles, never on a change) and, afterwards,
	 * on the extension's own `change()` and the host's `endSessionChange`. Neither waits
	 * on this chain: the host's reconcile, `onReconciled` and the mode re-sync never run an
	 * operation, and `#goalSessionChange` runs its mode re-sync after the release. An
	 * operation waits for the change only through the chain, and the change never waits
	 * on an operation that arrived after it.
	 */
	async beginSessionChange(): Promise<void> {
		if (this.#sessionChanges++ === 0) this.#transcriptBeforeChange = this.#session.sessionManager.getSessionId();
		if (this.#heldChanges++ === 0) {
			const release = Promise.withResolvers<void>();
			this.#releaseChange = release.resolve;
			const acquired = Promise.withResolvers<void>();
			this.#changeHeld = acquired.promise;
			void this.#run(async () => {
				acquired.resolve();
				await release.promise;
			});
		}
		await this.#changeHeld;
		await this.#host.beginSessionChange();
	}

	async endSessionChange(options: { detachedRun: boolean }): Promise<void> {
		try {
			if (--this.#sessionChanges === 0) {
				if (this.#session.sessionManager.getSessionId() !== this.#transcriptBeforeChange) {
					this.#selected = false;
					this.#objectivePending = false;
				}
				this.#transcriptBeforeChange = undefined;
			}
			await this.#host.endSessionChange(options);
		} finally {
			if (--this.#heldChanges === 0) {
				this.#releaseChange?.();
				this.#releaseChange = undefined;
			}
		}
	}
}
