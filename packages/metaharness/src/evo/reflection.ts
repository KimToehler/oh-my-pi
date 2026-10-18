/** Reflector-ready evidence bundle: diff, fitness/delta/cost, signal evidence, task flips, trace links. */
import * as fs from "node:fs/promises";
import type { TraceRow } from "../store";
import type { ComparisonReport } from "./compare";
import type { FitnessReport } from "./fitness";
import { taskKey } from "./suites";
import type { VariantRow } from "./variant-types";

const PER_BUCKET = 3;
/** Cap on the embedded diff; the stored file stays the source of truth. */
const DIFF_CAP_BYTES = 256 * 1024;

export interface TraceLink {
	task: string;
	jobName: string;
	trace: string;
	status: string;
	reward: number | null;
	href: string;
}

export interface TaskFlip {
	task: string;
	child: number;
	baseline: number;
	delta: number;
	childTraces: TraceLink[];
	baselineTraces: TraceLink[];
}

export interface ReflectionBundle {
	variant: VariantRow;
	parent: VariantRow | null;
	diff: { path: string; text: string; truncated: boolean };
	/** Evaluation pair this bundle describes; `baselineJob` is null when the variant has no baseline. */
	childJob: string;
	baselineJob: string | null;
	fitness: FitnessReport;
	baselineFitness: FitnessReport | null;
	comparison: ComparisonReport | null;
	signals: {
		expected: string[];
		hits: Record<string, number>;
		missing: string[];
		satisfied: boolean;
		/** Credited delta after the signal gate; raw delta stays on `comparison`. */
		creditedDelta: number | null;
	};
	cost: {
		/** Transcript cost (main + delegated); null when no trial carried one. */
		meanCostUsd: number | null;
		meanLlmCalls: number | null;
		meanOutputTokens: number | null;
		startFailureRate: number | null;
	};
	regressions: TaskFlip[];
	improvements: TaskFlip[];
	persistentFailures: TaskFlip[];
}

export function traceLinks(jobName: string, task: string, traces: readonly TraceRow[]): TraceLink[] {
	return traces
		.filter(t => taskKey(t.task) === task && t.tracePath !== null)
		.map(t => ({
			task,
			jobName,
			trace: t.name,
			status: t.status,
			reward: t.reward,
			href: `/api/runs/${encodeURIComponent(jobName)}/traces/${encodeURIComponent(t.name)}`,
		}));
}

async function readDiff(file: string): Promise<ReflectionBundle["diff"]> {
	const bytes = await fs.readFile(file).catch(() => new Uint8Array());
	const truncated = bytes.length > DIFF_CAP_BYTES;
	return {
		path: file,
		text: new TextDecoder().decode(truncated ? bytes.subarray(0, DIFF_CAP_BYTES) : bytes),
		truncated,
	};
}

export interface BundleInput {
	variant: VariantRow;
	parent: VariantRow | null;
	fitness: FitnessReport;
	baselineFitness: FitnessReport | null;
	comparison: ComparisonReport | null;
	childTraces: readonly TraceRow[];
	baselineTraces: readonly TraceRow[];
}

export async function buildReflectionBundle(input: BundleInput): Promise<ReflectionBundle> {
	const { variant, fitness, comparison } = input;
	const flip = (d: { task: string; child: number; baseline: number; delta: number }): TaskFlip => ({
		...d,
		childTraces: traceLinks(fitness.jobName, d.task, input.childTraces),
		baselineTraces: input.baselineFitness
			? traceLinks(input.baselineFitness.jobName, d.task, input.baselineTraces)
			: [],
	});
	const deltas = comparison?.deltas ?? [];
	const byDelta = (a: { delta: number; task: string }, b: { delta: number; task: string }): number =>
		a.delta - b.delta || (a.task < b.task ? -1 : 1);
	const expected = variant.expectedSignals;
	const missing = expected.filter(signal => !(signal in fitness.signalHits));
	return {
		variant,
		parent: input.parent,
		diff: await readDiff(variant.diffPath),
		childJob: fitness.jobName,
		baselineJob: input.baselineFitness?.jobName ?? null,
		fitness,
		baselineFitness: input.baselineFitness,
		comparison,
		signals: {
			expected,
			hits: fitness.signalHits,
			missing,
			satisfied: missing.length === 0,
			creditedDelta: comparison?.creditedDelta ?? null,
		},
		cost: {
			meanCostUsd: fitness.meanCostUsd,
			meanLlmCalls: fitness.meanLlmCalls,
			meanOutputTokens: fitness.meanOutputTokens,
			startFailureRate: fitness.startFailureRate,
		},
		regressions: deltas
			.filter(d => d.delta < 0)
			.sort(byDelta)
			.slice(0, PER_BUCKET)
			.map(flip),
		improvements: deltas
			.filter(d => d.delta > 0)
			.sort((a, b) => byDelta(b, a) || (a.task < b.task ? -1 : 1))
			.slice(0, PER_BUCKET)
			.map(flip),
		persistentFailures: deltas
			.filter(d => d.child < 1 && d.baseline < 1)
			.sort(byDelta)
			.slice(0, PER_BUCKET)
			.map(flip),
	};
}
