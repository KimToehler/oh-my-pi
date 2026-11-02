import type { Attempt, Dataset, Trial } from "./plan-review-replay/types";

export function attempt(over: Partial<Attempt> & Pick<Attempt, "id" | "stage">): Attempt {
	return {
		item: "i1",
		trial: "t1",
		historical: false,
		status: "completed",
		expectedModel: "sol",
		expectedEffort: "high",
		actualModels: ["sol"],
		actualEfforts: ["high"],
		dispatched: "2026-11-02T10:00:00Z",
		terminal: "2026-11-02T10:05:00Z",
		cost: 0.5,
		reason: null,
		provenance: "session s1",
		...over,
	};
}

export function base(): Dataset {
	return {
		version: 1,
		sources: [],
		arms: [
			{
				id: "S",
				historical: false,
				model: "sol",
				effort: "high",
				brief: "b",
				contract: "c",
				rules: "r",
				snapshot: "s",
				triage: "verifier",
				sampling: "3x",
			},
			{
				id: "H",
				historical: true,
				model: "terra",
				effort: "medium",
				brief: "b0",
				contract: "c0",
				rules: "r0",
				snapshot: "s0",
				triage: "none",
				sampling: "lens",
			},
		],
		items: [{ id: "i1", revision: "abc", tree: "def", snapshot: "snap" }],
		targets: [{ id: "g1", item: "i1", mechanism: "m", blocking: "blocking", evidence: ["plan.md:3"], reason: "r" }],
		attempts: [
			attempt({ id: "a-rev", stage: "reviewer" }),
			attempt({ id: "a-ver", stage: "verifier", expectedEffort: "medium", actualEfforts: ["medium"] }),
		],
		trials: [
			{
				id: "t1",
				arm: "S",
				item: "i1",
				repeat: 1,
				status: "completed",
				reviewAttempts: ["a-rev"],
				verifierAttempt: "a-ver",
				triage: "available",
				reason: null,
			},
		],
		findings: [
			{ id: "f1", trial: "t1", index: 1, description: "d1" },
			{ id: "f2", trial: "t1", index: 2, description: "d2" },
		],
		adjudications: [
			{
				finding: "f1",
				targets: ["g1"],
				mechanism: "m",
				validity: "valid",
				blocking: "blocking",
				kind: "known-target",
				evidence: ["plan.md:3"],
				reason: "match",
			},
		],
		triage: [
			{ finding: "f1", result: "confirmed", blocking: true, protected: false, consequence: true, reason: "ok" },
			{ finding: "f2", result: "refuted", blocking: false, protected: false, consequence: false, reason: "no" },
		],
		rounds: [],
		targetRepeats: [],
	};
}

export function withTrial(data: Dataset, trial: Trial, attempts: readonly Attempt[] = []): Dataset {
	return { ...data, trials: [...data.trials, trial], attempts: [...data.attempts, ...attempts] };
}
