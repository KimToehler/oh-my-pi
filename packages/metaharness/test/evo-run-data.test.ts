import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SuiteRegistry } from "../src/evo/suites";
import { ManagerServer } from "../src/server";
import { serveRegistryTasks } from "./registry-stub";

const SECRET = "sk-evo-suite-secret-0123456789abcdef";

const cleanups: Array<() => void> = [];
afterEach(async () => {
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

function write(dir: string, rel: string, content: string): void {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), content);
}

function makeDataset(extra: Record<string, string> = {}): string {
	const dataset = tmp("evo-rd-dataset-");
	for (const task of ["t1", "t2"]) {
		write(dataset, `${task}/task.toml`, `name = "${task}"\n`);
		write(dataset, `${task}/tests/test.sh`, `#!/bin/sh\necho verify ${task}\n`);
		write(dataset, `${task}/environment/Dockerfile`, "FROM debian:stable-slim\n");
	}
	for (const [rel, body] of Object.entries(extra)) write(dataset, rel, body);
	return dataset;
}

const manifestFor = (dataset: string) => ({
	id: "rd-1",
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
});

function suiteDataEntries(jobsDir: string): string[] {
	try {
		return fs.readdirSync(path.join(jobsDir, "_evo", "suite-data"));
	} catch {
		return [];
	}
}

describe("suite snapshot credential scan (S1)", () => {
	const secrets = () => [SECRET];

	it("refuses a dataset file body carrying a forwarded credential before anything is published", async () => {
		const jobsDir = tmp("evo-rd-jobs-");
		const dataset = makeDataset({ "t1/tests/data.txt": `token=${SECRET}\n` });
		const err = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset)).catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toMatch(/task file tests\/data\.txt embeds a host credential/);
		expect((err as Error).message).not.toContain(SECRET);
		expect(suiteDataEntries(jobsDir)).toEqual([]);
		expect(fs.existsSync(path.join(jobsDir, "_evo", "suites", "rd-1.json"))).toBe(false);
	});

	it("refuses a nested filename carrying a forwarded credential, redacting it from the error", async () => {
		const jobsDir = tmp("evo-rd-jobs-");
		const dataset = makeDataset({ [`t2/environment/${SECRET}/note.txt`]: "harmless" });
		const err = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset)).catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toMatch(/path .*\*\*\*.*host credential/);
		expect((err as Error).message).not.toContain(SECRET);
		expect(suiteDataEntries(jobsDir)).toEqual([]);
	});

	it("still registers a clean dataset, including a legitimate env reference by name", async () => {
		const jobsDir = tmp("evo-rd-jobs-");
		const dataset = makeDataset({ "t1/tests/env.txt": "export KEY=$OPENAI_API_KEY\n" });
		const { suite, created } = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset));
		expect(created).toBe(true);
		expect(Object.keys(suite.taskHashes ?? {}).sort()).toEqual(["t1", "t2"]);
	});
});

describe("registry task credential scan (R63)", () => {
	const secrets = () => [SECRET];
	const dataset = `terminal-bench@sha256:${"a".repeat(64)}`;
	const plain = (task: string) => ({
		"task.toml": `name = "${task}"\n`,
		"environment/Dockerfile": "FROM scratch\n",
	});
	const served = (extra: Record<string, Record<string, string>> = {}) =>
		cleanups.push(serveRegistryTasks({ t1: { ...plain("t1"), ...extra.t1 }, t2: { ...plain("t2"), ...extra.t2 } }));

	it("refuses a registry task file body carrying a forwarded credential, persisting nothing", async () => {
		const jobsDir = tmp("evo-rd-reg-");
		served({ t1: { "tests/data.txt": `token=${SECRET}\n` } });
		const err = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset)).catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toMatch(/task file tests\/data\.txt embeds a host credential/);
		expect((err as Error).message).not.toContain(SECRET);
		expect(suiteDataEntries(jobsDir)).toEqual([]);
		expect(fs.existsSync(path.join(jobsDir, "_evo", "suites", "rd-1.json"))).toBe(false);
	});

	it("refuses a registry nested filename carrying a forwarded credential, redacting it", async () => {
		const jobsDir = tmp("evo-rd-reg-");
		served({ t2: { [`environment/${SECRET}/note.txt`]: "harmless" } });
		const err = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset)).catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toMatch(/path .*\*\*\*.*host credential/);
		expect((err as Error).message).not.toContain(SECRET);
		expect(suiteDataEntries(jobsDir)).toEqual([]);
	});

	it("still registers a clean digest-pinned registry suite, including an env reference by name", async () => {
		const jobsDir = tmp("evo-rd-reg-");
		served({ t1: { "tests/env.txt": "export KEY=$OPENAI_API_KEY\n" } });
		const { created } = await new SuiteRegistry(jobsDir, secrets).register(manifestFor(dataset));
		expect(created).toBe(true);
		expect(suiteDataEntries(jobsDir)).toEqual([]);
	});
});

function harness() {
	const jobsDir = tmp("evo-rd-run-");
	const source = tmp("evo-rd-src-");
	const git = (...args: string[]) => {
		const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: source });
		if (r.exitCode !== 0) throw new Error(r.stderr.toString());
	};
	git("init", "-q", "-b", "main");
	write(source, "a.txt", "1");
	git("add", "-A");
	git("commit", "-q", "-m", "init");
	write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n");
	const manager = new ManagerServer(jobsDir, undefined, {
		sourceRoot: source,
		defaults: { modelsYaml: path.join(jobsDir, "models.yml"), forwardEnv: [] },
	});
	const server = manager.start(0);
	cleanups.push(() => void manager.stop());
	const post = (url: string, body: unknown) =>
		fetch(`http://localhost:${server.port}${url}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	return { jobsDir, manager, post };
}

/** Stub Bun.spawn; `finish` lets every stubbed runner exit so resume sees the run as not live. */
function stubSpawn(): { finish(): void } {
	const bun: { spawn: unknown } = Bun;
	const original = bun.spawn;
	const exits: Array<(code: number) => void> = [];
	bun.spawn = () => ({ pid: 2 ** 22 + 1, exited: new Promise<number>(resolve => exits.push(resolve)) });
	cleanups.push(() => {
		bun.spawn = original;
	});
	return { finish: () => exits.forEach(resolve => resolve(1)) };
}

async function launched(h: ReturnType<typeof harness>, jobName: string) {
	const cfgDir = tmp("evo-rd-cfg-");
	write(cfgDir, "AGENTS.md", "root");
	const v = await h.post("/api/evo/variants", { mutation: "root", configDir: cfgDir });
	const variantId = ((await v.json()) as { variant: { id: string } }).variant.id;
	expect((await h.post("/api/evo/suites", manifestFor(makeDataset()))).status).toBe(201);
	const res = await h.post(`/api/evo/variants/${variantId}/evaluate`, { suiteId: "rd-1", jobName });
	expect(res.status).toBe(201);
	return h.manager.store.getRun(jobName)!.config as Record<string, string>;
}

function tamper(dir: string): void {
	const file = path.join(dir, "t1", "tests", "test.sh");
	fs.chmodSync(path.dirname(file), 0o755);
	fs.rmSync(file);
	fs.writeFileSync(file, "#!/bin/sh\nexit 0\n");
}

describe("run-owned suite bytes (D1)", () => {
	it("hands the runner a run-private copy that later snapshot replacement cannot change", async () => {
		const h = harness();
		stubSpawn();
		const cfg = await launched(h, "rd-run");
		const snapshot = path.join(h.jobsDir, "_evo", "suite-data");
		expect(cfg.dataset.startsWith(snapshot)).toBe(false);
		expect(cfg.dataset).toBe(path.join(h.jobsDir, "_evo", "run-data", "rd-run"));
		const suite = (await new SuiteRegistry(h.jobsDir).get("rd-1"))!;
		tamper(path.join(snapshot, suite.hash));
		expect(fs.readFileSync(path.join(cfg.dataset, "t1", "tests", "test.sh"), "utf8")).toContain("verify t1");
	});

	it("gives each experiment arm its own copy and refuses resume when the copy changed", async () => {
		const h = harness();
		const spawned = stubSpawn();
		const cfg = await launched(h, "exp-base");
		const arm = h.manager.addArm("exp", { arm: "b", model: "onara/cc/claude-sonnet-5-5" });
		const armCfg = h.manager.store.getRun(arm.jobName)!.config as Record<string, string>;
		expect(armCfg.dataset).toBe(path.join(h.jobsDir, "_evo", "run-data", "exp-b"));
		expect(armCfg.dataset).not.toBe(cfg.dataset);
		expect(armCfg.taskHash).toBe(cfg.taskHash);

		spawned.finish();
		await Bun.sleep(20);
		tamper(armCfg.dataset);
		expect(() => h.manager.resume("exp-b")).toThrow(/no longer matches its registered task hash/);
	});
});
