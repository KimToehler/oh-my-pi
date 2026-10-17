import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildEvalLaunch, type EvoLaunchDefaults } from "../src/evo/launch";
import { LIVENESS_PATH, ProviderProxy, probeProxyLiveness } from "../src/evo/provider-proxy";
import {
	assertProxyForwardsNoCredentials,
	PROXY_TOKEN_ENV,
	proxyRoutesFromModels,
	rewriteModelsForProxy,
} from "../src/evo/proxy-models";
import { SuiteRegistry } from "../src/evo/suites";
import { harborRunnerArgs } from "../src/launch-args";
import { ManagerServer } from "../src/server";
import "./registry-stub";

const SENTINEL = "sk-proxy-sentinel-R64-0123456789abcdef";
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

function tmp(prefix: string): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	cleanups.push(() => {
		const unlock = (d: string): void => {
			try {
				fs.chmodSync(d, 0o755);
				for (const e of fs.readdirSync(d, { withFileTypes: true }))
					if (e.isDirectory()) unlock(path.join(d, e.name));
			} catch {}
		};
		unlock(dir);
		fs.rmSync(dir, { recursive: true, force: true });
	});
	return dir;
}

function setEnv(name: string, value: string): void {
	process.env[name] = value;
	cleanups.push(() => {
		delete process.env[name];
	});
}

const MODELS = "providers:\n  onara:\n    baseUrl: http://upstream.invalid/v1\n    apiKey: R64_PROVIDER_KEY\n";

describe("proxy models", () => {
	it("rewrites every credentialed provider to the proxy and strips key/headers", () => {
		const text = `${MODELS}    headers:\n      X-Org: R64_ORG\n  plain:\n    baseUrl: http://p.invalid\n`;
		const out = rewriteModelsForProxy(text, "http://host.docker.internal:5555");
		const parsed = Bun.YAML.parse(out) as { providers: Record<string, Record<string, unknown>> };
		expect(parsed.providers.onara).toEqual({
			baseUrl: "http://host.docker.internal:5555/onara",
			apiKey: PROXY_TOKEN_ENV,
		});
		expect(parsed.providers.plain).toEqual({ baseUrl: "http://p.invalid" });
		expect(out).not.toContain("R64_PROVIDER_KEY");
		expect(out).not.toContain("R64_ORG");
	});

	it("refuses a credentialed provider without a baseUrl", () => {
		expect(() => proxyRoutesFromModels("providers:\n  a:\n    apiKey: K\n", {})).toThrow("no baseUrl");
	});

	it("guard refuses forwarding any models.yml credential into the agent", () => {
		expect(() => assertProxyForwardsNoCredentials(["R64_PROVIDER_KEY"], ["R64_PROVIDER_KEY"])).toThrow(
			"must not forward credential env R64_PROVIDER_KEY",
		);
		expect(() => assertProxyForwardsNoCredentials(["PI_X"], ["R64_PROVIDER_KEY"])).not.toThrow();
	});
});

describe("ProviderProxy", () => {
	it("swaps the per-run token for the real key and rejects unknown tokens", async () => {
		const seen: Array<{ auth: string | null; path: string }> = [];
		const upstream = Bun.serve({
			port: 0,
			fetch: req => {
				seen.push({ auth: req.headers.get("authorization"), path: new URL(req.url).pathname });
				return new Response("ok");
			},
		});
		cleanups.push(() => void upstream.stop(true));
		const proxy = new ProviderProxy();
		cleanups.push(() => proxy.stop());
		const routes = proxyRoutesFromModels(
			`providers:\n  onara:\n    baseUrl: http://127.0.0.1:${upstream.port}/v1\n    apiKey: R64_PROVIDER_KEY\n`,
			{ R64_PROVIDER_KEY: SENTINEL },
		);
		const token = proxy.register("job", routes);
		expect(token).not.toContain(SENTINEL);
		const base = `http://127.0.0.1:${proxy.port}/onara/chat`;
		expect(
			await (
				await fetch(base, { method: "POST", body: "{}", headers: { authorization: `Bearer ${token}` } })
			).text(),
		).toBe("ok");
		expect(seen).toEqual([{ auth: `Bearer ${SENTINEL}`, path: "/v1/chat" }]);
		expect((await fetch(base, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
		proxy.unregister("job");
		expect((await fetch(base, { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
		expect(seen).toHaveLength(1);
	});
});

describe("provider proxy liveness", () => {
	const routes = new Map([["onara", { upstream: "http://upstream.invalid/v1", apiKey: "k", headers: {} }]]);
	it("204 for a live token, 401 after unregister and after stop; never forwards upstream", async () => {
		let upstreamCalls = 0;
		const proxy = new ProviderProxy((async () => {
			upstreamCalls++;
			return new Response("x");
		}) as unknown as typeof fetch);
		const token = proxy.register("job", routes);
		const port = proxy.port;
		const url = `http://127.0.0.1:${port}${LIVENESS_PATH}`;
		const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
		expect((await fetch(url, { headers: { "x-api-key": token } })).status).toBe(204);
		expect((await fetch(url)).status).toBe(401);
		expect((await fetch(url, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
		expect(await probeProxyLiveness(port, token)).toBe(true);
		proxy.unregister("job");
		expect((await fetch(url, { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
		expect(await probeProxyLiveness(port, token)).toBe(false);
		const second = proxy.register("job2", routes);
		expect(await probeProxyLiveness(port, second)).toBe(true);
		proxy.stop();
		expect(await probeProxyLiveness(port, second)).toBe(false);
		expect(upstreamCalls).toBe(0);
	});
});

describe("evo launch through the provider proxy", () => {
	const SUITE = {
		id: "search-r64",
		split: "search",
		benchmark: "harbor",
		dataset: `terminal-bench@sha256:${"a".repeat(64)}`,
		include: ["t1"],
		attempts: 1,
		timeoutMultiplier: 1,
		model: "onara/cc/claude-sonnet-5-5",
		thinking: "medium",
		environment: "docker",
		platform: "linux/arm64",
		minPairedTasks: 1,
		minAttemptsPerTask: 1,
		concurrency: 1,
	};

	async function setup() {
		setEnv("R64_PROVIDER_KEY", SENTINEL);
		const jobsDir = tmp("r64-jobs-");
		const source = tmp("r64-src-");
		const git = (...args: string[]): void => {
			const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: source });
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		};
		git("init", "-q", "-b", "main");
		fs.writeFileSync(path.join(source, "a.txt"), "1");
		git("add", "-A");
		git("commit", "-q", "-m", "init");
		const modelsYaml = path.join(jobsDir, "models.yml");
		fs.writeFileSync(modelsYaml, MODELS);
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: null };
		const manager = new ManagerServer(jobsDir, undefined, { sourceRoot: source, defaults });
		const server = manager.start(0);
		cleanups.push(() => void manager.stop());
		const post = (url: string, body: unknown) =>
			fetch(`http://localhost:${server.port}${url}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
		const rootDir = tmp("r64-root-");
		fs.writeFileSync(path.join(rootDir, "AGENTS.md"), "root");
		await post("/api/evo/suites", SUITE);
		const root = (await (await post("/api/evo/variants", { mutation: "root", configDir: rootDir })).json()) as {
			variant: { id: string };
		};
		const suite = (await new SuiteRegistry(jobsDir).get("search-r64"))!;
		const variant = manager.store.evo.getVariant(root.variant.id)!;
		return { jobsDir, manager, suite, variant, defaults, source };
	}

	it("buildEvalLaunch forwards no credential name and requests the proxy", async () => {
		const { jobsDir, suite, variant, defaults, source } = await setup();
		const launch = await buildEvalLaunch({
			jobsDir,
			variant,
			suite,
			jobName: "j",
			defaults,
			sourceRoot: source,
		});
		expect(launch.providerProxy).toBe(true);
		expect(launch.envNames).toEqual([]);
		const argv = harborRunnerArgs(launch, { jobsDir, jobName: "j", dataset: SUITE.dataset });
		expect(argv).toContain("--provider-proxy");
		expect(argv).not.toContain("--env");
		expect(JSON.stringify(launch)).not.toContain(SENTINEL);
	});

	it("an explicitly forwarded variable the proxy cannot route is refused", async () => {
		setEnv("R64_EXTRA", "extra-secret-value-123456");
		const { jobsDir, suite, variant, source } = await setup();
		const defaults: EvoLaunchDefaults = {
			modelsYaml: path.join(jobsDir, "models.yml"),
			forwardEnv: ["R64_PROVIDER_KEY", "R64_EXTRA"],
		};
		await expect(
			buildEvalLaunch({ jobsDir, variant, suite, jobName: "j", defaults, sourceRoot: source }),
		).rejects.toThrow("provider proxy cannot route forwarded variables not referenced by models.yml: R64_EXTRA");
	});

	it("real runner process: sentinel reaches no persisted artifact and no spawned process environment", async () => {
		const { jobsDir, manager, suite, variant, defaults, source } = await setup();
		const bin = tmp("r64-bin-");
		const envDump = path.join(tmp("r64-dump-"), "harbor-env.txt");
		for (const name of ["harbor", "docker"]) {
			const file = path.join(bin, name);
			fs.writeFileSync(file, name === "harbor" ? `#!/bin/sh\nenv > "${envDump}"\nexit 0\n` : "#!/bin/sh\nexit 0\n");
			fs.chmodSync(file, 0o755);
		}
		const oldPath = process.env.PATH;
		process.env.PATH = `${bin}${path.delimiter}${oldPath ?? ""}`;
		cleanups.push(() => {
			process.env.PATH = oldPath;
		});
		const launch = await buildEvalLaunch({
			jobsDir,
			variant,
			suite,
			jobName: "r64-job",
			defaults,
			sourceRoot: source,
		});
		manager.launch({ ...launch, extraArgs: ["--install", "published"] });
		for (let i = 0; i < 300 && manager.store.getRun("r64-job")?.status === "running"; i++) await Bun.sleep(100);
		expect(manager.store.getRun("r64-job")?.status).toBe("complete");
		const dump = fs.readFileSync(envDump, "utf8");
		expect(dump).not.toContain(SENTINEL);
		expect(dump).not.toContain("R64_PROVIDER_KEY=");
		expect(dump).toContain(`${PROXY_TOKEN_ENV}=omp-evo-`);
		const overlayModels = fs.readFileSync(
			path.join(jobsDir, "_bench", "r64-job", "agent-overlay", "models.yml"),
			"utf8",
		);
		expect(overlayModels).toContain(`apiKey: ${PROXY_TOKEN_ENV}`);
		expect(overlayModels).toContain("/onara");
		const hits: string[] = [];
		for (const entry of fs.readdirSync(jobsDir, { withFileTypes: true, recursive: true })) {
			if (!entry.isFile()) continue;
			const file = path.join(entry.parentPath, entry.name);
			if (fs.readFileSync(file).includes(SENTINEL)) hits.push(file);
		}
		expect(hits.filter(f => path.basename(f) !== "models.yml")).toEqual([]);
		// The token is a host-sourced value: it must not be persisted either.
		const persisted = fs.readFileSync(path.join(jobsDir, "_bench", "r64-job", "runner-config.json"), "utf8");
		expect(persisted).not.toContain("omp-evo-");
	}, 60_000);

	/** Spawn the real runner against a standalone proxy; stub harbor writes one verified trial then blocks on `release`. */
	async function runAgainstProxy(stopBefore: boolean) {
		const { jobsDir, manager, suite, variant, defaults, source } = await setup();
		const bin = tmp("r71-bin-");
		const gate = tmp("r71-gate-");
		const wrote = path.join(gate, "wrote");
		const release = path.join(gate, "release");
		const invoked = path.join(gate, "invoked");
		const trial = path.join(jobsDir, "r71-job", "t1__abc");
		const assistant = JSON.stringify({
			type: "message_end",
			message: { role: "assistant", stopReason: "stop", usage: { input: 1, output: 1 } },
		});
		const harbor = [
			"#!/bin/sh",
			`touch "${invoked}"`,
			`mkdir -p "${trial}/agent"`,
			`printf '%s\\n' '${assistant}' > "${trial}/agent/omp.txt"`,
			`printf '%s' '{"started_at":"2026-01-01T00:00:00Z","finished_at":"2026-01-01T00:00:10Z","verifier_result":{"rewards":{"reward":1}}}' > "${trial}/result.json"`,
			`touch "${wrote}"`,
			`while [ ! -f "${release}" ]; do sleep 0.05; done`,
			"exit 0",
			"",
		].join("\n");
		for (const name of ["harbor", "docker"]) {
			const file = path.join(bin, name);
			fs.writeFileSync(file, name === "harbor" ? harbor : "#!/bin/sh\nexit 0\n");
			fs.chmodSync(file, 0o755);
		}
		const launch = await buildEvalLaunch({
			jobsDir,
			variant,
			suite,
			jobName: "r71-job",
			defaults,
			sourceRoot: source,
		});
		const argv = harborRunnerArgs(
			{ ...launch, extraArgs: ["--install", "published"] },
			{
				jobsDir,
				jobName: "r71-job",
				dataset: SUITE.dataset,
			},
		);
		const proxy = new ProviderProxy();
		cleanups.push(() => proxy.stop());
		const token = proxy.register("r71-job", proxyRoutesFromModels(MODELS, { R64_PROVIDER_KEY: SENTINEL }));
		const port = proxy.port;
		if (stopBefore) proxy.stop();
		const env: Record<string, string | undefined> = { ...process.env };
		delete env.R64_PROVIDER_KEY;
		env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ""}`;
		env[PROXY_TOKEN_ENV] = token;
		env.OMP_EVO_PROXY_PORT = String(port);
		const proc = Bun.spawn(["bun", "src/runner.ts", ...argv], {
			cwd: path.resolve(import.meta.dir, ".."),
			env,
			stdout: "pipe",
			stderr: "pipe",
		});
		cleanups.push(() => proc.kill());
		return { jobsDir, manager, proc, proxy, wrote, release, invoked, trial };
	}

	it("proxy dead before launch: runner refuses to start and never invokes harbor", async () => {
		const r = await runAgainstProxy(true);
		const code = await r.proc.exited;
		expect(code).not.toBe(0);
		expect(await new Response(r.proc.stderr).text()).toContain("provider proxy liveness probe failed");
		expect(fs.existsSync(r.invoked)).toBe(false);
	}, 60_000);

	it("proxy lost between pre- and post-probe: persisted trial phase is executor_infra_failure", async () => {
		const r = await runAgainstProxy(false);
		for (let i = 0; i < 600 && !fs.existsSync(r.wrote); i++) await Bun.sleep(50);
		expect(fs.existsSync(r.wrote)).toBe(true);
		r.proxy.stop();
		fs.writeFileSync(r.release, "");
		await r.proc.exited;
		r.manager.store.registerLaunch({
			benchmark: "harbor",
			jobName: "r71-job",
			dataset: "d",
			agent: "omp",
			models: ["m"],
			pid: 1,
		});
		r.manager.store.syncRun("r71-job");
		const rows = r.manager.store.listTraces("r71-job");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.reward).toBe(1);
		expect(rows[0]?.phase).toBe("executor_infra_failure");
	}, 60_000);

	it("proxy alive throughout: the same stub run is model_outcome (positive control)", async () => {
		const r = await runAgainstProxy(false);
		for (let i = 0; i < 600 && !fs.existsSync(r.wrote); i++) await Bun.sleep(50);
		fs.writeFileSync(r.release, "");
		await r.proc.exited;
		r.manager.store.registerLaunch({
			benchmark: "harbor",
			jobName: "r71-job",
			dataset: "d",
			agent: "omp",
			models: ["m"],
			pid: 1,
		});
		r.manager.store.syncRun("r71-job");
		expect(r.manager.store.listTraces("r71-job")[0]?.phase).toBe("model_outcome");
	}, 60_000);
});
