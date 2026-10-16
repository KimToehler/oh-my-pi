/** Per-variant fitness on a fixed suite: macro-mean reward, uncertainty, cost, signal evidence. */
import type { TraceRow } from "../store";
import { taskKey } from "./suites";

/**
 * Harbor exception types caused by the environment or provider rather than the agent. Such
 * trials are excluded from the estimate and mark it incomplete until resumed. Everything else,
 * including `AgentTimeoutError`, counts as reward 0.
 */
export const INFRA_EXCEPTIONS: ReadonlySet<string> = new Set([
	"CancelledError",
	"EnvironmentStartTimeoutError",
	"SandboxBuildFailedError",
	"SandboxLikelyOutOfMemoryError",
	"NetworkConnectionError",
	"HealthcheckError",
	"SSHAccessError",
	"RuntimeRequestError",
	"GKEExecStreamClosedError",
	"GKEPodNotFoundError",
	"ApiConnectionError",
	"ApiConnectionClosedError",
	"ApiOverloadedError",
	"ApiRateLimitError",
	"ApiInternalServerError",
	"ApiUsageLimitError",
	"ApiResponseStalledError",
	"ApiProviderResourceNotFoundError",
]);

const Z_95 = 1.96;

export interface TaskFitness {
	task: string;
	/** Mean reward over counted attempts; null when every attempt was excluded or still running. */
	reward: number | null;
	attempts: number;
	counted: number;
	/** Attempts excluded as infrastructure failures or still running. */
	excluded: number;
	errors: number;
	meanLlmCalls: number | null;
	meanOutputTokens: number | null;
	meanCostUsd: number;
}

export interface Interval {
	sd: number | null;
	se: number | null;
	ci95: [number, number] | null;
}

export interface FitnessReport extends Interval {
	variantId: string;
	suiteId: string;
	jobName: string;
	/** Task keys seen in the job but absent from the suite; diagnostics only, never scored. */
	outsideSuiteTasks: string[];
	/** False when infra exceptions, running trials, or missing suite tasks make the estimate provisional. */
	complete: boolean;
	incompleteReasons: string[];
	/** Macro mean of complete per-task rewards; null when no task has a reward. */
	vHat: number | null;
	tasks: number;
	trials: number;
	errors: number;
	meanLlmCalls: number | null;
	meanOutputTokens: number | null;
	meanCostUsd: number;
	/** Share of decided trials whose transcript shows no assistant message. */
	startFailureRate: number | null;
	/** Trials emitting each signal. */
	signalHits: Record<string, number>;
	perTask: TaskFitness[];
}

export function mean(values: readonly number[]): number | null {
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function interval(values: readonly number[], center: number | null): Interval {
	if (values.length < 2 || center === null) return { sd: null, se: null, ci95: null };
	const variance = values.reduce((acc, v) => acc + (v - center) ** 2, 0) / (values.length - 1);
	const sd = Math.sqrt(variance);
	const se = sd / Math.sqrt(values.length);
	return { sd, se, ci95: [center - Z_95 * se, center + Z_95 * se] };
}

function trialReward(trial: TraceRow): number | null {
	if (trial.status === "running") return null;
	if (trial.status === "error" && INFRA_EXCEPTIONS.has(trial.detail)) return null;
	return trial.reward ?? 0;
}

export interface FitnessInput {
	variantId: string;
	suiteId: string;
	jobName: string;
	/** Explicit suite task IDs; each must be present for the estimate to be complete. */
	suiteTasks: readonly string[];
	trials: readonly TraceRow[];
}

function taskFitness(task: string, trials: readonly TraceRow[]): TaskFitness {
	const rewards: number[] = [];
	let errors = 0;
	for (const trial of trials) {
		const reward = trialReward(trial);
		if (reward !== null) rewards.push(reward);
		if (trial.status === "error") errors++;
	}
	const calls = trials.flatMap(t => (t.transcript ? [t.transcript.llmCalls] : []));
	const out = trials.flatMap(t => (t.transcript ? [t.transcript.outputTokens] : []));
	return {
		task,
		reward: mean(rewards),
		attempts: trials.length,
		counted: rewards.length,
		excluded: trials.length - rewards.length,
		errors,
		meanLlmCalls: mean(calls),
		meanOutputTokens: mean(out),
		meanCostUsd: mean(trials.map(t => t.costUsd)) ?? 0,
	};
}

export function computeFitness(input: FitnessInput): FitnessReport {
	const suiteKeys = [...new Set(input.suiteTasks.map(taskKey))];
	const inSuite = new Set(suiteKeys);
	const byTask = new Map<string, TraceRow[]>();
	const outside = new Set<string>();
	// Out-of-suite trials are diagnosed but excluded from every statistic below.
	const scored: TraceRow[] = [];
	for (const trial of input.trials) {
		const key = taskKey(trial.task);
		if (!inSuite.has(key)) {
			outside.add(key);
			continue;
		}
		scored.push(trial);
		const bucket = byTask.get(key);
		if (bucket) bucket.push(trial);
		else byTask.set(key, [trial]);
	}
	const perTask = [...suiteKeys].sort().map(task => taskFitness(task, byTask.get(task) ?? []));
	const outsideSuiteTasks = [...outside].sort();
	const reasons: string[] = [];
	const missing = suiteKeys.filter(task => !byTask.has(task));
	if (missing.length > 0) reasons.push(`missing suite tasks: ${missing.join(", ")}`);
	if (outsideSuiteTasks.length > 0) reasons.push(`trials outside suite: ${outsideSuiteTasks.join(", ")}`);
	const excluded = perTask.reduce((acc, t) => acc + t.excluded, 0);
	if (excluded > 0) reasons.push(`${excluded} trial(s) excluded as running or infrastructure failures`);
	const rewards = perTask.flatMap(t => (t.reward === null ? [] : [t.reward]));
	const vHat = mean(rewards);
	const decided = scored.filter(t => t.status !== "running");
	const startFailures = decided.filter(t => !t.transcript?.started).length;
	const signalHits: Record<string, number> = {};
	for (const trial of scored) {
		for (const signal of trial.transcript?.signals ?? []) signalHits[signal] = (signalHits[signal] ?? 0) + 1;
	}
	return {
		variantId: input.variantId,
		suiteId: input.suiteId,
		jobName: input.jobName,
		outsideSuiteTasks,
		complete: reasons.length === 0,
		incompleteReasons: reasons,
		vHat,
		...interval(rewards, vHat),
		tasks: perTask.filter(t => t.counted > 0).length,
		trials: scored.length,
		errors: perTask.reduce((acc, t) => acc + t.errors, 0),
		meanLlmCalls: mean(perTask.flatMap(t => (t.meanLlmCalls === null ? [] : [t.meanLlmCalls]))),
		meanOutputTokens: mean(perTask.flatMap(t => (t.meanOutputTokens === null ? [] : [t.meanOutputTokens]))),
		meanCostUsd: mean(perTask.filter(t => t.attempts > 0).map(t => t.meanCostUsd)) ?? 0,
		startFailureRate: decided.length === 0 ? null : startFailures / decided.length,
		signalHits,
		perTask,
	};
}
