import { escapeXmlText, prompt, Snowflake } from "@oh-my-pi/pi-utils";
import goalBudgetLimitPrompt from "../prompts/goals/goal-budget-limit.md" with { type: "text" };
import goalContinuationPrompt from "../prompts/goals/goal-continuation.md" with { type: "text" };
import goalModeActivePrompt from "../prompts/goals/goal-mode-active.md" with { type: "text" };
import type { Goal } from "@oh-my-pi/pi-tui/tools/goal";
import type { GoalBudgetSteering, GoalModeState, GoalRuntimeEvent, GoalTokenUsage } from "./state";

export interface GoalRuntimeHost {
	getState(): GoalModeState | undefined;
	setState(state: GoalModeState | undefined): void;
	getCurrentUsage(): GoalTokenUsage;
	emit(event: GoalRuntimeEvent): void | Promise<void>;
	persist(mode: "goal" | "goal_paused" | "none", state?: GoalModeState): void;
	sendHiddenMessage(message: {
		customType: string;
		content: string;
		deliverAs?: "steer" | "followUp" | "nextTurn";
	}): Promise<void>;
	now?(): number;
}

/** Who asks for a goal entry: the host's own prompt handling (`host`) or the agent's `goal` tool (`tool`, the default). */
export type GoalEntryOrigin = "host" | "tool";

/**
 * Opaque ownership stamp issued by a host's {@link GoalMutationGate}. It names the transcript (and,
 * by scope, the session-change state) in which an operation was requested.
 */
export type GoalOwnerStamp = object;

/**
 * What a stamp must still match when its operation writes.
 * - `entry`: the transcript, with no session change running, begun or ended since. A host's goal entry.
 * - `tool`: as `entry`, and no reconcile running. The agent's `goal` tool.
 * - `transcript`: only the transcript. Usage accounting, host pauses, budget changes: a session change that
 *   has begun but not switched the transcript leaves the old transcript's goal to its own accounting. A host
 *   abort passes the stamp reserved when its Stop arrived, so a late abort reaches only the transcript it
 *   interrupted, whatever other aborts are still unwinding.
 */
export type GoalOwnerScope = "entry" | "tool" | "transcript";

/**
 * Thrown when a stamp no longer owns the transcript, either by a mutator that wrote nothing or by a host entry
 * abandoned after its late effects were undone. A tool call surfaces it as a tool error; host callers discard
 * the operation; event-driven accounting (usage flush, agent end, task abort) drops it.
 */
export class GoalOwnerStale extends Error {
	constructor() {
		super("The session changed since this goal operation was requested; retry it afterwards.");
		this.name = "GoalOwnerStale";
	}
}

/**
 * Optional ownership gate a host installs on the runtime (ACP). Without one every mutator behaves as
 * before, so RPC and the TUI are unaffected. Each mutator reserves a stamp when it is called; every write
 * re-checks it synchronously, immediately before writing (see `GoalRuntime.#commit`).
 */
export interface GoalMutationGate {
	/** Reserve ownership now. A mutator calls it synchronously, before it queues on the accounting chain. */
	reserve(scope: GoalOwnerScope): GoalOwnerStamp;
	/** Whether `stamp` still owns the transcript. Synchronous: no await may separate it from the write it guards. */
	owns(stamp: GoalOwnerStamp): boolean;
	/** Throws to refuse an agent-tool goal entry the host's mode forbids (ACP: Plan). */
	admitEntry(): void;
}

/** Options of a mutator that is not an entry. */
export interface GoalOpOptions {
	/** A stamp the caller reserved when the operation was requested; absent: reserved when the mutator is called. */
	stamp?: GoalOwnerStamp;
}

/** Options of a mutator the agent's tool or the host can call. */
export interface GoalEntryOptions extends GoalOpOptions {
	origin?: GoalEntryOrigin;
}

/** The ownership of one mutator call: its stamp, or none when no gate is installed or the owner itself writes. */
interface GoalOp {
	readonly stamp?: GoalOwnerStamp;
}

/** The owning host's own reconcile (`onThreadResumed`): it is what replaces the previous owner, so nothing to re-check. */
const OWNER_SIDE: GoalOp = {};

export interface GoalTurnSnapshot {
	turnId: string;
	baselineUsage: GoalTokenUsage;
	activeGoalId?: string;
}

export interface GoalWallClockSnapshot {
	lastAccountedAt: number;
	activeGoalId?: string;
}

export interface GoalRuntimeSnapshot {
	turnSnapshot?: GoalTurnSnapshot;
	wallClock: GoalWallClockSnapshot;
	budgetReportedFor?: string;
}

export type GoalPromptKind = "active" | "continuation" | "budget-limit";

function cloneGoal(goal: Goal): Goal {
	return { ...goal };
}

function cloneState(state: GoalModeState): GoalModeState {
	return { ...state, goal: cloneGoal(state.goal) };
}

function budgetValue(goal: Goal): string {
	return goal.tokenBudget === undefined ? "none" : String(goal.tokenBudget);
}

function remainingValue(goal: Goal): string {
	return goal.tokenBudget === undefined ? "unbounded" : String(Math.max(0, goal.tokenBudget - goal.tokensUsed));
}

export function remainingTokens(goal: Goal | null | undefined): number | null {
	if (!goal || goal.tokenBudget === undefined) return null;
	return Math.max(0, goal.tokenBudget - goal.tokensUsed);
}

export function renderTrustedObjective(objective: string): string {
	return `<objective>\n${escapeXmlText(objective)}\n</objective>`;
}

export function goalTokenDelta(current: GoalTokenUsage, baseline: GoalTokenUsage): number {
	// Diverges from codex-rs: codex omits cache creation because its target providers
	// do not bill cache writes distinctly through the token-usage stream. Pi receives
	// cacheWrite separately on Anthropic/Bedrock; rotating a 1h ephemeral cache or
	// re-anchoring a changed system prompt can write 100K+ tokens, which the goal
	// budget must account for. cacheRead is excluded because it is reused prefix,
	// not new work consumed by the goal.
	return (
		Math.max(0, current.input - baseline.input) +
		Math.max(0, current.cacheWrite - baseline.cacheWrite) +
		Math.max(0, current.output - baseline.output)
	);
}

export function renderGoalPrompt(kind: GoalPromptKind, goal: Goal): string {
	const template =
		kind === "active"
			? goalModeActivePrompt
			: kind === "continuation"
				? goalContinuationPrompt
				: goalBudgetLimitPrompt;
	return prompt.render(template, {
		objective: escapeXmlText(goal.objective),
		tokensUsed: String(goal.tokensUsed),
		tokenBudget: budgetValue(goal),
		remainingTokens: remainingValue(goal),
		timeUsedSeconds: String(goal.timeUsedSeconds),
	});
}

export function completionBudgetReport(goal: Goal): string | null {
	const parts: string[] = [];
	if (goal.tokenBudget !== undefined) {
		parts.push(`tokens used: ${goal.tokensUsed} of ${goal.tokenBudget}`);
	}
	if (goal.timeUsedSeconds > 0) {
		parts.push(`time used: ${goal.timeUsedSeconds} seconds`);
	}
	if (parts.length === 0) return null;
	return `Goal achieved. Report final budget usage to the user: ${parts.join("; ")}.`;
}

function validateTokenBudget(tokenBudget: number | undefined): void {
	if (tokenBudget !== undefined && (!Number.isInteger(tokenBudget) || tokenBudget <= 0)) {
		throw new Error("goal token_budget must be a positive integer when provided");
	}
}

function isAccountingStatus(goal: Goal): boolean {
	return goal.status === "active" || goal.status === "budget-limited";
}

export class GoalRuntime {
	readonly #host: GoalRuntimeHost;
	#turnSnapshot: GoalTurnSnapshot | undefined;
	#wallClock: GoalWallClockSnapshot;
	#budgetReportedFor: string | undefined;
	#accountingTail: Promise<void> = Promise.resolve();
	#gate: GoalMutationGate | undefined;

	constructor(host: GoalRuntimeHost) {
		this.#host = host;
		this.#wallClock = { lastAccountedAt: this.#now() };
	}

	/** Install (or remove) the host's ownership gate. Absent by default: RPC and the TUI never set one. */
	setMutationGate(gate: GoalMutationGate | undefined): void {
		this.#gate = gate;
	}

	/** Whether `stamp` still owns the transcript; always true without a gate. For hosts that fence work around a mutator. */
	owns(stamp: GoalOwnerStamp): boolean {
		return this.#gate?.owns(stamp) ?? true;
	}

	/**
	 * Reserve ownership of the current transcript for an operation the host is requesting now (an abort),
	 * to pass later as that operation's `stamp`. `undefined` without a gate: RPC and the TUI are unaffected.
	 */
	reserveOwner(): GoalOwnerStamp | undefined {
		return this.#gate?.reserve("transcript");
	}

	get snapshot(): GoalRuntimeSnapshot {
		return {
			turnSnapshot: this.#turnSnapshot
				? { ...this.#turnSnapshot, baselineUsage: { ...this.#turnSnapshot.baselineUsage } }
				: undefined,
			wallClock: { ...this.#wallClock },
			budgetReportedFor: this.#budgetReportedFor,
		};
	}

	#now(): number {
		return this.#host.now?.() ?? Date.now();
	}

	#hasAccountingState(): boolean {
		const state = this.#host.getState();
		return Boolean(state?.enabled && isAccountingStatus(state.goal));
	}

	async #withAccounting<T>(fn: () => Promise<T> | T): Promise<T> {
		const previous = this.#accountingTail;
		const { promise, resolve } = Promise.withResolvers<void>();
		this.#accountingTail = previous.then(
			() => promise,
			() => promise,
		);
		await previous.catch(() => {});
		try {
			return await fn();
		} finally {
			resolve();
		}
	}

	// ---- ownership fence -------------------------------------------------------------------
	//
	// Every mutator reserves its owner stamp synchronously when it is called (`#reserve`), before it
	// queues on the accounting chain. Every write to goal state, the journal or accounting then goes
	// through `#commit` / `#commitState`, which re-check the stamp synchronously, immediately before the
	// write. An await between the reservation and a write can therefore never land the write in a
	// transcript the session has moved to: a stale stamp writes nothing and throws `GoalOwnerStale`.

	/** Reserve the owner stamp of one mutator call; `stamp` is one the caller reserved earlier, when it was requested. */
	#reserve(scope: GoalOwnerScope, stamp?: GoalOwnerStamp): GoalOp {
		const gate = this.#gate;
		return gate ? { stamp: stamp ?? gate.reserve(scope) } : OWNER_SIDE;
	}

	/** Throws `GoalOwnerStale` unless the op's stamp still owns the transcript. */
	#assertOwned(op: GoalOp): void {
		if (op.stamp !== undefined && this.#gate !== undefined && !this.#gate.owns(op.stamp)) throw new GoalOwnerStale();
	}

	/** The one write path: re-check the stamp, then apply `write` synchronously. */
	#commit(op: GoalOp, write: () => void): void {
		this.#assertOwned(op);
		write();
	}

	/**
	 * Write goal state, its journal entry and the accounting that belongs with it as one synchronous step
	 * behind the stamp check, then deliver the update event (delivery is not a write).
	 */
	async #commitState(
		op: GoalOp,
		state: GoalModeState | undefined,
		options?: { persist?: "goal" | "goal_paused" | "none"; emit?: boolean; accounting?: () => void },
	): Promise<void> {
		this.#commit(op, () => {
			options?.accounting?.();
			this.#host.setState(state ? cloneState(state) : undefined);
			if (options?.persist) {
				this.#host.persist(options.persist, state);
			}
		});
		if (options?.emit !== false) {
			await this.#host.emit({ type: "goal_updated", goal: state ? cloneGoal(state.goal) : null, state });
		}
	}

	/** Event-driven accounting (usage flush, agent end, task abort) has no caller to tell: a stale one is dropped. */
	async #absorbStale(run: () => Promise<void>): Promise<void> {
		try {
			await run();
		} catch (error) {
			if (!(error instanceof GoalOwnerStale)) throw error;
		}
	}

	#getStateClone(): GoalModeState | undefined {
		const state = this.#host.getState();
		return state ? cloneState(state) : undefined;
	}

	#markActiveAccounting(goal: Goal, resetWallClock = false): void {
		if (resetWallClock || this.#wallClock.activeGoalId !== goal.id) {
			this.#wallClock = { lastAccountedAt: this.#now(), activeGoalId: goal.id };
		}
		if (this.#turnSnapshot) {
			this.#turnSnapshot.activeGoalId = goal.id;
			this.#turnSnapshot.baselineUsage = { ...this.#host.getCurrentUsage() };
		}
	}

	#clearActiveAccounting(): void {
		this.#wallClock = { lastAccountedAt: this.#now() };
		if (this.#turnSnapshot) {
			this.#turnSnapshot.activeGoalId = undefined;
		}
	}

	/** Owner-side and synchronous (a reconcile or session change drops the previous owner's accounting): nothing to fence. */
	clearAccounting(): void {
		this.#turnSnapshot = undefined;
		this.#clearActiveAccounting();
		this.#budgetReportedFor = undefined;
	}

	/** Owner-side and synchronous, in event order with the turn it starts: nothing to fence. */
	onTurnStart(turnId: string, baselineUsage: GoalTokenUsage): void {
		this.#turnSnapshot = { turnId, baselineUsage: { ...baselineUsage } };
		const state = this.#host.getState();
		if (state?.enabled && isAccountingStatus(state.goal)) {
			this.#turnSnapshot.activeGoalId = state.goal.id;
			if (this.#wallClock.activeGoalId !== state.goal.id) {
				this.#wallClock = { lastAccountedAt: this.#now(), activeGoalId: state.goal.id };
			}
		}
	}

	async onToolCompleted(toolName: string): Promise<void> {
		if (toolName === "goal") return;
		if (!this.#hasAccountingState()) return;
		await this.flushUsage("allowed");
	}

	async onGoalToolCompleted(): Promise<void> {
		if (!this.#hasAccountingState()) return;
		await this.flushUsage("suppressed");
	}

	/**
	 * `currentUsage` may be a thunk: it is read synchronously (before any await)
	 * only when goal accounting is active, so idle sessions skip the usage walk.
	 */
	async onAgentEnd(options?: {
		turnCompleted?: boolean;
		currentUsage?: GoalTokenUsage | (() => GoalTokenUsage);
	}): Promise<void> {
		const op = this.#reserve("transcript");
		if (!this.#hasAccountingState()) {
			// Synchronous like the pre-gate path: an await here delays the session's settle past
			// the prompt's unwind, so an interrupt resumed by a queued steer would read as a stop.
			try {
				this.#commit(op, () => void (this.#turnSnapshot = undefined));
			} catch (error) {
				if (!(error instanceof GoalOwnerStale)) throw error;
			}
			return;
		}
		const currentUsage = options?.currentUsage;
		const usage = typeof currentUsage === "function" ? currentUsage() : currentUsage;
		await this.#absorbStale(() =>
			this.#withAccounting(async () => {
				await this.#flushUsageLocked(op, "suppressed", usage);
				this.#commit(op, () => void (this.#turnSnapshot = undefined));
			}),
		);
	}

	/** `options.stamp` is the one the host reserved when the abort was requested, not when it reaches the runtime. */
	async onTaskAborted(options?: { reason?: "interrupted" | "internal"; stamp?: GoalOwnerStamp }): Promise<void> {
		const interrupted = options?.reason === "interrupted";
		const op = this.#reserve("transcript", options?.stamp);
		const state = this.#host.getState();
		const needsAccounting = state?.enabled && isAccountingStatus(state.goal);
		const needsPause = interrupted && state?.enabled && state.goal.status === "active";
		await this.#absorbStale(async () => {
			if (!needsAccounting && !needsPause) {
				this.#commit(op, () => void (this.#turnSnapshot = undefined));
				return;
			}
			await this.#withAccounting(async () => {
				await this.#flushUsageLocked(op, "suppressed", undefined, options?.reason === "internal");
				this.#commit(op, () => void (this.#turnSnapshot = undefined));
				if (!interrupted) return;
				const cloned = this.#getStateClone();
				if (!cloned?.enabled || cloned.goal.status !== "active") return;
				cloned.enabled = false;
				cloned.goal.status = "paused";
				cloned.goal.updatedAt = this.#now();
				await this.#commitState(op, cloned, {
					persist: "goal_paused",
					accounting: () => {
						this.#clearActiveAccounting();
						this.#budgetReportedFor = undefined;
					},
				});
			});
		});
	}

	async onThreadResumed(options?: { preserveActiveGoal?: boolean }): Promise<GoalModeState | undefined> {
		const state = this.#getStateClone();
		if (!state) return undefined;
		if (options?.preserveActiveGoal && state.enabled && state.goal.status === "active") {
			await this.#commitState(OWNER_SIDE, state, {
				emit: true,
				accounting: () => this.#markActiveAccounting(state.goal, true),
			});
			return state;
		}
		if (state.goal.status === "active") {
			state.enabled = false;
			state.goal.status = "paused";
			state.goal.updatedAt = this.#now();
			await this.#commitState(OWNER_SIDE, state, {
				persist: "goal_paused",
				accounting: () => {
					this.#clearActiveAccounting();
					this.#budgetReportedFor = undefined;
				},
			});
			return state;
		}
		await this.#commitState(OWNER_SIDE, state, {
			emit: true,
			accounting: () => {
				if (state.enabled && isAccountingStatus(state.goal)) {
					this.#markActiveAccounting(state.goal);
				} else {
					this.#clearActiveAccounting();
				}
			},
		});
		return state;
	}

	async onBudgetMutated(newBudget: number | undefined): Promise<GoalModeState | undefined> {
		validateTokenBudget(newBudget);
		const op = this.#reserve("transcript");
		return await this.#withAccounting(async () => {
			this.#commit(op, () => void (this.#budgetReportedFor = undefined));
			await this.#flushUsageLocked(op, "suppressed");
			const state = this.#getStateClone();
			if (!state?.goal) return undefined;
			state.goal.tokenBudget = newBudget;
			state.goal.updatedAt = this.#now();
			let shouldSteer = false;
			let reactivated = false;
			if (newBudget !== undefined && state.goal.tokensUsed >= newBudget) {
				if (state.goal.status === "active") {
					state.goal.status = "budget-limited";
					shouldSteer = true;
				}
			} else if (state.goal.status === "budget-limited") {
				state.goal.status = "active";
				state.enabled = true;
				reactivated = true;
			}
			await this.#commitState(op, state, {
				persist: state.enabled ? "goal" : "goal_paused",
				accounting: () => {
					if (reactivated) this.#markActiveAccounting(state.goal);
				},
			});
			if (shouldSteer) {
				await this.#sendBudgetLimitSteer(op, state.goal);
			}
			return state;
		});
	}

	/** `currentUsage` defaults to the host's live totals, read only once a token delta is needed. */
	async #flushUsageLocked(
		op: GoalOp,
		steering: GoalBudgetSteering,
		currentUsage?: GoalTokenUsage,
		persistWallClock = false,
	): Promise<void> {
		const state = this.#getStateClone();
		if (!state?.enabled || !isAccountingStatus(state.goal)) return;
		if (this.#turnSnapshot?.activeGoalId !== state.goal.id && this.#wallClock.activeGoalId !== state.goal.id) return;

		let usage: GoalTokenUsage | undefined;
		let tokenDelta = 0;
		if (this.#turnSnapshot?.activeGoalId === state.goal.id) {
			usage = currentUsage ?? this.#host.getCurrentUsage();
			tokenDelta = goalTokenDelta(usage, this.#turnSnapshot.baselineUsage);
		}
		const wallSeconds =
			this.#wallClock.activeGoalId === state.goal.id
				? Math.max(0, Math.floor((this.#now() - this.#wallClock.lastAccountedAt) / 1000))
				: 0;
		if (tokenDelta <= 0 && wallSeconds <= 0) return;

		state.goal.tokensUsed += tokenDelta;
		state.goal.timeUsedSeconds += wallSeconds;
		state.goal.updatedAt = this.#now();
		const flippedToBudgetLimited =
			state.goal.tokenBudget !== undefined &&
			state.goal.tokensUsed >= state.goal.tokenBudget &&
			state.goal.status === "active";
		if (flippedToBudgetLimited) {
			state.goal.status = "budget-limited";
		}

		// Persisting wall-clock-only accounting on every tool event bloats /goal sessions with full
		// objective snapshots. Keep normal tool flushes in memory/UI only, but make wall-clock
		// usage durable before internal session switches because the active runtime is leaving.
		const shouldPersistUsage = tokenDelta > 0 || flippedToBudgetLimited || (persistWallClock && wallSeconds > 0);
		const goalId = state.goal.id;
		await this.#commitState(op, state, {
			persist: shouldPersistUsage ? "goal" : undefined,
			accounting: () => {
				if (usage && this.#turnSnapshot?.activeGoalId === goalId) {
					this.#turnSnapshot.baselineUsage = { ...usage };
				}
				if (this.#wallClock.activeGoalId === goalId && wallSeconds > 0) {
					this.#wallClock.lastAccountedAt += wallSeconds * 1000;
				}
				if (state.goal.status !== "budget-limited") {
					this.#budgetReportedFor = undefined;
				}
			},
		});

		if (steering === "allowed" && flippedToBudgetLimited && this.#budgetReportedFor !== state.goal.id) {
			await this.#sendBudgetLimitSteer(op, state.goal);
		}
	}

	async flushUsage(steering: GoalBudgetSteering, currentUsage?: GoalTokenUsage): Promise<void> {
		const op = this.#reserve("transcript");
		await this.#absorbStale(() => this.#withAccounting(() => this.#flushUsageLocked(op, steering, currentUsage)));
	}

	#createGoalState(objective: string, tokenBudget: number | undefined): GoalModeState {
		const now = this.#now();
		const goal: Goal = {
			id: String(Snowflake.next()),
			objective,
			status: "active",
			tokenBudget,
			tokensUsed: 0,
			timeUsedSeconds: 0,
			createdAt: now,
			updatedAt: now,
		};
		return { enabled: true, mode: "active", goal };
	}

	async createGoal(
		input: { objective: string; tokenBudget?: number },
		options?: GoalEntryOptions,
	): Promise<GoalModeState> {
		const objective = input.objective.trim();
		if (!objective) throw new Error("objective is required when op=create");
		validateTokenBudget(input.tokenBudget);
		const origin = options?.origin ?? "tool";
		const op = this.#reserve(origin === "tool" ? "tool" : "entry", options?.stamp);
		return await this.#withAccounting(async () => {
			const existing = this.#host.getState();
			if (existing?.goal && existing.goal.status !== "dropped" && existing.goal.status !== "complete") {
				throw new Error("cannot create a new goal because this session already has a goal");
			}
			if (origin === "tool") this.#gate?.admitEntry();
			const state = this.#createGoalState(objective, input.tokenBudget);
			await this.#commitState(op, state, {
				persist: "goal",
				accounting: () => {
					this.#budgetReportedFor = undefined;
					this.#markActiveAccounting(state.goal);
				},
			});
			return state;
		});
	}

	async replaceGoal(input: { objective: string; tokenBudget?: number }): Promise<GoalModeState> {
		const objective = input.objective.trim();
		if (!objective) throw new Error("objective is required when op=replace");
		validateTokenBudget(input.tokenBudget);
		const op = this.#reserve("transcript");
		return await this.#withAccounting(async () => {
			const existing = this.#host.getState();
			if (!existing?.enabled || !isAccountingStatus(existing.goal)) {
				throw new Error("cannot replace goal because no goal is active");
			}
			await this.#flushUsageLocked(op, "suppressed");
			const state = this.#createGoalState(objective, input.tokenBudget);
			await this.#commitState(op, state, {
				persist: "goal",
				accounting: () => {
					this.#budgetReportedFor = undefined;
					this.#markActiveAccounting(state.goal);
				},
			});
			return state;
		});
	}

	async resumeGoal(options?: GoalEntryOptions): Promise<GoalModeState> {
		const origin = options?.origin ?? "tool";
		const op = this.#reserve(origin === "tool" ? "tool" : "entry", options?.stamp);
		return await this.#withAccounting(async () => {
			const state = this.#getStateClone();
			if (!state?.goal) throw new Error("No paused goal.");
			if (state.goal.status === "complete") throw new Error("Goal is already complete.");
			if (origin === "tool") this.#gate?.admitEntry();
			state.enabled = true;
			state.mode = "active";
			state.reason = undefined;
			state.goal.status = "active";
			state.goal.updatedAt = this.#now();
			await this.#commitState(op, state, {
				persist: "goal",
				accounting: () => {
					this.#budgetReportedFor = undefined;
					this.#markActiveAccounting(state.goal);
				},
			});
			return state;
		});
	}

	/** `options.stamp` is the one the caller reserved when the pause was requested, not when it reaches the runtime. */
	async pauseGoal(options?: GoalOpOptions): Promise<GoalModeState | undefined> {
		const op = this.#reserve("transcript", options?.stamp);
		return await this.#withAccounting(async () => {
			await this.#flushUsageLocked(op, "suppressed");
			const state = this.#getStateClone();
			if (!state?.goal) return undefined;
			state.enabled = false;
			state.mode = "active";
			state.reason = undefined;
			if (state.goal.status === "active" || state.goal.status === "budget-limited") {
				state.goal.status = "paused";
			}
			state.goal.updatedAt = this.#now();
			await this.#commitState(op, state, {
				persist: "goal_paused",
				accounting: () => {
					this.#clearActiveAccounting();
					this.#budgetReportedFor = undefined;
				},
			});
			return state;
		});
	}

	/** `origin: "tool"` (the agent's `goal` tool) is refused wherever its stamp went stale; nothing is written. */
	async dropGoal(options?: GoalEntryOptions): Promise<Goal | undefined> {
		const op = this.#reserve(options?.origin === "tool" ? "tool" : "transcript", options?.stamp);
		return await this.#withAccounting(async () => {
			await this.#flushUsageLocked(op, "suppressed");
			const state = this.#getStateClone();
			if (!state?.goal) return undefined;
			const dropped = { ...state.goal, status: "dropped" as const, updatedAt: this.#now() };
			this.#commit(op, () => {
				this.#clearActiveAccounting();
				this.#budgetReportedFor = undefined;
			});
			await this.#host.emit({
				type: "goal_updated",
				goal: dropped,
				state: { ...state, enabled: false, goal: dropped },
			});
			await this.#commitState(op, undefined, { persist: "none", emit: false });
			return dropped;
		});
	}

	async completeGoalFromTool(): Promise<Goal> {
		const op = this.#reserve("tool");
		return await this.#withAccounting(async () => {
			await this.#flushUsageLocked(op, "suppressed");
			const state = this.#getStateClone();
			if (!state?.goal) {
				throw new Error("cannot complete goal because no goal is active");
			}
			if (state.goal.status === "complete") {
				throw new Error("goal is already complete");
			}
			if (state.goal.status === "dropped") {
				throw new Error("cannot complete a dropped goal");
			}
			state.enabled = false;
			state.goal.status = "complete";
			state.goal.updatedAt = this.#now();
			state.mode = "exiting";
			state.reason = "completed";
			await this.#commitState(op, state, {
				persist: "goal",
				accounting: () => {
					this.#clearActiveAccounting();
					this.#budgetReportedFor = undefined;
				},
			});
			return state.goal;
		});
	}

	buildActivePrompt(): string | undefined {
		const state = this.#host.getState();
		return state?.enabled && state.goal && state.goal.status === "active"
			? renderGoalPrompt("active", state.goal)
			: undefined;
	}

	buildContinuationPrompt(): string | undefined {
		const state = this.#host.getState();
		return state?.enabled && state.goal.status === "active"
			? renderGoalPrompt("continuation", state.goal)
			: undefined;
	}

	async #sendBudgetLimitSteer(op: GoalOp, goal: Goal): Promise<void> {
		if (this.#budgetReportedFor === goal.id) return;
		this.#commit(op, () => void (this.#budgetReportedFor = goal.id));
		await this.#host.sendHiddenMessage({
			customType: "goal-budget-limit",
			content: renderGoalPrompt("budget-limit", goal),
			deliverAs: "steer",
		});
	}
}
