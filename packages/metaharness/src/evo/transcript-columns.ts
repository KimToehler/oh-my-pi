/** SQLite column mapping for per-trial {@link TranscriptMetrics}; every column is nullable. */
import type { TranscriptMetrics } from "./transcript";

export const TRANSCRIPT_COLUMNS: ReadonlyArray<readonly [name: string, sqlType: "INTEGER" | "REAL" | "TEXT"]> = [
	["llm_calls", "INTEGER"],
	["llm_errors", "INTEGER"],
	["turns", "INTEGER"],
	["input_tokens", "INTEGER"],
	["output_tokens", "INTEGER"],
	["cache_read_tokens", "INTEGER"],
	["cache_write_tokens", "INTEGER"],
	["transcript_cost_usd", "REAL"],
	["tool_calls", "INTEGER"],
	["tool_errors", "INTEGER"],
	["compactions", "INTEGER"],
	["retries", "INTEGER"],
	["final_stop_reason", "TEXT"],
	["started", "INTEGER"],
	["startup_errors_json", "TEXT"],
	["signals_json", "TEXT"],
	["dropped_lines", "INTEGER"],
	["task_snapshot_conflicts", "INTEGER"],
	["transcript_complete", "INTEGER"],
];

/** Column names in bind order for {@link transcriptParams}. */
export const TRANSCRIPT_COLUMN_NAMES: readonly string[] = TRANSCRIPT_COLUMNS.map(([name]) => name);

/** Bind values matching {@link TRANSCRIPT_COLUMN_NAMES}; all null when there is no summary. */
export function transcriptParams(t: TranscriptMetrics | null | undefined): Array<number | string | null> {
	if (!t) return TRANSCRIPT_COLUMNS.map(() => null);
	return [
		t.llmCalls,
		t.llmErrors,
		t.turns,
		t.inputTokens,
		t.outputTokens,
		t.cacheReadTokens,
		t.cacheWriteTokens,
		t.costUsd,
		t.toolCalls,
		t.toolErrors,
		t.compactions,
		t.retries,
		t.finalStopReason,
		t.started ? 1 : 0,
		JSON.stringify(t.startupErrors),
		JSON.stringify(t.signals),
		t.droppedLines,
		t.taskSnapshotConflicts,
		t.transcriptComplete ? 1 : 0,
	];
}

function strings(value: unknown): string[] {
	if (typeof value !== "string") return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

/** Rebuild metrics from a `trials` row; null when the trial has no transcript summary. */
export function rowToTranscript(row: Record<string, unknown>): TranscriptMetrics | null {
	if (row.llm_calls === null || row.llm_calls === undefined) return null;
	return {
		llmCalls: Number(row.llm_calls),
		llmErrors: Number(row.llm_errors),
		turns: Number(row.turns),
		inputTokens: Number(row.input_tokens),
		outputTokens: Number(row.output_tokens),
		cacheReadTokens: Number(row.cache_read_tokens),
		cacheWriteTokens: Number(row.cache_write_tokens),
		costUsd:
			row.transcript_cost_usd === null || row.transcript_cost_usd === undefined
				? null
				: Number(row.transcript_cost_usd),
		toolCalls: Number(row.tool_calls),
		toolErrors: Number(row.tool_errors),
		compactions: Number(row.compactions),
		retries: Number(row.retries),
		finalStopReason: row.final_stop_reason === null ? null : String(row.final_stop_reason),
		started: Number(row.started) === 1,
		startupErrors: strings(row.startup_errors_json),
		signals: strings(row.signals_json),
		droppedLines: Number(row.dropped_lines),
		taskSnapshotConflicts: Number(row.task_snapshot_conflicts ?? 0),
		// Null (pre-column row) is unknown, which is not complete.
		transcriptComplete: Number(row.transcript_complete ?? 0) === 1,
	};
}
