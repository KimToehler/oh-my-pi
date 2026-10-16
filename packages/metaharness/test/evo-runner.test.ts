import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MODEL_ROLE_IDS } from "@oh-my-pi/pi-coding-agent/config/model-roles";
import { EvoHttpError } from "../src/evo/boundary";
import { BUILTIN_MODEL_ROLES, executorConfigHash, mergeOverlayConfig, stageAgentOverlay } from "../src/evo/overlay";
import { formatSourceIdentity, sourceIdentity } from "../src/evo/source-identity";
import { harborRunnerArgs } from "../src/launch-args";
import { buildHarborEnv, buildMountsJson, parseArgs } from "../src/runner";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

function tmp(): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "evo-runner-")));
	cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function write(dir: string, rel: string, content: string): void {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), content);
}

const SPEC = {
	model: "onara/cc/claude-sonnet-5-5",
	thinking: "medium",
	webSearch: false,
	findTool: false,
	settings: {},
};

describe("runner flags", () => {
	it("parses --agent-dir, --source-root, --source-identity, --models-yaml", () => {
		const cfg = parseArgs([
			"--agent-dir",
			"rel/agent",
			"--source-root",
			"/w/tree",
			"--source-identity",
			"abc",
			"--models-yaml",
			"/m.yml",
			"--no-gateway",
		]);
		expect(cfg.agentDir).toBe(path.resolve("rel/agent"));
		expect(cfg.sourceRoot).toBe("/w/tree");
		expect(cfg.sourceIdentity).toBe("abc");
		expect(cfg.modelsYaml).toBe("/m.yml");
		expect(cfg.gateway).toBe(false);
		const defaults = parseArgs([]);
		expect(defaults.agentDir).toBeNull();
		expect(defaults.sourceRoot).toBe(path.resolve(import.meta.dir, "..", "..", ".."));
	});

	it("--models-yaml works with --no-gateway and never emits env values", () => {
		const secret = "super-secret-router-key-9999";
		process.env.EVO_RUNNER_KEY = secret;
		cleanups.push(() => {
			delete process.env.EVO_RUNNER_KEY;
		});
		const cfg = parseArgs([
			"--model",
			"onara/cc/m",
			"--models-yaml",
			"/m.yml",
			"--no-gateway",
			"--env",
			"EVO_RUNNER_KEY",
		]);
		const env = buildHarborEnv(cfg, "/m.yml", null, "t", null, "/overlay");
		expect(env.OMP_BENCH_GATEWAY).toBe("0");
		expect(env.OMP_BENCH_MODELS_YAML).toBe("/m.yml");
		expect(env.OMP_BENCH_AGENT_OVERLAY).toBe("/opt/omp/agent-overlay");
		expect(env.OMP_BENCH_GATEWAY_URL).toBeUndefined();
		// The key travels only through the forwarded-env channel, never a config/OMP_BENCH_* field.
		expect(JSON.parse(env.OMP_BENCH_FORWARD_ENV ?? "{}")).toMatchObject({ EVO_RUNNER_KEY: secret });
		for (const [key, value] of Object.entries(env)) {
			if (key.startsWith("OMP_BENCH_") && key !== "OMP_BENCH_FORWARD_ENV") expect(value).not.toContain(secret);
		}
		expect(cfg.hostEnvKeys).toEqual(["EVO_RUNNER_KEY"]);
		// Without an overlay the variable is unset even if inherited from the caller's shell.
		process.env.OMP_BENCH_AGENT_OVERLAY = "/stale";
		cleanups.push(() => {
			delete process.env.OMP_BENCH_AGENT_OVERLAY;
		});
		expect(buildHarborEnv(cfg, "/m.yml", null, "t").OMP_BENCH_AGENT_OVERLAY).toBeUndefined();
	});

	it("an explicit --env KEY=VALUE is not treated as a host-sourced key", () => {
		const cfg = parseArgs(["--env", "A=1"]);
		expect(cfg.hostEnvKeys).toEqual([]);
	});
});

describe("mounts", () => {
	it("mounts the source root and the agent overlay read-only for apple-container", () => {
		const cfg = parseArgs(["--source-root", "/w/tree", "--environment", "apple-container"]);
		const mounts = JSON.parse(
			buildMountsJson(cfg, { arch: "arm64", depsDir: "/deps", nodeModules: ["node_modules"] }, "/ov") ?? "[]",
		) as Array<{ source: string; target: string; read_only: boolean }>;
		expect(mounts.find(m => m.target === "/opt/omp/src")?.source).toBe("/w/tree");
		expect(mounts.find(m => m.target === "/opt/omp/agent-overlay")).toEqual({
			type: "bind",
			source: "/ov",
			target: "/opt/omp/agent-overlay",
			read_only: true,
		});
		expect(mounts.every(m => m.read_only)).toBe(true);
		expect(buildMountsJson(cfg, null, null)).toBeNull();
		expect(JSON.parse(buildMountsJson(cfg, null, "/ov") ?? "[]")).toHaveLength(1);
	});
});

describe("agent overlay", () => {
	it("keeps the frozen built-in role list identical to the live registry", () => {
		expect([...BUILTIN_MODEL_ROLES]).toEqual([...MODEL_ROLE_IDS]);
	});

	it("pins every role to the fixed executor, drops reserved keys, applies explicit settings last", () => {
		const variant = [
			"modelRoles:\n  default: other/model\n  custom: another/one",
			"enabledModels: [x/y]",
			"modelProviderOrder: [x]",
			"retry:\n  maxRetries: 99",
			"defaultThinkingLevel: low",
			"theme: dark",
			"web_search:\n  enabled: true",
		].join("\n");
		const merged = Bun.YAML.parse(
			mergeOverlayConfig(variant, { ...SPEC, settings: { "edit.mode": "sloppy", theme: "light" } }),
		) as Record<string, any>;
		const selector = `${SPEC.model}:medium`;
		expect(merged.modelRoles.default).toBe(selector);
		expect(merged.modelRoles.custom).toBe(selector);
		expect(merged.modelRoles.smol).toBe(selector);
		expect(Object.values(merged.modelRoles).every(v => v === selector)).toBe(true);
		expect(merged.enabledModels).toEqual([SPEC.model]);
		expect(merged.modelProviderOrder).toBeUndefined();
		expect(merged.retry).toBeUndefined();
		expect(merged.defaultThinkingLevel).toBe("medium");
		expect(merged.web_search.enabled).toBe(false); // benchmark toggle beats the variant
		expect(merged.theme).toBe("light"); // explicit setting last
		expect(merged.edit.mode).toBe("sloppy");
		expect(() => mergeOverlayConfig("- a", SPEC)).toThrow("variant config.yml must be a YAML mapping");
	});

	it("stages variant files + merged config + fixed models and hashes the executor independently of the variant", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", "hello");
		write(variant, "rules/r.md", "rule");
		write(variant, "config.yml", "theme: dark\nmodelRoles:\n  default: other/model\n");
		const modelsYaml = path.join(root, "models.yml");
		fs.writeFileSync(modelsYaml, "providers:\n  onara:\n    apiKey: ROUTER_KEY\n");
		const staged = await stageAgentOverlay({
			variantConfigDir: variant,
			dest: path.join(root, "bench", "agent-overlay"),
			spec: SPEC,
			modelsYaml,
		});
		expect(fs.readFileSync(path.join(staged.dir, "AGENTS.md"), "utf8")).toBe("hello");
		expect(fs.readFileSync(path.join(staged.dir, "rules/r.md"), "utf8")).toBe("rule");
		expect(fs.readFileSync(path.join(staged.dir, "models.yml"), "utf8")).toContain("apiKey: ROUTER_KEY");
		expect(fs.readFileSync(path.join(staged.dir, "config.yml"), "utf8")).toContain(SPEC.model);
		expect(staged.executorConfigHash).toBe(executorConfigHash(SPEC));
		expect(executorConfigHash({ ...SPEC, model: "other/m" })).not.toBe(staged.executorConfigHash);
		// Every executor-owned input changes the hash.
		for (const patch of [
			{ thinking: "high" },
			{ webSearch: true },
			{ findTool: true },
			{ settings: { "edit.mode": "sloppy" } },
		]) {
			expect(executorConfigHash({ ...SPEC, ...patch })).not.toBe(staged.executorConfigHash);
		}
		// Settings key order is irrelevant (canonical sorted keys).
		const ab = executorConfigHash({ ...SPEC, settings: { a: 1, b: { y: 2, x: 1 } } });
		expect(executorConfigHash({ ...SPEC, settings: { b: { x: 1, y: 2 }, a: 1 } })).toBe(ab);
		expect(executorConfigHash({ ...SPEC, settings: { a: 1, b: { y: 2, x: 9 } } })).not.toBe(ab);
		expect(JSON.parse(fs.readFileSync(path.join(root, "bench", "overlay-meta.json"), "utf8"))).toEqual({
			stagedConfigHash: staged.stagedConfigHash,
			executorConfigHash: staged.executorConfigHash,
		});
	});

	it("stages only models whose apiKey is an env var name; rejects literals, commands, URLs, non-strings, empty", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", "x");
		const stage = (yaml: string, name: string) => {
			const modelsYaml = path.join(root, `${name}.yml`);
			fs.writeFileSync(modelsYaml, yaml);
			return stageAgentOverlay({
				variantConfigDir: variant,
				dest: path.join(root, `o-${name}`),
				spec: SPEC,
				modelsYaml,
			});
		};
		const sentinel = "sk-sentinel-literal-key-0123456789";
		const bad: Array<[string, string]> = [
			["literal", sentinel],
			["command", "'!op read secret'"],
			["url", "https://user:pw@example.com/token"],
			["number", "12345"],
			["empty", "''"],
			["spaced", "'ROUTER KEY'"],
			["dashed", "my-key"],
		];
		for (const [name, value] of bad) {
			const err = await stage(`providers:\n  onara:\n    apiKey: ${value}\n`, name).catch(
				(e: unknown) => e as Error & { status?: number },
			);
			expect((err as { status?: number }).status).toBe(422);
			expect((err as Error).message).toBe(
				"models.yml providers.onara.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)",
			);
			expect((err as Error).message).not.toContain(sentinel);
			expect(fs.existsSync(path.join(root, `o-${name}`))).toBe(false);
		}
		const okStaged = await stage("providers:\n  onara:\n    apiKey: ONARA_ROUTER_KEY\n", "ok");
		expect(fs.readFileSync(path.join(okStaged.dir, "models.yml"), "utf8")).toContain("ONARA_ROUTER_KEY");
		// A provider with no apiKey stays allowed.
		await stage("providers:\n  local:\n    baseUrl: http://x\n", "none");
	});

	it("refuses a models file that embeds a forwarded secret value", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", "x");
		const modelsYaml = path.join(root, "models.yml");
		fs.writeFileSync(
			modelsYaml,
			"providers:\n  onara:\n    baseUrl: http://x\n    note: literal-secret-value-1234\n",
		);
		await expect(
			stageAgentOverlay({
				variantConfigDir: variant,
				dest: path.join(root, "o"),
				spec: SPEC,
				modelsYaml,
				secretValues: ["literal-secret-value-1234"],
			}),
		).rejects.toThrow("--models-yaml embeds a forwarded secret value; reference the env var name instead");
		expect(fs.existsSync(path.join(root, "o"))).toBe(false);
		await expect(
			stageAgentOverlay({
				variantConfigDir: variant,
				dest: path.join(root, "o"),
				spec: SPEC,
				modelsYaml: path.join(root, "nope.yml"),
			}),
		).rejects.toThrow(/--models-yaml not readable/);
	});

	// Agent-dir path: stageAgentOverlay() -> referencedEnvNamesFromText() before models.yml is copied into the overlay.
	it("stageAgentOverlay rejects literal header credentials and userinfo baseUrls without echoing them or staging", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", "x");
		const secret = "evo-header-secret-7b1c2d";
		const cases: Array<[string, string, string]> = [
			[
				"header",
				`providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n  private-provider:\n    baseUrl: https://example.invalid/v1\n    headers:\n      Authorization: "Bearer ${secret}"\n`,
				"providers.private-provider.headers.Authorization",
			],
			[
				"userinfo",
				`providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n  private-provider:\n    baseUrl: "https://user:${secret}@example.invalid/v1"\n`,
				"providers.private-provider.baseUrl",
			],
			[
				"query",
				`providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n  private-provider:\n    baseUrl: "https://provider.invalid/v1?api_key=${secret}"\n`,
				"providers.private-provider.baseUrl",
			],
		];
		for (const [name, yaml, where] of cases) {
			const modelsYaml = path.join(root, `${name}.yml`);
			fs.writeFileSync(modelsYaml, yaml);
			const err = await stageAgentOverlay({
				variantConfigDir: variant,
				dest: path.join(root, `o-${name}`),
				spec: SPEC,
				modelsYaml,
			}).then(
				() => undefined,
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(EvoHttpError);
			if (!(err instanceof EvoHttpError)) throw new Error("unreachable");
			expect(err.status).toBe(422);
			expect(err.message).toContain(where);
			expect(err.message).not.toContain(secret);
			expect(fs.existsSync(path.join(root, `o-${name}`))).toBe(false);
		}
		// Env-var-named header values stay allowed.
		const okYaml = path.join(root, "ok.yml");
		fs.writeFileSync(
			okYaml,
			"providers:\n  p:\n    baseUrl: https://example.invalid/v1\n    headers:\n      Authorization: EVO_AUTH_HEADER\n",
		);
		await stageAgentOverlay({
			variantConfigDir: variant,
			dest: path.join(root, "o-ok"),
			spec: SPEC,
			modelsYaml: okYaml,
		});
	});
});

describe("source root", () => {
	it("identity drift: a dirty edit changes the formatted identity the runner compares", async () => {
		const root = tmp();
		const run = (...a: string[]) => {
			const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: root });
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		};
		run("init", "-q", "-b", "main");
		write(root, "f.txt", "1");
		run("add", "-A");
		run("commit", "-q", "-m", "i");
		const expected = formatSourceIdentity(await sourceIdentity(root));
		write(root, "f.txt", "2");
		const actual = formatSourceIdentity(await sourceIdentity(root));
		expect(actual).not.toBe(expected);
		expect(actual.startsWith(`${expected}+`)).toBe(true);
	});
});

describe("resume secrecy", () => {
	it("runner-config snapshots omit host-sourced env values and resume re-reads them", async () => {
		const { resolveResumeConfig } = await import("../src/runner");
		const jobsDir = tmp();
		write(jobsDir, "job-x/config.json", JSON.stringify({ environment: { type: "docker" } }));
		write(
			jobsDir,
			"_bench/job-x/runner-config.json",
			JSON.stringify({ models: ["m/x"], env: { KEEP: "1" }, hostEnvKeys: ["EVO_RESUME_KEY"] }),
		);
		process.env.EVO_RESUME_KEY = "fresh-from-shell";
		cleanups.push(() => {
			delete process.env.EVO_RESUME_KEY;
		});
		const cfg = resolveResumeConfig(parseArgs(["--resume", "job-x", "--jobs-dir", jobsDir]));
		expect(cfg.env).toEqual({ KEEP: "1", EVO_RESUME_KEY: "fresh-from-shell" });
	});
});

describe("local datasets", () => {
	const req = { model: "m/x", environment: "docker" as const };
	const opts = (dataset: string) => ({ jobsDir: "/jobs", jobName: "j", dataset });

	it("emits --path for absolute and explicit relative directories and -d for registry names", () => {
		const dir = tmp();
		const abs = harborRunnerArgs(req, opts(dir));
		expect(abs).toContain("--path");
		expect(abs[abs.indexOf("--path") + 1]).toBe(dir);
		expect(abs).not.toContain("-d");
		const cwd = process.cwd();
		process.chdir(dir);
		cleanups.push(() => process.chdir(cwd));
		fs.mkdirSync(path.join(dir, "tasks"));
		const rel = harborRunnerArgs(req, opts("./tasks"));
		expect(rel[rel.indexOf("--path") + 1]).toBe(path.join(dir, "tasks"));
		const parent = harborRunnerArgs(req, opts("../" + path.basename(dir)));
		expect(parent[parent.indexOf("--path") + 1]).toBe(dir);
		for (const name of ["terminal-bench@2.0", "swe-bench/swe-bench-verified", "tasks"]) {
			const argv = harborRunnerArgs(req, opts(name));
			expect(argv[argv.indexOf("-d") + 1]).toBe(name);
			expect(argv).not.toContain("--path");
		}
	});

	it("rejects a missing or non-directory local path with a stable error", () => {
		const dir = tmp();
		const file = path.join(dir, "f.txt");
		fs.writeFileSync(file, "x");
		for (const bad of [path.join(dir, "nope"), file]) {
			expect(() => harborRunnerArgs(req, opts(bad))).toThrow(
				`local dataset path is not an existing directory: ${bad}`,
			);
		}
	});

	it("runner --path resolves to the dataset and harbor receives -p", () => {
		const dir = tmp();
		const cfg = parseArgs(["--path", dir]);
		expect(cfg.dataset).toBe(dir);
		const roundTrip = parseArgs(harborRunnerArgs(req, opts(dir)));
		expect(roundTrip.dataset).toBe(dir);
	});
});

describe("runner-config credential persistence", () => {
	const SENTINEL = "evo-sentinel-secret-9f3a7c21";
	const RUNNER = path.resolve(import.meta.dir, "..", "src", "runner.ts");

	/** Fake `harbor`/`docker` first on PATH so the real runner entry reaches the persistence block and exits fast. */
	function stubBin(bodies: Record<string, string> = {}): string {
		const bin = tmp();
		for (const name of new Set(["harbor", "docker", ...Object.keys(bodies)])) {
			const file = path.join(bin, name);
			fs.writeFileSync(file, `#!/bin/sh\n${bodies[name] ?? ""}\nexit 0\n`);
			fs.chmodSync(file, 0o755);
		}
		return bin;
	}

	async function runRunner(
		jobsDir: string,
		jobName: string,
		extra: string[],
		hostEnv: Record<string, string> = {},
		modelsText = "providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n",
		stubBodies: Record<string, string> = {},
		installMode = "published",
	): Promise<{ code: number; out: string }> {
		const modelsYaml = path.join(jobsDir, "models.yml");
		fs.writeFileSync(modelsYaml, modelsText);
		const env: Record<string, string> = { ...(process.env as Record<string, string>), ...hostEnv };
		delete env.EVO_SENTINEL_KEY;
		Object.assign(env, hostEnv);
		env.PATH = `${stubBin(stubBodies)}${path.delimiter}${process.env.PATH ?? ""}`;
		const proc = Bun.spawn(
			[
				process.execPath,
				RUNNER,
				"--install",
				installMode,
				"--no-gateway",
				"--models-yaml",
				modelsYaml,
				"--jobs-dir",
				jobsDir,
				"--job-name",
				jobName,
				...extra,
			],
			{ env, stdout: "pipe", stderr: "pipe", stdin: "ignore" },
		);
		const [stdout, stderr, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
		return { code, out: `${stdout}\n${stderr}` };
	}

	function scanForSentinel(dir: string, needle: string = SENTINEL): string[] {
		const hits: string[] = [];
		for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
			if (!entry.isFile()) continue;
			const file = path.join(entry.parentPath, entry.name);
			if (fs.readFileSync(file).includes(needle)) hits.push(file);
		}
		return hits;
	}

	it("rejects an explicit --env KEY=VALUE for a models.yml apiKey variable and persists nothing", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-secret", ["--env", `EVO_SENTINEL_KEY=${SENTINEL}`]);
		expect(code).not.toBe(0);
		expect(out).toContain("EVO_SENTINEL_KEY");
		expect(out).toContain("--env EVO_SENTINEL_KEY");
		expect(out).not.toContain(SENTINEL);
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-secret", "runner-config.json"))).toBe(false);
		expect(scanForSentinel(jobsDir)).toEqual([]);
	}, 30_000);

	const HEADER_SECRET = "evo-header-secret-7b1c2d";
	const DRY_RUN_MARKER = "evo-dry-run-marker";
	const VALID_PROVIDER = "providers:\n  onara:\n    apiKey: EVO_SENTINEL_KEY\n";

	// Direct runner path: runner.ts main() -> readModelsEnvNames(cfg.modelsYaml) (src/evo/models-yaml.ts).
	it("rejects a models file whose provider headers carry a literal credential", async () => {
		const jobsDir = tmp();
		const models = `${VALID_PROVIDER}  private-provider:\n    baseUrl: https://example.invalid/v1\n    headers:\n      Authorization: "Bearer ${HEADER_SECRET}"\n`;
		const { code, out } = await runRunner(jobsDir, "job-header-secret", [], {}, models);
		expect(code).not.toBe(0);
		expect(out).toContain("providers.private-provider.headers.Authorization");
		expect(out).not.toContain(HEADER_SECRET);
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-header-secret", "runner-config.json"))).toBe(false);
		expect(scanForSentinel(jobsDir, HEADER_SECRET).filter(file => path.basename(file) !== "models.yml")).toEqual([]);
	}, 30_000);

	it("refuses to stage a models file that does not match the recorded hash", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-models-hash", ["--models-yaml-hash", "0".repeat(64)]);
		expect(code).not.toBe(0);
		expect(out).toContain("models.yml hash mismatch");
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-models-hash", "runner-config.json"))).toBe(false);
	}, 30_000);

	it("rejects a models file whose baseUrl embeds userinfo credentials", async () => {
		const jobsDir = tmp();
		const models = `${VALID_PROVIDER}  private-provider:\n    baseUrl: "https://user:${HEADER_SECRET}@example.invalid/v1"\n`;
		const { code, out } = await runRunner(jobsDir, "job-userinfo-secret", [], {}, models);
		expect(code).not.toBe(0);
		expect(out).toContain("providers.private-provider.baseUrl");
		expect(out).not.toContain(HEADER_SECRET);
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-userinfo-secret", "runner-config.json"))).toBe(false);
		expect(scanForSentinel(jobsDir, HEADER_SECRET).filter(file => path.basename(file) !== "models.yml")).toEqual([]);
	}, 30_000);

	for (const [label, suffix] of [
		["query", `?api_key=${HEADER_SECRET}`],
		["fragment", `#token=${HEADER_SECRET}`],
	] as const) {
		it(`rejects a models file whose baseUrl carries a literal credential in the ${label}`, async () => {
			const jobsDir = tmp();
			const models = `${VALID_PROVIDER}  private-provider:\n    baseUrl: "https://provider.invalid/v1${suffix}"\n`;
			const { code, out } = await runRunner(jobsDir, `job-${label}-secret`, [], {}, models);
			expect(code).not.toBe(0);
			expect(out).toContain("providers.private-provider.baseUrl");
			expect(out).not.toContain(HEADER_SECRET);
			expect(fs.existsSync(path.join(jobsDir, "_bench", `job-${label}-secret`, "runner-config.json"))).toBe(false);
			expect(scanForSentinel(jobsDir, HEADER_SECRET).filter(file => path.basename(file) !== "models.yml")).toEqual(
				[],
			);
		}, 30_000);
	}

	it("accepts a plain baseUrl without userinfo, query or fragment", async () => {
		const jobsDir = tmp();
		const models = `${VALID_PROVIDER}  router:\n    baseUrl: "https://router.example/v1"\n`;
		const { code, out } = await runRunner(jobsDir, "job-plain-baseurl", ["--dry-run"], {}, models);
		expect(out).not.toMatch(/error:/);
		expect(code).toBe(0);
	}, 30_000);

	it("never prints the models file body in a dry run", async () => {
		const jobsDir = tmp();
		const models = `# ${DRY_RUN_MARKER}\n${VALID_PROVIDER}`;
		const { code, out } = await runRunner(jobsDir, "job-dry-run", ["--dry-run"], {}, models);
		expect(out).not.toMatch(/error:/);
		expect(code).toBe(0);
		expect(out).not.toContain(DRY_RUN_MARKER);
		expect(out).toContain(path.join(jobsDir, "models.yml"));
		expect(scanForSentinel(jobsDir, DRY_RUN_MARKER).filter(file => path.basename(file) !== "models.yml")).toEqual([]);
	}, 30_000);

	it("rejects a host credential value passed under another explicit --env name and persists nothing", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-other-secret", ["--env", `OTHER_KNOB=${SENTINEL}`], {
			EVO_SENTINEL_KEY: SENTINEL,
		});
		expect(code).not.toBe(0);
		expect(out).toContain("credential env");
		expect(out).not.toContain(SENTINEL);
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-other-secret", "runner-config.json"))).toBe(false);
		expect(scanForSentinel(jobsDir)).toEqual([]);
	}, 30_000);

	it("rejects the same explicit credential KEY=VALUE for --agent pi and persists nothing", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-pi-secret", [
			"--agent",
			"pi",
			"--env",
			`EVO_SENTINEL_KEY=${SENTINEL}`,
		]);
		expect(code).not.toBe(0);
		expect(out).toContain("EVO_SENTINEL_KEY");
		expect(out).toContain("--env EVO_SENTINEL_KEY");
		expect(out).not.toContain(SENTINEL);
		expect(fs.existsSync(path.join(jobsDir, "_bench", "job-pi-secret", "runner-config.json"))).toBe(false);
		expect(scanForSentinel(jobsDir)).toEqual([]);
	}, 30_000);

	for (const [label, passthrough] of [
		["--ae KEY=VALUE", ["--ae", `EVO_SENTINEL_KEY=${SENTINEL}`]],
		["--agent-env=KEY=VALUE", [`--agent-env=EVO_SENTINEL_KEY=${SENTINEL}`]],
	] as const) {
		it(`rejects a credential value smuggled through harbor passthrough (${label}) and persists nothing`, async () => {
			const jobsDir = tmp();
			const { code, out } = await runRunner(jobsDir, "job-pass-secret", ["--", ...passthrough]);
			expect(code).not.toBe(0);
			expect(out).toContain("EVO_SENTINEL_KEY");
			expect(out).not.toContain(SENTINEL);
			expect(fs.existsSync(path.join(jobsDir, "_bench", "job-pass-secret", "runner-config.json"))).toBe(false);
			expect(scanForSentinel(jobsDir)).toEqual([]);
		}, 30_000);
	}

	for (const [label, args] of [
		["-e=KEY=VALUE", ["--", `-e=EVO_SENTINEL_KEY=${SENTINEL}`]],
		["-eKEY=VALUE", ["--", `-eEVO_SENTINEL_KEY=${SENTINEL}`]],
		["--agent-arg KEY=VALUE", ["--agent-arg", `EVO_SENTINEL_KEY=${SENTINEL}`]],
	] as const) {
		it(`rejects a credential value smuggled through ${label} and persists nothing`, async () => {
			const jobsDir = tmp();
			const { code, out } = await runRunner(jobsDir, "job-shape-secret", args);
			expect(code).not.toBe(0);
			expect(out).toContain("EVO_SENTINEL_KEY");
			expect(out).not.toContain(SENTINEL);
			expect(fs.existsSync(path.join(jobsDir, "_bench", "job-shape-secret", "runner-config.json"))).toBe(false);
			expect(scanForSentinel(jobsDir)).toEqual([]);
		}, 30_000);
	}

	it("still allows harbor passthrough that carries no credential value (-- -e docker)", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-pass-ok", ["--", "-e", "docker"]);
		expect(out).not.toMatch(/error:/);
		expect(code).toBe(0);
		const persisted = JSON.parse(
			fs.readFileSync(path.join(jobsDir, "_bench", "job-pass-ok", "runner-config.json"), "utf8"),
		) as { passthrough: string[] };
		expect(persisted.passthrough).toEqual(["-e", "docker"]);
	}, 60_000);

	it("still persists non-credential KEY=VALUE knobs and omits host-sourced credential values", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-ok", ["--env", "PI_KNOB=1", "--env", "EVO_SENTINEL_KEY"], {
			EVO_SENTINEL_KEY: SENTINEL,
		});
		expect(out).not.toMatch(/error:/);
		expect(code).toBe(0);
		const persisted = JSON.parse(
			fs.readFileSync(path.join(jobsDir, "_bench", "job-ok", "runner-config.json"), "utf8"),
		) as { env: Record<string, string>; hostEnvKeys: string[] };
		expect(persisted.env).toEqual({ PI_KNOB: "1" });
		expect(persisted.hostEnvKeys).toEqual(["EVO_SENTINEL_KEY"]);
		expect(fs.readFileSync(path.join(jobsDir, "_bench", "job-ok", "runner-config.json"), "utf8")).not.toContain(
			SENTINEL,
		);
	}, 60_000);

	for (const [label, args, hostEnv] of [
		["--setting x=KEY=VALUE", ["--setting", `x=EVO_SENTINEL_KEY=${SENTINEL}`], {}],
		["--setting JSON-escaped KEY\\u003dVALUE", ["--setting", `x="EVO_SENTINEL_KEY\\u003d${SENTINEL}"`], {}],
		["--setting carrying the host credential value", ["--setting", `x=${SENTINEL}`], { EVO_SENTINEL_KEY: SENTINEL }],
	] as const) {
		it(`rejects a credential smuggled through ${label} and persists nothing`, async () => {
			const jobsDir = tmp();
			const { code, out } = await runRunner(jobsDir, "job-setting-secret", [...args], { ...hostEnv });
			expect(code).not.toBe(0);
			expect(out).toContain("credential env");
			expect(out).not.toContain(SENTINEL);
			expect(fs.existsSync(path.join(jobsDir, "_bench", "job-setting-secret", "runner-config.json"))).toBe(false);
			expect(scanForSentinel(jobsDir)).toEqual([]);
		}, 30_000);
	}

	const nest12 = (leaf: string): unknown => {
		let node: unknown = leaf;
		for (let depth = 0; depth < 12; depth++) node = { a: node };
		return node;
	};
	for (const [label, args] of [
		["--setting with the credential value as an object key", ["--setting", `${SENTINEL}=false`]],
		[
			"--setting JSON nested 12 levels deep",
			["--setting", `x=${JSON.stringify(nest12(`EVO_SENTINEL_KEY=${SENTINEL}`))}`],
		],
	] as const) {
		it(`rejects a credential reachable through ${label} and persists nothing`, async () => {
			const jobsDir = tmp();
			const { code, out } = await runRunner(jobsDir, "job-deep-secret", [...args], { EVO_SENTINEL_KEY: SENTINEL });
			expect(code).not.toBe(0);
			expect(out).toContain("credential env");
			expect(out).not.toContain(SENTINEL);
			expect(fs.existsSync(path.join(jobsDir, "_bench", "job-deep-secret", "runner-config.json"))).toBe(false);
			expect(scanForSentinel(jobsDir)).toEqual([]);
		}, 30_000);
	}

	it("still persists non-credential --setting values while the host credential is set", async () => {
		const jobsDir = tmp();
		const { code, out } = await runRunner(jobsDir, "job-setting-ok", ["--setting", 'theme="dark"'], {
			EVO_SENTINEL_KEY: SENTINEL,
		});
		expect(out).not.toMatch(/error:/);
		expect(code).toBe(0);
		const file = path.join(jobsDir, "_bench", "job-setting-ok", "runner-config.json");
		const text = fs.readFileSync(file, "utf8");
		const persisted: { settings: Record<string, unknown> } = JSON.parse(text); // test reads own runner output
		expect(persisted.settings).toEqual({ theme: "dark" });
		expect(text).not.toContain(SENTINEL);
	}, 60_000);

	it("records the source identity observed after the run, not only the preflight one", async () => {
		const jobsDir = tmp();
		const source = tmp();
		const git = (...args: string[]): void => {
			const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: source });
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		};
		git("init", "-q", "-b", "main");
		write(source, "package.json", JSON.stringify({ name: "src", private: true }));
		write(source, "bun.lock", "");
		write(source, "tracked.txt", "before");
		git("add", "-A");
		git("commit", "-q", "-m", "init");
		const preflight = formatSourceIdentity(await sourceIdentity(source));
		const depsDir = path.join(jobsDir, "_bench", "_deps", "linux-arm64");
		const { code, out } = await runRunner(
			jobsDir,
			"job-post-drift",
			["--environment", "apple-container", "--source-root", source, "--source-identity", preflight],
			{ STUB_SOURCE_ROOT: source, STUB_DEPS_DIR: depsDir },
			undefined,
			{
				// `container run` builds the linux deps tree; harbor "runs" the trials and edits the mounted source.
				container: 'mkdir -p "$STUB_DEPS_DIR/node_modules"',
				harbor:
					'echo mutated-during-run > "$STUB_SOURCE_ROOT/tracked.txt"\necho new > "$STUB_SOURCE_ROOT/untracked.txt"',
			},
			"source",
		);
		// The stub really changed the bytes while harbor ran.
		expect(formatSourceIdentity(await sourceIdentity(source))).not.toBe(preflight);
		// Accepted outcome A: the runner detects drift and exits non-zero naming it.
		const detected = code !== 0 && out.includes("source identity drift");
		// Accepted outcome B: runner-config.json records a post-run identity that differs from the launch one.
		const file = path.join(jobsDir, "_bench", "job-post-drift", "runner-config.json");
		const persisted: Record<string, unknown> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
		expect(persisted.sourceIdentity).toBe(preflight);
		const observed = Object.entries(persisted).filter(
			([key, value]) => key !== "sourceIdentity" && /identity/i.test(key) && typeof value === "string",
		);
		const recordedPostRun = observed.some(([, value]) => value !== preflight);
		if (!detected && !recordedPostRun) {
			throw new Error(
				`source mutated during the run but neither drift exit nor post-run identity recorded (exit ${code}); ` +
					`identity keys: ${JSON.stringify(observed)}; out: ${out}`,
			);
		}
	}, 60_000);

	it("keeps a recorded source drift sticky across a resume", async () => {
		const jobsDir = tmp();
		const source = tmp();
		const git = (...args: string[]): void => {
			const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: source });
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		};
		git("init", "-q", "-b", "main");
		write(source, "package.json", JSON.stringify({ name: "src", private: true }));
		write(source, "bun.lock", "");
		write(source, "tracked.txt", "before");
		git("add", "-A");
		git("commit", "-q", "-m", "init");
		const launch = formatSourceIdentity(await sourceIdentity(source));
		const depsDir = path.join(jobsDir, "_bench", "_deps", "linux-arm64");
		const env = { STUB_SOURCE_ROOT: source, STUB_DEPS_DIR: depsDir };
		const jobName = "job-sticky-drift";
		const first = await runRunner(
			jobsDir,
			jobName,
			["--environment", "apple-container", "--source-root", source, "--source-identity", launch],
			env,
			undefined,
			{
				container: 'mkdir -p "$STUB_DEPS_DIR/node_modules"',
				harbor:
					'echo mutated-during-run > "$STUB_SOURCE_ROOT/tracked.txt"\necho new > "$STUB_SOURCE_ROOT/untracked.txt"',
			},
			"source",
		);
		const file = path.join(jobsDir, "_bench", jobName, "runner-config.json");
		const drifted = (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>).postRunSourceIdentity;
		expect(typeof drifted).toBe("string");
		expect(drifted).not.toBe(launch);
		expect(first.out).toContain("source identity drift");
		// Restore the source byte-for-byte, then resume the same job.
		write(source, "tracked.txt", "before");
		fs.rmSync(path.join(source, "untracked.txt"));
		expect(formatSourceIdentity(await sourceIdentity(source))).toBe(launch);
		fs.mkdirSync(path.join(jobsDir, jobName), { recursive: true });
		fs.writeFileSync(
			path.join(jobsDir, jobName, "config.json"),
			JSON.stringify({ environment: { type: "apple-container" } }),
		);
		const second = await runRunner(
			jobsDir,
			jobName,
			["--resume", jobName],
			env,
			undefined,
			{ container: 'mkdir -p "$STUB_DEPS_DIR/node_modules"' },
			"source",
		);
		expect(second.out).not.toMatch(/error:/);
		const after = (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>).postRunSourceIdentity;
		expect(after).toBe(drifted);
		expect(second.out).toContain("source identity drift");
	}, 90_000);
});
