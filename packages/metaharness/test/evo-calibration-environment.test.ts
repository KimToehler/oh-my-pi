import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EvoHttpError } from "../src/evo/boundary";
import { CALIBRATION_FILE, type CalibrationEnvironment, hashTaskDir } from "../src/evo/calibration";
import { SuiteRegistry } from "../src/evo/suites";
import { serveRegistryTasks } from "./registry-stub";

const DIGEST = `debian@sha256:${"b".repeat(64)}`;
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

const dockerEnv: CalibrationEnvironment = {
	mode: "container",
	runtime: "docker",
	backend: "docker",
	platform: "linux/arm64",
	image: "sha256:abc",
	verifierNetwork: "no-network",
};

/** A generated task directory with a calibration record claiming `env`, hash-bound to the task bytes. */
async function calibratedTask(root: string, name: string, env: Partial<CalibrationEnvironment> | null): Promise<void> {
	const dir = path.join(root, name);
	fs.mkdirSync(path.join(dir, "environment"), { recursive: true });
	fs.writeFileSync(path.join(dir, "task.toml"), `name = "${name}"\n`);
	fs.writeFileSync(path.join(dir, "evo-task.json"), "{}");
	fs.writeFileSync(path.join(dir, "environment", "Dockerfile"), `FROM ${DIGEST}\n`);
	if (env === null) return;
	const record = {
		before: 0,
		after: 1,
		environment: { ...dockerEnv, ...env },
		taskHash: await hashTaskDir(dir),
		verifiedAt: "2026-01-01T00:00:00Z",
	};
	fs.writeFileSync(path.join(dir, CALIBRATION_FILE), JSON.stringify(record));
}

function filesOf(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const rel of fs.readdirSync(dir, { recursive: true, withFileTypes: false }).map(String)) {
		const abs = path.join(dir, rel);
		if (fs.statSync(abs).isFile()) out[rel] = fs.readFileSync(abs, "utf8");
	}
	return out;
}

const manifest = (dataset: string, environment: string) => ({
	id: `cal-env-${environment}`,
	split: "search",
	benchmark: "harbor",
	dataset,
	include: ["gen"],
	attempts: 1,
	timeoutMultiplier: 1,
	model: "m",
	thinking: "off",
	environment,
	minPairedTasks: 1,
	minAttemptsPerTask: 1,
});

async function refusal(promise: Promise<unknown>): Promise<string> {
	const err = await promise.then(
		() => null,
		(e: unknown) => e,
	);
	expect(err).toBeInstanceOf(EvoHttpError);
	expect((err as EvoHttpError).status).toBe(422);
	return (err as Error).message;
}

describe("calibration is bound to the suite environment (R67)", () => {
	const registryDataset = `terminal-bench@sha256:${"a".repeat(64)}`;

	async function registryWith(env: Partial<CalibrationEnvironment> | null): Promise<void> {
		const root = tmp("evo-cal-reg-");
		await calibratedTask(root, "gen", env);
		cleanups.push(serveRegistryTasks({ gen: filesOf(path.join(root, "gen")) }));
	}

	it("local: a docker-calibrated task registers in a docker suite (clean control)", async () => {
		const dataset = tmp("evo-cal-ds-");
		await calibratedTask(dataset, "gen", {});
		const { created } = await new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(dataset, "docker"));
		expect(created).toBe(true);
	});

	it("local: a docker-calibrated task is refused in an apple-container suite", async () => {
		const dataset = tmp("evo-cal-ds-");
		await calibratedTask(dataset, "gen", {});
		const message = await refusal(
			new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(dataset, "apple-container")),
		);
		expect(message).toContain("apple-container");
		expect(message).toContain("docker");
	});

	it("local: a record with the right runtime name but no backend/platform is refused", async () => {
		const dataset = tmp("evo-cal-ds-");
		await calibratedTask(dataset, "gen", { backend: undefined, platform: undefined });
		await refusal(new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(dataset, "docker")));
	});

	it("local: a podman record cannot certify docker execution", async () => {
		const dataset = tmp("evo-cal-ds-");
		await calibratedTask(dataset, "gen", { runtime: "podman", backend: "podman" });
		await refusal(new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(dataset, "docker")));
	});

	it("registry: a task with a matching calibration registers (clean control)", async () => {
		await registryWith({});
		const { created } = await new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(registryDataset, "docker"));
		expect(created).toBe(true);
	});

	it("registry: a generated task without a calibration record is refused", async () => {
		await registryWith(null);
		const message = await refusal(
			new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(registryDataset, "docker")),
		);
		expect(message).toContain("calibration");
	});

	it("registry: a task calibrated for another backend is refused", async () => {
		await registryWith({});
		const message = await refusal(
			new SuiteRegistry(tmp("evo-cal-jobs-")).register(manifest(registryDataset, "apple-container")),
		);
		expect(message).toContain("apple-container");
	});
});
