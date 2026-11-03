import { describe, expect, test } from "bun:test";
import { InputError, parseDataset, validateDataset } from "./plan-review-replay/input";
import type { Attempt, Dataset, Trial } from "./plan-review-replay/types";
import { attempt, base, withTrial } from "./plan-review-replay-input-fixtures";

function issuesOf(data: Dataset): readonly string[] {
	try {
		validateDataset(data);
		return [];
	} catch (err) {
		if (err instanceof InputError) return err.issues;
		throw err;
	}
}

function expectIssue(data: Dataset, fragment: string): void {
	expect(issuesOf(data).some(issue => issue.includes(fragment))).toBe(true);
}

describe("parseDataset", () => {
	test("rejects unknown keys and wrong types", () => {
		expect(() => parseDataset({ ...base(), extra: 1 })).toThrow(InputError);
		expect(() => parseDataset({ ...base(), items: [{ id: "i1" }] })).toThrow(InputError);
		expect(() => parseDataset({ ...base(), version: 2 })).toThrow(InputError);
	});
});

describe("validateDataset", () => {
	test("duplicate ids", () => {
		const d = base();
		expectIssue({ ...d, findings: [...d.findings, d.findings[0]] }, "duplicate id f1");
		expectIssue({ ...d, items: [...d.items, d.items[0]] }, "duplicate id i1");
	});

	test("dangling references", () => {
		const d = base();
		expectIssue({ ...d, findings: [{ ...d.findings[0], trial: "nope" }, d.findings[1]] }, "unknown trial nope");
		expectIssue({ ...d, adjudications: [{ ...d.adjudications[0], targets: ["gX"] }] }, "unknown target gX");
		expectIssue({ ...d, triage: [...d.triage, { ...d.triage[0], finding: "fX" }] }, "unknown finding");
		expectIssue({ ...d, trials: [{ ...d.trials[0], reviewAttempts: ["a-rev", "zz"] }] }, "unknown review attempt zz");
		expectIssue({ ...d, targets: [{ ...d.targets[0], item: "iX" }] }, "unknown item iX");
	});

	test("target must belong to the finding's item", () => {
		const d = base();
		const two = {
			...d,
			items: [...d.items, { id: "i2", revision: "r", tree: "t", snapshot: "s" }],
			targets: [...d.targets, { ...d.targets[0], id: "g2", item: "i2" }],
		};
		expectIssue({ ...two, adjudications: [{ ...d.adjudications[0], targets: ["g2"] }] }, "different item");
	});

	test("incomplete verifier indices and non-consecutive findings", () => {
		const d = base();
		expectIssue({ ...d, triage: [d.triage[0]] }, "finding f2: missing triage verdict");
		expectIssue({ ...d, findings: [d.findings[0], { ...d.findings[1], index: 3 }] }, "consecutive from 1");
		expectIssue({ ...d, findings: [d.findings[0], { ...d.findings[1], index: 1 }] }, "consecutive from 1");
	});

	test("zero findings need explicit empty triage and no verifier call", () => {
		const d = base();
		const none = { ...d, findings: [], adjudications: [], triage: [] };
		expectIssue(none, 'requires explicit triage "empty"');
		const empty = {
			...none,
			trials: [{ ...d.trials[0], triage: "empty" as const, verifierAttempt: null }],
			attempts: [d.attempts[0]],
		};
		expect(issuesOf(empty)).toEqual([]);
		expectIssue(
			{ ...empty, trials: [{ ...empty.trials[0], verifierAttempt: "a-ver" }], attempts: d.attempts },
			"no verifier call",
		);
	});

	test("fresh trial with findings keeps triage honest about its verifier", () => {
		const d = base();
		expectIssue(
			{ ...d, trials: [{ ...d.trials[0], triage: "unavailable" }], triage: [] },
			"unavailable triage needs a reason",
		);
		const lost = {
			...d,
			trials: [
				{ ...d.trials[0], triage: "unavailable" as const, verifierAttempt: null, reason: "verifier fell back" },
			],
			attempts: [d.attempts[0], { ...d.attempts[1], status: "excluded" as const, reason: "wrong pin" }],
			triage: [],
		};
		expect(issuesOf(lost)).toEqual([]);
		expectIssue(
			{ ...lost, trials: [{ ...lost.trials[0], verifierAttempt: "a-ver" }], attempts: d.attempts },
			"unavailable triage with a completed verifier attempt",
		);
		expectIssue(
			{ ...d, trials: [{ ...d.trials[0], verifierAttempt: null }], attempts: [d.attempts[0]] },
			"completed verifier attempt",
		);
		expectIssue(
			{ ...d, attempts: [d.attempts[0], { ...d.attempts[1], status: "failed", reason: "x" }] },
			"completed verifier attempt",
		);
	});

	test("wrong pin or effort cannot be completed but excluded attempt retains cost", () => {
		const d = base();
		const wrong = { ...d.attempts[0], actualModels: ["terra"] };
		expectIssue({ ...d, attempts: [wrong, d.attempts[1]] }, "must be failed or excluded");
		expectIssue(
			{ ...d, attempts: [{ ...d.attempts[0], actualEfforts: ["low"] }, d.attempts[1]] },
			"must be failed or excluded",
		);
		const excluded = attempt({
			id: "a-bad",
			stage: "reviewer",
			status: "excluded",
			actualModels: ["terra"],
			reason: "fallback model",
			cost: 0.7,
		});
		const ok = {
			...d,
			attempts: [...d.attempts, excluded],
			trials: [{ ...d.trials[0], reviewAttempts: ["a-rev", "a-bad"] }],
		};
		expect(issuesOf(ok)).toEqual([]);
		expectIssue({ ...ok, attempts: [...d.attempts, { ...excluded, reason: null }] }, "needs a reason");
	});

	test("second eligible fresh reviewer attempt is rejected, historical multi-lens allowed", () => {
		const d = base();
		const extra = attempt({ id: "a-rev2", stage: "reviewer" });
		const two = {
			...d,
			attempts: [...d.attempts, extra],
			trials: [{ ...d.trials[0], reviewAttempts: ["a-rev", "a-rev2"] }],
		};
		expectIssue(two, "2 eligible reviewer attempts");
		const hist = (id: string) =>
			attempt({
				id,
				stage: "reviewer",
				trial: "th",
				historical: true,
				expectedModel: "terra",
				expectedEffort: "medium",
				actualModels: [],
				actualEfforts: [],
				dispatched: null,
				terminal: null,
				cost: null,
			});
		const h = withTrial(
			d,
			{
				id: "th",
				arm: "H",
				item: "i1",
				repeat: 1,
				status: "completed",
				reviewAttempts: ["h1", "h2", "h3"],
				verifierAttempt: null,
				triage: "unavailable",
				reason: null,
			},
			[hist("h1"), hist("h2"), hist("h3")],
		);
		const hf = { id: "fh", trial: "th", index: 1, description: "historical" };
		expect(issuesOf({ ...h, findings: [...d.findings, hf], triage: d.triage })).toEqual([]);
	});

	test("completed trial needs an eligible reviewer", () => {
		const d = base();
		expectIssue(
			{ ...d, attempts: [{ ...d.attempts[0], status: "failed", reason: "boom" }, d.attempts[1]] },
			"no eligible reviewer",
		);
	});

	test("historical unavailable metadata is explicit, fresh omissions are errors", () => {
		const d = base();
		const hist = attempt({
			id: "h1",
			stage: "reviewer",
			trial: "th",
			historical: true,
			expectedModel: "terra",
			expectedEffort: "medium",
			actualModels: [],
			actualEfforts: [],
			dispatched: null,
			terminal: null,
			cost: null,
		});
		const th: Trial = {
			id: "th",
			arm: "H",
			item: "i1",
			repeat: 1,
			status: "completed",
			reviewAttempts: ["h1"],
			verifierAttempt: null,
			triage: "unavailable",
			reason: null,
		};
		const histData = {
			...withTrial(d, th, [hist]),
			findings: [...d.findings, { id: "fh", trial: "th", index: 1, description: "historical" }],
		};
		expect(issuesOf(histData)).toEqual([]);
		expectIssue({ ...histData, attempts: [...d.attempts, { ...hist, provenance: "" }] }, "provenance required");
		const fresh = (over: Partial<Attempt>) => ({ ...d, attempts: [{ ...d.attempts[0], ...over }, d.attempts[1]] });
		expectIssue(fresh({ actualModels: [] }), "lacks actual model/effort");
		expectIssue(fresh({ dispatched: null, terminal: null }), "lacks timestamps");
		expectIssue(fresh({ cost: null }), "lacks usage cost");
	});

	test("timestamps must be valid and ordered", () => {
		const d = base();
		const mod = (over: Partial<Attempt>) => ({ ...d, attempts: [{ ...d.attempts[0], ...over }, d.attempts[1]] });
		expectIssue(mod({ terminal: "2026-11-02T09:00:00Z" }), "terminal precedes dispatched");
		expectIssue(mod({ dispatched: "yesterday" }), "invalid dispatched timestamp");
		expectIssue(mod({ dispatched: null }), "terminal timestamp without dispatched");
	});

	test("valid matches need mechanism and snapshot evidence; pending/invalid cannot match", () => {
		const d = base();
		const adj = d.adjudications[0];
		expectIssue({ ...d, adjudications: [{ ...adj, evidence: [] }] }, "snapshot evidence");
		expectIssue({ ...d, adjudications: [{ ...adj, mechanism: null }] }, "needs a mechanism");
		expectIssue({ ...d, adjudications: [{ ...adj, validity: "pending" }] }, "cannot match targets");
	});

	test("kind agrees with validity and target matches", () => {
		const d = base();
		const adj = d.adjudications[0];
		expectIssue({ ...d, adjudications: [{ ...adj, kind: "additional-defect" }] }, "additional-defect cannot match");
		expectIssue(
			{ ...d, adjudications: [{ ...adj, targets: [], kind: "known-target" }] },
			"known-target needs a matched target",
		);
		expectIssue(
			{ ...d, adjudications: [{ ...adj, targets: [], validity: "invalid", kind: "additional-defect" }] },
			"invalid finding cannot be additional-defect",
		);
		expectIssue(
			{ ...d, adjudications: [{ ...adj, validity: "pending", targets: [], kind: "false-claim" }] },
			"pending finding needs kind pending",
		);
		expect(issuesOf({ ...d, adjudications: [{ ...adj, targets: [], kind: "additional-defect" }] })).toEqual([]);
	});

	test("annotated rows need evidence and belong to historical reference trials only", () => {
		const d = base();
		const adj = d.adjudications[0];
		// The base trial belongs to the fresh arm S, so an annotated row there is a silent recall gift.
		expectIssue(
			{ ...d, adjudications: [{ ...adj, validity: "annotated" }] },
			"annotated validity is only for historical reference trials",
		);
		const historical = {
			...d,
			trials: [{ ...d.trials[0], arm: "H", triage: "unavailable" as const, reason: "historical" }],
			triage: [],
			adjudications: [{ ...adj, validity: "annotated" as const }],
		};
		// The same row on a historical reference trial is legitimate (attempt-pin issues of the fixture aside).
		expect(issuesOf(historical).filter(i => i.includes("annotated"))).toEqual([]);
		expectIssue(
			{ ...historical, adjudications: [{ ...adj, validity: "annotated" as const, evidence: [] }] },
			"annotated match needs snapshot evidence",
		);
	});

	test("repeated target assessments are unique per round and carry a source", () => {
		const d = base();
		const repeat = { target: "g1", round: "round-2", blocking: "blocking" as const, source: "adj2" };
		expect(issuesOf({ ...d, targetRepeats: [repeat] })).toEqual([]);
		expectIssue({ ...d, targetRepeats: [repeat, repeat] }, "duplicate assessment in round round-2");
		expectIssue({ ...d, targetRepeats: [{ ...repeat, source: " " }] }, "source required");
	});

	test("triage blocking requires a confirmed result; non-available trials carry no triage rows", () => {
		const d = base();
		expectIssue(
			{ ...d, triage: [{ ...d.triage[0], result: "undecided" }, d.triage[1]] },
			"blocking requires a confirmed",
		);
		expectIssue(
			{ ...d, trials: [{ ...d.trials[0], status: "excluded", reason: "wrong pin", triage: "unavailable" }] },
			"is not available",
		);
	});

	test("missing and excluded trials need reasons; repeats stay visible and consecutive", () => {
		const d = base();
		const missing: Trial = {
			id: "t2",
			arm: "S",
			item: "i1",
			repeat: 2,
			status: "missing",
			reviewAttempts: [],
			verifierAttempt: null,
			triage: "unavailable",
			reason: "budget",
		};
		expect(issuesOf(withTrial(d, missing))).toEqual([]);
		expectIssue(withTrial(d, { ...missing, reason: null }), "needs a reason");
		expectIssue(withTrial(d, { ...missing, repeat: 3 }), "consecutive from 1");
	});

	test("attempt membership must agree with trial", () => {
		const d = base();
		expectIssue({ ...d, trials: [{ ...d.trials[0], reviewAttempts: [] }] }, "not listed in trial t1 reviewAttempts");
		expectIssue({ ...d, attempts: [{ ...d.attempts[0], item: "iZ" }, d.attempts[1]] }, "unknown item iZ");
		expectIssue({ ...d, attempts: [{ ...d.attempts[0], trial: null }, d.attempts[1]] }, "requires a trial");
	});
});
