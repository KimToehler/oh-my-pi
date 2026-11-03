import { cmp, ratio, sortedBy } from "./report-math";
import type {
	ChangedAxis,
	Comparison,
	Exclusion,
	ItemScore,
	RoundsSummary,
	TargetRepeatDisagreement,
	TargetRepeatRound,
} from "./report-types";
import type { Arm, Attempt, Blocking, Dataset, Trial } from "./types";

const AXES: readonly { readonly axis: ChangedAxis; readonly read: (arm: Arm) => string }[] = [
	{ axis: "model", read: a => a.model },
	{ axis: "effort", read: a => a.effort },
	{ axis: "brief", read: a => a.brief },
	{ axis: "contract", read: a => a.contract },
	{ axis: "rules", read: a => a.rules },
	{ axis: "snapshot", read: a => a.snapshot },
	{ axis: "triage", read: a => a.triage },
	{ axis: "sampling", read: a => a.sampling },
];

function completedPerItem(items: readonly ItemScore[], arm: string): ReadonlyMap<string, number> {
	return new Map(items.filter(i => i.arm === arm).map(i => [i.item, i.completedTrials]));
}

function asymmetric(items: readonly ItemScore[], a: string, b: string): boolean {
	const left = completedPerItem(items, a);
	const right = completedPerItem(items, b);
	for (const key of new Set([...left.keys(), ...right.keys()])) {
		if ((left.get(key) ?? 0) !== (right.get(key) ?? 0)) return true;
	}
	return false;
}

/** Every arm pair, listing changed axes; a comparison is never labelled loop-only or causal. */
export function compareArms(arms: readonly Arm[], items: readonly ItemScore[]): readonly Comparison[] {
	const sorted = sortedBy(arms, a => a.id);
	const out: Comparison[] = [];
	for (let i = 0; i < sorted.length; i++) {
		for (let j = i + 1; j < sorted.length; j++) {
			const a = sorted[i];
			const b = sorted[j];
			if (a === undefined || b === undefined) continue;
			const changed = AXES.filter(x => x.read(a) !== x.read(b)).map(x => x.axis);
			const only = changed.length === 1 ? (changed[0] ?? null) : null;
			out.push({
				a: a.id,
				b: b.id,
				changedAxes: changed,
				label: changed.length === 0 ? "no-binding-change" : changed.length === 1 ? "single-axis" : "confounded",
				historicalReference: a.historical || b.historical,
				asymmetricRepeats: asymmetric(items, a.id, b.id),
				causalClaim: false,
				attribution: only,
			});
		}
	}
	return out;
}

export function summarizeRounds(data: Dataset): RoundsSummary {
	const rows = [...data.rounds].sort(
		(x, y) => cmp(x.item, y.item) || cmp(x.revision, y.revision) || cmp(x.path, y.path),
	);
	return {
		observed: rows.map(r => ({
			...r,
			workflowProvenance: r.workflow === null ? ("unknown" as const) : ("recorded" as const),
		})),
		measuredRoundsSaved: "not-measured",
		fullCycleSavings: "not-measured",
		budgets: "counterfactual",
	};
}

/**
 * Agreement of each repeated target-assessment round with the authoritative ledger.
 * A repeat never changes a target's severity; it only measures how reproducible that severity is.
 */
export function summarizeTargetRepeats(data: Dataset): readonly TargetRepeatRound[] {
	const severity = new Map(data.targets.map(t => [t.id, t.blocking]));
	const rounds = new Map<
		string,
		{
			assessed: number;
			agreed: number;
			dis: TargetRepeatDisagreement[];
			unknown: string[];
			by: Record<Blocking, number>;
		}
	>();
	for (const row of sortedBy(data.targetRepeats, r => `${r.round}\u0000${r.target}`)) {
		let bucket = rounds.get(row.round);
		if (bucket === undefined) {
			bucket = {
				assessed: 0,
				agreed: 0,
				dis: [],
				unknown: [],
				by: { blocking: 0, "below-threshold": 0, unresolved: 0 },
			};
			rounds.set(row.round, bucket);
		}
		bucket.assessed++;
		bucket.by[row.blocking]++;
		const authoritative = severity.get(row.target);
		if (authoritative === undefined) {
			bucket.unknown.push(row.target);
			continue;
		}
		if (authoritative === row.blocking) bucket.agreed++;
		else bucket.dis.push({ target: row.target, authoritative, repeat: row.blocking });
	}
	return [...rounds.entries()]
		.sort(([x], [y]) => cmp(x, y))
		.map(([round, b]) => ({
			round,
			assessed: b.assessed,
			agreed: ratio(b.agreed, b.assessed - b.unknown.length, "no repeated assessment of a known target"),
			disagreements: b.dis,
			unknownTargets: b.unknown,
			byBlocking: b.by,
		}));
}

export function listExclusions(trials: readonly Trial[], attempts: readonly Attempt[]): readonly Exclusion[] {
	const t: Exclusion[] = trials
		.filter(x => x.status !== "completed")
		.map(x => ({ kind: "trial" as const, id: x.id, status: x.status, reason: x.reason }));
	const a: Exclusion[] = attempts
		.filter(x => x.status !== "completed")
		.map(x => ({ kind: "attempt" as const, id: x.id, status: x.status, reason: x.reason }));
	return [...sortedBy(t, e => e.id), ...sortedBy(a, e => e.id)];
}
