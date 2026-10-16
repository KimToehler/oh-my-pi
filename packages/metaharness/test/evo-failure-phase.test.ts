import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { compareFitness } from "../src/evo/compare";
import { computeFitness } from "../src/evo/fitness";
import type { VariantRow } from "../src/evo/variant-types";
import { readTrials } from "../src/runner";
import { RunStore, type TraceRow } from "../src/store";

const dirs: string[] = [];
function tmp(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evo-phase-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const ASSISTANT = `${JSON.stringify({ type: "message_end", message: { role: "assistant", stopReason: "stop", usage: { input: 1, output: 1 } } })}\n`;

/** Seed a finished harbor trial; `transcript` is the omp.txt body (empty = agent never produced a message). */
function seed(
	jobDir: string,
	name: string,
	o: { transcript: string; exception?: string; reward?: number | null },
): void {
	const dir = path.join(jobDir, name);
	fs.mkdirSync(path.join(dir, "agent"), { recursive: true });
	fs.writeFileSync(path.join(dir, "agent", "omp.txt"), o.transcript);
	fs.writeFileSync(
		path.join(dir, "result.json"),
		JSON.stringify({
			started_at: "2026-01-01T00:00:00Z",
			finished_at: "2026-01-01T00:00:10Z",
			...(o.reward === null ? {} : { verifier_result: { rewards: { reward: o.reward ?? 0 } } }),
			...(o.exception ? { exception_info: { exception_type: o.exception } } : {}),
		}),
	);
}

const phaseOf = (jobDir: string, name: string) => readTrials(jobDir).find(t => t.name === name)?.phase;

describe("failure provenance classification", () => {
	it("started:false with an error text found in no list is variant_startup_failure", () => {
		const jobDir = tmp();
		seed(jobDir, "t__a", { transcript: "", exception: "TotallyNovelPreAgentBoom", reward: null });
		expect(phaseOf(jobDir, "t__a")).toBe("variant_startup_failure");
	});

	it("NonZeroAgentExitCodeError after the agent started is executor_infra_failure", () => {
		const jobDir = tmp();
		seed(jobDir, "t__a", { transcript: ASSISTANT, exception: "NonZeroAgentExitCodeError", reward: null });
		expect(phaseOf(jobDir, "t__a")).toBe("executor_infra_failure");
	});

	it("an agent that ran to a verifier verdict of 0 is model_outcome", () => {
		const jobDir = tmp();
		seed(jobDir, "t__a", { transcript: ASSISTANT, reward: 0 });
		expect(phaseOf(jobDir, "t__a")).toBe("model_outcome");
	});

	it("a started trial with no verdict and no exception is unknown, never model_outcome", () => {
		const jobDir = tmp();
		seed(jobDir, "t__a", { transcript: ASSISTANT, reward: null });
		expect(phaseOf(jobDir, "t__a")).toBe("unknown");
	});

	it("persists the phase through the store; pre-existing rows without phase read back null", () => {
		const jobsDir = tmp();
		const store = new RunStore(jobsDir);
		store.registerLaunch({ benchmark: "harbor", jobName: "j", dataset: "d", agent: "omp", models: ["m"], pid: 1 });
		seed(path.join(jobsDir, "j"), "t__a", { transcript: "", exception: "X", reward: null });
		store.syncRun("j");
		expect(store.listTraces("j")[0]?.phase).toBe("variant_startup_failure");
	});
});

const trial = (task: string, over: Partial<TraceRow>): TraceRow => ({
	jobName: "j",
	name: `${task}__1`,
	task,
	status: "fail",
	reward: 0,
	costUsd: 0,
	durationMs: 1,
	detail: "",
	phase: "model_outcome",
	updatedAt: 0,
	tracePath: null,
	transcript: null,
	...over,
});
const fit = (id: string, trials: TraceRow[]) =>
	computeFitness({ variantId: id, suiteId: "s", jobName: id, suiteTasks: ["a"], attempts: 1, trials });
const variant = { expectedSignals: [] } as unknown as VariantRow;

describe("comparison gate by provenance", () => {
	it("model_outcome 0 vs model_outcome 1 compares with a negative delta", () => {
		const c = compareFitness(
			fit("c", [trial("a", {})]),
			fit("b", [trial("a", { status: "pass", reward: 1 })]),
			variant,
		);
		expect(c.creditedDelta).toBe(-1);
		expect(c.refusals).toEqual([]);
	});

	for (const phase of ["variant_startup_failure", "executor_infra_failure", "unknown"] as const) {
		it(`${phase} 0 beside a model_outcome 0 refuses with counts and no numeric decision`, () => {
			const c = compareFitness(
				fit("c", [trial("a", { phase, status: "error" })]),
				fit("b", [trial("a", {})]),
				variant,
			);
			expect(c.refusals).toEqual([{ reason: phase, count: 1 }]);
			expect(c.complete).toBe(false);
			expect(c.creditedDelta).toBeNull();
			expect([c.wins, c.ties, c.losses]).toEqual([null, null, null]);
		});
	}

	it("a trial without recorded phase fails closed as unknown", () => {
		const c = compareFitness(fit("c", [trial("a", { phase: null })]), fit("b", [trial("a", {})]), variant);
		expect(c.refusals).toEqual([{ reason: "unknown", count: 1 }]);
		expect(c.creditedDelta).toBeNull();
	});
});
