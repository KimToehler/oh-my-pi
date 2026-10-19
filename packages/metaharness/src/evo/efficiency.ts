/**
 * Paired efficiency of a child against its baseline: per-task ratio of mean spend, summarised as a geometric mean
 * with a Student-t interval on the log scale. Rewards are not involved, so a suite on which both sides pass every
 * task still yields an efficiency estimate; the reward-variance gate does not apply.
 */
import { type DataGateIneligibility, interval } from "./decision-policy";
import type { FitnessReport, TaskFitness } from "./fitness";

export type EfficiencyIneligibility =
	| DataGateIneligibility
	/** Some terminal trial (either side) carried no transcript cost; only `costUsd` is refused. */
	| { reason: "cost_missing"; trials: number }
	/** Tasks whose mean is missing or zero on either side, so no ratio exists. */
	| { reason: "no_ratio"; tasks: string[] }
	/** Every task has the same ratio: a zero-width interval would claim certainty from no information. */
	| { reason: "no_variance"; pairedTasks: number };

export interface EfficiencyEstimate {
	/** Geometric mean over tasks of child/baseline mean spend; below 1 means the child spent less. */
	ratio: number | null;
	ci95: [number, number] | null;
	ineligibility: EfficiencyIneligibility | null;
}

export interface EfficiencyReport {
	/** Transcript cost (main + delegated). */
	costUsd: EfficiencyEstimate;
	outputTokens: EfficiencyEstimate;
	llmCalls: EfficiencyEstimate;
}

type Metric = "meanCostUsd" | "meanOutputTokens" | "meanLlmCalls";

function refused(ineligibility: EfficiencyIneligibility): EfficiencyEstimate {
	return { ratio: null, ci95: null, ineligibility };
}

/**
 * `gate` is the comparison's data-gate verdict; when it passes, both reports cover exactly the suite's tasks, so
 * the child's task list is the paired set.
 */
function estimate(
	child: ReadonlyMap<string, TaskFitness>,
	baseline: ReadonlyMap<string, TaskFitness>,
	metric: Metric,
): EfficiencyEstimate {
	const logs: number[] = [];
	const noRatio: string[] = [];
	for (const [task, c] of child) {
		const a = c[metric];
		const b = baseline.get(task)?.[metric] ?? null;
		if (a === null || b === null || a <= 0 || b <= 0) noRatio.push(task);
		else logs.push(Math.log(a / b));
	}
	if (noRatio.length > 0) return refused({ reason: "no_ratio", tasks: noRatio });
	const center = logs.reduce((x, y) => x + y, 0) / logs.length;
	const { sd, ci95 } = interval(logs, center);
	if (sd === null || sd === 0 || ci95 === null) return refused({ reason: "no_variance", pairedTasks: logs.length });
	return { ratio: Math.exp(center), ci95: [Math.exp(ci95[0]), Math.exp(ci95[1])], ineligibility: null };
}

export function compareEfficiency(
	child: FitnessReport,
	baseline: FitnessReport,
	gate: DataGateIneligibility | null,
): EfficiencyReport {
	if (gate) return { costUsd: refused(gate), outputTokens: refused(gate), llmCalls: refused(gate) };
	const c = new Map(child.perTask.map(t => [t.task, t]));
	const b = new Map(baseline.perTask.map(t => [t.task, t]));
	const costMissing = child.costMissingTrials + baseline.costMissingTrials;
	return {
		costUsd:
			costMissing > 0 ? refused({ reason: "cost_missing", trials: costMissing }) : estimate(c, b, "meanCostUsd"),
		outputTokens: estimate(c, b, "meanOutputTokens"),
		llmCalls: estimate(c, b, "meanLlmCalls"),
	};
}
