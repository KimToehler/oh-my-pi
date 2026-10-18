/** Decision policy: when a paired comparison may be read as a selection decision, and its interval. */
import type { FailurePhase } from "./failure-phase";

/** Pre-declared at suite registration, hashed into suite identity; never chosen at read time. */
export interface DecisionPolicy {
	/** Minimum paired tasks (>= 2: a single task has no variance to state an interval). */
	minPairedTasks: number;
	/** Minimum counted model-outcome attempts on every task, on both sides. */
	minAttemptsPerTask: number;
}

export interface Interval {
	sd: number | null;
	se: number | null;
	ci95: [number, number] | null;
}

/** Why a comparison is not decision-eligible. Decision-valued fields are null whenever one is present. */
export type Ineligibility =
	| { reason: "incomplete"; reasons: string[] }
	| { reason: "non_model_phase"; phases: Array<Exclude<FailurePhase, "model_outcome">> }
	| { reason: "lossy_transcript"; trials: number }
	| {
			reason: "underpowered";
			pairedTasks: number;
			minPairedTasks: number;
			attemptsPerTask: number;
			minAttemptsPerTask: number;
	  }
	| { reason: "no_variance"; pairedTasks: number };

/** Phases that make a trial non-decisionable, in the order refusals are reported. */
export const NON_MODEL_PHASES = [
	"variant_startup_failure",
	"executor_infra_failure",
	"unknown",
] as const satisfies ReadonlyArray<Exclude<FailurePhase, "model_outcome">>;

/** Two-sided 95% Student-t critical values, df 1..30. */
const T_95 = [
	12.7062, 4.3027, 3.1824, 2.7764, 2.5706, 2.4469, 2.3646, 2.306, 2.2622, 2.2281, 2.201, 2.1788, 2.1604, 2.1448,
	2.1314, 2.1199, 2.1098, 2.1009, 2.093, 2.086, 2.0796, 2.0739, 2.0687, 2.0639, 2.0595, 2.0555, 2.0518, 2.0484, 2.0452,
	2.0423,
];

/** Two-sided 95% Student-t critical value; df > 30 uses the Cornish-Fisher expansion around z = 1.96. */
export function tCritical95(df: number): number {
	if (!Number.isInteger(df) || df < 1) throw new RangeError(`tCritical95: df must be a positive integer, got ${df}`);
	const known = T_95[df - 1];
	if (known !== undefined) return known;
	const z = 1.959963984540054;
	return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2);
}

/**
 * Student-t interval for the mean of `values`, df = n - 1. Assumes the values are an exchangeable sample of
 * task-level quantities whose mean is approximately normal; with n < 2 there is no variance, so no interval.
 */
export function interval(values: readonly number[], center: number | null): Interval {
	if (values.length < 2 || center === null) return { sd: null, se: null, ci95: null };
	const variance = values.reduce((acc, v) => acc + (v - center) ** 2, 0) / (values.length - 1);
	const sd = Math.sqrt(variance);
	const se = sd / Math.sqrt(values.length);
	const half = tCritical95(values.length - 1) * se;
	return { sd, se, ci95: [center - half, center + half] };
}

/** Pooled sample variance of attempt rewards around each task's own mean; null when no task has 2+ attempts. */
export function pooledWithinTaskVariance(attemptRewards: ReadonlyArray<readonly number[]>): number | null {
	let ss = 0;
	let df = 0;
	for (const rewards of attemptRewards) {
		if (rewards.length < 2) continue;
		const m = rewards.reduce((a, b) => a + b, 0) / rewards.length;
		ss += rewards.reduce((acc, r) => acc + (r - m) ** 2, 0);
		df += rewards.length - 1;
	}
	return df === 0 ? null : ss / df;
}

export interface EligibilityInput {
	policy: DecisionPolicy;
	dataComplete: boolean;
	incompleteReasons: string[];
	nonModelPhases: Array<Exclude<FailurePhase, "model_outcome">>;
	/** Terminal trials (both sides) whose transcript parse dropped at least one line. */
	lossyTranscriptTrials: number;
	pairedTasks: number;
	attemptsPerTask: number;
	/** Paired per-task deltas over which the interval is stated. */
	deltas: readonly number[];
}

/**
 * First failing gate wins: data completeness, then provenance (R50), then transcript completeness (any dropped line), then declared power, then variance.
 * Zero spread across paired deltas gives a zero-width interval that would claim certainty from no
 * information, so it is ineligible rather than silently narrow. Zero WITHIN-task variance does not block:
 * the interval is over task-level deltas, so between-task spread still carries it; the operator sees
 * `withinTaskVariance` on the fitness report.
 */
export function evaluateEligibility(input: EligibilityInput): Ineligibility | null {
	if (!input.dataComplete) return { reason: "incomplete", reasons: input.incompleteReasons };
	if (input.nonModelPhases.length > 0) return { reason: "non_model_phase", phases: input.nonModelPhases };
	// Any dropped line means call/token totals undercount; there is no pre-declared tolerated fraction, so none is read.
	if (input.lossyTranscriptTrials > 0) return { reason: "lossy_transcript", trials: input.lossyTranscriptTrials };
	const { policy, pairedTasks, attemptsPerTask } = input;
	// A single paired task has no variance, so the effective floor is 2 whatever the suite declared.
	const minPairedTasks = Math.max(policy.minPairedTasks, 2);
	if (pairedTasks < minPairedTasks || attemptsPerTask < policy.minAttemptsPerTask) {
		return {
			reason: "underpowered",
			pairedTasks,
			minPairedTasks,
			attemptsPerTask,
			minAttemptsPerTask: policy.minAttemptsPerTask,
		};
	}
	const { sd } = interval(input.deltas, input.deltas.reduce((a, b) => a + b, 0) / Math.max(input.deltas.length, 1));
	if (sd === null || sd === 0) return { reason: "no_variance", pairedTasks };
	return null;
}
