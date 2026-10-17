import { describe, expect, it } from "bun:test";
import { compareFitness } from "../src/evo/compare";
import { tCritical95 } from "../src/evo/decision-policy";
import { computeFitness } from "../src/evo/fitness";
import { SuiteRegistry } from "../src/evo/suites";
import type { VariantRow } from "../src/evo/variant-types";
import type { TraceRow } from "../src/store";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const variant = { expectedSignals: [] } as unknown as VariantRow;

function trial(jobName: string, task: string, attempt: number, reward: number, over: Partial<TraceRow> = {}): TraceRow {
	return {
		jobName,
		name: `${task}__${attempt}`,
		task,
		status: reward >= 1 ? "pass" : "fail",
		reward,
		costUsd: 0.1,
		durationMs: 1,
		detail: "",
		updatedAt: 0,
		tracePath: null,
		transcript: null,
		phase: "model_outcome",
		...over,
	};
}

interface Policy {
	minPairedTasks: number;
	minAttemptsPerTask: number;
}

/** rewards[task] = per-attempt rewards. */
function side(
	id: string,
	rewards: Record<string, number[]>,
	policy: Policy,
	over: Record<string, Partial<TraceRow>> = {},
	suiteTasks: string[] = Object.keys(rewards),
) {
	const trials = Object.entries(rewards).flatMap(([task, rs]) =>
		rs.map((r, i) => trial(id, task, i + 1, r, over[`${task}__${i + 1}`] ?? {})),
	);
	const attempts = Math.max(...Object.values(rewards).map(rs => rs.length));
	return computeFitness({
		variantId: id,
		suiteId: "s",
		jobName: id,
		suiteTasks,
		attempts,
		policy,
		trials,
	});
}

const POLICY: Policy = { minPairedTasks: 3, minAttemptsPerTask: 1 };

describe("decision eligibility", () => {
	it("1 task x 1 attempt is dataComplete but not decisionEligible: decision fields null, reason visible", () => {
		const policy = { minPairedTasks: 3, minAttemptsPerTask: 1 };
		const c = compareFitness(side("c", { a: [1] }, policy), side("b", { a: [0] }, policy), variant);
		expect(c.dataComplete).toBe(true);
		expect(c.decisionEligible).toBe(false);
		expect(c.creditedDelta).toBeNull();
		expect([c.wins, c.ties, c.losses]).toEqual([null, null, null]);
		expect([c.sd, c.se, c.ci95]).toEqual([null, null, null]);
		expect(c.ineligibility).toMatchObject({ reason: "underpowered", pairedTasks: 1, minPairedTasks: 3 });
		// Raw diagnostics stay visible, never mistaken for a decision value.
		expect(c.rawDelta).toBe(1);
	});

	it("too few attempts per task is underpowered even with enough tasks", () => {
		const policy = { minPairedTasks: 2, minAttemptsPerTask: 2 };
		const one = { a: [1], b: [1] };
		const c = compareFitness(side("c", one, policy), side("b", { a: [0], b: [1] }, policy), variant);
		expect(c.dataComplete).toBe(true);
		expect(c.decisionEligible).toBe(false);
		expect(c.ineligibility).toMatchObject({ reason: "underpowered", attemptsPerTask: 1, minAttemptsPerTask: 2 });
		expect(c.creditedDelta).toBeNull();
	});

	it("policy met is eligible with numeric delta, counts and a non-null interval", () => {
		const c = compareFitness(
			side("c", { a: [1], b: [1], c: [0], d: [1] }, POLICY),
			side("b", { a: [0], b: [1], c: [0], d: [0] }, POLICY),
			variant,
		);
		expect(c.dataComplete).toBe(true);
		expect(c.decisionEligible).toBe(true);
		expect(c.ineligibility).toBeNull();
		expect(c.creditedDelta).toBeCloseTo(0.5, 12);
		expect([c.wins, c.ties, c.losses]).toEqual([2, 2, 0]);
		expect(c.ci95).not.toBeNull();
		expect(c.ci95![0]).toBeLessThan(0.5);
		expect(c.ci95![1]).toBeGreaterThan(0.5);
		// Student-t, df = 3: half width = t * se, not 1.96 * se.
		expect(c.ci95![1] - 0.5).toBeCloseTo(tCritical95(3) * c.se!, 12);
		expect(tCritical95(3)).toBeCloseTo(3.1824, 3);
	});

	it("zero within-task variance with attempts > 1 stays eligible and exposes withinTaskVariance 0; interval comes from between-task spread", () => {
		const policy = { minPairedTasks: 3, minAttemptsPerTask: 2 };
		const child = side("c", { a: [1, 1], b: [1, 1], c: [0, 0] }, policy);
		const baseline = side("b", { a: [0, 0], b: [1, 1], c: [0, 0] }, policy);
		expect(child.withinTaskVariance).toBe(0);
		expect(child.attemptsPerTask).toBe(2);
		const c = compareFitness(child, baseline, variant);
		expect(c.decisionEligible).toBe(true);
		expect([c.childWithinTaskVariance, c.baselineWithinTaskVariance]).toEqual([0, 0]);
		expect(c.pairedTasks).toBe(3);
		expect(c.attemptsPerTask).toBe(2);
		// Deltas [1,0,0]: between-task variance is nonzero, so the interval is not zero-width.
		expect(c.ci95![1] - c.ci95![0]).toBeGreaterThan(0.1);
	});

	it("withinTaskVariance is the pooled sample variance of attempt rewards (null with one attempt)", () => {
		const policy = { minPairedTasks: 2, minAttemptsPerTask: 1 };
		// a: [1,0] var .5 (df1); b: [1,1,0] var 1/3 (df2) -> pooled (.5 + 2/3) / 3
		const r = side("c", { a: [1, 0], b: [1, 1, 0] }, policy);
		expect(r.withinTaskVariance).toBeCloseTo((0.5 + 2 / 3) / 3, 12);
		expect(side("c", { a: [1], b: [0] }, policy).withinTaskVariance).toBeNull();
	});

	it("identical paired deltas give no variance to state an interval: ineligible, never a zero-width interval", () => {
		const c = compareFitness(
			side("c", { a: [1], b: [1], c: [1] }, POLICY),
			side("b", { a: [0], b: [0], c: [0] }, POLICY),
			variant,
		);
		expect(c.dataComplete).toBe(true);
		expect(c.decisionEligible).toBe(false);
		expect(c.ineligibility).toMatchObject({ reason: "no_variance", pairedTasks: 3 });
		expect(c.creditedDelta).toBeNull();
		expect(c.ci95).toBeNull();
	});

	for (const phase of ["variant_startup_failure", "executor_infra_failure", "unknown"] as const) {
		it(`a dataComplete pair with a ${phase} trial is ineligible and the reason names the phase`, () => {
			const policy = { minPairedTasks: 3, minAttemptsPerTask: 1 };
			// Task d has two attempts on the child: one model outcome, one non-model; the task keeps a reward.
			const child = computeFitness({
				variantId: "c",
				suiteId: "s",
				jobName: "c",
				suiteTasks: ["a", "b", "c"],
				attempts: 2,
				policy,
				trials: ["a", "b", "c"].flatMap(task => [
					trial("c", task, 1, 1),
					trial("c", task, 2, 0, task === "a" ? { phase, status: "error" } : {}),
				]),
			});
			const baseline = computeFitness({
				variantId: "b",
				suiteId: "s",
				jobName: "b",
				suiteTasks: ["a", "b", "c"],
				attempts: 2,
				policy,
				trials: ["a", "b", "c"].flatMap(task => [trial("b", task, 1, 0), trial("b", task, 2, 0)]),
			});
			expect(child.dataComplete).toBe(true);
			const c = compareFitness(child, baseline, variant);
			expect(c.dataComplete).toBe(true);
			expect(c.decisionEligible).toBe(false);
			expect(c.ineligibility).toMatchObject({ reason: "non_model_phase", phases: [phase] });
			expect(c.refusals).toEqual([{ reason: phase, count: 1 }]);
			expect(c.creditedDelta).toBeNull();
			expect([c.wins, c.ties, c.losses]).toEqual([null, null, null]);
			expect(c.ci95).toBeNull();
		});
	}

	describe("lossy transcripts fail closed", () => {
		const lossy = (n: number) => ({
			transcript: {
				llmCalls: 1,
				llmErrors: 0,
				turns: 1,
				inputTokens: 1,
				outputTokens: 1,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				toolCalls: 0,
				toolErrors: 0,
				compactions: 0,
				retries: 0,
				finalStopReason: "stop",
				started: true,
				startupErrors: [],
				signals: [],
				droppedLines: n,
			},
		});
		const rewardsC = { a: [1], b: [1], c: [0], d: [1] };
		const rewardsB = { a: [0], b: [1], c: [0], d: [0] };

		it("a clean transcript compares normally", () => {
			const c = compareFitness(
				side("c", rewardsC, POLICY, { a__1: lossy(0) }),
				side("b", rewardsB, POLICY, { a__1: lossy(0) }),
				variant,
			);
			expect(c.decisionEligible).toBe(true);
			expect(c.ineligibility).toBeNull();
			expect(c.callsDelta).not.toBeNull();
		});

		for (const which of ["child", "baseline"] as const) {
			it(`one dropped line on the ${which} refuses with lossy_transcript and nulls decision fields`, () => {
				const over = { a__1: lossy(1) };
				const c = compareFitness(
					side("c", rewardsC, POLICY, which === "child" ? over : {}),
					side("b", rewardsB, POLICY, which === "baseline" ? over : {}),
					variant,
				);
				expect(c.decisionEligible).toBe(false);
				expect(c.ineligibility).toEqual({ reason: "lossy_transcript", trials: 1 });
				expect(c.creditedDelta).toBeNull();
				expect([c.wins, c.ties, c.losses]).toEqual([null, null, null]);
				expect([c.callsDelta, c.outputTokensDelta, c.costUsdDelta]).toEqual([null, null, null]);
				expect(c.ci95).toBeNull();
				// Raw diagnostics stay visible.
				expect(c.rawDelta).toBeCloseTo(0.5, 12);
			});
		}

		it("fitness reports the lossy trial count", () => {
			expect(side("c", rewardsC, POLICY, { a__1: lossy(3), b__1: lossy(1) }).lossyTranscriptTrials).toBe(2);
			expect(side("c", rewardsC, POLICY).lossyTranscriptTrials).toBe(0);
		});
	});

	it("a data-incomplete run is not dataComplete and reports incomplete", () => {
		const c = compareFitness(
			side("c", { a: [1], b: [1] }, POLICY, {}, ["a", "b", "c"]),
			side("b", { a: [0], b: [1], c: [0] }, POLICY),
			variant,
		);
		expect(c.dataComplete).toBe(false);
		expect(c.decisionEligible).toBe(false);
		expect(c.ineligibility).toMatchObject({ reason: "incomplete" });
		expect(c.creditedDelta).toBeNull();
	});
});

describe("suite decision policy registration", () => {
	const manifest = {
		id: "pol-1",
		split: "search",
		benchmark: "harbor",
		dataset: `terminal-bench@sha256:${"a".repeat(64)}`,
		include: ["t1", "t2", "t3"],
		attempts: 2,
		timeoutMultiplier: 1,
		model: "m/x",
		thinking: "low",
		environment: "docker",
		minPairedTasks: 3,
		minAttemptsPerTask: 2,
	};
	const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "evo-policy-"));

	it("stores the policy in the manifest and hashes it into suite identity", async () => {
		const registry = new SuiteRegistry(tmp());
		const { suite } = await registry.register(manifest);
		expect(suite.manifest).toMatchObject({ minPairedTasks: 3, minAttemptsPerTask: 2 });
		const other = await new SuiteRegistry(tmp()).register({ ...manifest, minPairedTasks: 2 });
		expect(other.suite.hash).not.toBe(suite.hash);
	});

	it("rejects missing, malformed and unsatisfiable policies", async () => {
		const registry = new SuiteRegistry(tmp());
		const reject = (patch: Record<string, unknown>, message: string) =>
			expect(registry.register({ ...manifest, ...patch })).rejects.toThrow(message);
		await reject({ minPairedTasks: undefined }, "suite.minPairedTasks must be a positive integer");
		await reject({ minPairedTasks: 0 }, "suite.minPairedTasks must be a positive integer");
		await reject({ minPairedTasks: 4 }, "suite.minPairedTasks must not exceed the number of included tasks");
		await reject({ minAttemptsPerTask: undefined }, "suite.minAttemptsPerTask must be a positive integer");
		await reject({ minAttemptsPerTask: 3 }, "suite.minAttemptsPerTask must not exceed suite.attempts");
	});
});
