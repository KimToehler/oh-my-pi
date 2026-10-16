/** Matched-condition parent/child comparison with confound guards and signal-gated credit. */
import { EvoHttpError } from "./boundary";
import { type FitnessReport, interval, mean, type Interval } from "./fitness";
import type { VariantRow } from "./variant-types";

/** Run-level identity that must match for a delta to be meaningful. */
export interface ConditionIdentity {
	suiteId: string;
	suiteHash: string;
	model: string;
	executorConfigHash: string;
	sourceRef: string;
	sourceDirtyHash: string | null;
}

export interface Mismatch {
	field: keyof ConditionIdentity;
	child: string | null;
	baseline: string | null;
}

export function conditionMismatches(child: ConditionIdentity, baseline: ConditionIdentity): Mismatch[] {
	const out: Mismatch[] = [];
	for (const field of Object.keys(child) as Array<keyof ConditionIdentity>) {
		if (child[field] !== baseline[field]) out.push({ field, child: child[field], baseline: baseline[field] });
	}
	return out;
}

export function assertMatched(child: ConditionIdentity, baseline: ConditionIdentity): void {
	const mismatches = conditionMismatches(child, baseline);
	if (mismatches.length > 0) {
		throw new EvoHttpError(409, `conditions differ: ${mismatches.map(m => m.field).join(", ")}`, { mismatches });
	}
}

export interface TaskDelta {
	task: string;
	child: number;
	baseline: number;
	delta: number;
}

export interface ComparisonReport extends Interval {
	childVariantId: string;
	baselineVariantId: string;
	suiteId: string;
	sharedTasks: number;
	/** Mean paired delta over shared tasks with complete rewards on both sides. */
	rawDelta: number | null;
	/** Raw delta, with a positive value clamped to 0 unless every expected signal was observed. */
	creditedDelta: number | null;
	wins: number;
	ties: number;
	losses: number;
	missingInChild: string[];
	missingInBaseline: string[];
	complete: boolean;
	expectedSignals: string[];
	observedSignals: string[];
	missingSignals: string[];
	signalsSatisfied: boolean;
	deltas: TaskDelta[];
	callsDelta: number | null;
	outputTokensDelta: number | null;
	costUsdDelta: number;
}

function diff(a: number | null, b: number | null): number | null {
	return a === null || b === null ? null : a - b;
}

export function compareFitness(child: FitnessReport, baseline: FitnessReport, variant: VariantRow): ComparisonReport {
	const base = new Map(baseline.perTask.map(t => [t.task, t]));
	const deltas: TaskDelta[] = [];
	const missingInChild: string[] = [];
	const missingInBaseline: string[] = [];
	for (const task of child.perTask) {
		const other = base.get(task.task);
		if (task.reward === null) missingInChild.push(task.task);
		if (!other || other.reward === null) {
			if (task.reward !== null) missingInBaseline.push(task.task);
			continue;
		}
		if (task.reward === null) continue;
		deltas.push({ task: task.task, child: task.reward, baseline: other.reward, delta: task.reward - other.reward });
	}
	for (const task of baseline.perTask) {
		if (task.reward === null && !missingInChild.includes(task.task)) missingInChild.push(task.task);
	}
	const values = deltas.map(d => d.delta);
	const rawDelta = mean(values);
	const observed = Object.keys(child.signalHits).sort();
	const missingSignals = variant.expectedSignals.filter(signal => !(signal in child.signalHits));
	const signalsSatisfied = missingSignals.length === 0;
	const credited = rawDelta !== null && rawDelta > 0 && !signalsSatisfied ? 0 : rawDelta;
	return {
		childVariantId: child.variantId,
		baselineVariantId: baseline.variantId,
		suiteId: child.suiteId,
		sharedTasks: deltas.length,
		rawDelta,
		creditedDelta: credited,
		...interval(values, rawDelta),
		wins: deltas.filter(d => d.delta > 1e-12).length,
		ties: deltas.filter(d => Math.abs(d.delta) <= 1e-12).length,
		losses: deltas.filter(d => d.delta < -1e-12).length,
		missingInChild: missingInChild.sort(),
		missingInBaseline: missingInBaseline.sort(),
		complete: child.complete && baseline.complete && missingInChild.length === 0 && missingInBaseline.length === 0,
		expectedSignals: variant.expectedSignals,
		observedSignals: observed,
		missingSignals,
		signalsSatisfied,
		deltas,
		callsDelta: diff(child.meanLlmCalls, baseline.meanLlmCalls),
		outputTokensDelta: diff(child.meanOutputTokens, baseline.meanOutputTokens),
		costUsdDelta: child.meanCostUsd - baseline.meanCostUsd,
	};
}
