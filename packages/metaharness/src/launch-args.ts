/**
 * Shared launch surface: the POST /api/runs request shape and its mapping to
 * runner CLI argv. The server uses it to spawn new harbor runs; the runner's
 * `--resume` uses it to rebuild the original invocation from a job dir's
 * manager.json launch record when no runner-config.json snapshot exists.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { BenchmarkKind, RunRole } from "./store";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

/** POST /api/runs body. Mirrors the runner CLI surface we actually use. */
export interface LaunchRequest {
	/** Benchmark adapter to execute. */
	benchmark?: BenchmarkKind;
	model: string;
	dataset?: string;
	/** Task count for a dataset sample, or omit when `include` is given. */
	tasks?: number;
	/** Explicit task names (passed as repeated --include). */
	include?: string[];
	concurrency?: number;
	/** SnapCompact conditions; ignored by other benchmarks. */
	conditions?: string[];
	timeoutMultiplier?: number;
	attempts?: number;
	agent?: string;
	jobName?: string;
	webSearch?: boolean;
	/** Harbor container backend. Defaults to apple-container whenever the Apple `container` CLI is installed; docker is an explicit opt-in. */
	environment?: "docker" | "apple-container";
	/** Prewalk to a fast/cheap model at the first edit/write once the todo list exists; `into` overrides the default "smol" target. */
	prewalk?: { into?: string };
	/** Role of this run inside its experiment (baseline vs treatment). */
	role?: RunRole;
	/** One-line description of what this arm tests. */
	note?: string;
	/** Experiment goal; upserted for the run's experiment (job-name prefix). */
	goal?: string;
	/** Use prebuilt dist/omp-linux-* binaries instead of the default source mount. */
	prebuiltBinaries?: boolean;
	/** Fixed executor thinking level (`--thinking`). */
	thinking?: string;
	/** Evo variant under evaluation; recorded on the run row. */
	variantId?: string;
	/** Evo suite this run evaluates; recorded on the run row. */
	suiteId?: string;
	/** Variant agent dir staged as a read-only overlay (`--agent-dir`). */
	agentDir?: string;
	/** Source worktree mounted instead of this repo (`--source-root`). */
	sourceRoot?: string;
	/** Expected `<HEAD>[+<dirty hash>]` of the source root (`--source-identity`). */
	sourceIdentity?: string;
	/** Fixed container-safe models.yml (`--models-yaml`). */
	modelsYaml?: string;
	/** Pass provider keys into containers instead of the auth gateway (`--no-gateway`). */
	noGateway?: boolean;
	/** Host env var NAMES forwarded into the container (`--env NAME`); values never recorded. */
	envNames?: string[];
	/** Evo-only: hash of the merged config.yml staged for this run. */
	stagedConfigHash?: string;
	/** Evo-only: hash of the fixed executor routing fields. */
	executorConfigHash?: string;
	/** Evo-only: content hash of the suite manifest. */
	suiteHash?: string;
	/** Extra raw runner args, appended verbatim. */
	extraArgs?: string[];
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Harbor flags whose value is always an env assignment `NAME=VALUE`. */
const HARBOR_ENV_FLAGS: Record<string, true> = {
	"--ae": true,
	"--agent-env": true,
	"--ve": true,
	"--verifier-env": true,
};
/** `-e`/`--env` is harbor's environment type: an env assignment only when the value has `=`. */
const HARBOR_ENVTYPE_FLAGS: Record<string, true> = { "-e": true, "--env": true };

/** NAME of every env assignment in a harbor argv tail. Never returns values. */
export function harborEnvAssignmentNames(args: readonly string[]): string[] {
	const names: string[] = [];
	const take = (value: string | undefined): void => {
		const eq = value?.indexOf("=") ?? -1;
		if (value !== undefined && eq > 0) names.push(value.slice(0, eq));
	};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
		const flag = eq === -1 ? arg : arg.slice(0, eq);
		if (!HARBOR_ENV_FLAGS[flag] && !HARBOR_ENVTYPE_FLAGS[flag]) continue;
		if (eq !== -1) take(arg.slice(eq + 1));
		else take(args[++i]);
	}
	return names;
}

/** Reject launch requests that would carry env values (secrets) into persisted run state. Never echoes entries. */
export function assertLaunchEnvSafe(request: LaunchRequest, benchmark: string): void {
	for (const name of request.envNames ?? []) {
		if (typeof name !== "string" || !ENV_NAME.test(name)) {
			throw new Error(
				"envNames entries must be environment variable names (values are read from the host environment)",
			);
		}
	}
	if (benchmark !== "harbor") return;
	const extra = request.extraArgs ?? [];
	const split = extra.indexOf("--");
	const head = split === -1 ? extra : extra.slice(0, split);
	const tail = split === -1 ? [] : extra.slice(split + 1);
	const bad =
		head.some(arg => arg === "-e" || arg === "--env" || arg.startsWith("--env=")) ||
		harborEnvAssignmentNames(tail).length > 0 ||
		tail.some(arg => HARBOR_ENV_FLAGS[arg.split("=", 1)[0]]);
	if (bad) {
		throw new Error("extraArgs must not set --env/-e; use envNames so only variable names are recorded");
	}
}

/** True when a dataset names a local Harbor task/dataset directory rather than a registry entry. */
export function isLocalDataset(dataset: string): boolean {
	return path.isAbsolute(dataset) || dataset.startsWith("./") || dataset.startsWith("../");
}

/** Resolve a local dataset path and require it to be an existing directory; throws a stable error. */
export function resolveLocalDataset(dataset: string): string {
	const resolved = path.resolve(dataset);
	let isDir = false;
	try {
		isDir = fs.statSync(resolved).isDirectory();
	} catch {
		/* reported below */
	}
	if (!isDir) throw new Error(`local dataset path is not an existing directory: ${resolved}`);
	return resolved;
}

/** Default `<model-slug>-<UTC stamp>` job name used when a launch does not name its job. */
export function defaultJobName(model: string): string {
	const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	return `${model.replace(/[^a-zA-Z0-9]+/g, "-")}-${stamp}`;
}

/** Runner CLI flags (sans the `bun src/runner.ts` prefix) for a harbor launch. */
export function harborRunnerArgs(
	request: LaunchRequest,
	opts: { jobsDir: string; jobName: string; dataset: string },
): string[] {
	const datasetArgs = isLocalDataset(opts.dataset)
		? ["--path", resolveLocalDataset(opts.dataset)]
		: ["-d", opts.dataset];
	const argv = ["--model", request.model, ...datasetArgs, "--job-name", opts.jobName, "--jobs-dir", opts.jobsDir];
	// Prefer Apple Container when its CLI is present: native arm64 task
	// containers with no Docker daemon. The runner itself defaults to
	// docker, so the preference must be stated here.
	const environment = request.environment ?? (Bun.which("container") ? "apple-container" : "docker");
	argv.push("--environment", environment);
	if (request.agent) argv.push("--agent", request.agent);
	// An explicit include list IS the sample — never let the runner's
	// default task cap truncate it.
	const tasks = request.tasks ?? (request.include && request.include.length > 0 ? request.include.length : undefined);
	if (tasks !== undefined) argv.push("--tasks", String(tasks));
	if (request.concurrency !== undefined) argv.push("--concurrency", String(request.concurrency));
	if (request.attempts !== undefined) argv.push("--attempts", String(request.attempts));
	if (request.timeoutMultiplier !== undefined) argv.push("--timeout-multiplier", String(request.timeoutMultiplier));
	if (request.webSearch) argv.push("--web-search");
	if (request.thinking) argv.push("--thinking", request.thinking);
	if (request.agentDir) argv.push("--agent-dir", request.agentDir);
	if (request.sourceRoot) argv.push("--source-root", request.sourceRoot);
	if (request.sourceIdentity) argv.push("--source-identity", request.sourceIdentity);
	if (request.modelsYaml) argv.push("--models-yaml", request.modelsYaml);
	if (request.noGateway) argv.push("--no-gateway");
	for (const name of request.envNames ?? []) argv.push("--env", name);
	for (const task of request.include ?? []) argv.push("--include", task);
	if (request.prewalk) {
		argv.push("--agent-arg", "--prewalk");
		if (request.prewalk.into) {
			argv.push("--agent-arg", "--prewalk-into", "--agent-arg", request.prewalk.into);
			const provider = request.prewalk.into.split("/", 1)[0];
			if (provider && request.prewalk.into.includes("/")) argv.push("--providers", provider);
		}
	}
	if (request.prebuiltBinaries) {
		for (const name of ["omp-linux-arm64", "omp-linux-x64"]) {
			const binary = path.join(REPO_ROOT, "packages", "coding-agent", "dist", name);
			if (fs.existsSync(binary)) argv.push("--binary", binary);
		}
	}
	argv.push(...(request.extraArgs ?? []));
	return argv;
}
