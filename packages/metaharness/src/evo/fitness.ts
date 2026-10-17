/** Per-variant fitness on a fixed suite: macro-mean reward, uncertainty, cost, signal evidence. */
import type { TraceRow } from "../store";
import {
	type DecisionPolicy,
	evaluateEligibility,
	type Ineligibility,
	type Interval,
	interval,
	NON_MODEL_PHASES,
	pooledWithinTaskVariance,
} from "./decision-policy";
import { FAILURE_PHASES, type FailurePhase } from "./failure-phase";
import { taskKey } from "./suites";

export interface TaskFitness {
	task: string;
	/** Mean reward over counted attempts; null when every attempt was excluded or still running. */
	reward: number | null;
	attempts: number;
	counted: number;
	/** Attempts excluded as infrastructure failures or still running. */
	excluded: number;
	errors: number;
	meanLlmCalls: number | null;
	meanOutputTokens: number | null;
	/** Mean transcript cost over attempts that carry one; null when none does. Never counts a missing cost as 0. */
	meanCostUsd: number | null;
}

/**
 * Interval fields (`sd`, `se`, `ci95`) are null unless `decisionEligible`. `vHat` is a diagnostic that stays
 * populated when ineligible (the counterpart of `ComparisonReport.rawDelta`); read it only with `decisionEligible`.
 */
export interface FitnessReport extends Interval {
	variantId: string;
	suiteId: string;
	jobName: string;
	/** Task keys seen in the job but absent from the suite; diagnostics only, never scored. */
	outsideSuiteTasks: string[];
	/**
	 * Cardinality only: every suite task x attempt cell has a terminal record, nothing runs, nothing is outside the
	 * suite. Says nothing about power or provenance; see `ComparisonReport.decisionEligible`.
	 */
	dataComplete: boolean;
	incompleteReasons: string[];
	/** Suite-declared attempts per task (the cardinality `dataComplete` was checked against). */
	attemptsPerTask: number;
	/** Pooled sample variance of attempt rewards within tasks; null when no task has 2+ counted attempts. */
	withinTaskVariance: number | null;
	/** Decision policy the suite declared at registration. */
	policy: DecisionPolicy;
	/**
	 * Single-sided subset of the comparison gates: complete, model-outcome only, lossless transcripts, powered by the
	 * declared policy, and task-level variance. When false the interval is null and `vHat` is diagnostic only.
	 */
	decisionEligible: boolean;
	/** Why `decisionEligible` is false, in `ComparisonReport.ineligibility`'s shape; null when eligible. */
	ineligibility: Ineligibility | null;
	/** Macro mean of complete per-task rewards; null when no task has a reward. */
	vHat: number | null;
	tasks: number;
	trials: number;
	errors: number;
	meanLlmCalls: number | null;
	meanOutputTokens: number | null;
	/** Macro mean of transcript cost (main + delegated) over trials that carry one; null when none does. */
	meanCostUsd: number | null;
	/** Terminal in-suite trials with no transcript cost; they are excluded from `meanCostUsd`, and any makes cost deltas null. */
	costMissingTrials: number;
	/** Terminal in-suite trials per failure provenance phase. */
	phaseCounts: Record<FailurePhase, number>;
	/** Share of decided trials whose transcript shows no assistant message. */
	startFailureRate: number | null;
	/** Terminal in-suite trials whose transcript parse dropped lines; their call/token totals undercount. */
	lossyTranscriptTrials: number;
	/** Trials emitting each signal. */
	signalHits: Record<string, number>;
	perTask: TaskFitness[];
}

export function mean(values: readonly number[]): number | null {
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Provenance of a terminal trial; rows without recorded provenance fail closed as `unknown`. */
export function trialPhase(trial: TraceRow): FailurePhase {
	return trial.phase ?? "unknown";
}

function trialReward(trial: TraceRow): number | null {
	if (trial.status === "running") return null;
	// Only a genuine model outcome is a score; a missing phase on a terminal trial is `unknown`.
	if (trialPhase(trial) !== "model_outcome") return null;
	return trial.reward ?? 0;
}

export interface FitnessInput {
	variantId: string;
	suiteId: string;
	jobName: string;
	/** Explicit suite task IDs; each must be present for the estimate to be complete. */
	suiteTasks: readonly string[];
	/** Attempts the suite declares per task; each task must have exactly this many terminal trials. */
	attempts: number;
	policy: DecisionPolicy;
	trials: readonly TraceRow[];
}

function taskFitness(task: string, trials: readonly TraceRow[]): TaskFitness {
	const rewards: number[] = [];
	let errors = 0;
	for (const trial of trials) {
		const reward = trialReward(trial);
		if (reward !== null) rewards.push(reward);
		if (trial.status === "error") errors++;
	}
	const calls = trials.flatMap(t => (t.transcript ? [t.transcript.llmCalls] : []));
	const out = trials.flatMap(t => (t.transcript ? [t.transcript.outputTokens] : []));
	return {
		task,
		reward: mean(rewards),
		attempts: trials.length,
		counted: rewards.length,
		excluded: trials.length - rewards.length,
		errors,
		meanLlmCalls: mean(calls),
		meanOutputTokens: mean(out),
		meanCostUsd: mean(trials.flatMap(t => (t.transcript?.costUsd == null ? [] : [t.transcript.costUsd]))),
	};
}

export function computeFitness(input: FitnessInput): FitnessReport {
	const suiteKeys = [...new Set(input.suiteTasks.map(taskKey))];
	const inSuite = new Set(suiteKeys);
	const byTask = new Map<string, TraceRow[]>();
	const outside = new Set<string>();
	// Out-of-suite trials are diagnosed but excluded from every statistic below.
	const scored: TraceRow[] = [];
	for (const trial of input.trials) {
		const key = taskKey(trial.task);
		if (!inSuite.has(key)) {
			outside.add(key);
			continue;
		}
		scored.push(trial);
		const bucket = byTask.get(key);
		if (bucket) bucket.push(trial);
		else byTask.set(key, [trial]);
	}
	const perTask = [...suiteKeys].sort().map(task => taskFitness(task, byTask.get(task) ?? []));
	const outsideSuiteTasks = [...outside].sort();
	const reasons: string[] = [];
	const missing = suiteKeys.filter(task => !byTask.has(task));
	const wrongCount = perTask
		.filter(t => t.attempts > 0)
		.map(t => ({ task: t.task, terminal: (byTask.get(t.task) ?? []).filter(x => x.status !== "running").length }))
		.filter(t => t.terminal !== input.attempts);
	if (wrongCount.length > 0) {
		reasons.push(
			`tasks with unexpected attempt count (expected ${input.attempts}): ${wrongCount.map(t => `${t.task} has ${t.terminal}`).join(", ")}`,
		);
	}
	if (missing.length > 0) reasons.push(`missing suite tasks: ${missing.join(", ")}`);
	if (outsideSuiteTasks.length > 0) reasons.push(`trials outside suite: ${outsideSuiteTasks.join(", ")}`);
	// Terminal non-model trials are complete cells (surfaced via phaseCounts/refusals); only running trials are not.
	const running = scored.filter(t => t.status === "running").length;
	if (running > 0) reasons.push(`${running} trial(s) still running`);
	const attemptRewards = suiteKeys.map(task =>
		(byTask.get(task) ?? []).flatMap(t => {
			const reward = trialReward(t);
			return reward === null ? [] : [reward];
		}),
	);
	const rewards = perTask.flatMap(t => (t.reward === null ? [] : [t.reward]));
	const vHat = mean(rewards);
	const decided = scored.filter(t => t.status !== "running");
	const startFailures = decided.filter(t => !t.transcript?.started).length;
	const phaseCounts = Object.fromEntries(FAILURE_PHASES.map(p => [p, 0])) as Record<FailurePhase, number>;
	for (const trial of decided) phaseCounts[trialPhase(trial)]++;
	const signalHits: Record<string, number> = {};
	for (const trial of scored) {
		for (const signal of trial.transcript?.signals ?? []) signalHits[signal] = (signalHits[signal] ?? 0) + 1;
	}
	const dataComplete = reasons.length === 0;
	const lossyTranscriptTrials = decided.filter(t => (t.transcript?.droppedLines ?? 0) > 0).length;
	const ineligibility = evaluateEligibility({
		policy: input.policy,
		dataComplete,
		incompleteReasons: reasons,
		nonModelPhases: NON_MODEL_PHASES.filter(phase => phaseCounts[phase] > 0),
		lossyTranscriptTrials,
		pairedTasks: rewards.length,
		attemptsPerTask: input.attempts,
		deltas: rewards,
	});
	const eligible = ineligibility === null;
	return {
		variantId: input.variantId,
		suiteId: input.suiteId,
		jobName: input.jobName,
		outsideSuiteTasks,
		dataComplete,
		incompleteReasons: reasons,
		attemptsPerTask: input.attempts,
		withinTaskVariance: pooledWithinTaskVariance(attemptRewards),
		policy: input.policy,
		decisionEligible: eligible,
		ineligibility,
		vHat,
		...(eligible ? interval(rewards, vHat) : { sd: null, se: null, ci95: null }),
		tasks: perTask.filter(t => t.counted > 0).length,
		trials: scored.length,
		errors: perTask.reduce((acc, t) => acc + t.errors, 0),
		meanLlmCalls: mean(perTask.flatMap(t => (t.meanLlmCalls === null ? [] : [t.meanLlmCalls]))),
		meanOutputTokens: mean(perTask.flatMap(t => (t.meanOutputTokens === null ? [] : [t.meanOutputTokens]))),
		meanCostUsd: mean(perTask.flatMap(t => (t.meanCostUsd === null ? [] : [t.meanCostUsd]))),
		costMissingTrials: decided.filter(t => t.transcript?.costUsd == null).length,
		lossyTranscriptTrials,
		startFailureRate: decided.length === 0 ? null : startFailures / decided.length,
		phaseCounts,
		signalHits,
		perTask,
	};
}
