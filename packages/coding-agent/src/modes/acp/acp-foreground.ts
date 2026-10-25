/**
 * Foreground work: the unit of agent activity an ACP surface reports to its
 * client, independent of the wire protocol version. A v1 prompt owns exactly
 * one {@link ForegroundWork} (its `promptTurn` keeps only the pending-request
 * half); the v2 surface also creates agent-originated work for turns nobody
 * prompted.
 */
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { PromptResponse, Usage } from "@oh-my-pi/pi-utils/acp";
import type { AgentSession, AgentSessionEvent } from "../../session/agent-session";
import type { SubmissionOutcome } from "../../session/agent-session-types";
import type { UsageStatistics } from "../../session/session-entries";

export type AgentEndEvent = Extract<AgentSessionEvent, { type: "agent_end" }>;

export type ForegroundOrigin = "prompt" | "agent";

export type ForegroundWork = {
	/** `prompt`: started by a client prompt; `agent`: an autonomous turn (wake, goal continuation). */
	origin: ForegroundOrigin;
	abortController: AbortController;
	cancelRequested: boolean;
	/**
	 * Delivery of streamed assistant `error` chunks this work (the mapper
	 * surfaces them as `agent_message_chunk`s). Resolves `true` once at least
	 * one error chunk reached the client — the `agent_end` error fallback
	 * awaits it and stays silent on success, so a fallback racing an in-flight
	 * delivery can neither duplicate the error nor drop it when delivery fails.
	 */
	errorTextDelivery: Promise<boolean> | undefined;
	/**
	 * `abort()` is in-flight (or its bounded-timeout race). `undefined` while the work is
	 * running normally and after cleanup completes. The work occupies its slot for as long
	 * as it is unsettled or `cleanup` is set — that combined window is the "in flight"
	 * predicate every consumer gates on.
	 */
	cleanup: Promise<void> | undefined;
	usageBaseline: UsageStatistics;
	/** Latest `agent_end` of this work; a wake turn's end supersedes the first one for the stop reason. */
	lastAgentEnd: AgentEndEvent | undefined;
	/**
	 * The single wait for session quiescence, owned by the first `agent_end`
	 * handler. Later `agent_end`s (background-job wake turns) see it set and
	 * leave finishing the work to that handler.
	 */
	quiescenceWait: Promise<void> | undefined;
	/**
	 * Serializes builtin slash commands steered into this work (`/compact`,
	 * `/model`, …): each starts after the previous one finished. Owned by the
	 * work, so a command stuck in a cancelled work never blocks a later one.
	 */
	builtinSteerLane: Promise<void>;
	/** Steered builtins admitted into this work that have not finished yet; holds the work open. */
	pendingBuiltinSteers: number;
	/**
	 * Failure of the work's own command, kept when a steered builtin already
	 * armed the quiescence waiter: that waiter fails the work with it once
	 * the work the steered command started has finished.
	 */
	deferredError: unknown;
	/** Open client interactions (permission requests, elicitations) this work is blocked on. */
	pendingInteractions: number;
	/** Tool calls of this work between `tool_execution_start` and `tool_execution_end`; filled by surfaces that report aggregate state. */
	runningTools: Set<string>;
	/** Per-work event subscription (v1: prompt-scoped); the v2 session-lifetime subscription leaves it unset. */
	unsubscribe: (() => void) | undefined;
	/** Resolves once the surface ended this work (v1: the prompt response is resolved; v2: the foreground is cleared). */
	ended: Promise<void>;
	/** Called by the surface's `onForegroundEnd`; later calls are no-ops. */
	markEnded: () => void;
};

export function createForegroundWork(origin: ForegroundOrigin, usageBaseline: UsageStatistics): ForegroundWork {
	const ended = Promise.withResolvers<void>();
	return {
		origin,
		abortController: new AbortController(),
		cancelRequested: false,
		errorTextDelivery: undefined,
		cleanup: undefined,
		usageBaseline,
		lastAgentEnd: undefined,
		quiescenceWait: undefined,
		builtinSteerLane: Promise.resolve(),
		pendingBuiltinSteers: 0,
		deferredError: undefined,
		pendingInteractions: 0,
		runningTools: new Set(),
		unsubscribe: undefined,
		ended: ended.promise,
		markEnded: ended.resolve,
	};
}

/**
 * The v1 half of a prompt: the pending `session/prompt` request. The work
 * itself lives in {@link ForegroundWork}.
 */
export type PromptTurnState = {
	readonly work: ForegroundWork;
	settled: boolean;
	resolve: (value: PromptResponse) => void;
	reject: (reason?: unknown) => void;
	promise: Promise<PromptResponse>;
};

/**
 * A turn is "in flight" from the moment `prompt()` reserves the slot until `settled` is
 * true AND any cancel cleanup has completed. Fork/queue/event gating all depend on this
 * combined window — a settled-but-still-aborting turn is not safe to fork from, queue
 * onto, or forward late events for.
 */
export function isPromptTurnInFlight(turn: PromptTurnState | undefined): turn is PromptTurnState {
	return turn !== undefined && (!turn.settled || turn.work.cleanup !== undefined);
}

/** What {@link isAcpSessionQuiescent} reads from the session record. */
export type AcpQuiescenceHost = {
	readonly session: AgentSession;
	readonly pendingSteers: number;
	readonly goal: { readonly continuationPending: boolean };
};

/**
 * True when nothing can still produce output for the open foreground work: no run is
 * live or admitted, no tracked post-prompt work (queued-message drain, idle
 * yield flush, retry, compaction continuation) is scheduled, no owner-scoped
 * background work can wake the session, and no steer or steered builtin
 * command is still being admitted or run.
 *
 * `queuedMessageCount` is deliberately not consulted: it also counts hidden
 * next-turn context (e.g. `/tan`'s dispatch breadcrumb) and interrupt-held
 * follow-ups, which only the user's next prompt consumes. Waiting on them
 * would never resolve; a queued message that will drain is already visible as
 * scheduled post-prompt work.
 */
export function isAcpSessionQuiescent(
	host: AcpQuiescenceHost,
	work: ForegroundWork,
	/** Whether owner-scoped background jobs still hold the work open (v1: yes; v2: they wake as separate work). */
	includeBackgroundWork: boolean,
): boolean {
	const session = host.session;
	return (
		host.pendingSteers === 0 &&
		!host.goal.continuationPending &&
		work.pendingBuiltinSteers === 0 &&
		!session.isStreaming &&
		!session.hasAdmittedSubmission &&
		!session.hasPostPromptWork &&
		(!includeBackgroundWork || !session.hasPendingAsyncWork())
	);
}

export function cloneUsageStatistics(usage: UsageStatistics): UsageStatistics {
	return { ...usage };
}

/** Token usage `work` consumed: `current` minus the baseline taken when it started. */
export function buildTurnUsage(work: ForegroundWork | undefined, current: UsageStatistics): Usage | undefined {
	if (!work) return undefined;
	const previous = work.usageBaseline;
	const inputTokens = Math.max(0, current.input - previous.input);
	const outputTokens = Math.max(0, current.output - previous.output);
	const cachedReadTokens = Math.max(0, current.cacheRead - previous.cacheRead);
	const cachedWriteTokens = Math.max(0, current.cacheWrite - previous.cacheWrite);
	const totalTokens = Math.max(0, current.totalTokens - previous.totalTokens);

	if (totalTokens === 0) {
		return undefined;
	}

	const usage: Usage = {
		inputTokens,
		outputTokens,
		totalTokens,
	};
	if (cachedReadTokens > 0) {
		usage.cachedReadTokens = cachedReadTokens;
	}
	if (cachedWriteTokens > 0) {
		usage.cachedWriteTokens = cachedWriteTokens;
	}
	return usage;
}

/** Provider error text that marks a content-filter refusal rather than a failure. */
function isRefusal(message: AssistantMessage): boolean {
	return /content[_ ]?filter|refus(al|ed)/i.test(message.errorMessage ?? "");
}

/**
 * The provider failure that ended `work`, if its last reply failed with an error other than a
 * refusal and no cancel was requested. v1 reports such a turn as `end_turn`; v2 reports
 * `idle(error)` with this message.
 */
export function resolveTurnFailure(work: ForegroundWork): string | undefined {
	if (work.cancelRequested) return undefined;
	const lastAssistant = work.lastAgentEnd?.messages.findLast(
		(message): message is AssistantMessage => message.role === "assistant",
	);
	if (lastAssistant?.stopReason !== "error" || isRefusal(lastAssistant)) return undefined;
	return lastAssistant.errorMessage || "The model request failed";
}

/** Stop reason of `work`: its last `agent_end`, or `cancelled` once a cancel was requested. */
export function resolveStopReason(work: ForegroundWork): PromptResponse["stopReason"] {
	if (work.cancelRequested) {
		return "cancelled";
	}
	const lastAssistant = work.lastAgentEnd?.messages.findLast(
		(message): message is AssistantMessage => message.role === "assistant",
	);
	switch (lastAssistant?.stopReason) {
		case "aborted":
			return "cancelled";
		case "length":
			return "max_tokens";
		case "error":
			return isRefusal(lastAssistant) ? "refusal" : "end_turn";
		default:
			return "end_turn";
	}
}

/**
 * True when `work` waits on the client and nothing else progresses: an interaction is open and every running
 * tool is blocked on one (or no tool runs). Interactions are counted per call, not per tool, so a tool holding
 * two interactions at once can mask a sibling that is still running.
 */
export function isBlockedOnInteraction(work: ForegroundWork): boolean {
	return work.pendingInteractions > 0 && work.pendingInteractions >= work.runningTools.size;
}

/** Runs one open client interaction (permission request, elicitation) and counts it against the current foreground work. */
export type InteractionTracker = <T>(run: () => Promise<T>) => Promise<T>;

/**
 * Count one open client interaction against `work` while `run` is pending.
 * `changed` fires on every open and every close, so the aggregate state follows the count, not only its zero boundaries.
 */
export async function trackInteraction<T>(
	work: ForegroundWork | undefined,
	changed: (work: ForegroundWork) => void,
	run: () => Promise<T>,
): Promise<T> {
	if (!work) return await run();
	// `run` starts first so the client's request is on the wire before `changed` announces it.
	const pending = run();
	work.pendingInteractions++;
	changed(work);
	try {
		return await pending;
	} finally {
		work.pendingInteractions--;
		changed(work);
	}
}

/** Wraps an outcome callback so a submission reports at most once; later reports (e.g. a builtin finishing after Stop) are dropped. */
export function singleShotOutcome(
	report: ((outcome: SubmissionOutcome) => void) | undefined,
): ((outcome: SubmissionOutcome) => void) | undefined {
	if (!report) return undefined;
	let reported = false;
	return outcome => {
		if (reported) return;
		reported = true;
		report(outcome);
	};
}
