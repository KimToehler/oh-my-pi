import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolveBaseImage } from "../scripts/evo-task-image";
import { unlockTree } from "../src/evo/config-snapshot";
import { SuiteRegistry } from "../src/evo/suites";

let tmp = "";
const saved = {
	runtime: process.env.EVO_CONTAINER_RUNTIME,
	state: process.env.FAKE_DOCKER_STATE,
	salt: process.env.FAKE_IMAGE_SALT,
};

function restore(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

beforeEach(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), "evo-image-pin-"));
	process.env.EVO_CONTAINER_RUNTIME = path.join(import.meta.dir, "fixtures/evo-task/fake-docker.sh");
	process.env.FAKE_DOCKER_STATE = path.join(tmp, "docker-state");
});
afterEach(async () => {
	restore("EVO_CONTAINER_RUNTIME", saved.runtime);
	restore("FAKE_DOCKER_STATE", saved.state);
	restore("FAKE_IMAGE_SALT", saved.salt);
	await unlockTree(tmp);
	await fs.rm(tmp, { recursive: true, force: true });
});

const DIGEST = `debian@sha256:${"c".repeat(64)}`;

describe("generated-task base image pinning (D1)", () => {
	it("keeps a digest-pinned reference as-is and resolves a mutable tag to a digest", async () => {
		const runtime = process.env.EVO_CONTAINER_RUNTIME!;
		expect(await resolveBaseImage(DIGEST, runtime)).toBe(DIGEST);
		expect(await resolveBaseImage("debian:stable-slim", runtime)).toMatch(/^debian@sha256:[0-9a-f]{64}$/);
	});

	it("resolves a moved tag to a different digest, so the Dockerfile (and task hash) differ", async () => {
		const runtime = process.env.EVO_CONTAINER_RUNTIME!;
		const first = await resolveBaseImage("debian:stable-slim", runtime);
		process.env.FAKE_IMAGE_SALT = "moved";
		expect(await resolveBaseImage("debian:stable-slim", runtime)).not.toBe(first);
	});

	it("refuses to register a generated task whose Dockerfile builds from a mutable tag", async () => {
		const dataset = path.join(tmp, "dataset");
		const task = path.join(dataset, "g1");
		await fs.mkdir(path.join(task, "environment"), { recursive: true });
		await Bun.write(path.join(task, "evo-task.json"), "{}");
		await Bun.write(path.join(task, "environment", "Dockerfile"), "FROM oven/bun:1.4.2\nWORKDIR /w\n");
		const manifest = {
			id: "img-1",
			split: "search",
			benchmark: "harbor",
			dataset,
			include: ["g1"],
			attempts: 1,
			timeoutMultiplier: 1,
			model: "m/x",
			thinking: "medium",
			environment: "docker",
			minPairedTasks: 1,
			minAttemptsPerTask: 1,
		};
		await expect(new SuiteRegistry(path.join(tmp, "jobs")).register(manifest)).rejects.toThrow(
			/mutable image 'oven\/bun:1\.4\.2'/,
		);
		await Bun.write(path.join(task, "environment", "Dockerfile"), `FROM ${DIGEST}\nWORKDIR /w\n`);
		await expect(new SuiteRegistry(path.join(tmp, "jobs")).register(manifest)).rejects.toThrow(
			/RED\/GREEN calibration/,
		);
	});
});
