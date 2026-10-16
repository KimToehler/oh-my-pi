import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildEvalLaunch, type EvoLaunchDefaults } from "../src/evo/launch";
import { SuiteRegistry } from "../src/evo/suites";
import { harborRunnerArgs } from "../src/launch-args";
import { ManagerServer, resolveArmLaunch } from "../src/server";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

function tmp(prefix: string): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
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
	dataset: "terminal-bench@2.0",
	include: ["t1", "t2"],
	attempts: 1,
	timeoutMultiplier: 1,
	model: "onara/cc/claude-sonnet-5-5",
	thinking: "medium",
	environment: "docker",
};

interface Harness {
	base: string;
	jobsDir: string;
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
	executor?: string;
	model?: string;
	infra?: string;
}

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
		];
		write(trial, "agent/omp.txt", `${events.join("\n")}\n`);
	}
	write(jobDir, "config.json", JSON.stringify({ dataset: "terminal-bench@2.0", agents: [{ name: "omp" }] }));
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
		dataset: "terminal-bench@2.0",
		agent: "omp",
		models: [opts.model ?? SUITE.model],
		pid: 999999999,
		variantId,
		suiteId: SUITE.id,
		config: {
			model: opts.model ?? SUITE.model,
			suiteHash: opts.suiteHash,
			executorConfigHash: opts.executor ?? "exec-1",
		},
	});
	h.manager.store.markExit(jobName, 0);
}

async function seed(h: Harness) {
	const rootDir = tmp("evo-api-root-");
	write(rootDir, "AGENTS.md", "root");
	const childDir = tmp("evo-api-child-");
	write(childDir, "AGENTS.md", "root\nchild");
	const suite = await h.json<{ hash: string }>(await h.post("/api/evo/suites", SUITE));
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
	return { rootDir, childDir, suiteHash: suite.hash, rootId: root.variant.id, childId: child.variant.id };
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

		const fitness = await h.json<{ vHat: number; complete: boolean; signalHits: Record<string, number> }>(
			await fetch(`${h.base}/api/evo/variants/${childId}/fitness?suite=search-1`),
		);
		expect(fitness).toMatchObject({ vHat: 1, complete: true, signalHits: { "mark:fix": 2 } });

		const compare = await h.json<{
			rawDelta: number;
			creditedDelta: number;
			wins: number;
			signalsSatisfied: boolean;
		}>(await fetch(`${h.base}/api/evo/variants/${childId}/compare?suite=search-1`));
		expect(compare).toMatchObject({ rawDelta: 0.5, creditedDelta: 0.5, wins: 1, signalsSatisfied: true });

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
		await expectError(
			await fetch(`${h.base}/api/evo/variants/${childId}/fitness?suite=search-1`),
			409,
			"run 'evo-child' did not record its evaluation conditions",
		);
	});

	it("excludes infrastructure failures from fitness and reports incomplete", async () => {
		const h = harness();
		const { suiteHash, rootId } = await seed(h);
		writeJob(h, "evo-root", rootId, { t1: 0, t2: 1 }, { suiteHash, infra: "t1" });
		const fitness = await h.json<{ vHat: number; complete: boolean }>(
			await fetch(`${h.base}/api/evo/variants/${rootId}/fitness?suite=search-1`),
		);
		expect(fitness).toMatchObject({ vHat: 1, complete: false });
	});
});

describe("generic launch route", () => {
	it("rejects caller-supplied evo identity fields and persists nothing", async () => {
		const h = harness();
		for (const field of ["variantId", "suiteId", "suiteHash", "stagedConfigHash", "executorConfigHash"]) {
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
		write(h.jobsDir, "models.yml", "providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n");
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
			write(h.jobsDir, "models.yml", "providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n");
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
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", concurrency: 2, defaults };
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
			concurrency: 2,
			noGateway: true,
			envNames: ["EVO_TEST_ROUTER_KEY"],
			variantId: rootId,
			suiteId: "search-1",
			suiteHash: suite.hash,
			modelsYaml,
		});
		expect(launch.sourceRoot).toBeUndefined();
		expect(launch.agentDir).toBe(path.join(h.jobsDir, "_evo", "variants", rootId, "config"));
		expect(JSON.stringify(launch)).not.toContain(sentinel);
		const argv = harborRunnerArgs(launch, { jobsDir: h.jobsDir, jobName: "j", dataset: SUITE.dataset });
		expect(argv).toContain("--no-gateway");
		expect(argv.join(" ")).toContain("--env EVO_TEST_ROUTER_KEY");
		expect(argv.join(" ")).not.toContain(sentinel);
		for (const flag of ["--agent-dir", "--models-yaml", "--source-identity", "--thinking"])
			expect(argv).toContain(flag);
		expect(argv).not.toContain("--source-root");
		delete process.env.EVO_TEST_ROUTER_KEY;
		await expect(buildEvalLaunch({ ...input, concurrency: null })).rejects.toThrow(
			"host env not set for forwarded variables: EVO_TEST_ROUTER_KEY",
		);
	});

	it("buildEvalLaunch accepts an env-name apiKey and rejects literals with a stable 422, even with an explicit forward list", async () => {
		const jobsDir = tmp("evo-launch-");
		const sentinel = "sk-sentinel-literal-key-0123456789";
		const modelsYaml = path.join(jobsDir, "models.yml");
		const h = harness({ modelsYaml, forwardEnv: [] });
		const { rootId } = await seed(h);
		const suite = (await new SuiteRegistry(h.jobsDir).get("search-1"))!;
		const variant = h.manager.store.evo.getVariant(rootId)!;
		const input = { jobsDir: h.jobsDir, variant, suite, jobName: "j", concurrency: null };
		write(jobsDir, "models.yml", "providers:\n  onara:\n    apiKey: ONARA_ROUTER_KEY\n");
		process.env.ONARA_ROUTER_KEY = "router-value-123";
		cleanups.push(() => {
			delete process.env.ONARA_ROUTER_KEY;
		});
		const ok = await buildEvalLaunch({ ...input, defaults: { modelsYaml, forwardEnv: null } });
		expect(ok.envNames).toEqual(["ONARA_ROUTER_KEY"]);
		for (const value of [sentinel, "'!cat /etc/passwd'", "https://x.example/t", "42", "''"]) {
			write(jobsDir, "models.yml", `providers:\n  onara:\n    apiKey: ${value}\n`);
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

	it("requires an explicit forward list to cover every models.yml env name; outputs a deterministic deduplicated union", async () => {
		const jobsDir = tmp("evo-launch-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(
			jobsDir,
			"models.yml",
			"providers:\n  a:\n    apiKey: B_KEY\n  b:\n    apiKey: A_KEY\n  c:\n    apiKey: A_KEY\n",
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
				concurrency: null,
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
		// Complete, reordered, duplicated and superset lists produce the same sorted union.
		expect((await launch(["B_KEY", "A_KEY"])).envNames).toEqual(["A_KEY", "B_KEY"]);
		expect((await launch(null)).envNames).toEqual(["A_KEY", "B_KEY"]);
		expect((await launch(["EXTRA_KEY", "B_KEY", "A_KEY", "A_KEY"])).envNames).toEqual([
			"A_KEY",
			"B_KEY",
			"EXTRA_KEY",
		]);
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
		write(jobsDir, "models.yml", "providers:\n  onara:\n    apiKey: sk-literal-secret-value-99\n");
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
			concurrency: null,
			defaults,
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
		const arm = resolveArmLaunch(h.manager.store, "exp", { arm: "child", model: SUITE.model, variantId: childId });
		expect(arm).toMatchObject({
			suiteId: "search-1",
			suiteHash,
			thinking: "medium",
			include: SUITE.include,
			variantId: childId,
			noGateway: true,
		});
		expect(arm.executorConfigHash).toBe(launch.executorConfigHash);
		expect(arm.stagedConfigHash).toBe(launch.stagedConfigHash); // both lack config.yml; AGENTS.md is not part of it
		expect(arm.agentDir).toContain(childId);
		expect(() =>
			resolveArmLaunch(h.manager.store, "exp", { arm: "m", model: "other/model", variantId: childId }),
		).toThrow(`evo arms keep the suite model '${SUITE.model}'; got 'other/model'`);
		expect(() => resolveArmLaunch(h.manager.store, "exp", { arm: "p", model: SUITE.model, prewalk: {} })).toThrow(
			"evo arms may change only variantId, role, and note",
		);
	});
});
