/**
 * ACP goal and mode ownership. One {@link AcpGoalActor} per session record owns every piece of
 * state that decides who may change the goal, the tool set, and the mode the client sees:
 * the transcript generation, the client's goal selection and armed objective, the mode
 * last reported to the client, the stale client config per transcript, and the extension
 * session-change state. The goal lifecycle itself stays {@link GoalHostController}; selecting
 * mode `goal` arms the session and the next prompt that is not a registered command becomes the
 * objective.
 *
 * Processing model. Every intent (prompt admission, Stop, explicit mode change, plan approval,
 * extension session change, reconcile completion, the agent's own `goal` tool, lifetime events)
 * has a synchronous reserve phase: it runs at arrival, in arrival order, and does nothing but
 * read and bump the generation counters below. Async effects (tool swaps, runtime persistence,
 * reconcile, ACP transport notifications) run afterwards, outside that phase, and commit only
 * if the generation they reserved still owns the state:
 *
 * - `#lane` serialises the goal-mutating effects (goal entry, leave/select, Stop compensation)
 *   in reserve order. It is held across tool swaps and runtime persistence but never across an
 *   ACP transport notification, and a session change never queues on it, so an extension
 *   handler running inside a goal effect can start and end a session change without waiting.
 * - A goal entry commits only while no session change began, ended or is running since it was
 *   admitted ({@link GoalMutationGate.admitEntry}, and the host's `fence` after each await).
 *   A lost entry is discarded, and the host re-applies the tool set the new owner wants.
 * - A mode change bumps `#modes` at arrival. A prompt admitted before it is not submitted
 *   (`confirm()` is the last synchronous step before `session.prompt`); the mode change's own
 *   effect, queued behind the entry on the lane, pauses whatever the entry created.
 * - A Stop's late interrupted pause reaches the goal only while the transcript that was
 *   running at Stop is still current ({@link GoalMutationGate.admitInterruptPause}).
 */
import { isRecord, logger } from "@oh-my-pi/pi-utils";
import { GoalEntryAbandoned, GoalHostController, type GoalHostSession } from "../../goals/host-controller";
import type { AgentSessionEvent } from "../../session/agent-session";

export const ACP_DEFAULT_MODE_ID = "default";
export const ACP_PLAN_MODE_ID = "plan";
export const ACP_GOAL_MODE_ID = "goal";
export const ACP_MODE_CONFIG_ID = "mode";

/**
 * Session entry holding config values (`configId` → value) that omp replaced on
 * its own, e.g. plan approval exiting plan mode or switching the execution
 * model. JetBrains IDEs ignore `current_mode_update`, rank their stored
 * dropdown choice above the agent's `currentValue`, and re-send that stored
 * choice via `session/set_config_option` before every prompt. Re-sends of a
 * recorded value are dropped until the client picks a different value.
 * Persisted so the guard survives an agent restart followed by `session/resume`.
 */
const ACP_STALE_CLIENT_CONFIG_ENTRY = "acp-stale-client-config";

export interface AcpGoalActorOptions {
	/** Whether a client prompt is open: continuations stream into it and never run after it closed. */
	promptOpen: () => boolean;
	/** The client pins its stored config choices (JetBrains), so stale re-sends are recorded and ignored. */
	clientPinsConfig: () => boolean;
	/** Every select config option's current value, keyed by config id (mode included). */
	selectValues: () => Map<string, string>;
	/** Send `current_mode_update` and the full config options. Transport: never called from the lane. */
	announce: () => Promise<void>;
	/** Runs after every reattach, once the final goal state is in place; also deferred ones. */
	onReconciled: () => Promise<void>;
}

/** One client-initiated mode transition. The plan hooks are synchronous session mutators run on the lane. */
export interface AcpModeTransition {
	modeId: string;
	/** Throws for a mode the session does not offer; runs before the transition is reserved. */
	assertAvailable(): void;
	installPlan(): void;
	clearPlan(): void;
}

export interface AcpPromptAdmission {
	/**
	 * Last synchronous gate before the host submits the prompt: true when no Stop, mode change,
	 * session change or transcript switch has landed since admission. Call it immediately before
	 * `session.prompt`; nothing may be awaited in between.
	 */
	confirm(): boolean;
	/** Drop the admission without submitting. Idempotent; `confirm` releases too. */
	release(): void;
}

interface Stamp {
	transcript: number;
	changes: number;
	modes: number;
}

class PromptAdmission implements AcpPromptAdmission {
	readonly stamp: Stamp;
	transition: "created" | "resumed" | undefined;
	/** A Stop landed after admission and before the prompt was submitted. */
	stopped = false;
	/** The lane already paused what this admission entered, for a Stop that landed during its entry. */
	compensated = false;
	/** The prompt must not be submitted: the entry saw its ownership lost. */
	refused = false;
	#released = false;
	readonly #release: (admission: PromptAdmission) => void;
	readonly #owns: (stamp: Stamp, withModes: boolean) => boolean;

	constructor(
		stamp: Stamp,
		release: (admission: PromptAdmission) => void,
		owns: (stamp: Stamp, withModes: boolean) => boolean,
	) {
		this.stamp = stamp;
		this.#release = release;
		this.#owns = owns;
	}

	/** Whether the entry may still commit: Stop and mode changes are handled by the lane, a session change is not. */
	entryOwned(): boolean {
		return this.#owns(this.stamp, false);
	}

	confirm(): boolean {
		const ok = !this.refused && !this.stopped && this.#owns(this.stamp, true);
		this.release();
		return ok;
	}

	release(): void {
		if (this.#released) return;
		this.#released = true;
		this.#release(this);
	}
}

export class AcpGoalActor {
	readonly #session: GoalHostSession;
	readonly #host: GoalHostController;
	readonly #options: AcpGoalActorOptions;

	/** The client selected goal mode; survives an interrupt pause, cleared by leaving, completion, or drop. */
	#selected = false;
	/** Goal mode is selected with no goal yet: the next ordinary prompt is its objective. */
	#objectivePending = false;
	/** Mode id the client was last told about; agent-side goal changes are reported against it. */
	#reportedModeId = ACP_DEFAULT_MODE_ID;

	/** Transcript the generation counts; bumped when the session manager's id is seen to differ. */
	#transcriptId: string;
	#transcriptGeneration = 0;
	/** Bumped when an explicit mode change or plan exit is reserved. */
	#modes = 0;
	/** Bumped when an extension session change begins or ends. */
	#changes = 0;
	/** Extension session changes begun and not yet ended. */
	#sessionChanges = 0;
	#transcriptBeforeChange: string | undefined;
	/** Transcript generation a Stop's abort began in; undefined while no Stop's abort is unwinding. */
	#abortTranscript: number | undefined;

	/** Explicit mode transitions in flight; lifecycle sync is held back while above zero. */
	#explicit = 0;
	#syncDeferred = false;
	/** Explicit transitions reserved and not yet finished: a continuation must not start under them. */
	#modeEffects = 0;

	#laneTail: Promise<void> = Promise.resolve();
	readonly #admissions = new Set<PromptAdmission>();
	/** The admission whose goal entry is running on the lane right now. */
	#entering: PromptAdmission | undefined;
	readonly #stale = new Map<string, Map<string, string>>();

	constructor(session: GoalHostSession, options: AcpGoalActorOptions) {
		this.#session = session;
		this.#options = options;
		this.#transcriptId = session.sessionManager.getSessionId();
		this.#host = new GoalHostController(session, {
			continuationMode: "acp",
			canAutoContinue: () => options.promptOpen() && this.#modeEffects === 0,
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
				await options.onReconciled();
			},
		});
		session.goalRuntime.setMutationGate({
			reserve: () => this.#stamp(),
			admitEntry: (origin, reservation) => {
				if (origin === "host") {
					// Committed in the same tick as this check: an entry that lost its session to a
					// change is discarded here, before it can write into the new transcript.
					if (this.#entering && !this.#entering.entryOwned()) throw new GoalEntryAbandoned();
					return;
				}
				// The agent's own `goal` tool. Plan and goal are exclusive.
				if (this.#session.getPlanModeState()?.enabled) throw new Error("Exit plan mode before starting a goal.");
				this.#admitToolMutation(reservation);
			},
			admitToolMutation: reservation => this.#admitToolMutation(reservation),
			admitInterruptPause: () => {
				// The pause belongs to the transcript the Stop interrupted; a new transcript's goal is not its.
				this.#syncTranscript();
				return this.#abortTranscript === undefined || this.#abortTranscript === this.#transcriptGeneration;
			},
		});
	}

	dispose(): void {
		this.#session.goalRuntime.setMutationGate(undefined);
	}

	/**
	 * A tool mutation commits only into the transcript that admitted it: no session change or
	 * reconcile running now, and none begun or ended since the stamp was reserved. A stale call
	 * would otherwise write into (or drop) the goal the reconcile adopted for the new transcript.
	 */
	#admitToolMutation(reservation: object | undefined): void {
		if (
			this.#sessionChanges > 0 ||
			this.#host.reconciling ||
			(reservation !== undefined && !this.#owns(reservation as Stamp, false))
		) {
			throw new Error("A session change is in progress; retry the goal operation afterwards.");
		}
	}

	// ---- reads -----------------------------------------------------------------------------

	/** The mode ACP reports: plan, else goal for an enabled/completing goal or the client's selection, else default. */
	get modeId(): string {
		if (this.#session.getPlanModeState()?.enabled) return ACP_PLAN_MODE_ID;
		const state = this.#session.getGoalModeState();
		return this.#selected || state?.enabled === true || state?.mode === "exiting"
			? ACP_GOAL_MODE_ID
			: ACP_DEFAULT_MODE_ID;
	}

	/** A continuation has been decided and not yet admitted; the open prompt must not settle. */
	get continuationPending(): boolean {
		return this.#host.continuationPending;
	}

	/** An extension session change has begun and not ended: its target transcript is not known yet. */
	get sessionChangeInFlight(): boolean {
		return this.#sessionChanges > 0;
	}

	// ---- lane ------------------------------------------------------------------------------

	/** Serialise a goal-mutating effect in reserve order. A failure reaches only its caller. */
	#lane<T>(effect: () => Promise<T>): Promise<T> {
		const result = this.#laneTail.then(effect);
		this.#laneTail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	#syncTranscript(): void {
		// The transcript id, not `session.sessionId`: a host-pinned provider session id
		// does not change when the transcript does.
		const id = this.#session.sessionManager.getSessionId();
		if (id === this.#transcriptId) return;
		this.#transcriptId = id;
		this.#transcriptGeneration++;
	}

	#stamp(): Stamp {
		this.#syncTranscript();
		return { transcript: this.#transcriptGeneration, changes: this.#changes, modes: this.#modes };
	}

	#owns(stamp: Stamp, withModes: boolean): boolean {
		this.#syncTranscript();
		return (
			this.#sessionChanges === 0 &&
			stamp.transcript === this.#transcriptGeneration &&
			stamp.changes === this.#changes &&
			(!withModes || stamp.modes === this.#modes)
		);
	}

	// ---- client prompt admission -----------------------------------------------------------

	/**
	 * Admit an ordinary (non-command) host prompt: an armed objective is created from its text
	 * (an empty text throws and stays armed); a paused goal still selected resumes, the prompt
	 * being guidance. The returned admission must be {@link AcpPromptAdmission.confirm}ed
	 * right before the prompt is submitted.
	 *
	 * A Stop that landed during the entry is compensated in the same lane operation (paused,
	 * selection kept) before any later operation can run between the entry and its compensation.
	 * A session change since arrival discards the entry and refuses the prompt: the reconcile
	 * owns the goal state, so there is nothing to compensate.
	 */
	async admitPrompt(text: string): Promise<AcpPromptAdmission> {
		const admission = new PromptAdmission(
			this.#stamp(),
			done => void this.#admissions.delete(done),
			(stamp, withModes) => this.#owns(stamp, withModes),
		);
		this.#admissions.add(admission);
		if (this.#sessionChanges > 0) admission.refused = true;
		try {
			await this.#lane(async () => {
				await this.#host.settled();
				if (admission.refused || !admission.entryOwned()) {
					admission.refused = true;
					return;
				}
				this.#entering = admission;
				try {
					await this.#enter(admission, text);
				} catch (error) {
					if (!(error instanceof GoalEntryAbandoned)) throw error;
					admission.refused = true;
				} finally {
					this.#entering = undefined;
				}
				if (admission.transition && admission.stopped && admission.entryOwned() && !admission.refused) {
					admission.compensated = true;
					await this.#pauseForCancel();
				}
			});
		} catch (error) {
			admission.release();
			throw error;
		}
		return admission;
	}

	async #enter(admission: PromptAdmission, text: string): Promise<void> {
		const fence = () => admission.entryOwned();
		if (this.#objectivePending) {
			await this.#host.createForHostPrompt({ objective: text }, { fence });
			this.#objectivePending = false;
			admission.transition = "created";
			return;
		}
		const state = this.#session.getGoalModeState();
		if (this.#selected && state?.goal.status === "paused") {
			await this.#host.resumeForHostPrompt({ fence });
			admission.transition = "resumed";
		}
	}

	// ---- Stop ------------------------------------------------------------------------------

	/**
	 * The client pressed Stop. Synchronous part, before the abort starts: the aborted run's own
	 * `agent_end` must not schedule a goal turn, and its late interrupted pause is bound to the
	 * transcript running now. The returned effect compensates admissions Stop overtook (their
	 * entry paused, tools restored, selection kept, continuation held until the next host prompt).
	 * Never rejects; Stop answers the client without waiting for it.
	 */
	stop(): Promise<void> {
		this.#syncTranscript();
		this.#abortTranscript = this.#transcriptGeneration;
		this.#host.stopForHostAbort();
		const overtaken = [...this.#admissions];
		for (const admission of overtaken) admission.stopped = true;
		return this.#lane(async () => {
			await this.#host.settled();
			this.#syncTranscript();
			const needsPause = overtaken.some(
				admission =>
					admission.transition &&
					!admission.compensated &&
					admission.stamp.transcript === this.#transcriptGeneration,
			);
			if (needsPause) await this.#pauseForCancel();
		}).catch(error => {
			logger.warn("ACP goal Stop compensation failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		});
	}

	/** The aborted run has unwound (or the abort timed out): its interrupted pause no longer applies. */
	abortSettled(): void {
		this.#abortTranscript = undefined;
	}

	async #pauseForCancel(): Promise<void> {
		await this.#host.pause();
		this.#host.stopForHostAbort();
	}

	// ---- explicit mode change --------------------------------------------------------------

	/**
	 * A client-initiated transition (`session/set_mode`, or the mode config option), Plan state
	 * included. Reserved at arrival; its effect runs behind earlier goal effects on the lane, so
	 * concurrent Plan→Goal and Goal→Plan end in the state of the later request. Lifecycle mode
	 * sync is held back until the outermost explicit transition ends.
	 */
	async explicitModeChange(transition: AcpModeTransition): Promise<void> {
		this.#explicit++;
		try {
			if (!this.isStaleClientReassert(ACP_MODE_CONFIG_ID, transition.modeId)) {
				transition.assertAvailable();
				this.#modes++;
				this.#modeEffects++;
				try {
					await this.#lane(() => this.#applyMode(transition));
				} finally {
					this.#modeEffects--;
				}
			}
			await this.announceMode();
		} finally {
			await this.#endExplicit();
		}
	}

	async #applyMode(transition: AcpModeTransition): Promise<void> {
		await this.#host.settled();
		// Goal and plan are exclusive: leave goal mode before planning, clear plan before a goal.
		if (transition.modeId !== ACP_GOAL_MODE_ID) await this.#leave();
		if (transition.modeId === ACP_PLAN_MODE_ID) {
			transition.installPlan();
			return;
		}
		transition.clearPlan();
		if (transition.modeId === ACP_GOAL_MODE_ID) this.#select();
	}

	/** The client selected goal mode. A stored goal (active or paused) is kept; none arms the next prompt. */
	#select(): void {
		this.#selected = true;
		if (!this.#session.getGoalModeState()) this.#objectivePending = true;
	}

	/** The client selected another mode: pause the goal and restore the pre-goal tools. */
	async #leave(): Promise<void> {
		this.#selected = false;
		this.#objectivePending = false;
		const state = this.#session.getGoalModeState();
		// Also covers a reattached paused goal the client never selected: Default/Plan must still restore the pre-goal tools.
		if (!state || state.mode === "exiting") return;
		const status = state.goal.status;
		if (status !== "active" && status !== "budget-limited" && status !== "paused") return;
		await this.#host.pause();
	}

	/** The approved plan exits plan mode. A mode change that already cleared it wins; the goal is not touched. */
	exitPlan(clearPlan: () => void): void {
		this.#modes++;
		if (this.#session.getPlanModeState()?.enabled) clearPlan();
	}

	async #endExplicit(): Promise<void> {
		this.#explicit--;
		if (this.#explicit > 0 || !this.#syncDeferred) return;
		this.#syncDeferred = false;
		await this.syncAgentModeChange();
	}

	// ---- mode reporting --------------------------------------------------------------------

	/** Adopt the current mode as already reported (a session just registered; the response carries it). */
	adoptReportedMode(): void {
		this.#reportedModeId = this.modeId;
	}

	/** Tell the client the current mode. Recorded before sending, so a concurrent lifecycle sync sees it reported. */
	async announceMode(): Promise<void> {
		this.#reportedModeId = this.modeId;
		await this.#options.announce();
	}

	/**
	 * Report a mode the agent changed on its own (goal created by the `goal` tool,
	 * completed, or dropped). The old mode is recorded as stale so a JetBrains
	 * client re-sending its stored dropdown choice does not re-arm goal mode.
	 * Held back while an explicit transition is in flight: its pause emits `goal_updated`
	 * before the transition's own announcement, and syncing then would report an
	 * intermediate mode and record the mode being left as stale.
	 */
	async syncAgentModeChange(): Promise<void> {
		if (this.#explicit > 0) {
			this.#syncDeferred = true;
			return;
		}
		const reported = this.#reportedModeId;
		if (this.modeId === reported) return;
		const before = this.#options.selectValues();
		before.set(ACP_MODE_CONFIG_ID, reported);
		this.recordAgentConfigOverrides(before);
		await this.announceMode();
	}

	// ---- stale client config, per transcript -----------------------------------------------

	#staleValues(): Map<string, string> {
		const id = this.#session.sessionManager.getSessionId();
		const cached = this.#stale.get(id);
		if (cached) return cached;
		const values = new Map<string, string>();
		const branch = this.#session.sessionManager.getBranchView();
		for (let index = branch.length - 1; index >= 0; index--) {
			const entry = branch[index];
			if (entry.type !== "custom" || entry.customType !== ACP_STALE_CLIENT_CONFIG_ENTRY) continue;
			if (isRecord(entry.data) && isRecord(entry.data.values)) {
				for (const [configId, value] of Object.entries(entry.data.values)) {
					if (typeof value === "string") values.set(configId, value);
				}
			}
			break;
		}
		this.#stale.set(id, values);
		return values;
	}

	#persistStale(values: Map<string, string>): void {
		this.#session.sessionManager.appendCustomEntry(ACP_STALE_CLIENT_CONFIG_ENTRY, {
			values: Object.fromEntries(values),
		});
	}

	/**
	 * Whether a client config request only re-sends a value omp has since replaced in the
	 * current transcript. A different value is a real user choice: it clears the entry and
	 * applies normally.
	 */
	isStaleClientReassert(configId: string, value: string): boolean {
		if (!this.#options.clientPinsConfig()) return false;
		const stale = this.#staleValues();
		const staleValue = stale.get(configId);
		if (staleValue === undefined) return false;
		if (staleValue === value) {
			logger.debug("Ignoring stale ACP client config re-assert", { configId, value });
			return true;
		}
		stale.delete(configId);
		this.#persistStale(stale);
		return false;
	}

	/** Record every select value omp changed since `before` so the client's re-send of it is ignored. */
	recordAgentConfigOverrides(before: Map<string, string>): void {
		if (!this.#options.clientPinsConfig()) return;
		const after = this.#options.selectValues();
		const stale = this.#staleValues();
		let changed = false;
		for (const [configId, value] of before) {
			if (after.get(configId) === value || stale.get(configId) === value) continue;
			stale.set(configId, value);
			changed = true;
		}
		if (changed) this.#persistStale(stale);
	}

	// ---- session events --------------------------------------------------------------------

	/**
	 * Feed session events; must run before the ACP prompt handlers see the same event.
	 * Lifetime events (`goal_updated`, terminal `agent_end`) update the selection here, in
	 * event order, which is also arrival order for every other intent.
	 */
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

	// ---- reconcile and extension session changes -------------------------------------------

	/** Adopt the goal journaled in the current transcript; the client's selection does not carry over. */
	async reconcile(): Promise<void> {
		this.#selected = false;
		this.#objectivePending = false;
		await this.#host.reconcile();
		await this.#host.settled();
	}

	/**
	 * An extension is about to change the session. Never queued on the lane: the change may
	 * run inside a goal effect's extension callback. Admissions and entries from before it are
	 * fenced by the bumped change counter instead.
	 */
	async beginSessionChange(): Promise<void> {
		this.#syncTranscript();
		this.#changes++;
		if (this.#sessionChanges++ === 0) this.#transcriptBeforeChange = this.#session.sessionManager.getSessionId();
		await this.#host.beginSessionChange();
	}

	async endSessionChange(options: { detachedRun: boolean }): Promise<void> {
		this.#syncTranscript();
		this.#changes++;
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
