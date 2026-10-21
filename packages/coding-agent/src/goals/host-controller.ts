/**
 * Goal mode for headless hosts: RPC (`--mode rpc`, `--mode rpc-ui`) and ACP.
 *
 * The durable lifecycle (create/resume/pause/drop, accounting, persistence) is
 * `GoalRuntime`, shared with the TUI and the `goal` tool. This controller adds
 * what `InteractiveMode` otherwise owns: the goal tool's place in the active
 * tool set, completion/drop exit, reattach after a session change, and an
 * opt-in continuation driver keyed to agent lifecycle events instead of an
 * editor idle window.
 */
import type { Goal } from "@oh-my-pi/pi-tui/tools/goal";
import { logger } from "@oh-my-pi/pi-utils";
import type { AgentSession, AgentSessionEvent } from "../session/agent-session";
import { nextActionableTask } from "../tools/todo";
import { cfgGoalContinuationModes, cfgGoalEnabled, type GoalContinuationMode } from "./settings";
import { type GoalModeState, goalContinuationActivity, goalFromModeData } from "./state";

export type GoalHostOp = "get" | "create" | "resume" | "pause" | "drop";

export interface GoalHostCommand {
	op: GoalHostOp;
	objective?: string;
	tokenBudget?: number;
}

export interface GoalHostResult {
	goal: Goal | null;
	state: GoalModeState | null;
}

export type GoalHostSession = Pick<
	AgentSession,
	| "settings"
	| "sessionManager"
	| "goalRuntime"
	| "getGoalModeState"
	| "setGoalModeState"
	| "getPlanModeState"
	| "getEnabledToolNames"
	| "setActiveToolsByName"
	| "sendGoalModeContext"
	| "getTodoPhases"
	| "promptCustomMessage"
	| "waitForIdle"
	| "isStreaming"
	| "isDisposed"
	| "isSessionTransitioning"
	| "hasAdmittedSubmission"
	| "queuedMessageCount"
>;

export interface GoalHostControllerOptions {
	/** `goal.continuationModes` entry that enables automatic continuation for this host. */
	continuationMode: GoalContinuationMode;
	/**
	 * Host-side gate read with every other continuation gate. ACP closes it while no
	 * client prompt is open, so a continuation never runs unseen by the client.
	 */
	canAutoContinue?: () => boolean;
	/**
	 * Called when a pending continuation is abandoned (a gate closed while it waited),
	 * so settle reporting can re-check.
	 */
	onContinuationDropped?: () => void;
	/**
	 * Called after each reconcile has run, including reconciles queued behind a running
	 * one, so the host can re-read the final goal state. Never awaited inside
	 * {@link GoalHostController.endSessionChange}'s overlap branch; errors are reported,
	 * not thrown.
	 */
	onReconciled?: () => void | Promise<void>;
}

/** A goal entry whose host owner moved on mid-entry; discarded after its late effects were undone. */
export class GoalEntryAbandoned extends Error {
	constructor() {
		super("Goal entry abandoned: its session changed.");
		this.name = "GoalEntryAbandoned";
	}
}

interface EnterOptions {
	forHostPrompt?: boolean;
	/** Optional host-owned ownership check run after the tool swap; false abandons the entry. */
	fence?: () => boolean;
}

export class GoalHostController {
	readonly #session: GoalHostSession;
	readonly #continuationMode: GoalContinuationMode;
	readonly #canAutoContinue: (() => boolean) | undefined;
	/** Active tool set before goal mode added `goal`; restored when the goal ends. */
	#previousTools: string[] | undefined;
	/** Continuation turns submitted whose terminal `agent_end` has not arrived. */
	#pendingContinuationTurns = 0;
	#previousContinuationActivity: string | undefined;
	/** A continuation turn made no new progress; wait for the host before continuing. */
	#suppressContinuation = false;
	/**
	 * Set by a host abort; only host action (a prompt, or `goal create`/`resume`) clears it.
	 * Unlike {@link #suppressContinuation}, no turn's `agent_end` can re-arm it, so the
	 * aborted turn's own end cannot schedule another goal turn whatever its activity.
	 */
	#hostStopped = false;
	/** A continuation has been decided and is waiting for the session to go idle. */
	#continuationScheduled = false;
	/** Bumped by a host abort or session change; a waiting continuation from before is void. */
	#continuationGeneration = 0;
	/** Tool-set restoration triggered by session events; commands and reads wait for it. */
	#exitTask: Promise<void> = Promise.resolve();
	/** Session changes in progress; goal turns are held until they end. */
	#sessionChanges = 0;
	/** Transcript (session manager) id when the outermost in-progress change began. */
	#sessionBeforeChange: string | undefined;
	/** A goal turn was waiting or became due during the change; report busy until it ends. */
	#heldDuringChange = false;
	/** Reconciles run one at a time, each against the transcript current when it starts. */
	#reconcileTask: Promise<void> = Promise.resolve();
	/** Reconciles queued or running. */
	#reconcilesPending = 0;
	/**
	 * The in-progress change began while a reconcile was queued or running, so that
	 * reconcile may have read a transcript this change later replaced or rolled back:
	 * reconcile again (after it) when the change ends, whatever the ids say.
	 */
	#changeOverlappedReconcile = false;
	readonly #onContinuationDropped: (() => void) | undefined;
	readonly #onReconciled: (() => void | Promise<void>) | undefined;

	constructor(session: GoalHostSession, options: GoalHostControllerOptions) {
		this.#session = session;
		this.#continuationMode = options.continuationMode;
		this.#canAutoContinue = options.canAutoContinue;
		this.#onContinuationDropped = options.onContinuationDropped;
		this.#onReconciled = options.onReconciled;
	}

	/**
	 * True while a goal continuation has been decided but not yet admitted. Hosts and
	 * quiescence checks must treat the session as busy during this window.
	 */
	get continuationPending(): boolean {
		// A change that is holding a goal turn may resume it when cancelled: not settled meanwhile.
		return this.#continuationScheduled || (this.#sessionChanges > 0 && this.#heldDuringChange);
	}

	/**
	 * The host interrupted the session (`abort`). Stop automatic continuation until
	 * the host acts again. Called before the abort starts, so the aborted run's own
	 * `agent_end` cannot schedule another goal turn. The runtime separately pauses the
	 * interrupted goal, so in practice only `goal resume`/`create` restarts it.
	 */
	stopForHostAbort(): void {
		this.#hostStopped = true;
		this.#suppressContinuation = true;
		this.#continuationScheduled = false;
		this.#continuationGeneration++;
	}

	/** A reconcile is queued or running: goal state and tools are being replaced. */
	get reconciling(): boolean {
		return this.#reconcilesPending > 0;
	}

	get #state(): GoalHostResult {
		const state = this.#session.getGoalModeState();
		return { goal: state?.goal ?? null, state: state ?? null };
	}

	/**
	 * Resolves once queued goal exits and reconciles (including ones queued while
	 * waiting) have run. Host commands and reads wait for it so they never act on
	 * the previous transcript's goal. Not for use inside extension notifications.
	 */
	async settled(): Promise<void> {
		for (let tail = this.#reconcileTask; ; tail = this.#reconcileTask) {
			await this.#exitTask;
			await tail;
			if (tail === this.#reconcileTask) return;
		}
	}

	/**
	 * Call before any session change or tree navigation (RPC command or extension
	 * action). Waits for a pending goal exit so it cannot land in the next session,
	 * voids a waiting continuation, and holds new goal turns until
	 * {@link endSessionChange}.
	 */
	async beginSessionChange(): Promise<void> {
		if (this.#sessionChanges++ === 0) {
			// The transcript id, not `session.sessionId`: a host-pinned provider session id
			// (`--provider-session-id`) does not change when the transcript does.
			this.#sessionBeforeChange = this.#session.sessionManager.getSessionId();
			this.#heldDuringChange = this.#continuationScheduled || this.#continuationWanted();
		}
		if (this.#reconcilesPending > 0) this.#changeOverlappedReconcile = true;
		this.#continuationScheduled = false;
		this.#continuationGeneration++;
		await this.#exitTask;
	}

	/**
	 * Call after the change resolves, is cancelled, or throws. Only a change that
	 * actually switched the transcript adopts the target session's goal; an active
	 * goal stays active across it, as in the TUI. A cancelled or no-op change (same
	 * session, for example tree navigation or reopening the open session) leaves the
	 * running goal untouched and resumes continuation.
	 *
	 * `detachedRun`: the change stopped the running agent (new, switch, reload). A
	 * detached continuation turn never reaches its terminal `agent_end`, so it no
	 * longer counts as pending. Never throws; settlement is re-checked afterwards.
	 */
	async endSessionChange(options?: { detachedRun?: boolean }): Promise<void> {
		if (options?.detachedRun) {
			this.#pendingContinuationTurns = 0;
			this.#previousContinuationActivity = undefined;
		}
		if (--this.#sessionChanges > 0) return;
		const switched =
			this.#changeOverlappedReconcile || this.#session.sessionManager.getSessionId() !== this.#sessionBeforeChange;
		this.#changeOverlappedReconcile = false;
		this.#sessionBeforeChange = undefined;
		this.#heldDuringChange = false;
		try {
			if (switched && this.#reconcilesPending > 0) {
				// A reconcile is running, possibly the one whose extension notification
				// started this change: queue behind it without waiting, or the two would
				// wait on each other. Settlement is re-checked once it has run.
				void this.reconcile({ preserveActiveGoal: true })
					.then(() => this.#scheduleContinuation())
					.catch(reportControllerError)
					.finally(() => this.#onContinuationDropped?.());
				return;
			}
			if (switched) await this.reconcile({ preserveActiveGoal: true });
			this.#scheduleContinuation();
		} catch (error) {
			reportControllerError(error);
		}
		this.#onContinuationDropped?.();
	}

	#queueExit(exit: () => Promise<void>): void {
		this.#exitTask = this.#exitTask.then(exit).catch(reportControllerError);
	}

	async handle(command: GoalHostCommand): Promise<GoalHostResult> {
		await this.settled();
		switch (command.op) {
			case "get":
				return this.#state;
			case "create":
				return await this.#create(command);
			case "resume":
				return await this.#resume();
			case "pause":
				return await this.#pause();
			case "drop":
				// The runtime's `goal_updated(dropped)` queues the exit.
				await this.#session.goalRuntime.dropGoal();
				await this.#exitTask;
				return this.#state;
			default: {
				const op: never = command.op;
				throw new Error(`Unknown goal op: ${String(op)}`);
			}
		}
	}

	#assertCanEnter(): void {
		if (!cfgGoalEnabled.get(this.#session.settings)) {
			throw new Error("Goal mode is disabled (goal.enabled).");
		}
		if (this.#session.getPlanModeState()?.enabled) {
			throw new Error("Exit plan mode before starting a goal.");
		}
	}

	async #create(command: GoalHostCommand, options?: EnterOptions): Promise<GoalHostResult> {
		this.#assertCanEnter();
		const objective = command.objective?.trim();
		if (!objective) throw new Error("objective is required when op=create");
		const tokenBudget = command.tokenBudget;
		if (tokenBudget !== undefined && (!Number.isInteger(tokenBudget) || tokenBudget <= 0)) {
			throw new Error("token_budget must be a positive integer when provided");
		}
		const current = this.#session.getGoalModeState();
		if (current?.enabled) throw new Error("A goal is already active. Drop it before creating another.");
		if (current?.goal.status === "paused") {
			throw new Error("Resume or drop the paused goal before creating another.");
		}
		await this.#enter(
			() => this.#session.goalRuntime.createGoal({ objective, tokenBudget }, { origin: "host" }),
			options,
		);
		return this.#state;
	}

	async #resume(options?: EnterOptions): Promise<GoalHostResult> {
		this.#assertCanEnter();
		const current = this.#session.getGoalModeState();
		if (current?.enabled) return this.#state;
		if (current?.goal.status !== "paused") throw new Error("No paused goal to resume.");
		await this.#enter(() => this.#session.goalRuntime.resumeGoal({ origin: "host" }), options);
		return this.#state;
	}

	/**
	 * Create a goal whose objective the host is about to submit as its own prompt.
	 * No continuation is scheduled here: that prompt's terminal `agent_end` decides
	 * the first one, so a continuation can never race ahead of the objective turn.
	 */
	async createForHostPrompt(
		input: { objective: string; tokenBudget?: number },
		options?: { fence?: () => boolean },
	): Promise<GoalHostResult> {
		await this.settled();
		return await this.#create({ op: "create", ...input }, { forHostPrompt: true, fence: options?.fence });
	}

	/** Resume a paused goal for the host prompt about to run; see {@link createForHostPrompt}. */
	async resumeForHostPrompt(options?: { fence?: () => boolean }): Promise<GoalHostResult> {
		await this.settled();
		return await this.#resume({ forHostPrompt: true, fence: options?.fence });
	}

	/**
	 * Pause the goal and restore the pre-goal tool set (ACP leaving goal mode).
	 * An already-paused, disabled goal is not re-journaled; only the idempotent tool restore runs.
	 */
	async pause(): Promise<GoalHostResult> {
		await this.settled();
		const state = this.#session.getGoalModeState();
		if (state?.goal.status === "paused" && !state.enabled) {
			await this.#exit();
			return this.#state;
		}
		return await this.#pause();
	}

	async #pause(): Promise<GoalHostResult> {
		await this.#session.goalRuntime.pauseGoal();
		await this.#exit();
		return this.#state;
	}

	async #enter(start: () => Promise<GoalModeState>, options?: EnterOptions): Promise<void> {
		// The pre-goal tool set is captured once, when this controller first adds `goal`
		// (a reattached paused goal already holds it). A `goal` tool the host enabled
		// before the goal stays enabled afterwards.
		const previousTools = this.#previousTools ?? this.#session.getEnabledToolNames();
		const state = await start();
		this.#previousTools = previousTools;
		await this.#session.setActiveToolsByName([...new Set([...previousTools, "goal"])]);
		if (options?.fence && !options.fence()) {
			// The host's owner of this entry moved on (an ACP session change) while the tool swap
			// was running. The new owner's reconcile already replaced goal state and tools, so this
			// entry's late swap is undone, deterministically, and its state is never installed.
			await this.settled();
			const current = this.#session.getGoalModeState();
			await this.#session.setActiveToolsByName(current ? [...new Set([...previousTools, "goal"])] : previousTools);
			throw new GoalEntryAbandoned();
		}
		this.#session.setGoalModeState(state);
		this.#resetContinuation();
		if (this.#session.isStreaming) {
			await this.#session.sendGoalModeContext({ deliverAs: "steer" });
			return;
		}
		// An idle host prompt carries the goal context itself (`#buildGoalModeMessage`),
		// and its terminal agent_end schedules the first continuation.
		if (options?.forHostPrompt) return;
		this.#scheduleContinuation();
	}

	/** Restore the pre-goal tool set. Idempotent. */
	async #exit(): Promise<void> {
		const previousTools = this.#previousTools;
		this.#previousTools = undefined;
		this.#resetContinuation();
		if (previousTools) await this.#session.setActiveToolsByName(previousTools);
	}

	/** Write the completion records into the current transcript and clear goal state. Synchronous. */
	#journalCompletion(): void {
		const state = this.#session.getGoalModeState();
		this.#session.setGoalModeState(undefined);
		this.#session.sessionManager.appendModeChange("none");
		this.#session.sessionManager.appendCustomEntry("goal-completed", {
			objective: state?.goal.objective,
			tokensUsed: state?.goal.tokensUsed,
			tokenBudget: state?.goal.tokenBudget,
			timeUsedSeconds: state?.goal.timeUsedSeconds,
		});
	}

	#resetContinuation(): void {
		this.#pendingContinuationTurns = 0;
		this.#previousContinuationActivity = undefined;
		this.#suppressContinuation = false;
		this.#hostStopped = false;
	}

	/**
	 * Leave the previous session's goal behind and restore a goal journaled in the
	 * current session (startup, new/switch/branch/open), mirroring the TUI's reattach.
	 * `preserveActiveGoal` keeps an active goal active (in-process session changes);
	 * without it an active goal is paused (startup, a resumed process).
	 * Queued behind any reconcile already running; resolves when this one has run.
	 * Never awaited from {@link beginSessionChange}: `onThreadResumed` notifies
	 * extensions, which may start another change.
	 */
	async reconcile(options?: { preserveActiveGoal?: boolean }): Promise<void> {
		this.#reconcilesPending++;
		const run = this.#reconcileTask.then(async () => {
			await this.#reconcileOnce(options);
			// A deferred reconcile lands after its change returned; tell the host the final state is in.
			try {
				await this.#onReconciled?.();
			} catch (error) {
				reportControllerError(error);
			}
		});
		this.#reconcileTask = run.catch(reportControllerError).finally(() => {
			this.#reconcilesPending--;
		});
		await run;
	}

	async #reconcileOnce(options: { preserveActiveGoal?: boolean } | undefined): Promise<void> {
		// Goal state and the goal tool belong to the session that set them; the
		// session itself keeps both across a switch, so clear them here first.
		this.#continuationScheduled = false;
		this.#continuationGeneration++;
		await this.#exitTask;
		await this.#exit();
		this.#session.setGoalModeState(undefined);
		const context = this.#session.sessionManager.buildSessionContext();
		const runtime = this.#session.goalRuntime;
		if (context.mode !== "goal" && context.mode !== "goal_paused") {
			runtime.clearAccounting();
			return;
		}
		const goal = cfgGoalEnabled.get(this.#session.settings) ? goalFromModeData(context.modeData) : undefined;
		if (!goal) {
			runtime.clearAccounting();
			this.#session.sessionManager.appendModeChange("none");
			return;
		}
		this.#session.setGoalModeState({ enabled: context.mode === "goal", mode: "active", goal });
		const restored = await runtime.onThreadResumed({ preserveActiveGoal: options?.preserveActiveGoal });
		if (!restored?.goal) return;
		const previousTools = this.#session.getEnabledToolNames();
		this.#previousTools = previousTools;
		await this.#session.setActiveToolsByName([...new Set([...previousTools, "goal"])]);
	}

	/**
	 * Feed session events. Must run before the RPC settle watcher observes the same
	 * event so a continuation is admitted before settlement is evaluated.
	 */
	observe(event: AgentSessionEvent): void {
		if (event.type === "message_start" && event.message.role === "user" && !event.message.synthetic) {
			// A host prompt re-arms continuation after a no-progress stop.
			this.#resetContinuation();
			return;
		}
		if (event.type === "goal_updated") {
			const status = event.state?.goal.status;
			if (status === "dropped") {
				this.#queueExit(() => this.#exit());
			} else if (event.state?.enabled && this.#previousTools === undefined) {
				// Created by the agent's `goal` tool rather than this controller.
				this.#previousTools = this.#session.getEnabledToolNames();
			}
			return;
		}
		if (event.type !== "agent_end" || event.isTerminal === false) return;
		if (this.#pendingContinuationTurns > 0) {
			this.#pendingContinuationTurns--;
			const activity = goalContinuationActivity(event.messages);
			this.#suppressContinuation = activity.length === 0 || activity === this.#previousContinuationActivity;
			this.#previousContinuationActivity = activity;
		} else {
			// As in the TUI: a turn that was not a goal continuation (a host prompt, a delivery
			// or job wake, an extension-triggered turn) re-arms after a no-progress stop.
			// A host abort stays in force (#hostStopped).
			this.#suppressContinuation = false;
			this.#previousContinuationActivity = undefined;
		}
		if (this.#session.getGoalModeState()?.mode === "exiting") {
			// Journal now, while the transcript is certainly the one that completed the
			// goal; only the tool-set restore is queued (a later reconcile also restores it).
			this.#journalCompletion();
			this.#queueExit(() => this.#exit());
			return;
		}
		this.#scheduleContinuation();
	}

	/**
	 * Whether goal continuation is wanted at all, independent of whether the session
	 * is momentarily busy. Every gate is read from the live session.
	 */
	#continuationWanted(): boolean {
		const session = this.#session;
		if (!cfgGoalContinuationModes.get(session.settings).includes(this.#continuationMode)) return false;
		if (this.#hostStopped || this.#suppressContinuation || session.isDisposed) return false;
		if (this.#canAutoContinue && !this.#canAutoContinue()) return false;
		if (session.getPlanModeState()?.enabled) return false;
		const state = session.getGoalModeState();
		if (!state?.enabled || state.goal.status !== "active") return false;
		const phases = session.getTodoPhases();
		return !(
			!nextActionableTask(phases) && phases.some(phase => phase.tasks.some(task => task.status === "blocked"))
		);
	}

	/**
	 * Decide at a yield to continue the goal; admit the continuation once the yielding
	 * run has fully unwound. While waiting, {@link continuationPending} is true, so no
	 * settle report calls the session settled. At admission every gate is re-read:
	 * an abort, disposal, pause, plan mode, or another turn starting meanwhile drops it.
	 */
	#scheduleContinuation(): void {
		if (this.#sessionChanges > 0) {
			// Held until the change ends; a same-session change resumes it.
			if (this.#continuationWanted()) this.#heldDuringChange = true;
			return;
		}
		if (this.#continuationScheduled || !this.#continuationWanted()) return;
		this.#continuationScheduled = true;
		const generation = this.#continuationGeneration;
		void (async () => {
			const { promise, resolve } = Promise.withResolvers<void>();
			setImmediate(resolve);
			await promise;
			await this.#session.waitForIdle();
			if (!this.#continuationScheduled || generation !== this.#continuationGeneration) {
				this.#onContinuationDropped?.();
				return;
			}
			this.#continuationScheduled = false;
			const session = this.#session;
			const idle =
				!session.isStreaming &&
				!session.hasAdmittedSubmission &&
				session.queuedMessageCount === 0 &&
				!session.isSessionTransitioning;
			const prompt = idle && this.#continuationWanted() ? session.goalRuntime.buildContinuationPrompt() : undefined;
			if (!prompt) {
				this.#onContinuationDropped?.();
				return;
			}
			this.#pendingContinuationTurns++;
			const unclaim = () => {
				this.#pendingContinuationTurns = Math.max(0, this.#pendingContinuationTurns - 1);
				// No run follows, so nothing else will end this activity stretch.
				this.#onContinuationDropped?.();
			};
			// promptCustomMessage counts the submission as admitted synchronously, so every
			// settle report sees it from here on. A continuation that is refused or bails
			// before its run starts must neither stay counted nor withhold settlement.
			session.promptCustomMessage({ customType: "goal-continuation", content: prompt, display: false }).then(
				dispatched => {
					if (!dispatched) unclaim();
				},
				error => {
					unclaim();
					reportControllerError(error);
				},
			);
		})().catch(error => {
			this.#continuationScheduled = false;
			this.#onContinuationDropped?.();
			reportControllerError(error);
		});
	}
}

function reportControllerError(error: unknown): void {
	logger.warn("Goal host controller failed", { error: error instanceof Error ? error.message : String(error) });
}
