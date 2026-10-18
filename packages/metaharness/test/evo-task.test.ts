import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { encodeArchive } from "@oh-my-pi/pi-utils/ar";
import { type NativeAddonRecord, setNativeAddonFetch } from "../scripts/evo-native-addon";
import { parseMakeArgs } from "../scripts/evo-task";
import { type MakeOptions, makeTask } from "../scripts/evo-task-make";
import { verifyTask } from "../scripts/evo-task-verify";
import { EvoHttpError } from "../src/evo/boundary";
import { unlockTree } from "../src/evo/config-snapshot";
import { SuiteRegistry } from "../src/evo/suites";

let tmp = "";

async function sh(cwd: string, ...cmd: string[]): Promise<string> {
	const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
	if (code !== 0) throw new Error(`${cmd.join(" ")} failed: ${err}`);
	return out.trim();
}

async function commit(
	repo: string,
	files: Record<string, string>,
	message: string,
	remove: string[] = [],
	executable: string[] = [],
	symlinks: Record<string, string> = {},
) {
	for (const [rel, content] of Object.entries(files)) {
		await fs.mkdir(path.dirname(path.join(repo, rel)), { recursive: true });
		await Bun.write(path.join(repo, rel), content);
	}
	for (const rel of executable) await fs.chmod(path.join(repo, rel), 0o755);
	for (const [rel, target] of Object.entries(symlinks)) {
		await fs.mkdir(path.dirname(path.join(repo, rel)), { recursive: true });
		await fs.symlink(target, path.join(repo, rel));
	}
	for (const rel of remove) await fs.rm(path.join(repo, rel));
	await sh(repo, "git", "add", "-A");
	await sh(repo, "git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", message);
	return sh(repo, "git", "rev-parse", "HEAD");
}

interface Fixture {
	repo: string;
	base: string;
	fix: string;
}

async function makeRepo(): Promise<Fixture> {
	const repo = path.join(tmp, "repo");
	await fs.mkdir(repo);
	await sh(repo, "git", "init", "-q", "-b", "main");
	const base = await commit(
		repo,
		{ "src/value.txt": "broken\n", "src/old.txt": "obsolete\n", "README.md": "readme\n" },
		"base",
	);
	const fix = await commit(
		repo,
		{
			"src/value.txt": "fixed\n",
			"tests/check.sh": "#!/usr/bin/env bash\ngrep -qx fixed src/value.txt && [ ! -e src/old.txt ]\n",
		},
		"fix",
		["src/old.txt"],
	);
	return { repo, base, fix };
}

function opts(f: Fixture, over: Partial<MakeOptions> = {}): MakeOptions {
	return {
		repo: f.repo,
		base: f.base,
		fix: f.fix,
		name: "synthetic",
		instruction: "Make src/value.txt contain `fixed` and delete src/old.txt.",
		testCommand: "bash tests/check.sh",
		testGlobs: ["tests/**"],
		baseImage: "debian:stable-slim",
		output: path.join(tmp, "out"),
		nativeAddons: [],
		...over,
	};
}

const savedEnv = { runtime: Bun.env.EVO_CONTAINER_RUNTIME, state: Bun.env.FAKE_DOCKER_STATE, path: Bun.env.PATH };

function restoreEnv(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

beforeEach(async () => {
	tmp = await fs.mkdtemp(path.join(os.tmpdir(), "evo-task-test-"));
	// Basename selects the suite backend the calibration record claims, so the fake must be named like the real CLI.
	await fs.mkdir(path.join(tmp, "bin"));
	await fs.symlink(path.join(import.meta.dir, "fixtures/evo-task/fake-docker.sh"), path.join(tmp, "bin", "docker"));
	process.env.EVO_CONTAINER_RUNTIME = path.join(tmp, "bin", "docker");
	process.env.FAKE_DOCKER_STATE = path.join(tmp, "docker-state");
});
afterEach(async () => {
	restoreEnv("EVO_CONTAINER_RUNTIME", savedEnv.runtime);
	restoreEnv("FAKE_DOCKER_STATE", savedEnv.state);
	restoreEnv("PATH", savedEnv.path);
	// Suite task snapshots are read-only directories; restore owner write before deleting.
	await unlockTree(tmp);
	await fs.rm(tmp, { recursive: true, force: true });
});

describe("evo-task make", () => {
	it("emits Harbor 1.3 layout with hidden tests and solution split", async () => {
		const f = await makeRepo();
		const meta = await makeTask(opts(f));
		const out = path.join(tmp, "out");
		expect(meta.testFiles).toEqual(["tests/check.sh"]);
		expect(meta.solutionFiles).toEqual(["src/value.txt"]);
		expect(meta.deletedFiles).toEqual(["src/old.txt"]);

		const toml = await Bun.file(path.join(out, "task.toml")).text();
		expect(toml).toContain('schema_version = "1.3"');
		expect(toml).toContain('[verifier]\ntimeout_sec = 900.0\nnetwork_mode = "no-network"');
		expect(toml).toContain('[environment]\nbuild_timeout_sec = 900.0\nnetwork_mode = "public"');
		expect(toml).not.toContain("[verifier.environment]");
		expect(await Bun.file(path.join(out, "instruction.md")).text()).toContain("src/value.txt");
		const dockerfile = await Bun.file(path.join(out, "environment", "Dockerfile")).text();
		expect(dockerfile).toMatch(/^FROM debian@sha256:[0-9a-f]{64}\n/);
		expect(dockerfile).toContain("COPY repo/ /workspace/repo/");
		expect(await Bun.file(path.join(out, "tests", "test.sh")).text()).toContain("/logs/verifier");
		expect(await Bun.file(path.join(out, "tests", "test.sh")).text()).toContain("reward.txt");
		expect(await Bun.file(path.join(out, "tests", "files", "tests", "check.sh")).exists()).toBe(true);
		expect(await Bun.file(path.join(out, "solution", "files", "src", "value.txt")).text()).toBe("fixed\n");

		// Full base snapshot lives only under environment/repo; fix-only content never leaks into it.
		const snap = path.join(out, "environment", "repo");
		expect(await Bun.file(path.join(snap, "README.md")).text()).toBe("readme\n");
		expect(await Bun.file(path.join(snap, "src", "value.txt")).text()).toBe("broken\n");
		expect(await Bun.file(path.join(snap, "src", "old.txt")).exists()).toBe(true);
		expect(await Bun.file(path.join(snap, "tests", "check.sh")).exists()).toBe(false);
		const all = (await fs.readdir(out, { recursive: true })).map(p => p.toString());
		expect(all.some(p => p.includes("README.md") && !p.startsWith("environment/repo/"))).toBe(false);
		expect(all.some(p => p.startsWith("solution/files/tests"))).toBe(false);
		expect(
			all.some(
				p => p.startsWith("environment/") && !p.startsWith("environment/repo") && p !== "environment/Dockerfile",
			),
		).toBe(false);
	});

	it("verify: reward 0 before solution, 1 after", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		const result = await verifyTask(path.join(tmp, "out"));
		expect(result).toEqual({ before: 0, after: 1 });
	});

	it("verify runs RED and GREEN in the task image under the verifier no-network policy and records the environment", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		const out = path.join(tmp, "out");
		await verifyTask(out);
		const record = (await Bun.file(path.join(out, "calibration.json")).json()) as {
			before: number;
			after: number;
			environment: {
				mode: string;
				runtime: string;
				backend: string;
				platform: string;
				image: string;
				verifierNetwork: string;
			};
		};
		expect([record.before, record.after]).toEqual([0, 1]);
		expect(record.environment.mode).toBe("container");
		expect(record.environment.backend).toBe("docker");
		expect(record.environment.platform).toMatch(/^linux\/\w+$/);
		expect(record.environment.verifierNetwork).toBe("no-network");
		expect(record.environment.image).toMatch(/^sha256:/);
		const calls = (await Bun.file(path.join(tmp, "docker-state", "calls.log")).text()).trim().split("\n");
		const runs = calls.filter(c => c.startsWith("run "));
		expect(calls.find(c => c.startsWith("build "))).toMatch(/^build -t \S+ .*environment$/);
		expect(runs).toHaveLength(2);
		for (const r of runs) {
			expect(r).toContain("--network none");
			expect(r).toContain("/tests:/tests:ro");
			expect(r).toContain("/logs/verifier");
		}
	});

	it("verify refuses to certify a command that only passes on the host (isolated verifier)", async () => {
		const f = await makeRepo();
		// Host-only executable and host-only env var: invisible inside the task container.
		const bin = path.join(tmp, "hostbin");
		await fs.mkdir(bin);
		await Bun.write(
			path.join(bin, "host-only-check"),
			'#!/bin/sh\n[ "$HOST_ONLY_FLAG" = 1 ] && grep -qx fixed src/value.txt\n',
		);
		await fs.chmod(path.join(bin, "host-only-check"), 0o755);
		process.env.PATH = `${bin}:${savedEnv.path ?? ""}`;
		process.env.HOST_ONLY_FLAG = "1";
		try {
			await makeTask(opts(f, { testCommand: "host-only-check" }));
			const out = path.join(tmp, "out");
			// Control: the same task is a valid RED/GREEN task on the host, so only isolation can reject it.
			expect(await verifyTask(out, { hostUnisolated: true })).toEqual({ before: 0, after: 1 });
			await expect(verifyTask(out)).rejects.toThrow(/GREEN check failed/);
			expect(await Bun.file(path.join(out, "calibration.json")).exists()).toBe(false);
		} finally {
			delete process.env.HOST_ONLY_FLAG;
		}
	});

	it("host-unisolated verification never writes calibration.json", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		const out = path.join(tmp, "out");
		expect(await verifyTask(out, { hostUnisolated: true })).toEqual({ before: 0, after: 1 });
		expect(await Bun.file(path.join(out, "calibration.json")).exists()).toBe(false);
	});

	it("verify fails when the container runtime is unavailable", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		process.env.EVO_CONTAINER_RUNTIME = path.join(tmp, "no-such-runtime");
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/container runtime/);
	});

	it("verify refuses a task whose verifier network is not isolated", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		const toml = path.join(tmp, "out", "task.toml");
		await Bun.write(
			toml,
			(await Bun.file(toml).text()).replace(
				'[verifier]\ntimeout_sec = 900.0\nnetwork_mode = "no-network"',
				'[verifier]\ntimeout_sec = 900.0\nnetwork_mode = "public"',
			),
		);
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/network_mode/);
	});

	it("suite registration rejects a generated task with no successful calibration", async () => {
		const f = await makeRepo();
		const dataset = path.join(tmp, "dataset");
		await makeTask(opts(f, { output: path.join(dataset, "synthetic") }));
		const registry = new SuiteRegistry(path.join(tmp, "jobs"));
		const manifest = {
			id: "cal-suite",
			split: "search",
			benchmark: "harbor",
			dataset,
			include: ["synthetic"],
			attempts: 1,
			timeoutMultiplier: 1,
			model: "m",
			thinking: "off",
			environment: "docker",
			platform: "linux/arm64",
			minPairedTasks: 1,
			minAttemptsPerTask: 1,
			concurrency: 1,
		};
		const err = await registry.register(manifest).then(
			() => null,
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(EvoHttpError);
		expect((err as EvoHttpError).status).toBe(422);
		expect((err as Error).message).toMatch(/synthetic.*calibration|calibration.*synthetic/);

		await verifyTask(path.join(dataset, "synthetic"));
		expect((await registry.register(manifest)).created).toBe(true);

		// Task bytes changed after calibration: evidence no longer binds.
		const second = new SuiteRegistry(path.join(tmp, "jobs2"));
		await Bun.write(path.join(dataset, "synthetic", "tests", "command.txt"), "true\n");
		await expect(second.register(manifest)).rejects.toThrow(/synthetic.*calibration|calibration.*synthetic/);
	});

	it("verify rejects a task whose solution does not fix the tests (GREEN discriminates)", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		await fs.rm(path.join(tmp, "out", "solution", "files", "src", "value.txt"));
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/GREEN check failed/);
	});

	it("verify rejects a task that already passes before solution (RED discriminates)", async () => {
		const f = await makeRepo();
		await makeTask(opts(f));
		await Bun.write(path.join(tmp, "out", "tests", "command.txt"), "true\n");
		await expect(verifyTask(path.join(tmp, "out"))).rejects.toThrow(/RED check failed/);
	});

	it("rejects identical refs", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { fix: f.base }))).rejects.toThrow(/same commit/);
	});

	it("rejects merge fix commits", async () => {
		const f = await makeRepo();
		await sh(f.repo, "git", "checkout", "-q", "-b", "side", f.base);
		await commit(f.repo, { "side.txt": "s\n" }, "side");
		await sh(f.repo, "git", "checkout", "-q", "main");
		await sh(
			f.repo,
			"git",
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"merge",
			"-q",
			"--no-ff",
			"-m",
			"merge",
			"side",
		);
		const merge = await sh(f.repo, "git", "rev-parse", "HEAD");
		await expect(makeTask(opts(f, { fix: merge }))).rejects.toThrow(/merge commit/);
	});

	it("rejects when no changed file matches a test glob", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testGlobs: ["nomatch/**"] }))).rejects.toThrow(/no changed files match/);
	});

	it("rejects when every changed file is a hidden test (no solution to ship)", async () => {
		const f = await makeRepo();
		// Globs claim all changed files, so tests and solution cannot be separated.
		await expect(makeTask(opts(f, { testGlobs: ["tests/**", "src/value.txt", "src/old.txt"] }))).rejects.toThrow(
			/no solution/,
		);
	});

	it("rejects dirty repo", async () => {
		const f = await makeRepo();
		await Bun.write(path.join(f.repo, "untracked.txt"), "x");
		await expect(makeTask(opts(f))).rejects.toThrow(/dirty/);
	});

	it("rejects traversal and absolute globs", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testGlobs: ["../x"] }))).rejects.toThrow(/traversal/);
		await expect(makeTask(opts(f, { testGlobs: ["/etc/passwd"] }))).rejects.toThrow(/absolute/);
	});

	it("rejects NUL/newline in test command", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { testCommand: "true\nrm -rf /" }))).rejects.toThrow(/NUL or newline/);
		await expect(makeTask(opts(f, { testCommand: "true\u0000" }))).rejects.toThrow(/NUL or newline/);
	});

	it("parseMakeArgs requires every flag and accepts repeated --test-glob", () => {
		const base = [
			"--repo",
			"r",
			"--base",
			"b",
			"--fix",
			"f",
			"--name",
			"n",
			"--instruction",
			"i",
			"--test-command",
			"c",
			"--test-glob",
			"a",
			"--test-glob",
			"b",
			"--base-image",
			"img",
			"--output",
			"o",
		];
		expect(parseMakeArgs(base).testGlobs).toEqual(["a", "b"]);
		expect(() => parseMakeArgs(base.slice(2))).toThrow(/--repo is required/);
	});
});

describe("evo-task git file modes", () => {
	async function execRepo(): Promise<Fixture> {
		const repo = path.join(tmp, "repo");
		await fs.mkdir(repo);
		await sh(repo, "git", "init", "-q", "-b", "main");
		const base = await commit(repo, { "README.md": "readme\n" }, "base");
		const fix = await commit(
			repo,
			{
				"src/tool.sh": "#!/usr/bin/env bash\necho ok > out.txt\n",
				"src/data.txt": "plain\n",
				"tests/check.sh": "#!/usr/bin/env bash\n./src/tool.sh && grep -qx ok out.txt\n",
			},
			"fix",
			[],
			["src/tool.sh", "tests/check.sh"],
		);
		return { repo, base, fix };
	}

	it("preserves executable bit on hidden tests and solution files; verify runs 0 then 1", async () => {
		const f = await execRepo();
		await makeTask(opts(f, { testCommand: "./tests/check.sh" }));
		const out = path.join(tmp, "out");
		const mode = async (rel: string): Promise<number> => (await fs.stat(path.join(out, rel))).mode & 0o111;
		expect(await mode("tests/files/tests/check.sh")).not.toBe(0);
		expect(await mode("solution/files/src/tool.sh")).not.toBe(0);
		expect(await mode("solution/files/src/data.txt")).toBe(0);
		expect(await verifyTask(out)).toEqual({ before: 0, after: 1 });
	});

	it("rejects symlink tree entries in the fixed snapshot", async () => {
		const f = await execRepo();
		const fix = await commit(f.repo, {}, "link", [], [], { "src/link": "data.txt" });
		await expect(makeTask(opts(f, { fix, testCommand: "./tests/check.sh" }))).rejects.toThrow(/symlink|non-regular/);
	});
});

describe("example descriptor", () => {
	it("read-limited-text pins the planned refs, hidden test, and command", async () => {
		const d: unknown = await Bun.file(path.join(import.meta.dir, "fixtures/evo-task/read-limited-text.json")).json();
		expect(d).toMatchObject({
			base: "63b339b814^",
			fix: "63b339b814",
			testCommand: "bun test packages/coding-agent/test/web/search/read-limited-text.test.ts",
			testGlobs: ["packages/coding-agent/test/web/search/read-limited-text.test.ts"],
		});
	});

	it("output-budget-framing descriptor is a runnable make invocation over refs that change the hidden test", async () => {
		const d = (await Bun.file(
			path.join(import.meta.dir, "..", "examples", "evo-task-output-budget-framing.json"),
		).json()) as Record<string, unknown> & { testGlobs: string[]; nativeAddons: string[] };
		const argv = ["--output", "out"];
		for (const key of ["repo", "base", "fix", "name", "instruction", "baseImage"] as const) {
			argv.push(`--${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, String(d[key]));
		}
		argv.push("--test-command", String(d.testCommand), "--setup-command", String(d.setupCommand));
		for (const glob of d.testGlobs) argv.push("--test-glob", glob);
		for (const target of d.nativeAddons) argv.push("--native-addon", target);
		const opts = parseMakeArgs(argv);
		expect(opts.nativeAddons).toEqual(["linux-arm64"]);
		// The verifier runs only the hidden test; dependency install stays a build-time step.
		expect(opts.testCommand).toBe(`bun test ${d.testGlobs.join(" ")}`);
		expect(opts.setupCommand).toBe("bun install --frozen-lockfile");
		expect(d.expectedCalibration).toEqual({ before: 0, after: 1 });
		// The refs exist in this repository and the hidden test differs between them, so `make` has a test to hide.
		const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
		const changed = Bun.spawnSync(["git", "diff", "--name-only", opts.base, opts.fix, "--", ...opts.testGlobs], {
			cwd: repoRoot,
		});
		expect(changed.exitCode).toBe(0);
		expect(changed.stdout.toString().trim().split("\n")).toEqual(opts.testGlobs);
	});
});

describe("setup command (build-time dependency install)", () => {
	const setup = "printf ok > .deps-ready";
	const testCommand = "bash tests/check.sh && test -f .deps-ready";

	it("without --setup-command a test needing build-time artifacts fails GREEN; Dockerfile has no RUN line", async () => {
		const f = await makeRepo();
		await makeTask(opts(f, { testCommand }));
		const out = path.join(tmp, "out");
		const dockerfile = await Bun.file(path.join(out, "environment", "Dockerfile")).text();
		expect(dockerfile.split("\n").some(l => l.startsWith("RUN "))).toBe(false);
		expect(dockerfile).toMatch(/^FROM \S+\nCOPY repo\/ \/workspace\/repo\/\nWORKDIR \/workspace\/repo\n$/);
		const meta = (await Bun.file(path.join(out, "evo-task.json")).json()) as { setupCommand: string | null };
		expect(meta.setupCommand).toBeNull();
		await expect(verifyTask(out)).rejects.toThrow(/GREEN check failed/);
	});

	it("with --setup-command the RUN step executes at build time and verify returns 0 then 1", async () => {
		const f = await makeRepo();
		await makeTask(opts(f, { testCommand, setupCommand: setup }));
		const out = path.join(tmp, "out");
		const dockerfile = await Bun.file(path.join(out, "environment", "Dockerfile")).text();
		expect(dockerfile.endsWith(`WORKDIR /workspace/repo\nRUN ${setup}\n`)).toBe(true);
		const meta = (await Bun.file(path.join(out, "evo-task.json")).json()) as { setupCommand: string | null };
		expect(meta.setupCommand).toBe(setup);
		expect(await verifyTask(out)).toEqual({ before: 0, after: 1 });
	});

	it("rejects empty, NUL, or newline setup command", async () => {
		const f = await makeRepo();
		await expect(makeTask(opts(f, { setupCommand: "true\nrm -rf /" }))).rejects.toThrow(/NUL or newline/);
		await expect(makeTask(opts(f, { setupCommand: "true\u0000" }))).rejects.toThrow(/NUL or newline/);
		await expect(makeTask(opts(f, { setupCommand: "  " }))).rejects.toThrow(/must not be empty/);
	});

	it("parseMakeArgs accepts optional --setup-command", () => {
		const args = [
			"--repo",
			"r",
			"--base",
			"b",
			"--fix",
			"f",
			"--name",
			"n",
			"--instruction",
			"i",
			"--test-command",
			"c",
			"--test-glob",
			"g",
			"--base-image",
			"img",
			"--output",
			"o",
		];
		expect(parseMakeArgs(args).setupCommand).toBeUndefined();
		expect(parseMakeArgs([...args, "--setup-command", "bun install"]).setupCommand).toBe("bun install");
	});
});

describe("native addon embedding", () => {
	const META_URL_PREFIX = "https://registry.npmjs.org/@oh-my-pi%2Fpi-natives-linux-arm64/";
	const addonBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 1, 2, 3, 4]);
	let restoreFetch: (() => void) | undefined;
	let requested: string[] = [];

	function sri(bytes: Uint8Array): string {
		return `sha512-${new Bun.CryptoHasher("sha512").update(bytes).digest("base64")}`;
	}

	async function tarball(members: Record<string, string | Uint8Array>): Promise<Uint8Array> {
		return encodeArchive("tar.gz", Object.entries(members));
	}

	/** Serve one version of the arm64 package from an in-memory registry; `integrity` overrides the advertised SRI. */
	function serveRegistry(version: string, tgz: Uint8Array, integrity: string = sri(tgz)): void {
		restoreFetch = setNativeAddonFetch(async url => {
			requested.push(url);
			if (url === `${META_URL_PREFIX}${version}`) {
				return Response.json({ dist: { tarball: "https://registry.test/addon.tgz", integrity } });
			}
			if (url === "https://registry.test/addon.tgz") return new Response(tgz);
			return new Response("not found", { status: 404 });
		});
	}

	async function natives(version: string): Promise<Record<string, string>> {
		return { "packages/natives/package.json": `${JSON.stringify({ name: "@oh-my-pi/pi-natives", version })}\n` };
	}

	async function versionedFixture(baseVersion: string, fixVersion: string): Promise<Fixture> {
		const repo = path.join(tmp, "repo");
		await fs.mkdir(repo);
		await sh(repo, "git", "init", "-q", "-b", "main");
		const base = await commit(repo, { "src/value.txt": "broken\n", ...(await natives(baseVersion)) }, "base");
		const fix = await commit(
			repo,
			{
				...(await natives(fixVersion)),
				"src/value.txt": "fixed\n",
				"tests/check.sh": "#!/usr/bin/env bash\ngrep -qx fixed src/value.txt\n",
			},
			"fix",
		);
		return { repo, base, fix };
	}

	beforeEach(() => {
		requested = [];
	});
	afterEach(() => {
		restoreFetch?.();
		restoreFetch = undefined;
	});

	it("parseMakeArgs collects repeatable targets and rejects unknown or duplicate ones", () => {
		const args = [
			"--repo",
			"r",
			"--base",
			"b",
			"--fix",
			"f",
			"--name",
			"n",
			"--instruction",
			"i",
			"--test-command",
			"c",
			"--test-glob",
			"g",
			"--base-image",
			"img",
			"--output",
			"o",
		];
		expect(parseMakeArgs(args).nativeAddons).toEqual([]);
		expect(
			parseMakeArgs([...args, "--native-addon", "linux-arm64", "--native-addon", "linux-x64"]).nativeAddons,
		).toEqual(["linux-arm64", "linux-x64"]);
		expect(() => parseMakeArgs([...args, "--native-addon", "darwin-arm64"])).toThrow(/native-addon/);
		expect(() => parseMakeArgs([...args, "--native-addon", "linux-x64", "--native-addon", "linux-x64"])).toThrow(
			/duplicate/,
		);
	});

	it("makeTask rejects invalid or duplicate targets before creating output", async () => {
		const f = await versionedFixture("1.2.3", "9.9.9");
		serveRegistry("1.2.3", await tarball({}));
		// biome-ignore lint/suspicious/noExplicitAny: deliberately invalid target for the boundary check
		const bad = ["linux-riscv"] as any;
		await expect(makeTask(opts(f, { nativeAddons: bad }))).rejects.toThrow(/native-addon/);
		await expect(makeTask(opts(f, { nativeAddons: ["linux-x64", "linux-x64"] }))).rejects.toThrow(/duplicate/);
		expect(await fs.stat(path.join(tmp, "out")).catch(() => null)).toBeNull();
		expect(requested).toEqual([]);
	});

	it("embeds the BASE-version addon bytes and records integrity and repo-relative files", async () => {
		const f = await versionedFixture("1.2.3", "9.9.9");
		const tgz = await tarball({
			"package/package.json": "{}",
			"package/pi_natives.linux-arm64.node": addonBytes,
			"package/pi_natives.linux-x64.node": new Uint8Array([9]),
		});
		serveRegistry("1.2.3", tgz);
		const meta = await makeTask(opts(f, { nativeAddons: ["linux-arm64"] }));
		const out = path.join(tmp, "out");
		const rel = "packages/natives/native/pi_natives.linux-arm64.node";
		expect(await Bun.file(path.join(out, "environment", "repo", rel)).bytes()).toEqual(addonBytes);
		expect(
			await Bun.file(
				path.join(out, "environment", "repo", "packages/natives/native/pi_natives.linux-x64.node"),
			).exists(),
		).toBe(false);
		const record: NativeAddonRecord = {
			target: "linux-arm64",
			packageName: "@oh-my-pi/pi-natives-linux-arm64",
			version: "1.2.3",
			integrity: sri(tgz),
			files: [rel],
		};
		expect(meta.nativeAddons).toEqual([record]);
		const written = (await Bun.file(path.join(out, "evo-task.json")).json()) as { nativeAddons: NativeAddonRecord[] };
		expect(written.nativeAddons).toEqual([record]);
		expect(requested.some(u => u.endsWith("/9.9.9"))).toBe(false);
	});

	it("fails on integrity mismatch without producing task metadata", async () => {
		const f = await versionedFixture("1.2.3", "1.2.3");
		const tgz = await tarball({ "package/pi_natives.linux-arm64.node": addonBytes });
		serveRegistry("1.2.3", tgz, sri(new Uint8Array([1])));
		await expect(makeTask(opts(f, { nativeAddons: ["linux-arm64"] }))).rejects.toThrow(/integrity/);
		expect(await Bun.file(path.join(tmp, "out", "evo-task.json")).exists()).toBe(false);
		expect(
			await Bun.file(
				path.join(tmp, "out", "environment/repo/packages/natives/native/pi_natives.linux-arm64.node"),
			).exists(),
		).toBe(false);
	});

	it("fails when the archive has no matching addon member", async () => {
		const f = await versionedFixture("1.2.3", "1.2.3");
		serveRegistry("1.2.3", await tarball({ "package/pi_natives.linux-x64.node": addonBytes }));
		await expect(makeTask(opts(f, { nativeAddons: ["linux-arm64"] }))).rejects.toThrow(
			/no .*pi_natives\.linux-arm64/,
		);
		expect(await Bun.file(path.join(tmp, "out", "evo-task.json")).exists()).toBe(false);
	});

	it("fails on non-2xx registry responses and malformed metadata", async () => {
		const f = await versionedFixture("1.2.3", "1.2.3");
		restoreFetch = setNativeAddonFetch(async () => new Response("nope", { status: 404 }));
		await expect(makeTask(opts(f, { nativeAddons: ["linux-arm64"] }))).rejects.toThrow(/404/);
		restoreFetch();
		restoreFetch = setNativeAddonFetch(async () =>
			Response.json({ dist: { tarball: "https://x/y.tgz", integrity: "sha1-abc" } }),
		);
		await fs.rm(path.join(tmp, "out"), { recursive: true, force: true });
		await expect(makeTask(opts(f, { nativeAddons: ["linux-arm64"] }))).rejects.toThrow(/sha512/);
	});

	it("without --native-addon the layout is unchanged apart from explicit empty nativeAddons", async () => {
		const f = await makeRepo();
		const meta = await makeTask(opts(f));
		const out = path.join(tmp, "out");
		expect(meta.nativeAddons).toEqual([]);
		const written = (await Bun.file(path.join(out, "evo-task.json")).json()) as Record<string, unknown>;
		expect(Object.keys(written).sort()).toEqual(
			["base", "deletedFiles", "fix", "nativeAddons", "setupCommand", "solutionFiles", "testFiles"].sort(),
		);
		expect(written.nativeAddons).toEqual([]);
		expect(await fs.stat(path.join(out, "environment", "repo", "packages")).catch(() => null)).toBeNull();
	});
});
