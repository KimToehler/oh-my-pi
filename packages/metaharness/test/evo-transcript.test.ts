import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { summarizeOmpTranscript } from "../src/evo/transcript";
import { readTrials } from "../src/runner";
import { RunStore } from "../src/store";

const tmpDirs: string[] = [];
function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evo-transcript-"));
	tmpDirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

type Json = Record<string, unknown>;

function usage(input: number, output: number, cacheRead = 0, cacheWrite = 0): Json {
	return { input, output, cacheRead, cacheWrite, totalTokens: input + output + cacheRead + cacheWrite };
}
function assistantEnd(u: Json | undefined, stopReason = "stop"): Json {
	return { type: "message_end", message: { role: "assistant", stopReason, ...(u ? { usage: u } : {}) } };
}
function toolStart(id: string, name: string, args: unknown): Json {
	return { type: "tool_execution_start", toolCallId: id, toolName: name, args };
}
function toolEnd(id: string, name: string, result: unknown, isError = false): Json {
	return { type: "tool_execution_end", toolCallId: id, toolName: name, result, isError };
}
function write(dir: string, lines: ReadonlyArray<Json | string>, name = "omp.txt"): string {
	const file = path.join(dir, name);
	fs.writeFileSync(file, `${lines.map(l => (typeof l === "string" ? l : JSON.stringify(l))).join("\n")}\n`);
	return file;
}

describe("summarizeOmpTranscript", () => {
	it("counts main usage once and task aggregate usage once, never adding child usage twice", () => {
		const file = write(tmpDir(), [
			assistantEnd(usage(100, 10, 50, 5)),
			toolStart("t1", "task", { agent: "scout", task: "x", solutionSpace: "y" }),
			// Aggregate usage AND per-child usage present: only the aggregate counts.
			toolEnd("t1", "task", {
				details: {
					usage: usage(1000, 200, 300, 40),
					results: [
						{ requests: 3, usage: usage(400, 80, 100, 10) },
						{ requests: 4, usage: usage(600, 120, 200, 30) },
					],
				},
			}),
			// Same terminal event replayed (resume/duplicate write): ignored.
			toolEnd("t1", "task", {
				details: { usage: usage(1000, 200, 300, 40), results: [{ requests: 7, usage: usage(1000, 200, 300, 40) }] },
			}),
			assistantEnd(usage(7, 3, 2, 1)),
		]);
		const m = summarizeOmpTranscript(file);
		expect(m.llmCalls).toBe(2 + 7);
		expect(m.inputTokens).toBe(100 + 7 + 1000);
		expect(m.outputTokens).toBe(10 + 3 + 200);
		expect(m.cacheReadTokens).toBe(50 + 2 + 300);
		expect(m.cacheWriteTokens).toBe(5 + 1 + 40);
	});

	it("falls back to summing results[].usage when aggregate usage is absent", () => {
		const file = write(tmpDir(), [
			toolEnd("t1", "task", {
				details: {
					results: [
						{ requests: 2, usage: usage(10, 1, 2, 3) },
						{ requests: 5, usage: usage(20, 2, 4, 6) },
						{ requests: 1 },
					],
				},
			}),
		]);
		const m = summarizeOmpTranscript(file);
		expect(m.llmCalls).toBe(8);
		expect([m.inputTokens, m.outputTokens, m.cacheReadTokens, m.cacheWriteTokens]).toEqual([30, 3, 6, 9]);
	});

	it("does not treat non-task tool results as subagent usage", () => {
		const file = write(tmpDir(), [
			toolEnd("b1", "bash", { details: { usage: usage(999, 999), results: [{ requests: 9 }] } }),
		]);
		const m = summarizeOmpTranscript(file);
		expect(m.llmCalls).toBe(0);
		expect(m.inputTokens).toBe(0);
	});

	it("derives lifecycle, tool, error, and stop-reason fields", () => {
		const file = write(tmpDir(), [
			{ type: "turn_start" },
			assistantEnd(usage(1, 1), "toolUse"),
			toolStart("a", "bash", { command: "ls" }),
			toolEnd("a", "bash", { content: [] }),
			toolStart("b", "read", { path: "a.ts" }),
			toolEnd("b", "read", { content: [] }, true),
			{ type: "turn_end" },
			{ type: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 10 },
			assistantEnd(usage(1, 1), "error"),
			{ type: "turn_end" },
			{ type: "auto_compaction_start", reason: "threshold", action: "context-full" },
			{ type: "auto_compaction_end", action: "context-full", result: { summary: "s" }, aborted: false },
			{ type: "auto_compaction_start", reason: "threshold", action: "context-full" },
			{ type: "auto_compaction_end", action: "context-full", result: undefined, aborted: true },
			{ type: "message_end", message: { role: "user" } },
			assistantEnd(usage(1, 1), "stop"),
			{ type: "turn_end" },
		]);
		const m = summarizeOmpTranscript(file);
		expect(m).toMatchObject({
			llmCalls: 3,
			llmErrors: 1,
			turns: 3,
			toolCalls: 2,
			toolErrors: 1,
			compactions: 1,
			retries: 1,
			finalStopReason: "stop",
			started: true,
			startupErrors: [],
			droppedLines: 0,
		});
	});

	it("reports not started with null stop reason when no assistant message ended", () => {
		const file = write(tmpDir(), [{ type: "message_end", message: { role: "user" } }, "boom"]);
		const m = summarizeOmpTranscript(file);
		expect(m.started).toBe(false);
		expect(m.finalStopReason).toBeNull();
		expect(m.llmCalls).toBe(0);
	});

	it("derives sorted unique signals from tools, skill/rule reads, agents, ttsr, and exact markers", () => {
		const file = write(tmpDir(), [
			toolStart("1", "read", { path: "skill://debugging/SKILL.md" }),
			toolStart("2", "read", { path: "skill://debugging" }),
			toolStart("3", "read", { path: "rule://worktrees" }),
			toolStart("4", "read", { path: "/etc/hosts" }),
			toolStart("5", "task", { agent: "scout", task: "t", solutionSpace: "s" }),
			toolStart("6", "task", {
				context: "c",
				tasks: [
					{ agent: "oracle", task: "t", solutionSpace: "s" },
					{ agent: "scout", task: "t", solutionSpace: "s" },
					{ task: "no agent", solutionSpace: "s" },
				],
			}),
			{ type: "ttsr_triggered", rules: [{ name: "no-any", content: "PROMPT TEXT" }, { name: "worktrees" }, {}] },
			"EVO-MARK:gene-1",
			"EVO-MARK:gene-1",
			"prefix EVO-MARK:ignored",
			"EVO-MARK:",
			"EVO-MARK:bad id",
			JSON.stringify({ type: "message_end", message: { role: "assistant", content: "EVO-MARK:from-json" } }),
		]);
		const m = summarizeOmpTranscript(file);
		expect(m.signals).toEqual([
			"agent:oracle",
			"agent:scout",
			"mark:gene-1",
			"rule:no-any",
			"rule:worktrees",
			"skill:debugging",
			"tool:read",
			"tool:task",
		]);
		expect([...m.signals]).toEqual([...m.signals].sort());
	});

	it("captures extension load failures from non-JSON lines as startup errors", () => {
		const file = write(tmpDir(), [
			"Failed to load extension /x/ext.ts: SyntaxError: nope",
			"Failed to load extension /x/ext.ts: SyntaxError: nope",
			JSON.stringify({
				type: "message_end",
				message: { role: "assistant", content: "Failed to load extension fake" },
			}),
		]);
		const m = summarizeOmpTranscript(file);
		expect(m.startupErrors).toEqual(["Failed to load extension /x/ext.ts: SyntaxError: nope"]);
		expect(m.started).toBe(true);
	});

	it("recovers after malformed and oversized lines and counts them as dropped", () => {
		const dir = tmpDir();
		const file = path.join(dir, "omp.txt");
		const huge = JSON.stringify({ type: "tool_execution_start", toolName: "bash", pad: "x".repeat(5000) });
		fs.writeFileSync(
			file,
			[
				JSON.stringify(assistantEnd(usage(1, 1))),
				"{not json",
				huge,
				JSON.stringify(toolStart("a", "bash", {})),
				JSON.stringify(assistantEnd(usage(2, 2))),
			].join("\n"), // final line has no trailing newline
		);
		const m = summarizeOmpTranscript(file, { maxLineBytes: 1024, chunkBytes: 64 });
		expect(m.llmCalls).toBe(2);
		expect(m.inputTokens).toBe(3);
		expect(m.toolCalls).toBe(1);
		expect(m.droppedLines).toBe(2);
	});

	it("gives identical results across chunk sizes", () => {
		const dir = tmpDir();
		const file = write(dir, [
			assistantEnd(usage(1, 2)),
			toolStart("a", "bash", {}),
			"héllo ✓ EVO-MARK:é",
			"EVO-MARK:ok",
		]);
		const small = summarizeOmpTranscript(file, { chunkBytes: 7 });
		const big = summarizeOmpTranscript(file);
		expect(small).toEqual(big);
	});
});

function seedTrial(jobDir: string, name: string, opts: { result: boolean; lines: ReadonlyArray<Json | string> }): void {
	const trialDir = path.join(jobDir, name);
	fs.mkdirSync(path.join(trialDir, "agent"), { recursive: true });
	write(path.join(trialDir, "agent"), opts.lines);
	if (opts.result) {
		fs.writeFileSync(
			path.join(trialDir, "result.json"),
			JSON.stringify({
				agent_result: { n_input_tokens: 1, n_output_tokens: 1, n_cache_tokens: 0, cost_usd: 0.5 },
				verifier_result: { rewards: { reward: 1 } },
				started_at: "2026-01-01T00:00:00Z",
				finished_at: "2026-01-01T00:00:10Z",
			}),
		);
	}
}

describe("trial transcript persistence", () => {
	it("summarizes finished Harbor trials only; running trials carry null metrics", () => {
		const jobDir = tmpDir();
		const lines = [assistantEnd(usage(5, 6, 7, 8)), toolStart("a", "bash", {})];
		seedTrial(jobDir, "done__aaa", { result: true, lines });
		seedTrial(jobDir, "live__bbb", { result: false, lines });
		const trials = readTrials(jobDir);
		const done = trials.find(t => t.name === "done__aaa");
		const live = trials.find(t => t.name === "live__bbb");
		expect(done?.transcript).toMatchObject({
			llmCalls: 1,
			inputTokens: 5,
			outputTokens: 6,
			toolCalls: 1,
			started: true,
		});
		expect(done?.tokIn).toBe(1); // existing aggregate unchanged: still from result.json
		expect(live?.status).toBe("running");
		expect(live?.transcript).toBeNull();
	});

	it("persists metrics through RunStore.listTraces, clears them on resume, migrates old DBs", () => {
		const jobsDir = tmpDir();
		const store = new RunStore(jobsDir);
		const jobName = "evo-job";
		const jobDir = path.join(jobsDir, jobName);
		fs.mkdirSync(jobDir, { recursive: true });
		store.registerLaunch({
			jobName,
			benchmark: "harbor",
			dataset: "d",
			agent: "omp",
			models: ["m"],
			pid: process.pid,
		});
		seedTrial(jobDir, "t__abc", {
			result: true,
			lines: [
				assistantEnd(usage(11, 12, 13, 14)),
				toolStart("a", "task", { agent: "scout" }),
				"EVO-MARK:m1",
				"Failed to load extension /x: boom",
			],
		});
		store.syncRun(jobName);
		const done = store.listTraces(jobName)[0];
		expect(done.transcript).toMatchObject({
			llmCalls: 1,
			inputTokens: 11,
			outputTokens: 12,
			cacheReadTokens: 13,
			cacheWriteTokens: 14,
			toolCalls: 1,
			started: true,
			signals: ["agent:scout", "mark:m1", "tool:task"],
			startupErrors: ["Failed to load extension /x: boom"],
		});

		// resumed: result.json removed, trial running again -> terminal summary cleared
		fs.rmSync(path.join(jobDir, "t__abc", "result.json"));
		store.syncRun(jobName);
		const resumed = store.listTraces(jobName)[0];
		expect(resumed.status).toBe("running");
		expect(resumed.transcript).toBeNull();
		store.close();
	});
});
