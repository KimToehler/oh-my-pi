/**
 * Delegated (`task` subagent) usage extraction for omp transcripts. A call's
 * usage can appear in several events (blocking end, async terminal update, replays);
 * the richest snapshot per tool-call ID is kept and folded exactly once at EOF.
 */
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";

type UsageTuple = [input: number, output: number, cacheRead: number, cacheWrite: number];

/** Delegated usage of one `task` call as seen in a single event. */
export interface TaskSnapshot {
	results: number;
	requests: number;
	usage: UsageTuple;
}

/** Totals a snapshot contributes to a transcript tally. */
export interface TaskTotals {
	llmCalls: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
}

function num(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function usageTuple(usage: Record<string, unknown>): UsageTuple {
	return [num(usage.input), num(usage.output), num(usage.cacheRead), num(usage.cacheWrite)];
}

function snapshotOf(details: Record<string, unknown>): TaskSnapshot {
	const results = Array.isArray(details.results) ? details.results.filter(isRecord) : [];
	const snap: TaskSnapshot = { results: results.length, requests: 0, usage: [0, 0, 0, 0] };
	for (const child of results) snap.requests += num(child.requests);
	// Aggregate usage already includes every child; summing both would double count.
	const parts = isRecord(details.usage)
		? [usageTuple(details.usage)]
		: results.flatMap(child => (isRecord(child.usage) ? [usageTuple(child.usage)] : []));
	for (const part of parts) for (let i = 0; i < 4; i++) snap.usage[i] += part[i];
	return snap;
}

/** True when `next` is at least as rich as `prev`: results, then requests, then total tokens. */
function atLeastAsRich(next: TaskSnapshot, prev: TaskSnapshot): boolean {
	if (next.results !== prev.results) return next.results > prev.results;
	if (next.requests !== prev.requests) return next.requests > prev.requests;
	return next.usage.reduce((sum, value) => sum + value, 0) >= prev.usage.reduce((sum, value) => sum + value, 0);
}

/**
 * Record a candidate snapshot for a `task` call. Async updates count only when
 * terminal; a call without an ID is ignored rather than guessed.
 */
export function recordTaskDetails(
	snapshots: Map<string, TaskSnapshot>,
	toolCallId: unknown,
	details: unknown,
	requireAsyncTerminal: boolean,
): void {
	if (typeof toolCallId !== "string" || !isRecord(details)) return;
	const state = isRecord(details.async) ? details.async.state : undefined;
	if (requireAsyncTerminal && state !== "completed" && state !== "failed") return;
	const snap = snapshotOf(details);
	const prev = snapshots.get(toolCallId);
	if (!prev || atLeastAsRich(snap, prev)) snapshots.set(toolCallId, snap);
}

/** Fold each call's chosen snapshot into `tally` exactly once. */
export function foldTaskSnapshots(tally: TaskTotals, snapshots: ReadonlyMap<string, TaskSnapshot>): void {
	for (const snap of snapshots.values()) {
		tally.llmCalls += snap.requests;
		tally.inputTokens += snap.usage[0];
		tally.outputTokens += snap.usage[1];
		tally.cacheReadTokens += snap.usage[2];
		tally.cacheWriteTokens += snap.usage[3];
	}
}
