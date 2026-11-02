import { scoreArms, scoreItems } from "./report-aggregate";
import { compareArms, listExclusions, summarizeRounds } from "./report-compare";
import { summarizeCosts, summarizeTiming } from "./report-cost";
import { formatMarkdown } from "./report-format";
import { sortedBy } from "./report-math";
import { buildIndex, scoreTrial } from "./report-trial";
import type { ScoreSummary } from "./report-types";
import type { Dataset } from "./types";

export type { ScoreSummary } from "./report-types";
export { formatMarkdown };

/** Pure, deterministic scoring; output is independent of input row order. */
export function scoreDataset(data: Dataset): ScoreSummary {
	const index = buildIndex(data);
	const trials = sortedBy(data.trials, t => t.id);
	// Only completed trials contribute quality figures; exclusions stay listed with costs.
	const scored = trials.filter(t => t.status === "completed").map(t => scoreTrial(t, index));
	const items = scoreItems(scored);
	return {
		version: 1,
		unit: "first-pass-replay",
		targets: {
			total: data.targets.length,
			byBlocking: {
				blocking: data.targets.filter(t => t.blocking === "blocking").length,
				"below-threshold": data.targets.filter(t => t.blocking === "below-threshold").length,
				unresolved: data.targets.filter(t => t.blocking === "unresolved").length,
			},
		},
		trials: scored,
		items,
		arms: scoreArms(data.arms, trials, scored, items),
		costs: summarizeCosts(data.attempts, trials),
		timing: summarizeTiming(data.attempts, trials),
		comparisons: compareArms(data.arms, items),
		rounds: summarizeRounds(data),
		exclusions: listExclusions(trials, data.attempts),
	};
}
