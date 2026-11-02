import { describe, expect, it } from "bun:test";
import { adj, single, target, tri } from "./plan-review-replay-report-fixtures";

describe("trial triage semantics", () => {
	it("keeps recall and avoids a false drop when a duplicate finding survives", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1", "f2"],
			adjudications: [adj("f1", { targets: ["x"] }), adj("f2", { targets: ["x"] })],
			triage: [tri("f1", "refuted"), tri("f2", "confirmed")],
		});
		expect(s.preRecall).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
		expect(s.postRecall).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
		expect(s.triage?.falseDrop).toBe(0);
		expect(s.findings.duplicates).toBe(1);
		expect(s.falseDropRate).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
	});

	it("counts one false drop when every match is refuted", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1", "f2"],
			adjudications: [adj("f1", { targets: ["x"] }), adj("f2", { targets: ["x"] })],
			triage: [tri("f1", "refuted"), tri("f2", "refuted")],
		});
		expect(s.triage).toMatchObject({ falseDrop: 1, retained: 0 });
		expect(s.falseDropRate).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
	});

	it("reports protected, undecided and pending separately from false drops", () => {
		const s = single({
			targets: [target("x", "I", "blocking"), target("y", "I", "blocking"), target("z", "I", "blocking")],
			findings: ["fx", "fy", "fz"],
			adjudications: [adj("fx", { targets: ["x"] }), adj("fy", { targets: ["y"] }), adj("fz", { targets: ["z"] })],
			triage: [tri("fx", "refuted", { protected: true }), tri("fy", "undecided")],
		});
		expect(s.triage).toMatchObject({ protected: 1, undecided: 1, pending: 1, falseDrop: 0, retained: 0 });
		expect(s.falseDropRate).toMatchObject({ numerator: 0, denominator: 3, value: 0 });
	});

	it("keeps protected confirmed downgrades pending instead of reporting a false drop", () => {
		// Given an independently blocking discovery on a protected path.
		// When the verifier confirms the claim but downgrades its severity.
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["x"] })],
			triage: [tri("f1", "confirmed", { blocking: false, protected: true, consequence: true })],
		});
		// Then the workflow still requires a human decision; no genuine loss occurred.
		expect(s.triage).toMatchObject({ protected: 1, falseDrop: 0, downgraded: 0 });
		expect(s.falseDropRate).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
	});

	it("treats confirmed nonblocking as downgraded loss and consequence-less as pending", () => {
		const downgraded = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["x"] })],
			triage: [tri("f1", "confirmed", { blocking: false, consequence: true })],
		});
		expect(downgraded.triage).toMatchObject({ downgraded: 1, falseDrop: 1, retained: 0 });
		const pending = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["x"] })],
			triage: [tri("f1", "confirmed", { blocking: false, consequence: false })],
		});
		expect(pending.triage).toMatchObject({ pending: 1, falseDrop: 0, downgraded: 0 });
	});

	it("does not retain a confirmed finding that is independently below threshold", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["x"], blocking: "below-threshold" })],
			triage: [tri("f1", "confirmed")],
		});
		expect(s.retained).toEqual([]);
		expect(s.triage?.downgraded).toBe(1);
	});

	it("never counts undiscovered or below-threshold targets as false drops", () => {
		const s = single({
			targets: [target("u", "I", "blocking"), target("v", "I", "below-threshold")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["v"] })],
			triage: [tri("f1", "refuted")],
		});
		expect(s.undiscovered).toBe(1);
		expect(s.triage).toMatchObject({ falseDrop: 0, legitimateResidual: 1 });
		expect(s.falseDropRate).toMatchObject({ denominator: 0, value: null });
		expect(s.falseDropRate.reason).not.toBeNull();
	});

	it("counts adjudication kinds separately from validity", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["hit", "extra", "note", "wrong", "severity", "unsettled"],
			adjudications: [
				adj("hit", { targets: ["x"] }),
				adj("extra", { mechanism: "m-new" }),
				adj("note", { validity: "invalid", kind: "useful-note" }),
				adj("wrong", { validity: "invalid", kind: "evidence-error" }),
				adj("severity", { validity: "invalid", kind: "severity-error" }),
			],
			triage: [],
		});
		expect(s.findings.kinds).toMatchObject({
			"known-target": 1,
			"additional-defect": 1,
			"useful-note": 1,
			"evidence-error": 1,
			"severity-error": 1,
			"false-claim": 0,
			"unsupported-consequence": 0,
			pending: 1,
		});
		expect(s.findings.invalid).toBe(3);
	});

	it("separates invalid findings from pending ones and inherits no historical match", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["old-1", "new-1", "bad", "later"],
			adjudications: [
				adj("old-1", { targets: ["x"], validity: "invalid" }),
				adj("bad", { validity: "invalid" }),
				adj("later", { validity: "pending" }),
			],
			triage: [],
		});
		expect(s.discovered).toEqual([]);
		expect(s.findings).toMatchObject({ total: 4, valid: 0, invalid: 2, pending: 2 });
		expect(s.falsePositiveRate).toMatchObject({ numerator: 2, denominator: 2, value: 1 });
	});

	it("keeps additional mechanisms out of the frozen target denominator", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1", "f2", "f3"],
			adjudications: [
				adj("f1", { targets: ["x"] }),
				adj("f2", { mechanism: "new" }),
				adj("f3", { mechanism: "new" }),
			],
			triage: [tri("f1", "confirmed"), tri("f2", "confirmed"), tri("f3", "confirmed")],
		});
		expect(s.findings.additionalMechanisms).toEqual(["new"]);
		expect(s.findings.duplicates).toBe(1);
		expect(s.preRecall).toMatchObject({ numerator: 1, denominator: 1 });
	});

	it("reports unavailable triage as null with its own reason, keeping discovery", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1"],
			adjudications: [adj("f1", { targets: ["x"] })],
			triage: [],
			trial: { triage: "unavailable", reason: "verifier fell back to another model" },
		});
		expect(s.retained).toBeNull();
		expect(s.triage).toBeNull();
		expect(s.postRecall.value).toBeNull();
		expect(s.falseDropRate.value).toBeNull();
		expect(s.preRecall.value).toBe(1);
		expect(s.triageReason).toBe("verifier fell back to another model");
		expect(s.postRecall.reason).toBe("verifier fell back to another model");
	});

	it("reports zero denominators as null with a reason", () => {
		const s = single({ targets: [], findings: [], adjudications: [], triage: [], trial: { triage: "empty" } });
		expect(s.preRecall).toMatchObject({ denominator: 0, value: null });
		expect(s.preRecall.reason).not.toBeNull();
		expect(s.falsePositiveRate.value).toBeNull();
		expect(s.falseDropRate.value).toBeNull();
	});

	it("keeps annotated rows out of precision while they still establish coverage", () => {
		// Given a historical reference trial whose rows are descriptive labels, never independently judged.
		const s = single({
			targets: [target("x", "I", "blocking"), target("y", "I", "blocking")],
			findings: ["f1", "f2"],
			adjudications: [adj("f1", { targets: ["x"], validity: "annotated" }), adj("f2", { validity: "annotated" })],
			triage: [],
			trial: { triage: "unavailable", reason: "historical triage unavailable" },
		});
		// Then they count as coverage of the frozen ledger.
		expect(s.preRecall).toMatchObject({ numerator: 1, denominator: 2 });
		expect(s.findings).toMatchObject({ annotated: 2, valid: 0, invalid: 0, pending: 0 });
		// But no precision figure may be derived from rows nobody adjudicated.
		expect(s.falsePositiveRate.value).toBeNull();
		expect(s.falsePositiveRate.reason).toBe("no independently adjudicated findings");
	});

	it("computes precision from adjudicated rows only when annotated rows share the trial", () => {
		const s = single({
			targets: [target("x", "I", "blocking")],
			findings: ["f1", "f2", "f3"],
			adjudications: [
				adj("f1", { targets: ["x"], validity: "annotated" }),
				adj("f2", { validity: "invalid" }),
				adj("f3", { mechanism: "new" }),
			],
			triage: [tri("f3", "confirmed")],
		});
		expect(s.findings).toMatchObject({ annotated: 1, invalid: 1, valid: 1, total: 3 });
		expect(s.falsePositiveRate).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
	});
});
