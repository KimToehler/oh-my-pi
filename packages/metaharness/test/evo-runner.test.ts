import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MODEL_ROLE_IDS } from "@oh-my-pi/pi-coding-agent/config/model-roles";
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

	it("refuses a models file that embeds a forwarded secret value", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", "x");
		const modelsYaml = path.join(root, "models.yml");
		fs.writeFileSync(modelsYaml, "providers:\n  onara:\n    apiKey: literal-secret-value-1234\n");
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
