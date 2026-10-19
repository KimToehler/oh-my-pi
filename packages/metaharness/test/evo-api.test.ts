import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EvoHttpError } from "../src/evo/boundary";
import { buildEvalLaunch, type EvoLaunchDefaults } from "../src/evo/launch";
import { canonicalStagedModelsHash } from "../src/evo/proxy-models";
import { SuiteRegistry } from "../src/evo/suites";
import { harborRunnerArgs } from "../src/launch-args";
import { ManagerServer, resolveArmLaunch } from "../src/server";
import "./registry-stub";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

/** Published variant snapshots are read-only directories; restore owner write so cleanup can delete them. */
function rmTree(dir: string): void {
	const unlock = (d: string): void => {
		try {
			fs.chmodSync(d, 0o755);
			for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) unlock(path.join(d, e.name));
		} catch {}
	};
	unlock(dir);
	fs.rmSync(dir, { recursive: true, force: true });
}

function tmp(prefix: string): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	cleanups.push(() => rmTree(dir));
	return dir;
}

function write(dir: string, rel: string, content: string): void {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), content);
}

function git(cwd: string, ...args: string[]): void {
	const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });
	if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
}

const SUITE = {
	id: "search-1",
	split: "search",
	benchmark: "harbor",
	dataset: `terminal-bench@sha256:${"a".repeat(64)}`,
	include: ["t1", "t2"],
	attempts: 1,
	timeoutMultiplier: 1,
	model: "onara/cc/claude-sonnet-5-5",
	thinking: "medium",
	environment: "docker",
	platform: "linux/arm64",
	minPairedTasks: 1,
	minAttemptsPerTask: 1,
	concurrency: 4,
};

interface Harness {
	base: string;
	jobsDir: string;
	source: string;
	manager: ManagerServer;
	post: (url: string, body: unknown) => Promise<Response>;
	json: <T>(res: Response) => Promise<T>;
}

function harness(defaults?: EvoLaunchDefaults): Harness {
	const jobsDir = tmp("evo-api-jobs-");
	const source = tmp("evo-api-src-");
	git(source, "init", "-q", "-b", "main");
	write(source, "a.txt", "1");
	git(source, "add", "-A");
	git(source, "commit", "-q", "-m", "init");
	const manager = new ManagerServer(jobsDir, undefined, {
		sourceRoot: source,
		defaults: defaults ?? { modelsYaml: path.join(jobsDir, "models.yml"), forwardEnv: [] },
	});
	const server = manager.start(0);
	cleanups.push(() => void manager.stop());
	const base = `http://localhost:${server.port}`;
	return {
		base,
		jobsDir,
		source,
		manager,
		post: (url, body) =>
			fetch(`${base}${url}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
		json: async <T>(res: Response) => (await res.json()) as T,
	};
}

interface JobOptions {
	signals?: string[];
	suiteHash?: string;
	taskHash?: string;
	executor?: string;
	model?: string;
	modelsYamlHash?: string;
	/** Default records the canonical hash; null omits it (a run from before the field). */
	stagedModelsHash?: string | null;
	infra?: string;
	/** Launch `sourceIdentity` recorded in the run config, as the evo launch path records it. */
	sourceIdentity?: string;
	/** `sourceIdentityScheme` in runner-config.json; default 2, null omits it (a run from before the scheme). */
	scheme?: number | null;
	/** Evaluation concurrency recorded in the run config, as the evo launch path records it. */
	concurrency?: number;
	/** Post-run identity the runner persists; `null` simulates a runner that has not reached its postflight. */
	postRunSourceIdentity?: string | null;
	/** Leave the run row `running` instead of exited. */
	running?: boolean;
}

const LAUNCHED = "a".repeat(40);

/** Completed harbor job whose trials have the given rewards and omp transcript markers. */
function writeJob(
	h: Harness,
	jobName: string,
	variantId: string,
	rewards: Record<string, number>,
	opts: JobOptions = {},
): void {
	const jobDir = path.join(h.jobsDir, jobName);
	for (const [task, reward] of Object.entries(rewards)) {
		const trial = path.join(jobDir, `${task}__abc`);
		write(
			trial,
			"result.json",
			JSON.stringify({
				started_at: "2026-07-12T10:00:00",
				finished_at: "2026-07-12T10:01:00",
				verifier_result: { rewards: { reward } },
				...(opts.infra === task ? { exception_info: { exception_type: "EnvironmentStartTimeoutError" } } : {}),
				agent_result: { cost_usd: 0.25, n_input_tokens: 10, n_output_tokens: 5, n_cache_tokens: 0 },
			}),
		);
		const events = [
			JSON.stringify({
				type: "message_end",
				message: {
					role: "assistant",
					model: "m",
					usage: { input: 10, output: 5 },
					content: [{ type: "text", text: "hi" }],
					stopReason: "stop",
				},
			}),
			...(opts.signals ?? []).map(id => `EVO-MARK:${id}`),
			JSON.stringify({ type: "agent_end", messages: [] }),
		];
		write(trial, "agent/omp.txt", `${events.join("\n")}\n`);
	}
	write(
		jobDir,
		"config.json",
		JSON.stringify({ dataset: `terminal-bench@sha256:${"a".repeat(64)}`, agents: [{ name: "omp" }] }),
	);
	write(
		jobDir,
		"result.json",
		JSON.stringify({
			n_total_trials: Object.keys(rewards).length,
			finished_at: "2026-07-12T11:00:00",
			stats: { n_running_trials: 0, n_pending_trials: 0 },
		}),
	);
	h.manager.store.registerLaunch({
		benchmark: "harbor",
		jobName,
		dataset: `terminal-bench@sha256:${"a".repeat(64)}`,
		agent: "omp",
		models: [opts.model ?? SUITE.model],
		pid: 999999999,
		variantId,
		suiteId: SUITE.id,
		config: {
			model: opts.model ?? SUITE.model,
			suiteHash: opts.suiteHash,
			taskHash: opts.taskHash ?? "t".repeat(64),
			executorConfigHash: opts.executor ?? "exec-1",
			modelsYamlHash: opts.modelsYamlHash ?? "c".repeat(64),
			stagedModelsHash: opts.stagedModelsHash === null ? undefined : (opts.stagedModelsHash ?? "d".repeat(64)),
			concurrency: opts.concurrency ?? 1,
			sourceIdentity: opts.sourceIdentity ?? LAUNCHED,
		},
	});
	const postRun =
		opts.postRunSourceIdentity === undefined ? (opts.sourceIdentity ?? LAUNCHED) : opts.postRunSourceIdentity;
	{
		write(
			h.jobsDir,
			path.join("_bench", jobName, "runner-config.json"),
			JSON.stringify({
				jobName,
				sourceIdentity: opts.sourceIdentity ?? LAUNCHED,
				sourceIdentityScheme: opts.scheme === undefined ? 2 : opts.scheme,
				...(postRun === null ? {} : { postRunSourceIdentity: postRun }),
			}),
		);
	}
	if (!opts.running) h.manager.store.markExit(jobName, 0);
}

async function seed(h: Harness, suite: typeof SUITE = SUITE) {
	const rootDir = tmp("evo-api-root-");
	write(rootDir, "AGENTS.md", "root");
	const childDir = tmp("evo-api-child-");
	write(childDir, "AGENTS.md", "root\nchild");
	const suiteRes = await h.json<{ hash: string }>(await h.post("/api/evo/suites", suite));
	const root = await h.json<{ variant: { id: string } }>(
		await h.post("/api/evo/variants", { mutation: "root", configDir: rootDir }),
	);
	const child = await h.json<{ variant: { id: string } }>(
		await h.post("/api/evo/variants", {
			mutation: "revision",
			parentId: root.variant.id,
			configDir: childDir,
			expectedSignals: ["mark:fix"],
		}),
	);
	return { rootDir, childDir, suiteHash: suiteRes.hash, rootId: root.variant.id, childId: child.variant.id };
}

async function expectError(res: Response, status: number, message: string): Promise<void> {
	expect(res.status).toBe(status);
	expect((await res.json()) as { error: string }).toMatchObject({ error: message });
}

describe("evo REST", () => {
	it("registers root, noop, and child; lists lineage with run counts; returns detail", async () => {
		const h = harness();
		const { rootDir, rootId, childId } = await seed(h);
		const noopRes = await h.post("/api/evo/variants", { mutation: "manual", parentId: rootId, configDir: rootDir });
		expect(noopRes.status).toBe(200);
		expect(await h.json<{ outcome: string; variant: { id: string } }>(noopRes)).toMatchObject({
			outcome: "noop",
			variant: { id: rootId },
		});

		const list = await h.json<Array<{ id: string; parentId: string | null; runCount: number }>>(
			await fetch(`${h.base}/api/evo/variants`),
		);
		expect(list.map(v => [v.id, v.parentId, v.runCount])).toEqual([
			[rootId, null, 0],
			[childId, rootId, 0],
		]);

		const detail = await h.json<{ proposals: Array<{ outcome: string }>; diff: { changedFiles: string[] } }>(
			await fetch(`${h.base}/api/evo/variants/${childId}`),
		);
		expect(detail.diff.changedFiles).toEqual(["AGENTS.md"]);
		expect(detail.proposals.map(p => p.outcome)).toEqual(["applied"]);
		const rootDetail = await h.json<{ proposals: Array<{ outcome: string }> }>(
			await fetch(`${h.base}/api/evo/variants/${rootId}`),
		);
		expect(rootDetail.proposals.map(p => p.outcome)).toEqual(["applied", "applied", "noop"]);
	});

	it("exposes held-out evaluation counts per variant and per heldout suite; search runs do not count (R76)", async () => {
		const h = harness();
		const { rootId, childId } = await seed(h);
		const heldout = { ...SUITE, id: "held-1", split: "heldout" };
		expect((await h.post("/api/evo/suites", heldout)).status).toBe(201);
		const launch = (jobName: string, variantId: string, suiteId: string) =>
			h.manager.store.registerLaunch({
				benchmark: "harbor",
				jobName,
				dataset: SUITE.dataset,
				agent: "omp",
				models: [SUITE.model],
				pid: 999999999,
				variantId,
				suiteId,
				config: {},
			});
		launch("j-search", rootId, "search-1");
		const detail = async (id: string) =>
			(await h.json<{ heldoutEvaluations: number }>(await fetch(`${h.base}/api/evo/variants/${id}`)))
				.heldoutEvaluations;
		expect(await detail(rootId)).toBe(0);
		launch("j-held-1", rootId, "held-1");
		launch("j-held-2", rootId, "held-1");
		launch("j-held-child", childId, "held-1");
		expect(await detail(rootId)).toBe(2);
		expect(await detail(childId)).toBe(1);
		const suites = await h.json<Array<{ manifest: { id: string }; evaluations?: number }>>(
			await fetch(`${h.base}/api/evo/suites`),
		);
		expect(suites.find(s => s.manifest.id === "held-1")?.evaluations).toBe(3);
		expect(suites.find(s => s.manifest.id === "search-1")?.evaluations).toBeUndefined();
	});

	it("rejects invalid boundaries with exact errors and status codes", async () => {
		const h = harness();
		const { rootId } = await seed(h);
		await expectError(
			await h.post("/api/evo/variants", { mutation: "nope" }),
			400,
			"variant.mutation must be one of root|autonomous|revision|crossover|manual",
		);
		await expectError(
			await h.post("/api/evo/variants", { mutation: "revision", parentId: "ghost", configDir: "/tmp" }),
			404,
			"parent variant 'ghost' not found",
		);
		await expectError(
			await h.post("/api/evo/suites", { ...SUITE, include: [] }),
			400,
			"suite.include must name at least one task",
		);
		await expectError(
			await h.post("/api/evo/suites", { ...SUITE, attempts: 3 }),
			409,
			"suite 'search-1' already exists with different content",
		);
		await expectError(
			await fetch(`${h.base}/api/evo/suites`, { method: "POST", body: "{nope" }),
			400,
			"request body must be valid JSON",
		);
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "missing" }),
			404,
			"suite 'missing' not found",
		);
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1", model: "x" }),
			400,
			"evaluate: unknown field 'model'",
		);
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1", concurrency: 0 }),
			400,
			"evaluate.concurrency must be a positive integer",
		);
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1", concurrency: 20 }),
			409,
			"evaluate.concurrency 20 differs from suite 'search-1' concurrency 4; concurrency is suite policy",
		);
		await expectError(
			await h.post("/api/evo/variants/ghost/evaluate", { suiteId: "search-1" }),
			404,
			"variant 'ghost' not found",
		);
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${rootId}/fitness`),
			400,
			"query parameter 'suite' is required",
		);
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${rootId}/fitness?suite=search-1`),
			404,
			`variant '${rootId}' has no run on suite 'search-1'`,
		);
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${rootId}/compare?suite=search-1`),
			400,
			"variant has no parent; pass query parameter 'baseline'",
		);
	});

	it("serves fitness, compare and reflection bundle for matched runs; links run to variant and suite", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"] });
		expect(h.manager.store.getRun("evo-child")).toMatchObject({ variantId: childId, suiteId: "search-1" });
		const list = await h.json<Array<{ id: string; runCount: number }>>(await fetch(`${h.base}/api/evo/variants`));
		expect(list.map(v => v.runCount)).toEqual([1, 1]);

		const fitness = await h.json<{ vHat: number; dataComplete: boolean; signalHits: Record<string, number> }>(
			await fetch(`${h.base}/api/evo/variants/${childId}/fitness?suite=search-1`),
		);
		expect(fitness).toMatchObject({ vHat: 1, dataComplete: true, signalHits: { "mark:fix": 2 } });

		const compare = await h.json<{
			rawDelta: number;
			creditedDelta: number | null;
			wins: number | null;
			decisionEligible: boolean;
			signalsSatisfied: boolean;
			ineligibility: { reason: string; pairedTasks: number; minPairedTasks: number };
		}>(await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`));
		// Two paired tasks, but the suite declares minPairedTasks: 1 -> effective floor 2 is met; deltas [1, 0] have variance.
		expect(compare).toMatchObject({
			rawDelta: 0.5,
			creditedDelta: 0.5,
			wins: 1,
			decisionEligible: true,
			ineligibility: null,
			signalsSatisfied: true,
		});

		const bundle = await h.json<{
			diff: { text: string };
			improvements: Array<{ task: string; childTraces: Array<{ href: string }> }>;
			regressions: unknown[];
		}>(await fetch(`${h.base}/api/evo/variants/${childId}/reflection-bundle?suite=search-1`));
		expect(bundle.diff.text).toContain("+child");
		expect(bundle.improvements.map(f => f.task)).toEqual(["t1"]);
		expect(bundle.improvements[0].childTraces[0].href).toBe("/api/runs/evo-child/traces/t1__abc");
		expect(bundle.regressions).toEqual([]);
		expect((await fetch(`${h.base}${bundle.improvements[0].childTraces[0].href}`)).status).toBe(200);
	});

	it("clamps credited delta to 0 when the expected marker never fired", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash });
		const compare = await h.json<{ rawDelta: number; creditedDelta: number; missingSignals: string[] }>(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
		);
		expect(compare).toMatchObject({ rawDelta: 0.5, creditedDelta: 0, missingSignals: ["mark:fix"] });
	});

	it("never returns positive credit for an incomplete comparison", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		// Child omits t2 but improves t1 with the expected marker present.
		writeJob(h, "evo-child", childId, { t1: 1 }, { suiteHash, signals: ["fix"] });
		const compare = await h.json<Record<string, unknown>>(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
		);
		expect(compare).toMatchObject({
			dataComplete: false,
			decisionEligible: false,
			rawDelta: 1,
			creditedDelta: null,
			signalsSatisfied: true,
		});
		expect([compare.wins, compare.ties, compare.losses]).toEqual([null, null, null]);
	});

	it("withholds decision fields when a suite declaring attempts: 2 yields one trial per task", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h, { ...SUITE, attempts: 2 });
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"] });
		const compare = await h.json<Record<string, unknown>>(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
		);
		expect(compare).toMatchObject({ dataComplete: false, decisionEligible: false, creditedDelta: null });
		expect([compare.wins, compare.ties, compare.losses]).toEqual([null, null, null]);
	});

	it("returns 409 with exact differing fields for model and executor confounds", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, model: "other/model", executor: "exec-2" });
		const res = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string; mismatches: Array<{ field: string }> };
		expect(body.error).toBe("conditions differ: model, executorConfigHash");
		expect(body.mismatches.map(m => m.field)).toEqual(["model", "executorConfigHash"]);
		expect((await fetch(`${h.base}/api/evo/variants/${childId}/reflection-bundle?suite=search-1`)).status).toBe(409);
	});

	it("refuses a run without the execution-manifest identity scheme, never returning a delta", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"], scheme: null });
		const refused = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(refused.status).toBe(409);
		expect(((await refused.json()) as { error: string }).error).toContain(
			"predates the execution-manifest source identity; re-evaluate",
		);
		// Negative control: the same run stamped with scheme 2 is comparable.
		writeJob(h, "evo-child2", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"] });
		expect((await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`)).status).toBe(200);
	});

	it("refuses a comparison whose run recorded post-run source drift", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		const launched = "a".repeat(40);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, sourceIdentity: launched });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"], sourceIdentity: launched });
		const configFile = path.join(h.jobsDir, "_bench", "evo-child", "runner-config.json");
		const recordPostRun = (postRunSourceIdentity: string): void =>
			write(
				h.jobsDir,
				path.join("_bench", "evo-child", "runner-config.json"),
				JSON.stringify({
					jobName: "evo-child",
					sourceIdentity: launched,
					sourceIdentityScheme: 2,
					postRunSourceIdentity,
				}),
			);
		const url = `${h.base}/api/evo/variants/${childId}/compare?suite=search-1`;

		recordPostRun(`${"b".repeat(40)}+${"c".repeat(64)}`);
		expect(fs.existsSync(configFile)).toBe(true);
		const refused = await fetch(url);
		expect(refused.status).toBe(409);
		expect(((await refused.json()) as { error: string }).error).toContain("source changed during the run");

		// Negative control: the same run with an unchanged post-run identity is comparable.
		recordPostRun(launched);
		const ok = await h.json<{ rawDelta: number }>(await fetch(url));
		expect(ok.rawDelta).toBe(0.5);
	});

	it("refuses fitness, comparison and reflection until the run is terminal with a matching post-run identity", async () => {
		const cases: Array<{ label: string; child: JobOptions; error: string }> = [
			{ label: "running row", child: { running: true }, error: "has not finished" },
			{
				label: "missing postflight",
				child: { postRunSourceIdentity: null },
				error: "no recorded post-run source identity",
			},
			{
				label: "mismatch",
				child: { postRunSourceIdentity: "b".repeat(40) },
				error: "source changed during the run",
			},
		];
		for (const c of cases) {
			const h = harness();
			const { suiteHash, rootId, childId } = await seed(h);
			writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
			writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"], ...c.child });
			for (const route of ["compare", "fitness", "reflection-bundle"]) {
				const res = await fetch(`${h.base}/api/evo/variants/${childId}/${route}?suite=search-1`);
				const status = res.status;
				const body = await h.json<{ error: string }>(res);
				expect({ label: c.label, route, status }).toEqual({ label: c.label, route, status: 409 });
				expect(body.error).toContain(c.error);
			}
		}
		// Clean control: two terminal runs with durable matching identities are decision-eligible.
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"] });
		const ok = await h.json<{ decisionEligible: boolean }>(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
		);
		expect(ok.decisionEligible).toBe(true);
	});

	it("refuses a comparison whose runs staged different models.yml content", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 1, t2: 1 }, { suiteHash, modelsYamlHash: "a".repeat(64) });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, modelsYamlHash: "b".repeat(64) });
		const res = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string; mismatches: Array<{ field: string }> };
		expect(body.error).toContain("modelsYamlHash");
		expect(body.mismatches.map(m => m.field)).toEqual(["modelsYamlHash"]);
	});

	it("refuses a comparison whose runs staged different proxy-rewritten models", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 1, t2: 1 }, { suiteHash, stagedModelsHash: "a".repeat(64) });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, stagedModelsHash: "b".repeat(64) });
		const res = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string; mismatches: Array<{ field: string }> };
		expect(body.error).toContain("conditions differ: stagedModelsHash");
		expect(body.mismatches.map(m => m.field)).toEqual(["stagedModelsHash"]);
	});

	it("refuses a run that did not record stagedModelsHash", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 1, t2: 1 }, { suiteHash });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, stagedModelsHash: null });
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
			409,
			"run 'evo-child' did not record its evaluation conditions",
		);
	});

	it("refuses a comparison whose runs evaluated different task bytes, never returning a delta", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, taskHash: "a".repeat(64) });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, taskHash: "b".repeat(64) });
		const res = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string; rawDelta?: number; mismatches: Array<{ field: string }> };
		expect(body.error).toBe("conditions differ: taskHash");
		expect(body.mismatches.map(m => m.field)).toEqual(["taskHash"]);
		expect(body.rawDelta).toBeUndefined();
	});

	it("refuses a comparison whose runs recorded different evaluation concurrency, never returning a delta", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, concurrency: 1 });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, concurrency: 20 });
		const res = await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string; rawDelta?: number; mismatches: Array<{ field: string }> };
		expect(body.error).toBe("conditions differ: concurrency");
		expect(body.mismatches.map(m => m.field)).toEqual(["concurrency"]);
		expect(body.rawDelta).toBeUndefined();
	});

	it("compares runs that recorded the same evaluation concurrency", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, concurrency: 20 });
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash, concurrency: 20 });
		const ok = await h.json<{ rawDelta: number }>(
			await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`),
		);
		expect(ok.rawDelta).toBe(0.5);
	});

	it("refuses a suite that omits or mis-declares its evaluation concurrency at registration", async () => {
		const h = harness();
		const { concurrency: _omitted, ...withoutConcurrency } = SUITE;
		await expectError(
			await h.post("/api/evo/suites", { ...withoutConcurrency, id: "no-conc" }),
			400,
			"suite.concurrency must be a positive integer",
		);
		await expectError(
			await h.post("/api/evo/suites", { ...SUITE, id: "bad-conc", concurrency: 0 }),
			400,
			"suite.concurrency must be a positive integer",
		);
	});

	it("refuses fitness for a stale suite version and for runs without recorded conditions", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash: "stale" });
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${rootId}/fitness?suite=search-1`),
			409,
			"run 'evo-root' evaluated a different version of suite 'search-1'",
		);
		writeJob(h, "evo-child", childId, { t1: 1, t2: 1 }, { suiteHash });
		h.manager.store.registerLaunch({
			benchmark: "harbor",
			jobName: "evo-child",
			dataset: "d",
			agent: "omp",
			models: ["m"],
			pid: 1,
			variantId: childId,
			suiteId: "search-1",
			config: {},
		});
		h.manager.store.markExit("evo-child", 0);
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${childId}/fitness?suite=search-1`),
			409,
			"run 'evo-child' did not record its evaluation conditions",
		);
	});

	it("excludes infrastructure failures from fitness and reports them in phaseCounts", async () => {
		const h = harness();
		const { suiteHash, rootId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, infra: "t1" });
		const fitness = await h.json<{ vHat: number; dataComplete: boolean; phaseCounts: Record<string, number> }>(
			await fetch(`${h.base}/api/evo/variants/${rootId}/fitness?suite=search-1`),
		);
		// Every cell has a terminal record, so the data is complete; the infra trial is unscored and shown in phaseCounts.
		expect(fitness).toMatchObject({ vHat: 1, dataComplete: true, phaseCounts: { executor_infra_failure: 1 } });
	});
});

describe("generic launch route", () => {
	it("rejects caller-supplied evo identity fields and persists nothing", async () => {
		const h = harness();
		for (const field of [
			"variantId",
			"suiteId",
			"suiteHash",
			"stagedConfigHash",
			"executorConfigHash",
			"modelsYamlHash",
			"stagedModelsHash",
		]) {
			const res = await h.post("/api/runs", { model: "m/x", jobName: `spoof-${field}`, [field]: "forged" });
			await expectError(
				res,
				400,
				`evo identity fields (${field}) cannot be set on /api/runs; use POST /api/evo/variants/:id/evaluate`,
			);
			expect(h.manager.store.getRun(`spoof-${field}`)).toBeNull();
		}
		const multi = await h.post("/api/runs", { model: "m/x", variantId: "a", suiteId: "b" });
		expect(((await multi.json()) as { error: string }).error).toContain("variantId, suiteId");
		expect(h.manager.store.listRuns()).toEqual([]);
	});

	it("rejects KEY=VALUE secrets in envNames and extraArgs before creating any run state", async () => {
		const SENTINEL = "evo-sentinel-secret-9f3a7c21";
		const kv = `EVO_SENTINEL_KEY=${SENTINEL}`;
		const cases: Array<{ field: "envNames" | "extraArgs"; value: string[] }> = [
			{ field: "envNames", value: [kv] },
			{ field: "extraArgs", value: ["--env", kv] },
			{ field: "extraArgs", value: ["-e", kv] },
			{ field: "extraArgs", value: [`--env=${kv}`] },
			{ field: "extraArgs", value: ["--", "--env", kv] },
			{ field: "extraArgs", value: ["--", "-e", kv] },
			{ field: "extraArgs", value: ["--", `--env=${kv}`] },
			{ field: "extraArgs", value: ["--", "--ae", kv] },
			{ field: "extraArgs", value: ["--", `--agent-env=${kv}`] },
			{ field: "extraArgs", value: ["--", "--ve", kv] },
		];
		const h = harness();
		for (const [i, c] of cases.entries()) {
			const jobName = `secret-${i}`;
			const res = await h.post("/api/runs", { model: "m/x", jobName, [c.field]: c.value });
			expect(res.status).toBe(400);
			const { error } = (await res.json()) as { error: string };
			expect(error).toContain(c.field);
			expect(error).not.toContain(SENTINEL);
			expect(h.manager.store.getRun(jobName)).toBeNull();
			expect(fs.existsSync(path.join(h.jobsDir, jobName))).toBe(false);
		}
		expect(h.manager.store.listRuns()).toEqual([]);
		for (const entry of fs.readdirSync(h.jobsDir, { withFileTypes: true, recursive: true })) {
			if (!entry.isFile()) continue;
			expect(fs.readFileSync(path.join(entry.parentPath, entry.name)).includes(SENTINEL)).toBe(false);
		}
	});

	it("rejects any extraArgs element assigning a models.yml credential, whatever the flag form", async () => {
		const SENTINEL = "evo-sentinel-secret-9f3a7c21";
		const kv = `EVO_SENTINEL_KEY=${SENTINEL}`;
		const h = harness();
		const modelsYaml = path.join(h.jobsDir, "models.yml");
		write(h.jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_SENTINEL_KEY\n");
		const cases = [
			["--", `-e=${kv}`],
			["--", `-e${kv}`],
			["--", `--ae=${kv}`],
			["--some-runner-flag", kv],
			["--setting", `x=${kv}`],
		];
		for (const [i, extraArgs] of cases.entries()) {
			const jobName = `credential-extra-${i}`;
			const res = await h.post("/api/runs", { model: "m/x", jobName, modelsYaml, extraArgs });
			expect(res.status).toBe(400);
			const { error } = (await res.json()) as { error: string };
			expect(error).toContain("credential env");
			expect(error).toContain("EVO_SENTINEL_KEY");
			expect(error).not.toContain(SENTINEL);
			expect(h.manager.store.getRun(jobName)).toBeNull();
			expect(fs.existsSync(path.join(h.jobsDir, jobName))).toBe(false);
		}
		for (const entry of fs.readdirSync(h.jobsDir, { withFileTypes: true, recursive: true })) {
			if (!entry.isFile()) continue;
			expect(fs.readFileSync(path.join(entry.parentPath, entry.name)).includes(SENTINEL)).toBe(false);
		}
	});

	it("rejects credential values hidden in --setting JSON escapes and in host-value form", async () => {
		const SENTINEL = "evo-sentinel-secret-9f3a7c21";
		const previous = process.env.EVO_SENTINEL_KEY;
		process.env.EVO_SENTINEL_KEY = SENTINEL;
		try {
			const h = harness();
			const modelsYaml = path.join(h.jobsDir, "models.yml");
			write(h.jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_SENTINEL_KEY\n");
			const escaped = `--setting=x="EVO_SENTINEL_KEY\\u003d${SENTINEL}"`;
			expect(escaped.includes("EVO_SENTINEL_KEY=")).toBe(false);
			expect(escaped.includes("\\u003d")).toBe(true);
			const cases: Record<string, unknown>[] = [
				{ extraArgs: [escaped] },
				{ extraArgs: ["--setting", `x=${SENTINEL}`] },
				{ note: `token ${SENTINEL}` },
			];
			for (const [i, c] of cases.entries()) {
				const jobName = `setting-secret-${i}`;
				const res = await h.post("/api/runs", { model: "m/x", jobName, modelsYaml, ...c });
				expect(res.status).toBe(400);
				const { error } = (await res.json()) as { error: string };
				expect(error).toContain("credential env");
				expect(error).not.toContain(SENTINEL);
				expect(h.manager.store.getRun(jobName)).toBeNull();
				expect(fs.existsSync(path.join(h.jobsDir, jobName))).toBe(false);
			}
			for (const entry of fs.readdirSync(h.jobsDir, { withFileTypes: true, recursive: true })) {
				if (!entry.isFile()) continue;
				expect(fs.readFileSync(path.join(entry.parentPath, entry.name)).includes(SENTINEL)).toBe(false);
			}
		} finally {
			if (previous === undefined) delete process.env.EVO_SENTINEL_KEY;
			else process.env.EVO_SENTINEL_KEY = previous;
		}
	});

	it("rejects credentials reachable through a models.yml given in extraArgs, object keys, or deep nesting", async () => {
		const SENTINEL = "evo-sentinel-secret-9f3a7c21";
		const previous = process.env.EVO_SENTINEL_KEY;
		process.env.EVO_SENTINEL_KEY = SENTINEL;
		try {
			const h = harness();
			const modelsYaml = path.join(h.jobsDir, "models.yml");
			write(h.jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_SENTINEL_KEY\n");
			let nest: unknown = `EVO_SENTINEL_KEY=${SENTINEL}`;
			for (let depth = 0; depth < 12; depth++) nest = { a: nest };
			const cases: Record<string, unknown>[] = [
				{
					extraArgs: ["--models-yaml", modelsYaml, "--setting", `x=EVO_SENTINEL_KEY=${SENTINEL}`],
				},
				{ extraArgs: [`--models-yaml=${modelsYaml}`, "--setting", `x=${SENTINEL}`] },
				{ modelsYaml, extraArgs: ["--setting", `${SENTINEL}=false`] },
				{ modelsYaml, extraArgs: ["--setting", `x=${JSON.stringify(nest)}`] },
			];
			for (const [i, c] of cases.entries()) {
				const jobName = `deep-${i}`;
				const res = await h.post("/api/runs", { model: "m/x", jobName, ...c });
				expect(res.status).toBe(400);
				const { error } = (await res.json()) as { error: string };
				expect(error).toContain("credential env");
				expect(error).not.toContain(SENTINEL);
				expect(h.manager.store.getRun(jobName)).toBeNull();
				expect(fs.existsSync(path.join(h.jobsDir, jobName))).toBe(false);
			}
			for (const entry of fs.readdirSync(h.jobsDir, { withFileTypes: true, recursive: true })) {
				if (!entry.isFile()) continue;
				expect(fs.readFileSync(path.join(entry.parentPath, entry.name)).includes(SENTINEL)).toBe(false);
			}
		} finally {
			if (previous === undefined) delete process.env.EVO_SENTINEL_KEY;
			else process.env.EVO_SENTINEL_KEY = previous;
		}
	});
});

describe("evo request hardening", () => {
	it("rejects an over-1MiB body with 413, both declared and streamed", async () => {
		const h = harness();
		const big = JSON.stringify({ pad: "x".repeat(1024 * 1024 + 10) });
		await expectError(
			await fetch(`${h.base}/api/evo/suites`, { method: "POST", body: big }),
			413,
			"request body exceeds 1048576 bytes",
		);
		// Chunked upload with no content-length is bounded by streaming.
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new Uint8Array(256 * 1024).fill(0x20));
			},
		});
		const res = await fetch(`${h.base}/api/evo/variants`, {
			method: "POST",
			body: stream,
			// @ts-expect-error Bun requires duplex for streamed request bodies
			duplex: "half",
		});
		expect(res.status).toBe(413);
		// Just under the cap is parsed normally (negative control).
		const ok = await fetch(`${h.base}/api/evo/suites`, {
			method: "POST",
			body: JSON.stringify({ pad: "x".repeat(1000) }),
		});
		expect(ok.status).toBe(400);
	});

	it("answers bad percent-encoding in a variant path with 400", async () => {
		const h = harness();
		await expectError(
			await fetch(`${h.base}/api/evo/variants/%E0%A4%A`),
			400,
			"variant id has invalid percent-encoding",
		);
	});

	it("serves the lever taxonomy as markdown on GET and refuses other methods with 405", async () => {
		const h = harness();
		const res = await fetch(`${h.base}/api/evo/levers`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
		expect(await res.text()).toBe(await Bun.file(path.join(import.meta.dir, "../src/evo/prompts/levers.md")).text());
		const post = await fetch(`${h.base}/api/evo/levers`, { method: "POST", body: "{}" });
		expect(post.status).toBe(405);
		expect(await post.json()).toEqual({ error: "method not allowed" });
	});
});

describe("evo launch", () => {
	it("derives every matched field from the suite and never records secret values", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_TEST_ROUTER_KEY\n");
		const sentinel = "sentinel-secret-value-123456";
		process.env.EVO_TEST_ROUTER_KEY = sentinel;
		cleanups.push(() => {
			delete process.env.EVO_TEST_ROUTER_KEY;
		});
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: null };
		const h = harness(defaults);
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", defaults, sourceRoot: h.source };
		const launch = await buildEvalLaunch(input);
		expect(launch).toMatchObject({
			model: SUITE.model,
			dataset: SUITE.dataset,
			include: SUITE.include,
			tasks: 2,
			attempts: 1,
			timeoutMultiplier: 1,
			thinking: "medium",
			environment: "docker",
			concurrency: 4,
			noGateway: true,
			providerProxy: true,
			envNames: [],
			variantId: rootId,
			suiteId: "search-1",
			suiteHash: suite.hash,
			modelsYaml: path.join(h.jobsDir, "_evo", "models", `${launch.modelsYamlHash}.yml`),
		});
		expect(launch.modelsYamlHash).toBe(
			new Bun.CryptoHasher("sha256").update(fs.readFileSync(modelsYaml, "utf8")).digest("hex"),
		);
		expect(fs.readFileSync(launch.modelsYaml!, "utf8")).toBe(fs.readFileSync(modelsYaml, "utf8"));
		expect(launch.stagedModelsHash).toBe(canonicalStagedModelsHash(fs.readFileSync(modelsYaml, "utf8")));
		expect(launch.sourceRoot).toBe(h.source);
		expect(launch.agentDir).toBe(path.join(h.jobsDir, "_evo", "variants", rootId, "config"));
		expect(JSON.stringify(launch)).not.toContain(sentinel);
		const argv = harborRunnerArgs(launch, { jobsDir: h.jobsDir, jobName: "j", dataset: SUITE.dataset });
		expect(argv).toContain("--no-gateway");
		expect(argv).toContain("--provider-proxy");
		expect(argv).not.toContain("--env");
		expect(argv.join(" ")).not.toContain(sentinel);
		for (const flag of ["--agent-dir", "--models-yaml", "--source-identity", "--thinking"])
			expect(argv).toContain(flag);
		expect(argv).toContain("--source-root");
		// The suite's declared platform decides the container arch, not the daemon's native one.
		expect(argv[argv.indexOf("--platform") + 1]).toBe(SUITE.platform);
		delete process.env.EVO_TEST_ROUTER_KEY;
		await expect(buildEvalLaunch(input)).rejects.toThrow(
			"host env not set for forwarded variables: EVO_TEST_ROUTER_KEY",
		);
	});

	it("refuses a launch whose scanned source hash differs from the registered one (409), and a jobs dir inside the source (422)", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_TEST_ROUTER_KEY\n");
		process.env.EVO_TEST_ROUTER_KEY = "sentinel-secret-value-123456";
		cleanups.push(() => {
			delete process.env.EVO_TEST_ROUTER_KEY;
		});
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: null };
		const h = harness(defaults);
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", defaults, sourceRoot: h.source };
		await buildEvalLaunch(input);
		for (const stale of ["f".repeat(64), null]) {
			const err = await buildEvalLaunch({ ...input, variant: { ...variant, sourceDirtyHash: stale } }).catch(
				(e: unknown) => e as EvoHttpError,
			);
			expect(err).toMatchObject({
				status: 409,
				message: "source changed since registration; re-register the variant",
			});
		}
		// A byte changed after registration is the same refusal.
		write(h.source, "late-edit.txt", "x");
		await expect(buildEvalLaunch(input)).rejects.toMatchObject({ status: 409 });
		fs.rmSync(path.join(h.source, "late-edit.txt"));
		await buildEvalLaunch(input);
		// Manager jobs dir inside the source root (outside the reserved roots) is refused before any scan.
		const inside = path.join(h.source, "jobs");
		await expect(buildEvalLaunch({ ...input, jobsDir: inside })).rejects.toThrow();
	});

	it("buildEvalLaunch accepts an env-name apiKey and rejects literals with a stable 422, even with an explicit forward list", async () => {
		const jobsDir = tmp("evo-launch-");
		const sentinel = "sk-sentinel-literal-key-0123456789";
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: [] });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", sourceRoot: h.source };
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n");
		process.env.ONARA_ROUTER_KEY = "router-value-123";
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual([]);
		for (const value of [sentinel, "'!cat /etc/passwd'", "https://x.example/t", "42", "''"]) {
			write(jobsDir, "models.yml", `providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ${value}\n`);
			for (const forwardEnv of [null, []]) {
				const err = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv } }).catch(
					(e: unknown) => e as Error,
				);
				expect((err as { status?: number }).status).toBe(422);
				expect((err as Error).message).toBe(
					"models.yml providers.onara.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)",
				);
				expect((err as Error).message).not.toContain(sentinel);
			}
		}
	});

	it("refuses to publish a models snapshot whose scalar carries a host credential", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: null });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", sourceRoot: h.source };
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		for (const secret of ["router-secret-value-0123456789", "rk-77"]) {
			process.env.ONARA_ROUTER_KEY = secret;
			write(
				jobsDir,
				"models.yml",
				`providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n    metadata: ${secret}\n`,
			);
			const err = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } }).then(
				() => undefined,
				(e: unknown) => e,
			);
			expect(err).toMatchObject({ status: 422 });
			const message = (err as Error).message;
			expect(message).toContain("providers.onara.metadata");
			expect(message).not.toContain(secret);
			const snapshots = path.join(h.jobsDir, "_evo", "models");
			expect(fs.existsSync(snapshots) ? fs.readdirSync(snapshots) : []).toEqual([]);
		}
		// Positive control: public metadata is accepted.
		process.env.ONARA_ROUTER_KEY = "router-secret-value-0123456789";
		write(
			jobsDir,
			"models.yml",
			"providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n    metadata: public\n",
		);
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual([]);
	});

	it("refuses to publish a models snapshot whose only host credential occurrence is in a comment", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: null });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", sourceRoot: h.source };
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		for (const secret of ["router-secret-value-0123456789", "rk-77"]) {
			process.env.ONARA_ROUTER_KEY = secret;
			for (const comment of [`# ${secret}`, `# note: ${secret}`]) {
				write(
					jobsDir,
					"models.yml",
					`providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n${comment}\n`,
				);
				const err = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } }).then(
					() => undefined,
					(e: unknown) => e,
				);
				expect(err).toMatchObject({ status: 422 });
				const message = (err as Error).message;
				expect(message).toContain("outside the parsed structure");
				expect(message).not.toContain(secret);
				const snapshots = path.join(h.jobsDir, "_evo", "models");
				expect(fs.existsSync(snapshots) ? fs.readdirSync(snapshots) : []).toEqual([]);
			}
		}
		// Positive control: ordinary comments without the credential are accepted.
		process.env.ONARA_ROUTER_KEY = "router-secret-value-0123456789";
		write(
			jobsDir,
			"models.yml",
			"# router config\nproviders:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY # env name only\n# end\n",
		);
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual([]);
	});

	it("refuses a short host credential that a comment quotes or punctuates", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: null });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", sourceRoot: h.source };
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		process.env.ONARA_ROUTER_KEY = "rk-77";
		for (const comment of [
			'# token="rk-77"',
			'# "rk-77":',
			"# 'rk-77',",
			"# (rk-77).",
			'# token: "rk-77";',
			"# key=[rk-77]",
		]) {
			write(
				jobsDir,
				"models.yml",
				`providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n${comment}\n`,
			);
			const err = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } }).then(
				() => undefined,
				(e: unknown) => e,
			);
			expect(err).toMatchObject({ status: 422 });
			expect((err as Error).message).toContain("outside the parsed structure");
			expect((err as Error).message).not.toContain("rk-77");
		}
		// Negative control: a longer token merely containing the short value as a substring is not a leak.
		write(
			jobsDir,
			"models.yml",
			"providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n# rk-770 and brk-77x\n",
		);
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual([]);
	});

	it("refuses to publish a models snapshot whose header NAME carries a host credential", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: null });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", sourceRoot: h.source };
		process.env.PUBLIC_HEADER_ENV = "public-header-value";
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
			delete process.env.PUBLIC_HEADER_ENV;
		});
		for (const secret of ["router-secret-value-0123456789", "rk-77"]) {
			process.env.ONARA_ROUTER_KEY = secret;
			write(
				jobsDir,
				"models.yml",
				`providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n    headers:\n      "${secret}": PUBLIC_HEADER_ENV\n`,
			);
			const err = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } }).then(
				() => undefined,
				(e: unknown) => e,
			);
			expect(err).toMatchObject({ status: 422 });
			const message = (err as Error).message;
			expect(message).toContain("providers.onara.headers");
			expect(message).not.toContain(secret);
			const snapshots = path.join(h.jobsDir, "_evo", "models");
			expect(fs.existsSync(snapshots) ? fs.readdirSync(snapshots) : []).toEqual([]);
		}
		// Positive control: a normal header name with an env-name value is accepted.
		process.env.ONARA_ROUTER_KEY = "router-secret-value-0123456789";
		write(
			jobsDir,
			"models.yml",
			"providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n    headers:\n      X-Public: PUBLIC_HEADER_ENV\n",
		);
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual([]);
	});

	it("rejects a models snapshot whose bytes no longer match its recorded hash", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: ONARA_ROUTER_KEY\n");
		process.env.ONARA_ROUTER_KEY = "router-value-123";
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: null };
		const h = harness(defaults);
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", defaults, sourceRoot: h.source };
		const first = await buildEvalLaunch(input);
		const snapshot = first.modelsYaml!;
		expect(fs.statSync(snapshot).mode & 0o222).toBe(0);
		fs.chmodSync(snapshot, 0o644);
		fs.writeFileSync(snapshot, "providers:\n  onara:\n    baseUrl: http://tampered\n    apiKey: ONARA_ROUTER_KEY\n");
		const err = await buildEvalLaunch(input).then(
			() => undefined,
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(Error);
		expect(err).toMatchObject({ status: 422 });
		const message = err instanceof Error ? err.message : "";
		expect(message).toContain(snapshot);
		expect(message).not.toContain("tampered");
	});

	it("requires an explicit forward list to cover every models.yml env name; outputs a deterministic deduplicated union", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(
			jobsDir,
			"models.yml",
			"providers:\n  a:\n    baseUrl: http://x\n    apiKey: B_KEY\n  b:\n    baseUrl: http://x\n    apiKey: A_KEY\n  c:\n    baseUrl: http://x\n    apiKey: A_KEY\n",
		);
		const h = harness({ modelsYaml, forwardEnv: null });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const launch = (forwardEnv: string[] | null) =>
			buildEvalLaunch({
				jobsDir: h.jobsDir,
				variant,
				suite,
				jobName: "j",
				sourceRoot: h.source,
				defaults: { modelsYaml, forwardEnv },
			});
		for (const name of ["A_KEY", "B_KEY", "EXTRA_KEY"]) process.env[name] = `value-of-${name}`;
		cleanups.push(() => {
			for (const name of ["A_KEY", "B_KEY", "EXTRA_KEY"]) delete process.env[name];
		});
		// Empty and mismatched lists are rejected, naming variable NAMES only.
		for (const [list, missing] of [
			[[], "A_KEY, B_KEY"],
			[["A_KEY"], "B_KEY"],
			[["EXTRA_KEY", "B_KEY"], "A_KEY"],
		] as const) {
			const err = await launch([...list]).catch((e: unknown) => e as Error);
			expect((err as { status?: number }).status).toBe(422);
			expect((err as Error).message).toBe(`forwarded env is missing variables referenced by models.yml: ${missing}`);
			expect((err as Error).message).not.toContain("value-of-");
		}
		// Complete, reordered and duplicated lists are accepted; the proxy forwards no name into the agent.
		expect((await launch(["B_KEY", "A_KEY"])).envNames).toEqual([]);
		expect((await launch(null)).envNames).toEqual([]);
		expect((await launch(["B_KEY", "A_KEY", "A_KEY"])).envNames).toEqual([]);
		// A superset is refused: the proxy has no route for an extra variable.
		await expect(launch(["EXTRA_KEY", "B_KEY", "A_KEY"])).rejects.toThrow(
			"provider proxy cannot route forwarded variables not referenced by models.yml: EXTRA_KEY",
		);
		// Host value missing for any name in the union.
		delete process.env.EXTRA_KEY;
		await expect(launch(["EXTRA_KEY", "A_KEY", "B_KEY"])).rejects.toThrow(
			"host env not set for forwarded variables: EXTRA_KEY",
		);
		delete process.env.A_KEY;
		await expect(launch(null)).rejects.toThrow("host env not set for forwarded variables: A_KEY");
	});

	it("evaluate answers 422 over REST for a literal apiKey and launches nothing", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(
			jobsDir,
			"models.yml",
			"providers:\n  onara:\n    baseUrl: http://x\n    apiKey: sk-literal-secret-value-99\n",
		);
		const h = harness({ modelsYaml, forwardEnv: [] });
		const { rootId } = await seed(h);
		const res = await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1" });
		await expectError(
			res,
			422,
			"models.yml providers.onara.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)",
		);
		expect(h.manager.store.listRuns()).toEqual([]);
	});

	it("refuses to reuse an existing evaluation job name", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(
			jobsDir,
			"models.yml",
			"providers:\n  onara:\n    baseUrl: http://x\n    apiKey: sk-literal-secret-value-99\n",
		);
		const h = harness({ modelsYaml, forwardEnv: [] });
		const { suiteHash, rootId } = await seed(h);
		writeJob(h, "evo-used", rootId, { t1: 0, t2: 1 }, { suiteHash });
		h.manager.store.syncRun("evo-used");
		const before = h.manager.store.listTraces("evo-used");
		expect(before.length).toBe(2);
		const run = h.manager.store.getRun("evo-used");
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1", jobName: "evo-used" }),
			409,
			"job 'evo-used' already exists; evaluate always starts a new run",
		);
		expect(h.manager.store.listTraces("evo-used")).toEqual(before);
		expect(h.manager.store.getRun("evo-used")).toEqual(run);
		// Positive control: a fresh name passes the guard and reaches launch construction (422 from the literal key).
		await expectError(
			await h.post(`/api/evo/variants/${rootId}/evaluate`, { suiteId: "search-1", jobName: "evo-fresh" }),
			422,
			"models.yml providers.onara.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)",
		);
	});

	it("resolveArmLaunch inherits suite, executor and tasks; only the variant may change", async () => {
		const modelsDir = tmp("evo-arm-models-");
		write(modelsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n");
		const defaults: EvoLaunchDefaults = { modelsYaml: path.join(modelsDir, "models.yml"), forwardEnv: [] };
		const h = harness(defaults);
		const { suiteHash, rootId, childId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const rootVariant = h.manager.store.evo.getVariant(rootId)!;
		const launch = await buildEvalLaunch({
			jobsDir: h.jobsDir,
			variant: rootVariant,
			suite,
			jobName: "exp-base",
			defaults,
			sourceRoot: h.source,
		});
		h.manager.store.registerLaunch({
			benchmark: "harbor",
			jobName: "exp-base",
			dataset: SUITE.dataset,
			agent: "omp",
			models: [SUITE.model],
			pid: 1,
			variantId: rootId,
			suiteId: "search-1",
			config: { ...launch },
		});
		const arm = await resolveArmLaunch(
			h.manager.store,
			"exp",
			{ arm: "child", model: SUITE.model, variantId: childId },
			h.source,
		);
		expect(arm).toMatchObject({
			suiteId: "search-1",
			suiteHash,
			thinking: "medium",
			include: SUITE.include,
			variantId: childId,
			noGateway: true,
			providerProxy: true,
		});
		expect(arm.executorConfigHash).toBe(launch.executorConfigHash);
		expect(arm.stagedConfigHash).toBe(launch.stagedConfigHash); // both lack config.yml; AGENTS.md is not part of it
		expect(arm.agentDir).toContain(childId);
		await expect(
			resolveArmLaunch(h.manager.store, "exp", { arm: "m", model: "other/model", variantId: childId }, h.source),
		).rejects.toThrow(`evo arms keep the suite model '${SUITE.model}'; got 'other/model'`);
		await expect(
			resolveArmLaunch(h.manager.store, "exp", { arm: "p", model: SUITE.model, prewalk: {} }, h.source),
		).rejects.toThrow("evo arms may change only variantId, role, and note");
	});

	it("refuses an arm that inherits an external source root from an evo template", async () => {
		const h = harness();
		const required = path.join(h.jobsDir, "_evo", "worktrees");
		const inside = path.join(required, "wt-1");
		fs.mkdirSync(inside, { recursive: true });
		const external = tmp("evo-arm-external-");
		const repo = tmp("evo-arm-repo-");
		const template = (jobName: string, config: Record<string, unknown>): void => {
			h.manager.store.registerLaunch({
				benchmark: "harbor",
				jobName,
				dataset: SUITE.dataset,
				agent: "omp",
				models: [SUITE.model],
				pid: 1,
				config: { model: SUITE.model, ...config },
			});
		};
		template("ext-base", { variantId: "v-old", sourceRoot: external });
		template("in-base", { variantId: "v-old", sourceRoot: inside });
		template("plain-base", { sourceRoot: repo });
		// No variantId on the request: the template's identity is inherited verbatim.
		await expect(
			resolveArmLaunch(h.manager.store, "ext", { arm: "a", model: SUITE.model }, h.source),
		).rejects.toThrow(
			`inherited variant 'v-old' source root must be a task-owned worktree under ${required}: ${external}`,
		);
		expect(await resolveArmLaunch(h.manager.store, "in", { arm: "a", model: SUITE.model }, h.source)).toMatchObject({
			variantId: "v-old",
			sourceRoot: inside,
		});
		expect(
			await resolveArmLaunch(h.manager.store, "plain", { arm: "a", model: SUITE.model }, h.source),
		).toMatchObject({
			sourceRoot: repo,
		});
	});

	it("refuses to resume an evo run whose recorded source root is external", async () => {
		const h = harness();
		const required = path.join(h.jobsDir, "_evo", "worktrees");
		const inside = path.join(required, "wt-1");
		fs.mkdirSync(inside, { recursive: true });
		const external = tmp("evo-resume-external-");
		const repo = tmp("evo-resume-repo-");
		const register = (
			jobName: string,
			variantId: string | undefined,
			sourceRoot: string,
			withConfig: boolean,
		): void => {
			h.manager.store.registerLaunch({
				benchmark: "harbor",
				jobName,
				dataset: SUITE.dataset,
				agent: "omp",
				models: [SUITE.model],
				pid: 2147483646,
				config: { model: SUITE.model, sourceRoot },
				variantId,
			});
			h.manager.store.markExit(jobName, 0, false);
			if (withConfig) write(path.join(h.jobsDir, jobName), "config.json", "{}");
		};
		register("ext-run", "v-old", external, true);
		await expect(h.manager.resume("ext-run")).rejects.toThrow(
			`variant 'v-old' source root must be a task-owned worktree under ${required}: ${external}`,
		);
		// Positive controls stop at the next precondition (missing harbor config.json) instead of
		// spawning a real runner: reaching that error proves the ownership guard did not fire.
		register("in-run", "v-old", inside, false);
		await expect(h.manager.resume("in-run")).rejects.toThrow("in-run has no harbor config.json to resume from");
		register("plain-run", undefined, repo, false);
		await expect(h.manager.resume("plain-run")).rejects.toThrow("plain-run has no harbor config.json to resume from");
	});
});

describe("registered variant snapshot integrity at launch", () => {
	/** Stub Bun.spawn only: ManagerServer.launch, #spawnRunner and registerLaunch stay production code. */
	function stubSpawn(): { argvs: string[][] } {
		const argvs: string[][] = [];
		const bun: { spawn: unknown } = Bun;
		const original = bun.spawn;
		bun.spawn = (argv: string[]) => {
			argvs.push(argv);
			return { pid: process.pid, exited: new Promise<number>(() => {}) };
		};
		cleanups.push(() => {
			bun.spawn = original;
		});
		return { argvs };
	}

	/** The attack: an owner may unlink a read-only file from a writable dir and drop a replacement in. */
	function replaceSnapshotFile(jobsDir: string, variantId: string, rel: string, content: string): void {
		const dir = path.join(jobsDir, "_evo", "variants", variantId, "config");
		const target = path.join(dir, path.dirname(rel));
		// A directory the registry made non-writable is chmod-able back by its owner; the hash check, not modes, is the boundary.
		fs.chmodSync(path.join(jobsDir, "_evo", "variants", variantId), 0o755);
		fs.chmodSync(dir, 0o755);
		fs.chmodSync(target, 0o755);
		fs.rmSync(path.join(dir, rel), { force: true });
		fs.writeFileSync(path.join(dir, rel), content);
	}

	function artifacts(jobsDir: string, jobName: string) {
		return {
			jobDir: fs.existsSync(path.join(jobsDir, jobName)),
			benchDir: fs.existsSync(path.join(jobsDir, "_bench", jobName)),
			runnerConfig: fs.existsSync(path.join(jobsDir, "_bench", jobName, "runner-config.json")),
			overlay: fs.existsSync(path.join(jobsDir, "_bench", jobName, "agent-overlay")),
		};
	}

	function setup() {
		const modelsDir = tmp("evo-integrity-models-");
		write(modelsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n");
		return harness({ modelsYaml: path.join(modelsDir, "models.yml"), forwardEnv: [] });
	}

	const evaluate = (h: Harness, variantId: string, jobName: string) =>
		h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "search-1", jobName });

	it("refuses to evaluate a variant whose snapshot was replaced after registration, before any job artifact exists", async () => {
		const h = setup();
		const { argvs } = stubSpawn();
		const { rootId, childId } = await seed(h);
		// Positive control: untouched variants launch.
		const ok = await evaluate(h, rootId, "evo-intact");
		expect(ok.status).toBe(201);
		expect(argvs.length).toBe(1);

		replaceSnapshotFile(h.jobsDir, childId, "AGENTS.md", "tampered harness");
		const res = await evaluate(h, childId, "evo-tampered");
		const body = await h.json<{ error: string }>(res);
		expect({ status: res.status, error: body.error }).toEqual({
			status: 422,
			error: `variant '${childId}' snapshot no longer matches its registered configHash`,
		});
		expect(body.error).not.toContain("tampered harness");
		expect(argvs.length).toBe(1);
		expect(h.manager.store.getRun("evo-tampered")).toBeNull();
		expect(artifacts(h.jobsDir, "evo-tampered")).toEqual({
			jobDir: false,
			benchDir: false,
			runnerConfig: false,
			overlay: false,
		});
		// The untouched sibling is unaffected.
		expect((await evaluate(h, rootId, "evo-intact-2")).status).toBe(201);
	});

	it("also refuses added and removed snapshot files", async () => {
		const h = setup();
		stubSpawn();
		const { rootId, childId } = await seed(h);
		const dir = path.join(h.jobsDir, "_evo", "variants");
		fs.chmodSync(path.join(dir, rootId, "config"), 0o755);
		fs.writeFileSync(path.join(dir, rootId, "config", "config.yml"), "theme: injected\n");
		expect((await evaluate(h, rootId, "evo-added")).status).toBe(422);
		fs.chmodSync(path.join(dir, childId), 0o755);
		fs.chmodSync(path.join(dir, childId, "config"), 0o755);
		fs.rmSync(path.join(dir, childId, "config", "AGENTS.md"));
		expect((await evaluate(h, childId, "evo-removed")).status).toBe(422);
		expect(h.manager.store.listRuns()).toEqual([]);
	});

	it("refuses an arm that swaps in, or inherits, a tampered variant", async () => {
		const h = setup();
		const { argvs } = stubSpawn();
		const { rootId, childId } = await seed(h);
		expect((await evaluate(h, rootId, "exp-base")).status).toBe(201);
		// Arm swapping to an intact variant works.
		const arm = await h.post("/api/experiments/exp/arms", { arm: "child", model: SUITE.model, variantId: childId });
		expect(arm.status).toBe(201);
		const launched = argvs.length;

		replaceSnapshotFile(h.jobsDir, childId, "AGENTS.md", "tampered harness");
		const swapped = await h.post("/api/experiments/exp/arms", {
			arm: "swap",
			model: SUITE.model,
			variantId: childId,
		});
		expect(swapped.status).toBe(400);
		expect(((await swapped.json()) as { error: string }).error).toBe(
			`variant '${childId}' snapshot no longer matches its registered configHash`,
		);
		// Inheriting: the newest sibling template now names the tampered variant, no variantId on the request.
		const inherited = await h.post("/api/experiments/exp/arms", { arm: "inherit", model: SUITE.model });
		expect(inherited.status).toBe(400);
		expect(argvs.length).toBe(launched);
		expect(h.manager.store.getRun("exp-swap")).toBeNull();
		expect(h.manager.store.getRun("exp-inherit")).toBeNull();
		expect(artifacts(h.jobsDir, "exp-swap").benchDir).toBe(false);
	});
});

describe("evo evaluation-pair binding (R52)", () => {
	it("fitness names the job used: newest by default, the named older job with ?job", async () => {
		const h = harness();
		const { suiteHash, childId } = await seed(h);
		writeJob(h, "evo-child-old", childId, { t1: 0, t2: 0 }, { suiteHash });
		writeJob(h, "evo-child-new", childId, { t1: 1, t2: 1 }, { suiteHash });
		const base = `${h.base}/api/evo/variants/${childId}/fitness?suite=search-1`;
		const newest = await h.json<{ vHat: number; jobName: string }>(await fetch(base));
		expect(newest).toMatchObject({ vHat: 1, jobName: "evo-child-new" });
		const older = await h.json<{ vHat: number; jobName: string }>(await fetch(`${base}&job=evo-child-old`));
		expect(older).toMatchObject({ vHat: 0, jobName: "evo-child-old" });
		expect((await fetch(`${base}&job=ghost`)).status).toBe(404);
	});

	it("compare uses exactly the named child/baseline jobs from different epochs and reports both", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "root-a", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "child-a", childId, { t1: 1, t2: 1 }, { suiteHash, signals: ["fix"] });
		writeJob(h, "root-b", rootId, { t1: 1, t2: 1 }, { suiteHash });
		writeJob(h, "child-b", childId, { t1: 1, t2: 0 }, { suiteHash, signals: ["fix"] });
		const url = `${h.base}/api/evo/variants/${childId}/compare?suite=search-1`;
		const dflt = await h.json<{ childJob: string; baselineJob: string; rawDelta: number }>(await fetch(url));
		expect(dflt).toMatchObject({ childJob: "child-b", baselineJob: "root-b", rawDelta: -0.5 });
		const mixed = await h.json<{ childJob: string; baselineJob: string; rawDelta: number }>(
			await fetch(`${url}&childJob=child-a&baselineJob=root-a`),
		);
		expect(mixed).toMatchObject({ childJob: "child-a", baselineJob: "root-a", rawDelta: 0.5 });
		const onlyChild = await h.json<{ childJob: string; baselineJob: string }>(await fetch(`${url}&childJob=child-a`));
		expect(onlyChild).toMatchObject({ childJob: "child-a", baselineJob: "root-b" });
		const bundle = await h.json<{ childJob: string; baselineJob: string | null }>(
			await fetch(
				`${h.base}/api/evo/variants/${childId}/reflection-bundle?suite=search-1&childJob=child-a&baselineJob=root-a`,
			),
		);
		expect(bundle).toMatchObject({ childJob: "child-a", baselineJob: "root-a" });
	});

	it("rejects a job of another variant or a missing job; never falls back", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "root-a", rootId, { t1: 0, t2: 1 }, { suiteHash });
		writeJob(h, "child-a", childId, { t1: 1, t2: 1 }, { suiteHash });
		const url = `${h.base}/api/evo/variants/${childId}/compare?suite=search-1`;
		expect((await fetch(`${url}&childJob=root-a`)).status).toBe(422);
		expect((await fetch(`${url}&baselineJob=child-a`)).status).toBe(422);
		expect((await fetch(`${url}&childJob=ghost`)).status).toBe(404);
		expect((await fetch(`${url}&baselineJob=ghost`)).status).toBe(404);
		expect((await fetch(`${h.base}/api/evo/variants/${childId}/fitness?suite=search-1&job=root-a`)).status).toBe(422);
	});

	it("matched-conditions are re-verified on the explicit pair, not the newest rows", async () => {
		const h = harness();
		const { suiteHash, rootId, childId } = await seed(h);
		writeJob(h, "root-a", rootId, { t1: 0, t2: 1 }, { suiteHash, taskHash: "a".repeat(64) });
		writeJob(h, "child-a", childId, { t1: 1, t2: 1 }, { suiteHash, taskHash: "a".repeat(64) });
		writeJob(h, "root-b", rootId, { t1: 0, t2: 1 }, { suiteHash, taskHash: "b".repeat(64) });
		const url = `${h.base}/api/evo/variants/${childId}/compare?suite=search-1`;
		// Newest baseline is root-b (different task bytes): default pairing refuses.
		expect((await fetch(url)).status).toBe(409);
		// Explicit matched epoch-a pair succeeds.
		const ok = await h.json<{ rawDelta: number; baselineJob: string }>(await fetch(`${url}&baselineJob=root-a`));
		expect(ok).toMatchObject({ rawDelta: 0.5, baselineJob: "root-a" });
		// Explicit mismatched pair refuses.
		expect((await fetch(`${url}&baselineJob=root-b`)).status).toBe(409);
	});
});
