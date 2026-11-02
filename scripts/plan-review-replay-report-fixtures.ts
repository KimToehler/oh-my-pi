import { scoreDataset } from "./plan-review-replay/report";
import type {
	Adjudication,
	Arm,
	Attempt,
	Blocking,
	Dataset,
	Finding,
	Item,
	RoundRecord,
	Target,
	Trial,
	Triage,
} from "./plan-review-replay/types";

export const arm = (id: string, over: Partial<Arm> = {}): Arm => ({
	id,
	historical: false,
	model: "sol",
	effort: "high",
	brief: "b1",
	contract: "c1",
	rules: "r1",
	snapshot: "s1",
	triage: "tr1",
	sampling: "x3",
	...over,
});
export const item = (id: string): Item => ({ id, revision: "rev", tree: "tree", snapshot: "snap" });
export const target = (id: string, it: string, blocking: Blocking): Target => ({
	id,
	item: it,
	mechanism: `mech-${id}`,
	blocking,
	evidence: [],
	reason: "r",
});
export const trial = (id: string, a: string, it: string, over: Partial<Trial> = {}): Trial => ({
	id,
	arm: a,
	item: it,
	repeat: 1,
	status: "completed",
	reviewAttempts: [],
	verifierAttempt: null,
	triage: "available",
	reason: null,
	...over,
});
export const finding = (id: string, t: string, index: number): Finding => ({ id, trial: t, index, description: id });
export const adj = (f: string, over: Partial<Adjudication> = {}): Adjudication => {
	const base: Adjudication = {
		finding: f,
		targets: [],
		mechanism: null,
		validity: "valid",
		blocking: "blocking",
		kind: "additional-defect",
		evidence: [],
		reason: "r",
		...over,
	};
	if (over.kind !== undefined) return base;
	const kind =
		base.validity === "pending"
			? "pending"
			: base.validity === "invalid"
				? "false-claim"
				: base.targets.length > 0
					? "known-target"
					: "additional-defect";
	return { ...base, kind };
};
export const tri = (f: string, result: Triage["result"], over: Partial<Triage> = {}): Triage => ({
	finding: f,
	result,
	blocking: result === "confirmed",
	protected: false,
	consequence: true,
	reason: "r",
	...over,
});
export const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({
	id,
	item: "A",
	trial: null,
	stage: "reviewer",
	historical: false,
	status: "completed",
	expectedModel: "sol",
	expectedEffort: "high",
	actualModels: ["sol"],
	actualEfforts: ["high"],
	dispatched: null,
	terminal: null,
	cost: null,
	reason: null,
	provenance: "test",
	...over,
});
export const empty: Dataset = {
	version: 1,
	sources: [],
	arms: [],
	items: [],
	targets: [],
	attempts: [],
	trials: [],
	findings: [],
	adjudications: [],
	triage: [],
	rounds: [],
};

export interface TrialFixture {
	readonly targets: readonly Target[];
	readonly findings: readonly string[];
	readonly adjudications: readonly Adjudication[];
	readonly triage: readonly Triage[];
	readonly trial?: Partial<Trial>;
}

/** One trial scenario; unrelated dataset fields stay fixed. */
export function single(input: TrialFixture) {
	const data: Dataset = {
		...empty,
		arms: [arm("S")],
		items: [item("I")],
		targets: input.targets,
		trials: [trial("t1", "S", "I", input.trial ?? {})],
		findings: input.findings.map((f, i) => finding(f, "t1", i)),
		adjudications: input.adjudications,
		triage: input.triage,
	};
	const [score] = scoreDataset(data).trials;
	if (score === undefined) throw new Error("trial not scored");
	return score;
}

/** Two items of different size, hand-calculated. A: a1,a2 blocking, a3 below, a4 unresolved. B: b1,b2 blocking. */
const T0 = "2026-01-01T00:00:";
export function fixture(): Dataset {
	const targets = [
		target("a1", "A", "blocking"),
		target("a2", "A", "blocking"),
		target("a3", "A", "below-threshold"),
		target("a4", "A", "unresolved"),
		target("b1", "B", "blocking"),
		target("b2", "B", "blocking"),
	];
	const f = (id: string, t: string, i: number) => finding(id, t, i);
	return {
		...empty,
		arms: [
			arm("S"),
			arm("T", { model: "terra", effort: "medium", sampling: "x1" }),
			arm("U", { model: "terra" }),
			arm("H", { historical: true, brief: "old", contract: "old", rules: "old", triage: "none" }),
		],
		items: [item("A"), item("B")],
		targets,
		trials: [
			trial("sA1", "S", "A", { repeat: 1, reviewAttempts: ["a-r1"], verifierAttempt: "a-v1" }),
			trial("sA2", "S", "A", { repeat: 2, reviewAttempts: ["a-r2"] }),
			trial("sB1", "S", "B"),
			trial("sB2", "S", "B", { repeat: 2, status: "excluded", reason: "wrong model" }),
			trial("tA1", "T", "A", { triage: "empty" }),
			trial("hA1", "H", "A", { triage: "unavailable", reviewAttempts: ["a-hist"] }),
		],
		findings: [
			f("f1", "sA1", 0),
			f("f2", "sA1", 1),
			f("f3", "sA1", 2),
			f("f4", "sA1", 3),
			f("f5", "sA1", 4),
			f("f6", "sA1", 5),
			f("f7", "sA2", 0),
			f("f8", "sA2", 1),
			f("f9", "sB1", 0),
			f("f10", "sB1", 1),
			f("h1", "hA1", 0),
		],
		adjudications: [
			adj("f1", { targets: ["a1"] }),
			adj("f2", { targets: ["a1"] }),
			adj("f3", { targets: ["a2"] }),
			adj("f4", { mechanism: "m-new" }),
			adj("f5", { validity: "invalid" }),
			adj("f6", { validity: "pending" }),
			adj("f7", { targets: ["a3"], blocking: "below-threshold" }),
			adj("f8", { targets: ["a4"], blocking: "unresolved" }),
			adj("f9", { targets: ["b1"] }),
			adj("f10", { targets: ["b2"] }),
			adj("h1", { targets: ["a1"] }),
		],
		triage: [
			tri("f1", "refuted"),
			tri("f2", "confirmed"),
			tri("f3", "refuted"),
			tri("f4", "confirmed"),
			tri("f5", "refuted"),
			tri("f7", "refuted"),
			tri("f8", "refuted"),
			tri("f9", "confirmed"),
			tri("f10", "confirmed", { blocking: false, consequence: false }),
		],
		attempts: [
			attempt("a-r1", { trial: "sA1", cost: 1, dispatched: `${T0}00Z`, terminal: "2026-01-01T00:01:00Z" }),
			attempt("a-v1", {
				trial: "sA1",
				stage: "verifier",
				cost: 0.5,
				dispatched: "2026-01-01T00:01:00Z",
				terminal: "2026-01-01T00:02:30Z",
			}),
			attempt("a-r2", {
				trial: "sA2",
				cost: 1.5,
				dispatched: "2026-01-01T00:00:00Z",
				terminal: "2026-01-01T00:02:00Z",
			}),
			attempt("a-r3", {
				trial: "sB2",
				status: "failed",
				cost: 2,
				dispatched: "2026-01-01T00:00:30Z",
				terminal: "2026-01-01T00:04:00Z",
			}),
			attempt("a-adj", { stage: "adjudicator" }),
			attempt("a-hist", { trial: "hA1", historical: true }),
		],
		rounds: [
			{ item: "B", revision: "r2", path: "p2", lastRound: 17, workflow: null } satisfies RoundRecord,
			{ item: "A", revision: "r1", path: "p1", lastRound: 3, workflow: "loop-v2" } satisfies RoundRecord,
		],
	};
}
