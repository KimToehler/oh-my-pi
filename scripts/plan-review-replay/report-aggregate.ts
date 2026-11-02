import { cmp, ratio, sortedBy, sum, unavailable, unique } from "./report-math";
import type { AdditionalBlocking, ArmScore, ItemScore, Ratio, TrialScore } from "./report-types";
import { addAdditional, addCounts, EMPTY_ADDITIONAL, EMPTY_COUNTS } from "./report-trial";
import type { Arm, Trial } from "./types";

/** Sum numerators and denominators over ratios that are computable. */
export function pool(ratios: readonly Ratio[], reason: string): Ratio {
	const known = ratios.filter(r => r.value !== null);
	if (known.length === 0) return unavailable(reason);
	return ratio(sum(known.map(r => r.numerator)), sum(known.map(r => r.denominator)), reason);
}

/** Unweighted mean of computable values: numerator = sum of values, denominator = count. */
export function macro(ratios: readonly Ratio[], reason: string): Ratio {
	const values = ratios.flatMap(r => (r.value === null ? [] : [r.value]));
	return ratio(sum(values), values.length, reason);
}

function groupKey(t: TrialScore): string {
	return `${t.arm}\u0000${t.item}`;
}

export function scoreItems(completed: readonly TrialScore[]): readonly ItemScore[] {
	const groups = new Map<string, TrialScore[]>();
	for (const t of completed) {
		const list = groups.get(groupKey(t));
		if (list) list.push(t);
		else groups.set(groupKey(t), [t]);
	}
	const out: ItemScore[] = [];
	for (const trials of groups.values()) {
		const first = trials[0];
		if (first === undefined) continue;
		const n = first.targetCount;
		const noTargets = "item has no frozen targets";
		const withTriage = trials.filter(t => t.retained !== null);
		const meanPre = sum(trials.map(t => t.discovered.length)) / trials.length;
		const post = withTriage.map(t => t.retained?.length ?? 0);
		const unionPre = unique(trials.flatMap(t => t.discovered));
		const unionPost = unique(withTriage.flatMap(t => t.retained ?? []));
		const noPost = "triage unavailable for every completed trial";
		// An arm or item whose trials carry no triage reports no off-ledger figure at all: a zero here
		// would read as "nothing discovered or dropped" for a stage that never ran.
		const withAdditional = trials.flatMap(t => (t.additionalBlocking === null ? [] : [t.additionalBlocking]));
		const additional = withAdditional.length === 0 ? null : withAdditional.reduce(addAdditional, EMPTY_ADDITIONAL);
		out.push({
			arm: first.arm,
			item: first.item,
			targetCount: n,
			completedTrials: trials.length,
			triagedTrials: withTriage.length,
			trialMeanPre: ratio(meanPre, n, noTargets),
			trialMeanPost: withTriage.length === 0 ? unavailable(noPost) : ratio(sum(post) / post.length, n, noTargets),
			unionLabel: `${trials.length}-repeat best-of-repeats coverage`,
			unionPre: ratio(unionPre.length, n, noTargets),
			unionPost: withTriage.length === 0 ? unavailable(noPost) : ratio(unionPost.length, n, noTargets),
			falseDrop: pool(
				trials.flatMap(t => (t.triage === null ? [] : [t.falseDropRate])),
				"no discovered independently blocking targets or triage unavailable",
			),
			additionalBlocking: additional,
			additionalBlockingDrop:
				additional === null
					? unavailable(noPost)
					: ratio(
							additional.dropped,
							additional.discovered,
							"no discovered independently blocking additional mechanisms or triage unavailable",
						),
			additionalMechanisms: unique(trials.flatMap(t => t.findings.additionalMechanisms)),
		});
	}
	return out.sort((a, b) => cmp(a.arm, b.arm) || cmp(a.item, b.item));
}

/** `null` unless at least one item of the arm has a triaged trial; zeros would read as measured. */
function armAdditional(items: readonly ItemScore[]): AdditionalBlocking | null {
	const present = items.flatMap(i => (i.additionalBlocking === null ? [] : [i.additionalBlocking]));
	return present.length === 0 ? null : present.reduce(addAdditional, EMPTY_ADDITIONAL);
}

export function scoreArms(
	arms: readonly Arm[],
	trials: readonly Trial[],
	completed: readonly TrialScore[],
	items: readonly ItemScore[],
): readonly ArmScore[] {
	return sortedBy(arms, a => a.id).map(arm => {
		const mine = trials.filter(t => t.arm === arm.id);
		const done = completed.filter(t => t.arm === arm.id);
		const its = items.filter(i => i.arm === arm.id);
		const none = "no completed trials with a computable denominator";
		const triaged = done.flatMap(t => (t.triage === null ? [] : [t.triage]));
		return {
			arm: arm.id,
			historical: arm.historical,
			intendedTrials: mine.length,
			completedTrials: done.length,
			excludedTrials: mine.filter(t => t.status === "excluded").length,
			missingTrials: mine.filter(t => t.status === "missing").length,
			triagedTrials: triaged.length,
			macroPre: macro(
				its.map(i => i.trialMeanPre),
				none,
			),
			macroPost: macro(
				its.map(i => i.trialMeanPost),
				none,
			),
			microPre: pool(
				its.map(i => i.trialMeanPre),
				none,
			),
			microPost: pool(
				its.map(i => i.trialMeanPost),
				none,
			),
			microUnionPre: pool(
				its.map(i => i.unionPre),
				none,
			),
			microUnionPost: pool(
				its.map(i => i.unionPost),
				none,
			),
			falseDrop: pool(
				done.flatMap(t => (t.triage === null ? [] : [t.falseDropRate])),
				"no discovered independently blocking targets or triage unavailable",
			),
			falsePositive: pool(
				done.map(t => t.falsePositiveRate),
				"no independently adjudicated findings",
			),
			additionalBlocking: armAdditional(its),
			additionalBlockingDrop: pool(
				its.map(i => i.additionalBlockingDrop),
				"no discovered independently blocking additional mechanisms or triage unavailable",
			),
			triage: triaged.reduce(addCounts, EMPTY_COUNTS),
			pendingFindings: sum(done.map(t => t.findings.pending)),
			additionalMechanisms: unique(its.flatMap(i => i.additionalMechanisms.map(m => `${i.item}:${m}`))).length,
		};
	});
}
