/**
 * Failure provenance: WHERE in the pipeline a trial's outcome was observed, never what its error text says.
 * Only `model_outcome` rewards are evidence about a candidate; every other phase is non-decisionable.
 */
import type { TranscriptMetrics } from "./transcript";

export const FAILURE_PHASES = [
	"model_outcome",
	"variant_startup_failure",
	"executor_infra_failure",
	"unknown",
] as const;
export type FailurePhase = (typeof FAILURE_PHASES)[number];

export function parseFailurePhase(value: unknown): FailurePhase | null {
	return FAILURE_PHASES.find(phase => phase === value) ?? null;
}

/**
 * The single executor exception that is a model-attributable terminal verdict: the agent ran and
 * exhausted its own time budget. This is an allow-list of the one genuine model outcome; every other
 * exception from the executor fails closed as infrastructure.
 */
const AGENT_BUDGET_EXCEPTION = "AgentTimeoutError";

export interface PhaseEvidence {
	/** Executor exception recorded for the trial, if any. */
	exception: string | null;
	/** Verifier reward, if the verifier ran. */
	reward: number | null;
	/** Omp transcript summary; null when no transcript was read. */
	transcript: TranscriptMetrics | null;
	/**
	 * The run's provider route was observed dead after harbor returned. Host infrastructure failed, so no
	 * outcome of this run is evidence about the model; takes precedence over every verdict.
	 */
	providerRouteLost?: boolean;
}

/** Phase of a terminal harbor trial. Missing evidence yields `unknown`, never `model_outcome`. */
export function classifyHarborPhase(evidence: PhaseEvidence): FailurePhase {
	const { exception, reward, transcript, providerRouteLost } = evidence;
	if (providerRouteLost === true) return "executor_infra_failure";
	if (transcript === null) return "unknown";
	// The agent never produced an assistant message: it/its config overlay never came up.
	if (!transcript.started) return "variant_startup_failure";
	if (exception !== null) return exception === AGENT_BUDGET_EXCEPTION ? "model_outcome" : "executor_infra_failure";
	return reward === null ? "unknown" : "model_outcome";
}
