/**
 * Streaming metrics extraction from an omp `--mode json` transcript (`agent/omp.txt`).
 *
 * The file mixes JSONL events with raw stderr lines. Only fields the harness
 * emits as structure are read; prompt/message text is never inspected.
 */
import * as fs from "node:fs";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { addCost, foldTaskSnapshots, recordTaskDetails, type TaskSnapshot, usageCost } from "./transcript-task";

/** Per-trial metrics derived from one transcript. */
export interface TranscriptMetrics {
	/** Main-agent assistant messages plus delegated subagent requests. */
	readonly llmCalls: number;
	/** Assistant messages that ended with `stopReason: "error"`. */
	readonly llmErrors: number;
	readonly turns: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	/**
	 * Main-agent `usage.cost.total` plus delegated task usage cost, same scope as the token counts.
	 * Null when no usage record carried a cost; consumers must not treat null as 0.
	 */
	readonly costUsd: number | null;
	readonly toolCalls: number;
	readonly toolErrors: number;
	readonly compactions: number;
	readonly retries: number;
	readonly finalStopReason: string | null;
	/** True once at least one assistant message ended. */
	readonly started: boolean;
	readonly startupErrors: readonly string[];
	/** Sorted unique `tool:`/`skill:`/`rule:`/`agent:`/`mark:` evidence. */
	readonly signals: readonly string[];
	/** Oversized lines and `{`-prefixed lines that failed JSON parsing. */
	readonly droppedLines: number;
}

export interface TranscriptOptions {
	/** Lines longer than this are skipped and counted in `droppedLines`. */
	readonly maxLineBytes?: number;
	/** Read buffer size. */
	readonly chunkBytes?: number;
}

const DEFAULT_MAX_LINE_BYTES = 4 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES = 1024 * 1024;
const MAX_STARTUP_ERRORS = 20;
const MAX_STARTUP_ERROR_CHARS = 500;
const MARK_LINE = /^EVO-MARK:([A-Za-z0-9._:-]+)$/;
const EXTENSION_LOAD_FAILURE = /^Failed to load extension\b/;

interface Tally {
	llmCalls: number;
	llmErrors: number;
	turns: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	costUsd: number | null;
	toolCalls: number;
	toolErrors: number;
	compactions: number;
	retries: number;
	finalStopReason: string | null;
	started: boolean;
	droppedLines: number;
	readonly startupErrors: Set<string>;
	readonly signals: Set<string>;
	/** Richest delegated-usage snapshot per `task` tool-call ID, folded once at EOF. */
	readonly taskSnapshots: Map<string, TaskSnapshot>;
}

function num(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addUsage(tally: Tally, usage: Record<string, unknown>): void {
	tally.inputTokens += num(usage.input);
	tally.outputTokens += num(usage.output);
	tally.cacheReadTokens += num(usage.cacheRead);
	tally.cacheWriteTokens += num(usage.cacheWrite);
	tally.costUsd = addCost(tally.costUsd, usageCost(usage));
}

function readSignalPath(tally: Tally, pathArg: unknown): void {
	if (typeof pathArg !== "string") return;
	for (const scheme of ["skill", "rule"] as const) {
		const prefix = `${scheme}://`;
		if (!pathArg.startsWith(prefix)) continue;
		const name = pathArg.slice(prefix.length).split(/[/?#]/, 1)[0];
		if (name) tally.signals.add(`${scheme}:${name}`);
	}
}

function taskAgentSignals(tally: Tally, args: Record<string, unknown>): void {
	const agents: unknown[] = [args.agent];
	if (Array.isArray(args.tasks)) for (const item of args.tasks) agents.push(isRecord(item) ? item.agent : undefined);
	for (const agent of agents) if (typeof agent === "string" && agent) tally.signals.add(`agent:${agent}`);
}

function onToolStart(tally: Tally, event: Record<string, unknown>): void {
	tally.toolCalls++;
	if (typeof event.toolName !== "string" || !event.toolName) return;
	tally.signals.add(`tool:${event.toolName}`);
	const args = isRecord(event.args) ? event.args : undefined;
	if (!args) return;
	if (event.toolName === "read") readSignalPath(tally, args.path);
	else if (event.toolName === "task") taskAgentSignals(tally, args);
}

function onEvent(tally: Tally, event: Record<string, unknown>): void {
	switch (event.type) {
		case "message_end": {
			const message = event.message;
			if (!isRecord(message) || message.role !== "assistant") return;
			tally.started = true;
			tally.llmCalls++;
			if (message.stopReason === "error") tally.llmErrors++;
			if (typeof message.stopReason === "string") tally.finalStopReason = message.stopReason;
			if (isRecord(message.usage)) addUsage(tally, message.usage);
			return;
		}
		case "turn_end":
			tally.turns++;
			return;
		case "tool_execution_start":
			onToolStart(tally, event);
			return;
		case "tool_execution_end":
			if (event.isError === true) tally.toolErrors++;
			if (event.toolName === "task" && isRecord(event.result)) {
				recordTaskDetails(tally.taskSnapshots, event.toolCallId, event.result.details, false);
			}
			return;
		case "tool_execution_update":
			if (event.toolName === "task" && isRecord(event.partialResult)) {
				recordTaskDetails(tally.taskSnapshots, event.toolCallId, event.partialResult.details, true);
			}
			return;
		case "auto_retry_start":
			tally.retries++;
			return;
		case "auto_compaction_end":
			if (event.aborted !== true && event.result !== undefined && event.result !== null) tally.compactions++;
			return;
		case "ttsr_triggered":
			if (!Array.isArray(event.rules)) return;
			for (const rule of event.rules) {
				if (isRecord(rule) && typeof rule.name === "string" && rule.name) tally.signals.add(`rule:${rule.name}`);
			}
			return;
	}
}

function onTextLine(tally: Tally, line: string): void {
	const mark = MARK_LINE.exec(line);
	if (mark) {
		tally.signals.add(`mark:${mark[1]}`);
		return;
	}
	if (EXTENSION_LOAD_FAILURE.test(line) && tally.startupErrors.size < MAX_STARTUP_ERRORS) {
		tally.startupErrors.add(line.slice(0, MAX_STARTUP_ERROR_CHARS));
	}
}

function onLine(tally: Tally, raw: string): void {
	const line = raw.trim();
	if (!line) return;
	if (!line.startsWith("{")) {
		onTextLine(tally, line);
		return;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		tally.droppedLines++;
		return;
	}
	if (isRecord(parsed)) onEvent(tally, parsed);
}

/**
 * Summarize a transcript with bounded memory: fixed-size reads, and a line
 * longer than `maxLineBytes` is discarded up to its newline. A missing or
 * unreadable file yields zeroed metrics with `started: false`.
 */
export function summarizeOmpTranscript(file: string, options: TranscriptOptions = {}): TranscriptMetrics {
	const maxLine = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
	const tally: Tally = {
		llmCalls: 0,
		llmErrors: 0,
		turns: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		costUsd: null,
		toolCalls: 0,
		toolErrors: 0,
		compactions: 0,
		retries: 0,
		finalStopReason: null,
		started: false,
		droppedLines: 0,
		startupErrors: new Set(),
		signals: new Set(),
		taskSnapshots: new Map(),
	};
	let fd: number | null = null;
	try {
		fd = fs.openSync(file, "r");
		const chunk = Buffer.allocUnsafe(options.chunkBytes ?? DEFAULT_CHUNK_BYTES);
		let remainder: Buffer = Buffer.alloc(0);
		let discarding = false;
		let position = 0;
		for (;;) {
			const read = fs.readSync(fd, chunk, 0, chunk.length, position);
			if (read <= 0) break;
			position += read;
			const data =
				remainder.length > 0 ? Buffer.concat([remainder, chunk.subarray(0, read)]) : chunk.subarray(0, read);
			let start = 0;
			for (;;) {
				const nl = data.indexOf(0x0a, start);
				if (nl === -1) break;
				if (discarding) discarding = false;
				else if (nl - start > maxLine) tally.droppedLines++;
				else onLine(tally, data.toString("utf8", start, nl));
				start = nl + 1;
			}
			// Copy: `data` may alias the reusable read buffer.
			remainder = discarding ? Buffer.alloc(0) : Buffer.from(data.subarray(start));
			if (remainder.length > maxLine) {
				tally.droppedLines++;
				remainder = Buffer.alloc(0);
				discarding = true;
			}
		}
		if (!discarding && remainder.length > 0) onLine(tally, remainder.toString("utf8"));
	} catch {
		/* unreadable transcript: report whatever was accumulated */
	} finally {
		if (fd !== null) fs.closeSync(fd);
	}
	foldTaskSnapshots(tally, tally.taskSnapshots);
	return {
		llmCalls: tally.llmCalls,
		llmErrors: tally.llmErrors,
		turns: tally.turns,
		inputTokens: tally.inputTokens,
		outputTokens: tally.outputTokens,
		cacheReadTokens: tally.cacheReadTokens,
		cacheWriteTokens: tally.cacheWriteTokens,
		costUsd: tally.costUsd,
		toolCalls: tally.toolCalls,
		toolErrors: tally.toolErrors,
		compactions: tally.compactions,
		retries: tally.retries,
		finalStopReason: tally.finalStopReason,
		started: tally.started,
		startupErrors: [...tally.startupErrors],
		signals: [...tally.signals].sort(),
		droppedLines: tally.droppedLines,
	};
}
