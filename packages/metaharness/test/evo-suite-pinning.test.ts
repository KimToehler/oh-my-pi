import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setRegistryTaskFetcher } from "../src/evo/registry-tasks";
import { SuiteRegistry } from "../src/evo/suites";
import { ManagerServer } from "../src/server";
import { serveRegistryTasks } from "./registry-stub";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

/** Published snapshots are read-only directories; restore owner write so cleanup can delete them. */
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

/** Local dataset with two tasks, each carrying a hidden verifier and an environment file. */
function makeDataset(): string {
	const dataset = tmp("evo-pin-dataset-");
	for (const task of ["t1", "t2"]) {
		write(dataset, `${task}/task.toml`, `name = "${task}"\n`);
		write(dataset, `${task}/tests/test.sh`, `#!/bin/sh\necho verify ${task}\n`);
		write(dataset, `${task}/environment/Dockerfile`, "FROM debian:stable-slim\n");
	}
	return dataset;
}

const manifestFor = (dataset: string, over: Record<string, unknown> = {}) => ({
	id: "pin-1",
	split: "search",
	benchmark: "harbor",
	dataset,
	include: ["t1", "t2"],
	attempts: 1,
	timeoutMultiplier: 1,
	model: "onara/cc/claude-sonnet-5-5",
	thinking: "medium",
	environment: "docker",
	minPairedTasks: 1,
	minAttemptsPerTask: 1,
	...over,
});

function harness() {
	const jobsDir = tmp("evo-pin-jobs-");
	const source = tmp("evo-pin-src-");
	git(source, "init", "-q", "-b", "main");
	write(source, "a.txt", "1");
	git(source, "add", "-A");
	git(source, "commit", "-q", "-m", "init");
	write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n");
	const manager = new ManagerServer(jobsDir, undefined, {
		sourceRoot: source,
		defaults: { modelsYaml: path.join(jobsDir, "models.yml"), forwardEnv: [] },
	});
	const server = manager.start(0);
	cleanups.push(() => void manager.stop());
	const base = `http://localhost:${server.port}`;
	const post = (url: string, body: unknown) =>
		fetch(`${base}${url}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	return { jobsDir, manager, post };
}

/** Stub Bun.spawn only: ManagerServer.launch and registerLaunch stay production code. */
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

async function registerVariant(h: ReturnType<typeof harness>): Promise<string> {
	const configDir = tmp("evo-pin-cfg-");
	write(configDir, "AGENTS.md", "root");
	const res = await h.post("/api/evo/variants", { mutation: "root", configDir });
	return ((await res.json()) as { variant: { id: string } }).variant.id;
}

describe("suite task-byte pinning (R49)", () => {
	it("rejects a launch after a hidden verifier changed in the snapshot, creating no run", async () => {
		const h = harness();
		const { argvs } = stubSpawn();
		const dataset = makeDataset();
		expect((await h.post("/api/evo/suites", manifestFor(dataset))).status).toBe(201);
		const variantId = await registerVariant(h);
		const ok = await h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "pin-1", jobName: "pin-ok" });
		expect(ok.status).toBe(201);

		// The mutable dataset dir is irrelevant to the launch; tampering with what is actually evaluated is refused.
		const suite = (await new SuiteRegistry(h.jobsDir).get("pin-1"))!;
		const snap = path.join(h.jobsDir, "_evo", "suite-data", suite.hash, "t1");
		fs.chmodSync(snap, 0o755);
		fs.chmodSync(path.join(snap, "tests"), 0o755);
		fs.rmSync(path.join(snap, "tests", "test.sh"));
		fs.writeFileSync(path.join(snap, "tests", "test.sh"), "#!/bin/sh\nexit 0\n");
		const res = await h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "pin-1", jobName: "pin-bad" });
		expect(res.status).toBe(422);
		expect(((await res.json()) as { error: string }).error).toMatch(/task 't1'.*no longer matches/);
		expect(h.manager.store.getRun("pin-bad")).toBeNull();
		expect(argvs.length).toBe(1);
		expect(fs.existsSync(path.join(h.jobsDir, "pin-bad"))).toBe(false);
	});

	it("launches from the snapshot: later dataset edits cannot change what parent and child execute", async () => {
		const h = harness();
		stubSpawn();
		const dataset = makeDataset();
		await h.post("/api/evo/suites", manifestFor(dataset));
		const variantId = await registerVariant(h);
		await h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "pin-1", jobName: "pin-parent" });
		write(dataset, "t1/tests/test.sh", "#!/bin/sh\nexit 0\n"); // mutate hidden verifier between launches
		const child = await h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "pin-1", jobName: "pin-child" });
		expect(child.status).toBe(201);
		const parentCfg = h.manager.store.getRun("pin-parent")!.config as Record<string, string>;
		const childCfg = h.manager.store.getRun("pin-child")!.config as Record<string, string>;
		expect(parentCfg.dataset).not.toBe(dataset);
		// Each run owns its bytes: distinct run-private directories, identical content and identity.
		expect(parentCfg.dataset).not.toBe(childCfg.dataset);
		expect(fs.readFileSync(path.join(parentCfg.dataset, "t1", "tests", "test.sh"), "utf8")).toContain("verify t1");
		expect(parentCfg.taskHash).toMatch(/^[0-9a-f]{64}$/);
		expect(childCfg.taskHash).toBe(parentCfg.taskHash);
		expect(fs.readFileSync(path.join(childCfg.dataset, "t1", "tests", "test.sh"), "utf8")).toContain("verify t1");
	});

	it("makes identical manifests over different task bytes different suites", async () => {
		const dataset = makeDataset();
		const a = new SuiteRegistry(tmp("evo-pin-a-"));
		const b = new SuiteRegistry(tmp("evo-pin-b-"));
		const first = await a.register(manifestFor(dataset));
		write(dataset, "t2/environment/Dockerfile", "FROM debian:stable-slim\nRUN echo drift\n");
		const second = await b.register(manifestFor(dataset));
		expect(second.suite.hash).not.toBe(first.suite.hash);
		expect(second.suite.taskHashes).not.toEqual(first.suite.taskHashes);
		expect(Object.keys(first.suite.taskHashes!).sort()).toEqual(["t1", "t2"]);
		// Re-registering the same id over mutated bytes is a conflict, not a silent identity swap.
		await expect(a.register(manifestFor(dataset))).rejects.toThrow(/already exists with different content/);
	});

	it("refuses a registry dataset that is not pinned to a content digest", async () => {
		const h = harness();
		const unpinned = await h.post("/api/evo/suites", manifestFor("terminal-bench@2.0"));
		expect(unpinned.status).toBe(422);
		expect(((await unpinned.json()) as { error: string }).error).toContain("not pinned to an immutable revision");
		const pinned = await h.post("/api/evo/suites", manifestFor(`terminal-bench@sha256:${"a".repeat(64)}`));
		expect(pinned.status).toBe(201);
	});

	describe("generated-task base image pinning on registry datasets (R60)", () => {
		const DIGEST = `debian@sha256:${"b".repeat(64)}`;
		const registryTask = (from: string) => ({
			t1: { "task.toml": 'name = "t1"\n', "evo-task.json": "{}", "environment/Dockerfile": `FROM ${from}\n` },
			t2: { "task.toml": 'name = "t2"\n', "environment/Dockerfile": "FROM debian:stable-slim\n" },
		});
		const dataset = `terminal-bench@sha256:${"a".repeat(64)}`;

		it("refuses a registry suite whose generated task builds from a mutable tag", async () => {
			cleanups.push(serveRegistryTasks(registryTask("debian:stable-slim")));
			const res = await harness().post("/api/evo/suites", manifestFor(dataset));
			expect(res.status).toBe(422);
			expect(((await res.json()) as { error: string }).error).toContain("mutable image 'debian:stable-slim'");
		});

		it("registers a registry suite whose generated task is digest-pinned", async () => {
			cleanups.push(serveRegistryTasks(registryTask(DIGEST)));
			const res = await harness().post("/api/evo/suites", manifestFor(dataset));
			expect(res.status).toBe(201);
		});

		it("refuses a registry suite whose task is missing, and one whose download fails", async () => {
			cleanups.push(serveRegistryTasks({}));
			const missing = await harness().post("/api/evo/suites", manifestFor(dataset));
			expect(missing.status).toBe(422);
			expect(JSON.stringify(await missing.json())).toContain("was not found in registry dataset");
			cleanups.push(
				setRegistryTaskFetcher(async () => {
					throw new Error("offline");
				}),
			);
			const failed = await harness().post("/api/evo/suites", manifestFor(dataset));
			expect(failed.status).toBe(422);
			expect(JSON.stringify(await failed.json())).toContain("refused rather than registered unchecked");
		});

		it("still refuses a LOCAL suite with a mutable generated-task tag (R58 guard)", async () => {
			const local = makeDataset();
			write(local, "t1/evo-task.json", "{}");
			const res = await harness().post("/api/evo/suites", manifestFor(local));
			expect(res.status).toBe(422);
			expect(((await res.json()) as { error: string }).error).toContain("mutable image");
		});
	});

	it("refuses to read a suite whose snapshot was tampered", async () => {
		const jobsDir = tmp("evo-pin-get-");
		const registry = new SuiteRegistry(jobsDir);
		const { suite } = await registry.register(manifestFor(makeDataset()));
		const dir = path.join(jobsDir, "_evo", "suite-data", suite.hash);
		fs.chmodSync(path.join(dir, "t2"), 0o755);
		fs.chmodSync(path.join(dir, "t2", "environment"), 0o755);
		fs.writeFileSync(path.join(dir, "t2", "environment", "extra"), "x");
		await expect(registry.get("pin-1")).rejects.toThrow(/task 't2'|no longer/);
	});
});
