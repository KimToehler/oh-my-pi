import { ratio, sortedBy, unavailable, unique } from "./report-math";
import type { FindingCounts, TriageCounts, TrialScore } from "./report-types";
import type { Adjudication, AdjudicationKind, Dataset, Finding, Target, Trial, Triage } from "./types";

export interface Index {
	readonly targetsByItem: ReadonlyMap<string, readonly Target[]>;
	readonly findingsByTrial: ReadonlyMap<string, readonly Finding[]>;
	readonly adjudication: ReadonlyMap<string, Adjudication>;
	readonly triage: ReadonlyMap<string, Triage>;
}

function group<T>(rows: readonly T[], key: (row: T) => string): ReadonlyMap<string, readonly T[]> {
	const out = new Map<string, T[]>();
	for (const row of rows) {
		const list = out.get(key(row));
		if (list) list.push(row);
		else out.set(key(row), [row]);
	}
	return out;
}

export function buildIndex(data: Dataset): Index {
	return {
		targetsByItem: group(
			sortedBy(data.targets, t => t.id),
			t => t.item,
		),
		findingsByTrial: group(
			[...data.findings].sort((a, b) => (a.trial < b.trial ? -1 : a.trial > b.trial ? 1 : a.index - b.index)),
			f => f.trial,
		),
		adjudication: new Map(data.adjudications.map(a => [a.finding, a])),
		triage: new Map(data.triage.map(t => [t.finding, t])),
	};
}

type FindingClass = "retained" | "protected" | "undecided" | "pending" | "nonblocking" | "dropped";
// Higher rank wins when several findings match one target.
const RANK: Readonly<Record<FindingClass, number>> = {
	retained: 5,
	protected: 4,
	undecided: 3,
	pending: 2,
	nonblocking: 1,
	dropped: 0,
};

function classify(adj: Adjudication, tri: Triage | undefined): FindingClass {
	if (tri === undefined) return "pending";
	if (tri.protected && (tri.result !== "confirmed" || !tri.blocking)) return "protected";
	switch (tri.result) {
		case "undecided":
			return "undecided";
		case "refuted":
			return "dropped";
		case "confirmed":
			if (tri.blocking) return adj.blocking === "blocking" ? "retained" : "nonblocking";
			return tri.consequence ? "nonblocking" : "pending";
	}
}

const KIND_KEYS: readonly AdjudicationKind[] = [
	"known-target",
	"additional-defect",
	"useful-note",
	"evidence-error",
	"unsupported-consequence",
	"false-claim",
	"severity-error",
	"pending",
];

function countFindings(findings: readonly Finding[], index: Index, itemTargets: ReadonlySet<string>): FindingCounts {
	let valid = 0;
	let invalid = 0;
	let pending = 0;
	const units = new Set<string>();
	const mechanisms = new Set<string>();
	const kinds: { -readonly [K in AdjudicationKind]: number } = Object.fromEntries(KIND_KEYS.map(k => [k, 0])) as {
		-readonly [K in AdjudicationKind]: number;
	};
	for (const f of findings) {
		const adj = index.adjudication.get(f.id);
		kinds[adj?.kind ?? "pending"]++;
		if (adj === undefined || adj.validity === "pending") pending++;
		else if (adj.validity === "invalid") invalid++;
		else {
			valid++;
			const hit = adj.targets.filter(t => itemTargets.has(t));
			if (hit.length > 0) units.add(`t:${[...hit].sort().join(",")}`);
			else if (adj.mechanism !== null) {
				units.add(`m:${adj.mechanism}`);
				mechanisms.add(adj.mechanism);
			} else units.add(`f:${f.id}`);
		}
	}
	return {
		total: findings.length,
		valid,
		invalid,
		pending,
		duplicates: valid - units.size,
		additionalMechanisms: unique(mechanisms),
		kinds,
	};
}

export const EMPTY_COUNTS: TriageCounts = {
	retained: 0,
	protected: 0,
	undecided: 0,
	pending: 0,
	downgraded: 0,
	falseDrop: 0,
	legitimateResidual: 0,
	unresolvedDrop: 0,
};

export function addCounts(a: TriageCounts, b: TriageCounts): TriageCounts {
	return {
		retained: a.retained + b.retained,
		protected: a.protected + b.protected,
		undecided: a.undecided + b.undecided,
		pending: a.pending + b.pending,
		downgraded: a.downgraded + b.downgraded,
		falseDrop: a.falseDrop + b.falseDrop,
		legitimateResidual: a.legitimateResidual + b.legitimateResidual,
		unresolvedDrop: a.unresolvedDrop + b.unresolvedDrop,
	};
}

/** Triage outcome per discovered target; independent valid adjudications only. */
function triageTargets(
	discovered: ReadonlyMap<string, readonly Finding[]>,
	targets: ReadonlyMap<string, Target>,
	index: Index,
) {
	const retained: string[] = [];
	let counts = EMPTY_COUNTS;
	let blockingDiscovered = 0;
	for (const [id, matches] of discovered) {
		const target = targets.get(id);
		if (target === undefined) continue;
		let best: FindingClass = "dropped";
		for (const f of matches) {
			const adj = index.adjudication.get(f.id);
			if (adj === undefined) continue;
			const c = classify(adj, index.triage.get(f.id));
			if (RANK[c] > RANK[best]) best = c;
		}
		if (target.blocking === "blocking") blockingDiscovered++;
		const lost = best === "dropped" || best === "nonblocking";
		const step: Partial<Record<FindingClass, keyof TriageCounts>> = {
			retained: "retained",
			protected: "protected",
			undecided: "undecided",
			pending: "pending",
		};
		const key = step[best];
		const delta: { -readonly [K in keyof TriageCounts]?: number } = {};
		if (key !== undefined) delta[key] = 1;
		if (best === "retained") retained.push(id);
		if (lost) {
			if (target.blocking === "blocking") delta.falseDrop = 1;
			else if (target.blocking === "below-threshold") delta.legitimateResidual = 1;
			else delta.unresolvedDrop = 1;
			if (best === "nonblocking") delta.downgraded = 1;
		}
		counts = addCounts(counts, { ...EMPTY_COUNTS, ...delta });
	}
	return { retained: unique(retained), counts, blockingDiscovered };
}

export function scoreTrial(trial: Trial, index: Index): TrialScore {
	const targetList = index.targetsByItem.get(trial.item) ?? [];
	const targets = new Map(targetList.map(t => [t.id, t]));
	const findings = index.findingsByTrial.get(trial.id) ?? [];
	const discovered = new Map<string, Finding[]>();
	for (const f of findings) {
		const adj = index.adjudication.get(f.id);
		if (adj === undefined || adj.validity !== "valid") continue;
		for (const t of adj.targets) {
			if (!targets.has(t)) continue;
			const list = discovered.get(t);
			if (list) list.push(f);
			else discovered.set(t, [f]);
		}
	}
	const counts = countFindings(findings, index, new Set(targets.keys()));
	const n = targetList.length;
	const noTargets = "item has no frozen targets";
	const base = {
		id: trial.id,
		arm: trial.arm,
		item: trial.item,
		repeat: trial.repeat,
		targetCount: n,
		discovered: unique(discovered.keys()),
		undiscovered: n - discovered.size,
		preRecall: ratio(discovered.size, n, noTargets),
		findings: counts,
		falsePositiveRate: ratio(counts.invalid, counts.invalid + counts.valid, "no independently adjudicated findings"),
	};
	if (trial.triage === "unavailable") {
		const reason = trial.reason ?? "historical triage unavailable; not retained by default";
		return {
			...base,
			retained: null,
			postRecall: unavailable(reason),
			triage: null,
			triageReason: reason,
			falseDropRate: unavailable(reason),
		};
	}
	const t = triageTargets(discovered, targets, index);
	return {
		...base,
		retained: t.retained,
		postRecall: ratio(t.retained.length, n, noTargets),
		triage: t.counts,
		triageReason: null,
		falseDropRate: ratio(t.counts.falseDrop, t.blockingDiscovered, "no discovered independently blocking targets"),
	};
}
