import { describe, expect, it } from "bun:test";
import { formatMarkdown, scoreDataset } from "./plan-review-replay/report";
import type { Dataset } from "./plan-review-replay/types";
import {
	adj,
	arm,
	attempt,
	empty,
	finding,
	fixture,
	item,
	target,
	tri,
	trial,
} from "./plan-review-replay-report-fixtures";

describe("hand-calculated two-item dataset", () => {
	const summary = scoreDataset(fixture());
	const arm_ = (id: string) => {
		const found = summary.arms.find(a => a.arm === id);
		if (found === undefined) throw new Error(`arm ${id}`);
		return found;
	};
	const trialOf = (id: string) => {
		const found = summary.trials.find(t => t.id === id);
		if (found === undefined) throw new Error(`trial ${id}`);
		return found;
	};

	it("scores each trial independently of repeats", () => {
		expect(trialOf("sA1")).toMatchObject({ discovered: ["a1", "a2"], retained: ["a1"], undiscovered: 2 });
		expect(trialOf("sA1").preRecall.value).toBe(0.5);
		expect(trialOf("sA1").postRecall.value).toBe(0.25);
		expect(trialOf("sA1").falseDropRate).toMatchObject({ numerator: 1, denominator: 2 });
		expect(trialOf("sA1").findings).toMatchObject({
			valid: 4,
			invalid: 1,
			pending: 1,
			duplicates: 1,
			additionalMechanisms: ["m-new"],
		});
		expect(trialOf("sA1").falsePositiveRate).toMatchObject({ numerator: 1, denominator: 5 });
		expect(trialOf("sA2")).toMatchObject({ discovered: ["a3", "a4"], retained: [] });
		expect(trialOf("sA2").triage).toMatchObject({ legitimateResidual: 1, unresolvedDrop: 1, falseDrop: 0 });
		expect(trialOf("sA2").falseDropRate.value).toBeNull();
		expect(trialOf("sB1").triage).toMatchObject({ retained: 1, pending: 1 });
	});

	it("separates repeat union from the trial mean per item", () => {
		const a = summary.items.find(i => i.arm === "S" && i.item === "A");
		expect(a?.trialMeanPre).toMatchObject({ numerator: 2, denominator: 4, value: 0.5 });
		expect(a?.trialMeanPost).toMatchObject({ numerator: 0.5, denominator: 4, value: 0.125 });
		expect(a?.unionPre).toMatchObject({ numerator: 4, denominator: 4, value: 1 });
		expect(a?.unionPost).toMatchObject({ numerator: 1, denominator: 4, value: 0.25 });
		expect(a?.completedTrials).toBe(2);
		expect(a?.unionLabel).toContain("2");
		expect(a?.falseDrop).toMatchObject({ numerator: 1, denominator: 2 });
	});

	it("weights macro by item and micro by target count", () => {
		const s = arm_("S");
		expect(s.macroPre).toMatchObject({ numerator: 1.5, denominator: 2, value: 0.75 });
		expect(s.microPre).toMatchObject({ numerator: 4, denominator: 6 });
		expect(s.microPre.value).toBeCloseTo(4 / 6, 10);
		expect(s.macroPost.value).toBeCloseTo(0.3125, 10);
		expect(s.microPost).toMatchObject({ numerator: 1.5, denominator: 6, value: 0.25 });
		expect(s.microUnionPre).toMatchObject({ numerator: 6, denominator: 6, value: 1 });
		expect(s.microUnionPost).toMatchObject({ numerator: 2, denominator: 6 });
		expect(s.falseDrop).toMatchObject({ numerator: 1, denominator: 4, value: 0.25 });
		expect(s.falsePositive).toMatchObject({ numerator: 1, denominator: 9 });
		expect(s.triage).toMatchObject({
			retained: 2,
			pending: 1,
			falseDrop: 1,
			legitimateResidual: 1,
			unresolvedDrop: 1,
		});
		expect(s).toMatchObject({
			intendedTrials: 4,
			completedTrials: 3,
			excludedTrials: 1,
			pendingFindings: 1,
			additionalMechanisms: 1,
		});
	});

	it("keeps unavailable historical triage null at arm level", () => {
		const h = arm_("H");
		expect(h.microPre).toMatchObject({ numerator: 1, denominator: 4 });
		expect(h.microPost.value).toBeNull();
		expect(h.falseDrop.value).toBeNull();
		expect(h.historical).toBe(true);
		// An arm whose trials carry no triage reports no triage counts at all: zeros would read as measured.
		expect(h.triage).toBeNull();
		expect(arm_("S").triage).toMatchObject({ retained: 2, falseDrop: 1 });
	});

	it("sums costs per stage with exclusions and a lower bound for unknown usage", () => {
		const c = summary.costs;
		expect(c.reviewer).toEqual({ attempts: 4, unknownCost: 1, amount: 4.5 });
		expect(c.verifier).toEqual({ attempts: 1, unknownCost: 0, amount: 0.5 });
		expect(c.adjudicator).toEqual({ attempts: 1, unknownCost: 1, amount: 0 });
		expect(c.unsuccessful).toEqual({ attempts: 1, unknownCost: 0, amount: 2 });
		expect(c.total).toEqual({ attempts: 6, unknownCost: 2, amount: 5 });
		expect(c.totalIsLowerBound).toBe(true);
		expect(c.complete).toBe(false);
	});

	it("uses actual timestamps and leaves missing ones unavailable", () => {
		const t = summary.timing;
		expect(t.attempts.find(a => a.attempt === "a-r1")?.elapsedMs).toBe(60_000);
		expect(t.attempts.find(a => a.attempt === "a-hist")).toMatchObject({ elapsedMs: null });
		expect(t.trialSpans.find(s => s.trial === "sA1")?.span).toMatchObject({ ms: 150_000, complete: true });
		expect(t.trialSpans.find(s => s.trial === "hA1")?.span).toMatchObject({ ms: null, complete: false });
		// envelope 00:00:00..00:04:00, not the sum of 60+90+120+210 s; adjudicator lacks timestamps
		expect(t.experimentWall).toMatchObject({ ms: 240_000, complete: false });
	});

	it("ties trial-span completeness to the verifier stage, not to the attempts that happen to be listed", () => {
		// A reviewer that completed and a verifier that failed afterwards: the trial consumed both, and no
		// verifier outcome exists, so the reviewer-only interval must not be published as the whole trial.
		const rev = attempt("rev", { trial: "t1", dispatched: "2026-01-01T00:00:00Z", terminal: "2026-01-01T00:01:00Z" });
		const spanOf = (over: Partial<Dataset["trials"][number]>, attempts: Dataset["attempts"]) => {
			const data: Dataset = {
				...empty,
				arms: [arm("S")],
				items: [item("A")],
				trials: [trial("t1", "S", "A", { reviewAttempts: ["rev"], ...over })],
				attempts,
			};
			return scoreDataset(data).timing.trialSpans.find(s => s.trial === "t1")?.span;
		};
		const failed = attempt("ver", {
			trial: "t1",
			stage: "verifier",
			status: "failed",
			dispatched: "2026-01-01T00:01:00Z",
			terminal: "2026-01-01T00:03:00Z",
		});
		expect(spanOf({ triage: "unavailable", reason: "verifier failed" }, [rev, failed])).toMatchObject({
			ms: 180_000,
			complete: false,
		});
		// The same failed verifier selected as the trial's verifier attempt: a pointer is not a result.
		expect(
			spanOf({ triage: "unavailable", reason: "verifier failed", verifierAttempt: "ver" }, [rev, failed]),
		).toMatchObject({ ms: 180_000, complete: false });
		// A verifier that was never dispatched leaves the same unfinished stage, with no attempt to point at.
		expect(spanOf({ triage: "unavailable", reason: "verifier not dispatched" }, [rev])).toMatchObject({
			ms: 60_000,
			complete: false,
		});
		// An empty trial makes no verifier call at all, so its reviewer envelope is the whole trial.
		expect(spanOf({ triage: "empty" }, [rev])).toMatchObject({ ms: 60_000, complete: true });
	});

	it("labels confounded comparisons and never claims causality", () => {
		const find = (a: string, b: string) => summary.comparisons.find(c => c.a === a && c.b === b);
		expect(find("S", "T")).toMatchObject({
			changedAxes: ["model", "effort", "sampling"],
			label: "confounded",
			asymmetricRepeats: true,
			attribution: null,
		});
		expect(find("S", "U")).toMatchObject({ changedAxes: ["model"], label: "single-axis", attribution: "model" });
		expect(find("H", "S")).toMatchObject({ label: "confounded", historicalReference: true });
		expect(summary.comparisons.every(c => c.causalClaim === false)).toBe(true);
		expect(summary.comparisons).toHaveLength(6);
	});

	it("keeps recorded rounds as observations and savings not measured", () => {
		expect(summary.rounds.observed.map(r => [r.item, r.lastRound, r.workflowProvenance])).toEqual([
			["A", 3, "recorded"],
			["B", 17, "unknown"],
		]);
		expect(summary.rounds.measuredRoundsSaved).toBe("not-measured");
		expect(summary.rounds.fullCycleSavings).toBe("not-measured");
		expect(summary.rounds.budgets).toBe("counterfactual");
	});

	it("lists excluded trials and failed attempts", () => {
		expect(summary.exclusions.map(e => [e.kind, e.id, e.status])).toEqual([
			["trial", "sB2", "excluded"],
			["attempt", "a-r3", "failed"],
		]);
		expect(summary.targets).toEqual({ total: 6, byBlocking: { blocking: 4, "below-threshold": 1, unresolved: 1 } });
	});

	it("pools blocking discoveries outside the ledger per arm and keeps them out of the target denominators", () => {
		// Given the verifier refutes the one valid blocking mechanism that matches no frozen target.
		const d = fixture();
		const dropped = scoreDataset({
			...d,
			triage: d.triage.map(t => (t.finding === "f4" ? tri("f4", "refuted") : t)),
		});
		const sDropped = dropped.arms.find(a => a.arm === "S");
		expect(sDropped?.additionalBlocking).toMatchObject({ discovered: 1, retained: 0, dropped: 1 });
		expect(sDropped?.additionalBlockingDrop).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
		// The frozen-target figures are unchanged by that loss.
		expect(sDropped?.falseDrop).toEqual(arm_("S").falseDrop);
		expect(sDropped?.microPost).toEqual(arm_("S").microPost);
		// And the retained case is the mirror image.
		expect(arm_("S").additionalBlocking).toMatchObject({ discovered: 1, retained: 1, dropped: 0 });
		expect(arm_("S").additionalBlockingDrop).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
		// A historical arm without triage reports no figure at all: a zero would read as measured.
		expect(arm_("H").additionalBlocking).toBeNull();
		expect(arm_("H").additionalBlockingDrop.value).toBeNull();
		expect(formatMarkdown(summary)).toContain("| H | n/a (triage unavailable) |");
		const md = formatMarkdown(dropped);
		const row = md.split("\n").find(l => l.startsWith("| S |") && l.includes("| 1 | 0 | 0 | 0 | 0 | 1 |"));
		expect(row).toBeDefined();
		expect(md).toContain("## Blocking discoveries outside the frozen ledger");
	});

	it("marks the unsuccessful cost row as a subset of the stage rows", () => {
		const md = formatMarkdown(summary);
		expect(md).toContain("- unsuccessful (subset of the stage rows above, not an additional bucket): 2.0000");
	});

	it("is invariant under row reordering and renders identically", () => {
		const d = fixture();
		const reversed: Dataset = {
			...d,
			arms: [...d.arms].reverse(),
			items: [...d.items].reverse(),
			targets: [...d.targets].reverse(),
			attempts: [...d.attempts].reverse(),
			trials: [...d.trials].reverse(),
			findings: [...d.findings].reverse(),
			adjudications: [...d.adjudications].reverse(),
			triage: [...d.triage].reverse(),
			rounds: [...d.rounds].reverse(),
			targetRepeats: [...d.targetRepeats].reverse(),
		};
		const other = scoreDataset(reversed);
		expect(other).toEqual(summary);
		expect(formatMarkdown(other)).toBe(formatMarkdown(summary));
	});
});

describe("empty and zero-denominator datasets", () => {
	it("yields null aggregates with reasons when nothing completed", () => {
		const data: Dataset = {
			...empty,
			arms: [arm("S")],
			items: [item("C")],
			trials: [trial("c1", "S", "C", { status: "missing" })],
		};
		const s = scoreDataset(data);
		expect(s.arms[0]?.macroPre).toMatchObject({ denominator: 0, value: null });
		expect(s.arms[0]?.macroPre.reason).not.toBeNull();
		expect(s.arms[0]?.missingTrials).toBe(1);
		expect(s.costs.total).toEqual({ attempts: 0, unknownCost: 0, amount: 0 });
		expect(s.timing.experimentWall.ms).toBeNull();
	});

	it("excludes zero-target items from macro and micro", () => {
		const data: Dataset = {
			...empty,
			arms: [arm("S")],
			items: [item("A"), item("C")],
			targets: [target("a1", "A", "blocking")],
			trials: [trial("t1", "S", "A", { triage: "empty" }), trial("t2", "S", "C", { triage: "empty" })],
		};
		const s = scoreDataset(data);
		expect(s.items.find(i => i.item === "C")?.trialMeanPre.value).toBeNull();
		expect(s.arms[0]?.macroPre).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
	});

	it("marks a post-triage figure pooled from a subset with its trial coverage", () => {
		// Given one arm where only one of two completed trials was triaged.
		const data: Dataset = {
			...empty,
			arms: [arm("H", { historical: true })],
			items: [item("A")],
			targets: [target("a1", "A", "blocking"), target("a2", "A", "blocking")],
			trials: [
				trial("h1", "H", "A"),
				trial("h2", "H", "A", { repeat: 2, triage: "unavailable", reason: "historical triage unavailable" }),
			],
			findings: [finding("f1", "h1", 1), finding("f2", "h2", 1)],
			adjudications: [adj("f1", { targets: ["a1"] }), adj("f2", { targets: ["a2"] })],
			triage: [tri("f1", "confirmed")],
		};
		const s = scoreDataset(data);
		const armRow = s.arms[0];
		expect(armRow).toMatchObject({ completedTrials: 2, triagedTrials: 1 });
		expect(s.items[0]).toMatchObject({ completedTrials: 2, triagedTrials: 1 });
		// Then the rendered post cells disclose that one trial carried them, while pre cells do not.
		const md = formatMarkdown(s);
		const armLine = md.split("\n").find(l => l.startsWith("| H |")) ?? "";
		expect(armLine).toContain("(triaged 1/2 trials)");
		expect(armLine.split("|")[3]).not.toContain("triaged");
	});

	it("omits the coverage note when every completed trial was triaged", () => {
		const data: Dataset = {
			...empty,
			arms: [arm("S")],
			items: [item("A")],
			targets: [target("a1", "A", "blocking")],
			trials: [trial("s1", "S", "A")],
			findings: [finding("f1", "s1", 1)],
			adjudications: [adj("f1", { targets: ["a1"] })],
			triage: [tri("f1", "confirmed")],
		};
		const md = formatMarkdown(scoreDataset(data));
		expect(md).not.toContain("triaged");
	});
});

describe("repeated target severity assessments", () => {
	const data = (): Dataset => ({
		...empty,
		arms: [arm("S")],
		items: [item("A")],
		targets: [target("a1", "A", "blocking"), target("a2", "A", "blocking"), target("a3", "A", "below-threshold")],
		trials: [trial("s1", "S", "A", { triage: "empty" })],
		targetRepeats: [
			{ target: "a3", round: "round-2", blocking: "below-threshold", source: "adj2" },
			{ target: "a1", round: "round-2", blocking: "blocking", source: "adj2" },
			{ target: "a2", round: "round-2", blocking: "below-threshold", source: "adj2" },
		],
	});

	it("derives agreement against the authoritative ledger without revising it", () => {
		const s = scoreDataset(data());
		expect(s.targets.byBlocking).toEqual({ blocking: 2, "below-threshold": 1, unresolved: 0 });
		const [round] = s.targetRepeats;
		expect(round).toMatchObject({ round: "round-2", assessed: 3 });
		expect(round?.agreed).toMatchObject({ numerator: 2, denominator: 3 });
		expect(round?.disagreements).toEqual([{ target: "a2", authoritative: "blocking", repeat: "below-threshold" }]);
		expect(round?.byBlocking).toEqual({ blocking: 1, "below-threshold": 2, unresolved: 0 });
	});

	it("keeps a repeat of an unknown target out of the agreement denominator", () => {
		const d = data();
		const s = scoreDataset({
			...d,
			targetRepeats: [
				...d.targetRepeats,
				{ target: "ghost", round: "round-2", blocking: "blocking", source: "adj2" },
			],
		});
		const [round] = s.targetRepeats;
		expect(round).toMatchObject({ assessed: 4, unknownTargets: ["ghost"] });
		expect(round?.agreed).toMatchObject({ numerator: 2, denominator: 3 });
	});

	it("renders each repeat round with its disagreements", () => {
		const md = formatMarkdown(scoreDataset(data()));
		expect(md).toContain("## Target severity repeats");
		expect(md).toContain("a2: blocking -> below-threshold");
	});

	it("escapes a pipe inside a cell so the row keeps its column count", () => {
		// Real target ids are `<item>|<id>`; an unescaped pipe would split the cell.
		const d = data();
		const s = scoreDataset({
			...d,
			targets: [...d.targets, target("A|t9", "A", "blocking")],
			targetRepeats: [
				...d.targetRepeats,
				{ target: "A|t9", round: "round-2", blocking: "below-threshold", source: "adj2" },
			],
		});
		const line = formatMarkdown(s)
			.split("\n")
			.find(l => l.startsWith("| round-2 |"));
		expect(line).toContain("A\\|t9: blocking -> below-threshold");
		expect(line?.split(/(?<!\\)\|/)).toHaveLength(7);
	});
});
