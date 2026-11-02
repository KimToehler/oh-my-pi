import { ratio, sortedBy, unavailable, unique } from "./report-math";
import type { AdditionalBlocking, FindingCounts, TriageCounts, TrialScore } from "./report-types";
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

type FindingClass = "retained" | "survived" | "protected" | "undecided" | "pending" | "nonblocking" | "dropped";
// Higher rank wins when several findings match one target.
const RANK: Readonly<Record<FindingClass, number>> = {
	retained: 6,
	survived: 5,
	protected: 4,
	undecided: 3,
	pending: 2,
	nonblocking: 1,
	dropped: 0,
};

/**
 * The contract's retained automatic blocker needs all three: an independently blocking finding, an
 * independently blocking target, and a verifier that confirmed the finding as blocking. The verifier's
 * own `confirmed-but-nonblocking` call is the only downgrade, so a match it confirmed as blocking
 * survives even when the adjudicator rated that finding lower - it is then `survived`, never a loss.
 */
function classify(adj: Adjudication, tri: Triage | undefined): FindingClass {
	if (tri === undefined) return "pending";
	if (tri.protected && (tri.result !== "confirmed" || !tri.blocking)) return "protected";
	switch (tri.result) {
		case "undecided":
			return "undecided";
		case "refuted":
			return "dropped";
		case "confirmed":
			if (tri.blocking) return adj.blocking === "blocking" ? "retained" : "survived";
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
	let annotated = 0;
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
		else if (adj.validity === "annotated") annotated++;
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
		annotated,
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
	survivingNonBlocker: 0,
	downgraded: 0,
	falseDrop: 0,
	legitimateResidual: 0,
	unstatedResidual: 0,
	unresolvedDrop: 0,
};

export function addCounts(a: TriageCounts, b: TriageCounts): TriageCounts {
	return {
		retained: a.retained + b.retained,
		protected: a.protected + b.protected,
		undecided: a.undecided + b.undecided,
		pending: a.pending + b.pending,
		survivingNonBlocker: a.survivingNonBlocker + b.survivingNonBlocker,
		downgraded: a.downgraded + b.downgraded,
		falseDrop: a.falseDrop + b.falseDrop,
		legitimateResidual: a.legitimateResidual + b.legitimateResidual,
		unstatedResidual: a.unstatedResidual + b.unstatedResidual,
		unresolvedDrop: a.unresolvedDrop + b.unresolvedDrop,
	};
}

/**
 * Triage outcome per discovered target; independent valid adjudications only. Retention needs the
 * target's own severity on top of a match that qualifies as a retained automatic blocker; a match
 * that merely survived triage is neither retention nor a loss.
 */
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
		const blockingTarget = target.blocking === "blocking";
		if (blockingTarget) blockingDiscovered++;
		const lost = best === "dropped" || best === "nonblocking";
		const step: Partial<Record<FindingClass, keyof TriageCounts>> = {
			retained: "retained",
			protected: "protected",
			undecided: "undecided",
			pending: "pending",
		};
		const retainable = best === "retained" && blockingTarget;
		const key = retainable
			? "retained"
			: best === "retained" || best === "survived"
				? "survivingNonBlocker"
				: step[best];
		const delta: { -readonly [K in keyof TriageCounts]?: number } = {};
		if (key !== undefined) delta[key] = 1;
		if (retainable) retained.push(id);
		if (lost) {
			// The contract calls a loss legitimate only with below-threshold severity *and* a concrete
			// stated consequence; a loss nobody justified is counted, never relabelled as justified.
			const stated = matches.some(f => index.triage.get(f.id)?.consequence === true);
			if (blockingTarget) delta.falseDrop = 1;
			else if (target.blocking !== "below-threshold") delta.unresolvedDrop = 1;
			else if (stated) delta.legitimateResidual = 1;
			else delta.unstatedResidual = 1;
			if (best === "nonblocking") delta.downgraded = 1;
		}
		counts = addCounts(counts, { ...EMPTY_COUNTS, ...delta });
	}
	return { retained: unique(retained), counts, blockingDiscovered };
}

export const EMPTY_ADDITIONAL: AdditionalBlocking = {
	discovered: 0,
	retained: 0,
	protected: 0,
	undecided: 0,
	pending: 0,
	dropped: 0,
};

export function addAdditional(a: AdditionalBlocking, b: AdditionalBlocking): AdditionalBlocking {
	return {
		discovered: a.discovered + b.discovered,
		retained: a.retained + b.retained,
		protected: a.protected + b.protected,
		undecided: a.undecided + b.undecided,
		pending: a.pending + b.pending,
		dropped: a.dropped + b.dropped,
	};
}

/**
 * Triage outcome of independently blocking discoveries outside the frozen ledger, deduplicated by
 * mechanism so repeated wordings of one defect count once, as they do for target matches.
 */
function triageAdditional(
	findings: readonly Finding[],
	itemTargets: ReadonlySet<string>,
	index: Index,
): AdditionalBlocking {
	const best = new Map<string, FindingClass>();
	for (const f of findings) {
		const adj = index.adjudication.get(f.id);
		if (adj === undefined || adj.validity !== "valid" || adj.blocking !== "blocking") continue;
		if (adj.targets.some(t => itemTargets.has(t))) continue;
		const unit = adj.mechanism === null ? `f:${f.id}` : `m:${adj.mechanism}`;
		// `adj.blocking` is `blocking` here, so `classify` can only return `retained`, never `survived`.
		const c = classify(adj, index.triage.get(f.id));
		const prev = best.get(unit);
		if (prev === undefined || RANK[c] > RANK[prev]) best.set(unit, c);
	}
	let out = { ...EMPTY_ADDITIONAL, discovered: best.size };
	for (const c of best.values()) {
		if (c === "retained") out = { ...out, retained: out.retained + 1 };
		else if (c === "protected") out = { ...out, protected: out.protected + 1 };
		else if (c === "undecided") out = { ...out, undecided: out.undecided + 1 };
		else if (c === "pending") out = { ...out, pending: out.pending + 1 };
		else out = { ...out, dropped: out.dropped + 1 };
	}
	return out;
}

export function scoreTrial(trial: Trial, index: Index): TrialScore {
	const targetList = index.targetsByItem.get(trial.item) ?? [];
	const targets = new Map(targetList.map(t => [t.id, t]));
	const findings = index.findingsByTrial.get(trial.id) ?? [];
	const discovered = new Map<string, Finding[]>();
	for (const f of findings) {
		const adj = index.adjudication.get(f.id);
		// `annotated` rows are descriptive historical labels, never independently judged: they
		// establish the historical reference coverage but no precision claim (see falsePositiveRate).
		if (adj === undefined || (adj.validity !== "valid" && adj.validity !== "annotated")) continue;
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
			additionalBlocking: null,
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
		additionalBlocking: triageAdditional(findings, new Set(targets.keys()), index),
	};
}
