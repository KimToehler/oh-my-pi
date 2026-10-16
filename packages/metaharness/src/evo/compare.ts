/** Matched-condition parent/child comparison with confound guards and signal-gated credit. */
import { EvoHttpError } from "./boundary";
import type { FailurePhase } from "./failure-phase";
import { type FitnessReport, interval, mean, type Interval } from "./fitness";
import type { VariantRow } from "./variant-types";

/** Run-level identity that must match for a delta to be meaningful. */
export interface ConditionIdentity {
	suiteId: string;
	suiteHash: string;
	/** Identity of the evaluated task bytes; parent and child must have run the same bytes. */
	taskHash: string;
	model: string;
	executorConfigHash: string;
	modelsYamlHash: string;
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

/** Why a comparison is non-decisionable: terminal trials whose outcome is not a model outcome. */
export interface Refusal {
	reason: Exclude<FailurePhase, "model_outcome">;
	count: number;
}

export interface ComparisonReport extends Interval {
	childVariantId: string;
	baselineVariantId: string;
	suiteId: string;
	sharedTasks: number;
	/** Mean paired delta over shared tasks with complete rewards on both sides. */
	rawDelta: number | null;
	/**
	 * Raw delta, with a positive value clamped to 0 unless every expected signal was observed.
	 * `null` whenever the comparison is incomplete: a partial task set never yields a decision value.
	 */
	creditedDelta: number | null;
	/** Task counts over shared tasks; `null` when the comparison is incomplete. */
	wins: number | null;
	ties: number | null;
	losses: number | null;
	missingInChild: string[];
	missingInBaseline: string[];
	complete: boolean;
	/** Non-model trial counts (both sides) that make the comparison non-decisionable; empty when none. */
	refusals: Refusal[];
	expectedSignals: string[];
	observedSignals: string[];
	missingSignals: string[];
	signalsSatisfied: boolean;
	deltas: TaskDelta[];
	callsDelta: number | null;
	outputTokensDelta: number | null;
	costUsdDelta: number | null;
}

function diff(a: number | null, b: number | null): number | null {
	return a === null || b === null ? null : a - b;
}

const REFUSAL_PHASES = ["variant_startup_failure", "executor_infra_failure", "unknown"] as const;

function refusalsOf(child: FitnessReport, baseline: FitnessReport): Refusal[] {
	return REFUSAL_PHASES.map(reason => ({
		reason,
		count: child.phaseCounts[reason] + baseline.phaseCounts[reason],
	})).filter(r => r.count > 0);
}

export function compareFitness(child: FitnessReport, baseline: FitnessReport, variant: VariantRow): ComparisonReport {
	const childTasks = new Map(child.perTask.map(t => [t.task, t.reward]));
	const baseTasks = new Map(baseline.perTask.map(t => [t.task, t.reward]));
	const deltas: TaskDelta[] = [];
	const missingInChild = new Set<string>();
	const missingInBaseline = new Set<string>();
	for (const task of [...new Set([...childTasks.keys(), ...baseTasks.keys()])].sort()) {
		const c = childTasks.get(task) ?? null;
		const b = baseTasks.get(task) ?? null;
		if (c !== null && b !== null) {
			deltas.push({ task, child: c, baseline: b, delta: c - b });
			continue;
		}
		// Each side is blamed only for its own absence; a task absent on both sides is listed on both.
		if (c === null) missingInChild.add(task);
		if (b === null) missingInBaseline.add(task);
	}
	const values = deltas.map(d => d.delta);
	const rawDelta = mean(values);
	const observed = Object.keys(child.signalHits).sort();
	const missingSignals = variant.expectedSignals.filter(signal => !(signal in child.signalHits));
	const signalsSatisfied = missingSignals.length === 0;
	const refusals = refusalsOf(child, baseline);
	const complete =
		refusals.length === 0 &&
		child.complete &&
		baseline.complete &&
		missingInChild.size === 0 &&
		missingInBaseline.size === 0;
	// Shared-task view stays as a diagnostic (`rawDelta`, `deltas`); every decision-valued field needs a complete task set.
	const credited = !complete ? null : rawDelta !== null && rawDelta > 0 && !signalsSatisfied ? 0 : rawDelta;
	return {
		childVariantId: child.variantId,
		baselineVariantId: baseline.variantId,
		suiteId: child.suiteId,
		sharedTasks: deltas.length,
		rawDelta,
		creditedDelta: credited,
		...(complete ? interval(values, rawDelta) : { sd: null, se: null, ci95: null }),
		wins: complete ? deltas.filter(d => d.delta > 1e-12).length : null,
		ties: complete ? deltas.filter(d => Math.abs(d.delta) <= 1e-12).length : null,
		losses: complete ? deltas.filter(d => d.delta < -1e-12).length : null,
		missingInChild: [...missingInChild],
		missingInBaseline: [...missingInBaseline],
		complete,
		refusals,
		expectedSignals: variant.expectedSignals,
		observedSignals: observed,
		missingSignals,
		signalsSatisfied,
		deltas,
		callsDelta: complete ? diff(child.meanLlmCalls, baseline.meanLlmCalls) : null,
		outputTokensDelta: complete ? diff(child.meanOutputTokens, baseline.meanOutputTokens) : null,
		costUsdDelta: complete ? child.meanCostUsd - baseline.meanCostUsd : null,
	};
}
