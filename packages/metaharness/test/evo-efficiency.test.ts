import { describe, expect, it } from "bun:test";
import { compareFitness } from "../src/evo/compare";
import { tCritical95 } from "../src/evo/decision-policy";
import { computeFitness } from "../src/evo/fitness";
import type { TranscriptMetrics } from "../src/evo/transcript";
import type { VariantRow } from "../src/evo/variant-types";
import type { TraceRow } from "../src/store";

const variant = { expectedSignals: [] } as unknown as VariantRow;
const POLICY = { minPairedTasks: 2, minAttemptsPerTask: 1 };

interface Spend {
	cost: number;
	tokens: number;
	calls: number;
}

function trial(jobName: string, task: string, spend: Spend): TraceRow {
	const transcript: TranscriptMetrics = {
		llmCalls: spend.calls,
		llmErrors: 0,
		turns: spend.calls,
		inputTokens: 100,
		outputTokens: spend.tokens,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		costUsd: spend.cost,
		toolCalls: 1,
		toolErrors: 0,
		compactions: 0,
		retries: 0,
		finalStopReason: "stop",
		started: true,
		startupErrors: [],
		signals: [],
		droppedLines: 0,
		taskSnapshotConflicts: 0,
		transcriptComplete: true,
	};
	return {
		jobName,
		name: `${task}__1`,
		task,
		status: "pass",
		reward: 1,
		costUsd: spend.cost,
		durationMs: 1,
		detail: "",
		updatedAt: 0,
		tracePath: "x/agent/omp.txt",
		transcript,
		phase: "model_outcome",
	};
}

/** Every task passes on both sides, so the reward comparison has no variance. */
function side(job: string, spend: Record<string, Spend>) {
	return computeFitness({
		variantId: job,
		suiteId: "s",
		jobName: job,
		suiteTasks: Object.keys(spend),
		attempts: 1,
		policy: POLICY,
		trials: Object.entries(spend).map(([task, s]) => trial(job, task, s)),
	});
}

describe("efficiency comparison", () => {
	it("states a paired cost ratio with an interval when rewards tie on every task", () => {
		const base = {
			a: { cost: 0.2, tokens: 100, calls: 4 },
			b: { cost: 4, tokens: 900, calls: 9 },
			c: { cost: 0.1, tokens: 50, calls: 2 },
		};
		const child = {
			a: { cost: 0.1, tokens: 80, calls: 4 },
			b: { cost: 3, tokens: 900, calls: 6 },
			c: { cost: 0.05, tokens: 60, calls: 3 },
		};
		const c = compareFitness(side("c", child), side("b", base), variant);

		expect(c.ineligibility).toEqual({ reason: "no_variance", pairedTasks: 3 });
		// Geometric mean of per-task ratios: the $4 task does not outweigh the cheap ones.
		const logs = [Math.log(0.5), Math.log(0.75), Math.log(0.5)];
		const m = logs.reduce((x, y) => x + y, 0) / 3;
		const sd = Math.sqrt(logs.reduce((acc, v) => acc + (v - m) ** 2, 0) / 2);
		const half = (tCritical95(2) * sd) / Math.sqrt(3);
		expect(c.efficiency.costUsd.ineligibility).toBeNull();
		expect(c.efficiency.costUsd.ratio).toBeCloseTo(Math.exp(m), 12);
		const ci = c.efficiency.costUsd.ci95;
		expect(ci?.[0]).toBeCloseTo(Math.exp(m - half), 12);
		expect(ci?.[1]).toBeCloseTo(Math.exp(m + half), 12);
	});

	it("refuses a metric whose task mean is zero on either side, naming the task", () => {
		const base = { a: { cost: 0.2, tokens: 0, calls: 4 }, b: { cost: 0.4, tokens: 90, calls: 9 } };
		const child = { a: { cost: 0.1, tokens: 80, calls: 3 }, b: { cost: 0.3, tokens: 70, calls: 6 } };
		const c = compareFitness(side("c", child), side("b", base), variant);

		expect(c.efficiency.outputTokens).toEqual({
			ratio: null,
			ci95: null,
			ineligibility: { reason: "no_ratio", tasks: ["a"] },
		});
		expect(c.efficiency.costUsd.ineligibility).toBeNull();
	});

	it("refuses a zero-width interval when every task has the same ratio", () => {
		const base = { a: { cost: 0.2, tokens: 100, calls: 4 }, b: { cost: 0.4, tokens: 90, calls: 8 } };
		const child = { a: { cost: 0.1, tokens: 80, calls: 2 }, b: { cost: 0.3, tokens: 70, calls: 4 } };
		const c = compareFitness(side("c", child), side("b", base), variant);

		expect(c.efficiency.llmCalls).toEqual({
			ratio: null,
			ci95: null,
			ineligibility: { reason: "no_variance", pairedTasks: 2 },
		});
	});
});
