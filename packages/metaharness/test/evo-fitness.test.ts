import { describe, expect, it } from "bun:test";
import { assertMatched, type ConditionIdentity, compareFitness } from "../src/evo/compare";
import { computeFitness } from "../src/evo/fitness";
import { buildReflectionBundle } from "../src/evo/reflection";
import type { TranscriptMetrics } from "../src/evo/transcript";
import type { VariantRow } from "../src/evo/variant-types";
import type { TraceRow } from "../src/store";

function metrics(over: Partial<TranscriptMetrics> = {}): TranscriptMetrics {
	return {
		llmCalls: 4,
		llmErrors: 0,
		turns: 4,
		inputTokens: 100,
		outputTokens: 10,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		toolCalls: 3,
		toolErrors: 0,
		compactions: 0,
		retries: 0,
		finalStopReason: "stop",
		started: true,
		startupErrors: [],
		signals: [],
		droppedLines: 0,
		...over,
	};
}

function trial(task: string, attempt: number, over: Partial<TraceRow> = {}): TraceRow {
	return {
		jobName: "job",
		name: `${task}__${attempt}`,
		task,
		status: "pass",
		reward: 1,
		costUsd: 0.1,
		durationMs: 1,
		detail: "",
		updatedAt: 0,
		tracePath: "x/agent/omp.txt",
		transcript: metrics(),
		phase: "model_outcome",
		...over,
	};
}

const fit = (trials: TraceRow[], tasks: string[], variantId = "v", jobName = "job", attempts = 1) =>
	computeFitness({ variantId, suiteId: "s", jobName, suiteTasks: tasks, attempts, trials });

describe("fitness", () => {
	it("computes per-task mean attempts, macro mean, SD/SE/CI, and cost means exactly", () => {
		const trials = [
			trial("a", 1, { reward: 1, costUsd: 0.2, transcript: metrics({ llmCalls: 2, outputTokens: 20 }) }),
			trial("a", 2, {
				status: "fail",
				reward: 0,
				costUsd: 0.4,
				transcript: metrics({ llmCalls: 4, outputTokens: 40 }),
			}),
			trial("b", 1, { reward: 1, costUsd: 0.1, transcript: metrics({ llmCalls: 10, outputTokens: 100 }) }),
			trial("c", 1, {
				status: "fail",
				reward: 0,
				costUsd: 0,
				transcript: metrics({ llmCalls: 6, outputTokens: 60 }),
			}),
			trial("b", 2, { reward: 1, costUsd: 0.1, transcript: metrics({ llmCalls: 10, outputTokens: 100 }) }),
			trial("c", 2, {
				status: "fail",
				reward: 0,
				costUsd: 0,
				transcript: metrics({ llmCalls: 6, outputTokens: 60 }),
			}),
		];
		const r = fit(trials, ["a", "b", "c"], "v", "job", 2);
		expect(r.perTask.map(t => [t.task, t.reward])).toEqual([
			["a", 0.5],
			["b", 1],
			["c", 0],
		]);
		expect(r.vHat).toBeCloseTo(0.5, 12);
		// rewards [0.5, 1, 0]: variance = (0 + .25 + .25)/2 = .25 -> sd .5, se .5/sqrt3
		expect(r.sd).toBeCloseTo(0.5, 12);
		expect(r.se).toBeCloseTo(0.5 / Math.sqrt(3), 12);
		expect(r.ci95?.[0]).toBeCloseTo(0.5 - 1.96 * r.se!, 12);
		expect(r.tasks).toBe(3);
		expect(r.trials).toBe(6);
		expect(r.complete).toBe(true);
		// per-task means [3,10,6] -> 19/3; [30,100,60] -> 190/3; cost [.3,.1,0]
		expect(r.meanLlmCalls).toBeCloseTo(19 / 3, 12);
		expect(r.meanOutputTokens).toBeCloseTo(190 / 3, 12);
		expect(r.meanCostUsd).toBeCloseTo(0.4 / 3, 12);
		expect(r.startFailureRate).toBe(0);
	});

	it("counts missing reward and AgentTimeoutError as 0, excludes infra errors and marks incomplete", () => {
		const trials = [
			trial("a", 1, { status: "error", reward: null, detail: "AgentTimeoutError" }),
			trial("b", 1, { status: "fail", reward: null }),
			trial("c", 1, {
				status: "error",
				reward: null,
				detail: "EnvironmentStartTimeoutError",
				phase: "executor_infra_failure",
			}),
			trial("d", 1, { reward: 1 }),
		];
		const r = fit(trials, ["a", "b", "c", "d"]);
		expect(r.perTask.find(t => t.task === "a")?.reward).toBe(0);
		expect(r.perTask.find(t => t.task === "b")?.reward).toBe(0);
		expect(r.perTask.find(t => t.task === "c")?.reward).toBeNull();
		expect(r.vHat).toBeCloseTo(1 / 3, 12);
		expect(r.complete).toBe(false);
		expect(r.incompleteReasons.join()).toContain("excluded as running or infrastructure failures");
		expect(r.errors).toBe(2);
		// A timeout must NOT be excluded (negative control): vHat would be 0.5 if it were.
		expect(r.vHat).not.toBeCloseTo(0.5, 6);
	});

	it("marks missing suite tasks and running trials incomplete; reports start failures and signal hits", () => {
		const trials = [
			trial("a", 1, { transcript: metrics({ started: false, signals: ["tool:read"] }) }),
			trial("a", 2, { transcript: metrics({ signals: ["tool:read", "mark:m"] }) }),
			trial("b", 1, { status: "running", reward: null, transcript: null }),
		];
		const r = fit(trials, ["a", "b", "z"]);
		expect(r.complete).toBe(false);
		expect(r.incompleteReasons.join()).toContain("missing suite tasks: z");
		expect(r.startFailureRate).toBe(0.5);
		expect(r.signalHits).toEqual({ "tool:read": 2, "mark:m": 1 });
	});

	it("marks a report incomplete when a task has fewer or more attempts than the suite declares", () => {
		const run = (counts: Record<string, number>) =>
			computeFitness({
				variantId: "v",
				suiteId: "s",
				jobName: "job",
				suiteTasks: ["a", "b"],
				attempts: 2,
				trials: Object.entries(counts).flatMap(([task, n]) =>
					Array.from({ length: n }, (_, i) => trial(task, i + 1)),
				),
			});
		const exact = run({ a: 2, b: 2 });
		expect(exact.complete).toBe(true);
		expect(exact.incompleteReasons).toEqual([]);
		const fewer = run({ a: 2, b: 1 });
		expect(fewer.complete).toBe(false);
		expect(fewer.incompleteReasons).toEqual(["tasks with unexpected attempt count (expected 2): b has 1"]);
		const more = run({ a: 3, b: 2 });
		expect(more.complete).toBe(false);
		expect(more.incompleteReasons).toEqual(["tasks with unexpected attempt count (expected 2): a has 3"]);
	});
});

describe("out-of-suite trials", () => {
	it("never enter perTask, vHat, intervals, means, start-failure rate or signals; they only mark incomplete", () => {
		const trials = [
			trial("t1", 1, {
				status: "fail",
				reward: 0,
				costUsd: 0.2,
				transcript: metrics({ llmCalls: 2, outputTokens: 20, signals: ["tool:read"] }),
			}),
			trial("t2", 1, {
				reward: 1,
				costUsd: 9,
				transcript: metrics({ llmCalls: 90, outputTokens: 900, started: false, signals: ["mark:outside"] }),
			}),
		];
		const r = fit(trials, ["t1"]);
		expect(r.perTask.map(t => t.task)).toEqual(["t1"]);
		expect(r.vHat).toBe(0);
		expect(r.sd).toBeNull();
		expect(r.tasks).toBe(1);
		expect(r.trials).toBe(1);
		expect(r.meanLlmCalls).toBe(2);
		expect(r.meanOutputTokens).toBe(20);
		expect(r.meanCostUsd).toBeCloseTo(0.2, 12);
		expect(r.startFailureRate).toBe(0);
		expect(r.signalHits).toEqual({ "tool:read": 1 });
		expect(r.outsideSuiteTasks).toEqual(["t2"]);
		expect(r.complete).toBe(false);
		expect(r.incompleteReasons).toContain("trials outside suite: t2");
	});

	it("keeps outside tasks out of paired deltas", () => {
		const mk = (jobName: string, reward: number) => [
			trial("t1", 1, { jobName, reward, status: reward ? "pass" : "fail" }),
			trial("extra", 1, { jobName, reward: 1 }),
		];
		const child = fit(mk("cj", 1), ["t1"], "child", "cj");
		const baseline = fit(mk("pj", 0), ["t1"], "parent", "pj");
		const c = compareFitness(child, baseline, variant([]));
		expect(c.deltas.map(d => d.task)).toEqual(["t1"]);
		expect(c.rawDelta).toBe(1);
	});
});

describe("missing task attribution", () => {
	const side = (jobName: string, rewards: Record<string, number | null>, id: string) =>
		fit(
			Object.entries(rewards).map(([task, reward]) =>
				trial(
					task,
					1,
					reward === null
						? {
								jobName,
								status: "error",
								reward: null,
								detail: "EnvironmentStartTimeoutError",
								phase: "executor_infra_failure",
							}
						: { jobName, reward, status: reward ? "pass" : "fail" },
				),
			),
			["both", "childOnly", "baseOnly", "neither"],
			id,
			jobName,
		);

	it("blames only the side that lacks a reward; both-null is listed on both without duplicates", () => {
		const child = side("cj", { both: 1, childOnly: 1, baseOnly: null, neither: null }, "child");
		const baseline = side("pj", { both: 0, childOnly: null, baseOnly: 1, neither: null }, "parent");
		const c = compareFitness(child, baseline, variant([]));
		expect(c.deltas.map(d => d.task)).toEqual(["both"]);
		expect(c.missingInBaseline).toEqual(["childOnly", "neither"]);
		expect(c.missingInChild).toEqual(["baseOnly", "neither"]);
		expect(new Set(c.missingInChild).size).toBe(c.missingInChild.length);
		expect(new Set(c.missingInBaseline).size).toBe(c.missingInBaseline.length);
		expect(c.complete).toBe(false);
	});

	it("is complete only when no task is missing on either side", () => {
		const all = { both: 1, childOnly: 1, baseOnly: 0, neither: 1 };
		const c = compareFitness(side("cj", all, "child"), side("pj", all, "parent"), variant([]));
		expect(c.missingInChild).toEqual([]);
		expect(c.missingInBaseline).toEqual([]);
		expect(c.complete).toBe(true);
	});
});

const variant = (expectedSignals: string[]): VariantRow => ({
	id: "child",
	configHash: "c",
	sourceRef: "r",
	sourceDirtyHash: null,
	snapshotPath: "/p",
	parentId: "parent",
	donorVariantId: null,
	depth: 1,
	mutation: "revision",
	strategy: "",
	directive: "",
	expectedSignals,
	diffPath: "/nonexistent.patch",
	changedFiles: [],
	createdAt: 0,
});

function pair(childRewards: Record<string, number>, childSignals: string[] = []) {
	const mk = (rewards: Record<string, number>, jobName: string, signals: string[]) =>
		Object.entries(rewards).map(([task, reward]) =>
			trial(task, 1, {
				jobName,
				status: reward >= 1 ? "pass" : "fail",
				reward,
				transcript: metrics({ signals }),
			}),
		);
	const tasks = ["t1", "t2", "t3", "t4"];
	const base = { t1: 0, t2: 1, t3: 0, t4: 0 };
	const child = fit(mk(childRewards, "cj", childSignals), tasks, "child", "cj");
	const baseline = fit(mk(base, "pj", []), tasks, "parent", "pj");
	return { child, baseline };
}

describe("comparison", () => {
	it("computes paired delta, SE/CI, wins/ties/losses, cost deltas", () => {
		const { child, baseline } = pair({ t1: 1, t2: 0, t3: 1, t4: 0 });
		const c = compareFitness(child, baseline, variant([]));
		expect(c.deltas.map(d => [d.task, d.delta])).toEqual([
			["t1", 1],
			["t2", -1],
			["t3", 1],
			["t4", 0],
		]);
		expect(c.rawDelta).toBeCloseTo(0.25, 12);
		expect([c.wins, c.ties, c.losses]).toEqual([2, 1, 1]);
		// deltas [1,-1,1,0] mean .25: var = (.5625+1.5625+.5625+.0625)/3 = .9166667
		expect(c.se).toBeCloseTo(Math.sqrt(0.9166666667 / 4), 9);
		expect(c.creditedDelta).toBeCloseTo(0.25, 12);
		expect(c.complete).toBe(true);
		expect(typeof c.costUsdDelta).toBe("number");
		expect(typeof c.callsDelta).toBe("number");
		expect(typeof c.outputTokensDelta).toBe("number");
	});

	it("clamps positive credited delta to 0 unless every expected signal appears; raw stays visible", () => {
		const gain = { t1: 1, t2: 1, t3: 0, t4: 0 };
		const withMarker = pair(gain, ["tool:read", "mark:fix"]);
		const credited = compareFitness(withMarker.child, withMarker.baseline, variant(["mark:fix"]));
		expect(credited.rawDelta).toBeCloseTo(0.25, 12);
		expect(credited.creditedDelta).toBeCloseTo(0.25, 12);
		expect(credited.signalsSatisfied).toBe(true);

		const noMarker = pair(gain, ["tool:read"]);
		const clamped = compareFitness(noMarker.child, noMarker.baseline, variant(["mark:fix"]));
		expect(clamped.rawDelta).toBeCloseTo(0.25, 12);
		expect(clamped.creditedDelta).toBe(0);
		expect(clamped.missingSignals).toEqual(["mark:fix"]);

		const partial = compareFitness(withMarker.child, withMarker.baseline, variant(["mark:fix", "skill:x"]));
		expect(partial.creditedDelta).toBe(0);

		// Negative deltas are never clamped upward; empty expected signals are unconditional.
		const loss = pair({ t1: 0, t2: 0, t3: 0, t4: 0 });
		expect(compareFitness(loss.child, loss.baseline, variant(["mark:fix"])).creditedDelta).toBeCloseTo(-0.25, 12);
		expect(compareFitness(noMarker.child, noMarker.baseline, variant([])).creditedDelta).toBeCloseTo(0.25, 12);
	});

	it("withholds decision metrics when either side is incomplete", () => {
		// Child improves t1 and satisfies every expected signal but omits t3/t4: shared gain must not be credited.
		const { child, baseline } = pair({ t1: 1, t2: 1 }, ["tool:read", "mark:fix"]);
		const c = compareFitness(child, baseline, variant(["mark:fix"]));
		expect(c.signalsSatisfied).toBe(true);
		expect(c.complete).toBe(false);
		expect(c.sharedTasks).toBe(2);
		expect(c.rawDelta).toBeCloseTo(0.5, 12);
		expect(c.deltas.map(d => [d.task, d.delta])).toEqual([
			["t1", 1],
			["t2", 0],
		]);
		expect(c.creditedDelta).toBeNull();
		expect([c.sd, c.se, c.ci95]).toEqual([null, null, null]);
		expect([c.wins, c.ties, c.losses]).toEqual([null, null, null]);
		expect([c.callsDelta, c.outputTokensDelta, c.costUsdDelta]).toEqual([null, null, null]);
	});

	it("reports tasks missing on either side instead of a comparable delta", () => {
		const { child, baseline } = pair({ t1: 1, t2: 1 });
		const c = compareFitness(child, baseline, variant([]));
		expect(c.complete).toBe(false);
		expect(c.sharedTasks).toBe(2);
		expect(c.missingInChild).toEqual(["t3", "t4"]);
	});

	const identity: ConditionIdentity = {
		suiteId: "s",
		suiteHash: "h",
		model: "m",
		executorConfigHash: "e",
		modelsYamlHash: "m",
		sourceRef: "r",
		sourceDirtyHash: null,
	};

	it("rejects every confounded condition with a 409 naming the exact fields", () => {
		expect(() => assertMatched(identity, { ...identity })).not.toThrow();
		for (const field of Object.keys(identity) as Array<keyof ConditionIdentity>) {
			const other = { ...identity, [field]: field === "sourceDirtyHash" ? "dirty" : "different" };
			try {
				assertMatched(identity, other);
				throw new Error(`no rejection for ${field}`);
			} catch (err) {
				expect((err as { status?: number }).status).toBe(409);
				expect((err as Error).message).toBe(`conditions differ: ${field}`);
				expect((err as { body?: { mismatches: Array<{ field: string }> } }).body?.mismatches[0].field).toBe(field);
			}
		}
	});
});

describe("reflection bundle", () => {
	it("selects at most 3 regressions, improvements, persistent failures with trace links", async () => {
		const tasks = Array.from({ length: 12 }, (_, i) => `k${i}`);
		const childRewards: Record<string, number> = {};
		const baseRewards: Record<string, number> = {};
		tasks.forEach((task, i) => {
			if (i < 4)
				[childRewards[task], baseRewards[task]] = [1, 0]; // improvements
			else if (i < 8)
				[childRewards[task], baseRewards[task]] = [0, 1]; // regressions
			else [childRewards[task], baseRewards[task]] = [0, 0]; // persistent failures
		});
		const mk = (rewards: Record<string, number>, jobName: string) =>
			Object.entries(rewards).map(([task, reward]) =>
				trial(task, 1, { jobName, reward, status: reward ? "pass" : "fail" }),
			);
		const childTraces = mk(childRewards, "cj");
		const baseTraces = mk(baseRewards, "pj");
		const child = fit(childTraces, tasks, "child", "cj");
		const baseline = fit(baseTraces, tasks, "parent", "pj");
		const comparison = compareFitness(child, baseline, variant(["mark:x"]));
		const bundle = await buildReflectionBundle({
			variant: variant(["mark:x"]),
			parent: { ...variant([]), id: "parent" },
			fitness: child,
			baselineFitness: baseline,
			comparison,
			childTraces,
			baselineTraces: baseTraces,
		});
		expect(bundle.regressions).toHaveLength(3);
		expect(bundle.improvements).toHaveLength(3);
		expect(bundle.persistentFailures).toHaveLength(3);
		expect(bundle.regressions.every(f => f.delta < 0)).toBe(true);
		expect(bundle.improvements.every(f => f.delta > 0)).toBe(true);
		expect(bundle.persistentFailures.every(f => f.child === 0 && f.baseline === 0)).toBe(true);
		expect(bundle.regressions[0].childTraces[0].href).toMatch(/^\/api\/runs\/cj\/traces\/k\d+__1$/);
		expect(bundle.regressions[0].baselineTraces[0].jobName).toBe("pj");
		expect(bundle.signals).toMatchObject({ expected: ["mark:x"], satisfied: false, missing: ["mark:x"] });
		expect(bundle.signals.creditedDelta).toBe(comparison.creditedDelta);
		expect(bundle.diff.text).toBe("");
	});
});
