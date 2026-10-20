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

	/**
	 * @param canAutoContinue whether a goal continuation may start now. ACP passes
	 *   "a client prompt is open", so continuations stream into a prompt the client
	 *   can see and never run after it closed.
	 */
	constructor(session: GoalHostSession, canAutoContinue: () => boolean) {
		this.#session = session;
		this.#host = new GoalHostController(session, { continuationMode: "acp", canAutoContinue });
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

	/** The client selected goal mode. A stored goal (active or paused) is kept; none arms the next prompt. */
	select(): void {
		this.#selected = true;
		if (!this.#session.getGoalModeState()) this.#objectivePending = true;
	}

	/** The client selected another mode: pause the goal and restore the pre-goal tools. */
	async leave(): Promise<void> {
		this.#selected = false;
		this.#objectivePending = false;
		const state = this.#session.getGoalModeState();
		// Also covers a reattached paused goal the client never selected: Default/Plan must still restore the pre-goal tools.
		if (!state || state.mode === "exiting") return;
		const status = state.goal.status;
		if (status !== "active" && status !== "budget-limited" && status !== "paused") return;
		await this.#host.pause();
	}

	/**
	 * Prepare the goal for an ordinary (non-command) host prompt about to run:
	 * an armed objective is created from its text (an empty text throws and stays
	 * armed); a paused goal still selected resumes, the prompt being guidance.
	 */
	async prepareHostPrompt(text: string): Promise<void> {
		if (this.#objectivePending) {
			await this.#host.createForHostPrompt({ objective: text });
			this.#objectivePending = false;
			return;
		}
		const state = this.#session.getGoalModeState();
		if (this.#selected && state?.goal.status === "paused") await this.#host.resumeForHostPrompt();
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

	async beginSessionChange(): Promise<void> {
		if (this.#sessionChanges++ === 0) this.#transcriptBeforeChange = this.#session.sessionManager.getSessionId();
		await this.#host.beginSessionChange();
	}

	async endSessionChange(options: { detachedRun: boolean }): Promise<void> {
		if (--this.#sessionChanges === 0) {
			if (this.#session.sessionManager.getSessionId() !== this.#transcriptBeforeChange) {
				this.#selected = false;
				this.#objectivePending = false;
			}
			this.#transcriptBeforeChange = undefined;
		}
		await this.#host.endSessionChange(options);
	}
}
