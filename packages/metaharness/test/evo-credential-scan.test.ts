import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildEvalLaunch, type EvoLaunchDefaults } from "../src/evo/launch";
import { stageAgentOverlay } from "../src/evo/overlay";
import { parseVariantRequest, VariantRegistry } from "../src/evo/variants";
import { ManagerServer } from "../src/server";
import * as runner from "../src/runner";
import { RunStore } from "../src/store";

const SECRET = "sk-leak-sentinel-R43-abcdef123456";
const EXTRA_SECRET = "sk-extra-sentinel-R43-0123456789ab";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

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

function tmp(prefix = "evo-cred-"): string {
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

function setEnv(name: string, value: string): void {
	process.env[name] = value;
	cleanups.push(() => {
		delete process.env[name];
	});
}

function makeSource(): string {
	const dir = tmp("evo-cred-src-");
	git(dir, "init", "-q", "-b", "main");
	write(dir, "a.txt", "one\n");
	git(dir, "add", "-A");
	git(dir, "commit", "-q", "-m", "init");
	return dir;
}

/** Every path a rejected registration must not have created. */
function expectNothingPersisted(jobsDir: string, store: RunStore): void {
	expect(store.evo.listVariants()).toEqual([]);
	const variants = path.join(jobsDir, "_evo", "variants");
	expect(fs.existsSync(variants) ? fs.readdirSync(variants) : []).toEqual([]);
	const scratch = path.join(jobsDir, "_evo", "tmp");
	expect(fs.existsSync(scratch) ? fs.readdirSync(scratch) : []).toEqual([]);
	const leaked = Bun.spawnSync(["grep", "-rl", "--", SECRET, jobsDir]).stdout.toString().trim();
	expect(leaked).toBe("");
}

function registry(secrets: string[], source = makeSource()) {
	const jobsDir = tmp("evo-cred-jobs-");
	const store = new RunStore(jobsDir);
	cleanups.push(() => store.close());
	const reg = new VariantRegistry(store.evo, jobsDir, source, undefined, () => secrets);
	return { jobsDir, store, reg };
}

const error = (p: Promise<unknown>) =>
	p.then(
		() => undefined,
		(e: unknown) => e as Error,
	);

describe("variant genome credential scan (Gap A)", () => {
	it("rejects a credential value in a whitelisted config file body and persists nothing", async () => {
		const { jobsDir, store, reg } = registry([SECRET]);
		const dir = tmp("evo-cred-agent-");
		write(dir, "AGENTS.md", `# rules\nuse key ${SECRET} for the router\n`);
		const err = await error(reg.register(parseVariantRequest({ mutation: "root", configDir: dir })));
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("AGENTS.md");
		expect(err?.message).toContain("host credential value");
		expect(err?.message).not.toContain(SECRET);
		expectNothingPersisted(jobsDir, store);
	});

	it("rejects a credential value in the source patch and persists nothing new", async () => {
		const repo = makeSource();
		const { jobsDir, store, reg } = registry([SECRET], repo);
		const cfg = tmp("evo-cred-agent-");
		write(cfg, "AGENTS.md", "clean\n");
		const base = await reg.register(parseVariantRequest({ mutation: "root", configDir: cfg }));
		write(repo, "a.txt", `two ${SECRET}\n`);
		git(repo, "add", "-A");
		git(repo, "commit", "-q", "-m", "leak");
		const wt = path.join(jobsDir, "_evo", "worktrees", "wt");
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		git(repo, "worktree", "add", "-q", "--detach", wt, "HEAD");
		cleanups.push(() => Bun.spawnSync(["git", "worktree", "remove", "--force", wt], { cwd: repo }));
		const variantsBefore = fs.readdirSync(path.join(jobsDir, "_evo", "variants")).sort();
		const err = await error(
			reg.register(
				parseVariantRequest({
					mutation: "manual",
					parentId: base.variant.id,
					configDir: cfg,
					sourceWorktree: fs.realpathSync(wt),
				}),
			),
		);
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("source patch");
		expect(err?.message).not.toContain(SECRET);
		expect(store.evo.listVariants().map(v => v.id)).toEqual([base.variant.id]);
		expect(fs.readdirSync(path.join(jobsDir, "_evo", "variants")).sort()).toEqual(variantsBefore);
		const scratch = path.join(jobsDir, "_evo", "tmp");
		expect(fs.existsSync(scratch) ? fs.readdirSync(scratch) : []).toEqual([]);
		const leaked = Bun.spawnSync(["grep", "-rl", "--", SECRET, path.join(jobsDir, "_evo", "variants")])
			.stdout.toString()
			.trim();
		expect(leaked).toBe("");
	});

	it("still registers a legitimate config (no false rejection)", async () => {
		const { store, reg } = registry([SECRET]);
		const dir = tmp("evo-cred-agent-");
		write(dir, "AGENTS.md", "# rules\nuse the router via ONARA_ROUTER_KEY, never inline it\n");
		const out = await reg.register(parseVariantRequest({ mutation: "root", configDir: dir }));
		expect(out.created).toBe(true);
		expect(store.evo.listVariants()).toHaveLength(1);
	});

	it("overlay staging rejects a credential in a variant file before creating dest or overlay-meta", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, "AGENTS.md", `key ${SECRET}\n`);
		const modelsYaml = path.join(root, "models.yml");
		fs.writeFileSync(modelsYaml, "providers:\n  onara:\n    baseUrl: http://x\n");
		const dest = path.join(root, "bench", "agent-overlay");
		const err = await error(
			stageAgentOverlay({
				variantConfigDir: variant,
				dest,
				spec: { model: "m", thinking: "medium", webSearch: false, findTool: false, settings: {} },
				modelsYaml,
				secretValues: [SECRET],
			}),
		);
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("AGENTS.md");
		expect(err?.message).not.toContain(SECRET);
		expect(fs.existsSync(dest)).toBe(false);
		expect(fs.existsSync(path.join(root, "bench", "overlay-meta.json"))).toBe(false);
	});

	it("POST /api/evo/variants scans with the server's forwarded names (referenced + explicit)", async () => {
		setEnv("EVO_CRED_REFERENCED", SECRET);
		setEnv("EVO_CRED_EXPLICIT", EXTRA_SECRET);
		const jobsDir = tmp("evo-cred-api-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_CRED_REFERENCED\n");
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: ["EVO_CRED_REFERENCED", "EVO_CRED_EXPLICIT"] };
		const manager = new ManagerServer(jobsDir, undefined, { sourceRoot: makeSource(), defaults });
		const server = manager.start(0);
		cleanups.push(() => void manager.stop());
		const post = (configDir: string) =>
			fetch(`http://localhost:${server.port}/api/evo/variants`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mutation: "root", configDir }),
			});
		for (const secret of [SECRET, EXTRA_SECRET]) {
			const dir = tmp("evo-cred-agent-");
			write(dir, "AGENTS.md", `# leak ${secret}\n`);
			const res = await post(dir);
			expect(res.status).toBe(422);
			expect(await res.text()).not.toContain(secret);
		}
		expect(manager.store.evo.listVariants()).toEqual([]);
		const variants = path.join(jobsDir, "_evo", "variants");
		expect(fs.existsSync(variants) ? fs.readdirSync(variants) : []).toEqual([]);
		const ok = tmp("evo-cred-agent-");
		write(ok, "AGENTS.md", "# clean\n");
		expect((await post(ok)).status).toBe(201);
	});
});

describe("credential scan covers filenames and the generated diff (R44)", () => {
	it("rejects a credential in a filename and persists nothing", async () => {
		const { jobsDir, store, reg } = registry([SECRET]);
		const dir = tmp("evo-cred-agent-");
		write(dir, `rules/${SECRET}.md`, "harmless\n");
		const err = await error(reg.register(parseVariantRequest({ mutation: "root", configDir: dir })));
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("host credential value");
		expect(err?.message).not.toContain(SECRET);
		expectNothingPersisted(jobsDir, store);
		const names = Bun.spawnSync(["find", jobsDir, "-name", `*${SECRET}*`])
			.stdout.toString()
			.trim();
		expect(names).toBe("");
	});

	it("rejects a credential in a nested directory component", async () => {
		const { jobsDir, store, reg } = registry([SECRET]);
		const dir = tmp("evo-cred-agent-");
		write(dir, `skills/${SECRET}/SKILL.md`, "harmless\n");
		const err = await error(reg.register(parseVariantRequest({ mutation: "root", configDir: dir })));
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("host credential value");
		expect(err?.message).not.toContain(SECRET);
		expectNothingPersisted(jobsDir, store);
		const names = Bun.spawnSync(["find", jobsDir, "-name", `*${SECRET}*`])
			.stdout.toString()
			.trim();
		expect(names).toBe("");
	});

	it("rejects a clean child whose diff would carry a credential from a pre-scan parent snapshot", async () => {
		const { jobsDir, store, reg } = registry([SECRET]);
		const base = tmp("evo-cred-agent-");
		write(base, "AGENTS.md", "clean\n");
		const parent = await reg.register(parseVariantRequest({ mutation: "root", configDir: base }));
		// Simulate a pre-R43 registration: plant a credential straight into the read-only parent snapshot.
		const cfg = path.join(jobsDir, "_evo", "variants", parent.variant.id, "config");
		fs.chmodSync(cfg, 0o755);
		fs.chmodSync(path.join(cfg, "AGENTS.md"), 0o644);
		fs.writeFileSync(path.join(cfg, "AGENTS.md"), `old ${SECRET}\n`);
		fs.chmodSync(cfg, 0o555);
		const child = tmp("evo-cred-agent-");
		write(child, "rules/new.md", "new rule\n");
		const variantsBefore = fs.readdirSync(path.join(jobsDir, "_evo", "variants")).sort();
		const err = await error(
			reg.register(parseVariantRequest({ mutation: "manual", parentId: parent.variant.id, configDir: child })),
		);
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("diff");
		expect(err?.message).not.toContain(SECRET);
		expect(store.evo.listVariants().map(v => v.id)).toEqual([parent.variant.id]);
		expect(fs.readdirSync(path.join(jobsDir, "_evo", "variants")).sort()).toEqual(variantsBefore);
		const scratch = path.join(jobsDir, "_evo", "tmp");
		expect(fs.existsSync(scratch) ? fs.readdirSync(scratch) : []).toEqual([]);
		const patches = Bun.spawnSync(["grep", "-rlF", "--include=diff.patch", "--", SECRET, path.join(jobsDir, "_evo")])
			.stdout.toString()
			.trim();
		expect(patches).toBe("");
	});

	it("overlay staging rejects a credential in a variant filename before creating dest", async () => {
		const root = tmp();
		const variant = path.join(root, "variant");
		write(variant, `rules/${SECRET}.md`, "harmless\n");
		const modelsYaml = path.join(root, "models.yml");
		fs.writeFileSync(modelsYaml, "providers:\n  onara:\n    baseUrl: http://x\n");
		const dest = path.join(root, "bench", "agent-overlay");
		const err = await error(
			stageAgentOverlay({
				variantConfigDir: variant,
				dest,
				spec: { model: "m", thinking: "medium", webSearch: false, findTool: false, settings: {} },
				modelsYaml,
				secretValues: [SECRET],
			}),
		);
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).not.toContain(SECRET);
		expect(fs.existsSync(dest)).toBe(false);
		expect(fs.existsSync(path.join(root, "bench", "overlay-meta.json"))).toBe(false);
	});

	it("still registers content that merely names the env var (201 through the server)", async () => {
		setEnv("EVO_CRED_REFERENCED", SECRET);
		const jobsDir = tmp("evo-cred-api-");
		const modelsYaml = path.join(jobsDir, "models.yml");
		write(jobsDir, "models.yml", "providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_CRED_REFERENCED\n");
		const defaults: EvoLaunchDefaults = { modelsYaml, forwardEnv: ["EVO_CRED_REFERENCED"] };
		const manager = new ManagerServer(jobsDir, undefined, { sourceRoot: makeSource(), defaults });
		const server = manager.start(0);
		cleanups.push(() => void manager.stop());
		const post = (configDir: string) =>
			fetch(`http://localhost:${server.port}/api/evo/variants`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mutation: "root", configDir }),
			});
		const bad = tmp("evo-cred-agent-");
		write(bad, `rules/${SECRET}.md`, "harmless\n");
		const rejected = await post(bad);
		expect(rejected.status).toBe(422);
		expect(await rejected.text()).not.toContain(SECRET);
		const variants = path.join(jobsDir, "_evo", "variants");
		expect(fs.existsSync(variants) ? fs.readdirSync(variants) : []).toEqual([]);
		expect(
			Bun.spawnSync(["grep", "-rlF", "--", SECRET, path.join(jobsDir, "_evo")])
				.stdout.toString()
				.trim(),
		).toBe("");
		const ok = tmp("evo-cred-agent-");
		write(ok, "rules/EVO_CRED_REFERENCED.md", "set EVO_CRED_REFERENCED in the environment\n");
		expect((await post(ok)).status).toBe(201);
	});
});

describe("models.yml credential scan covers the full forwarded union (Gap B)", () => {
	const text = (note: string) =>
		`providers:\n  onara:\n    baseUrl: http://x\n    apiKey: EVO_CRED_REFERENCED\n    note: ${note}\n`;

	it("buildEvalLaunch rejects an explicit-but-unreferenced forwarded value and writes no snapshot", async () => {
		setEnv("EVO_CRED_REFERENCED", SECRET);
		setEnv("EVO_CRED_EXPLICIT", EXTRA_SECRET);
		const jobsDir = tmp("evo-cred-launch-");
		write(jobsDir, "models.yml", text(EXTRA_SECRET));
		const defaults: EvoLaunchDefaults = {
			modelsYaml: path.join(jobsDir, "models.yml"),
			forwardEnv: ["EVO_CRED_REFERENCED", "EVO_CRED_EXPLICIT"],
		};
		const manifest = {
			id: "s",
			split: "search",
			benchmark: "harbor",
			dataset: "d",
			include: ["t"],
			attempts: 1,
			timeoutMultiplier: 1,
			model: "m",
			thinking: "medium",
			environment: "docker",
		};
		const input = {
			jobsDir,
			variant: {} as never,
			suite: { manifest, hash: "h" } as never,
			jobName: "j",
			concurrency: null,
			defaults,
		};
		const err = await error(buildEvalLaunch(input));
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toContain("providers.onara.note");
		expect(err?.message).not.toContain(EXTRA_SECRET);
		expect(fs.existsSync(path.join(jobsDir, "_evo", "models"))).toBe(false);
	});

	it("runner scan values include explicit --env NAME credentials, not only referenced names", () => {
		setEnv("EVO_CRED_REFERENCED", SECRET);
		setEnv("EVO_CRED_EXPLICIT", EXTRA_SECRET);
		const cfg = runner.parseArgs(["--env", "EVO_CRED_EXPLICIT"]);
		const values = runner.modelsScanValues(["EVO_CRED_REFERENCED"], cfg.env, process.env);
		expect(values).toContain(SECRET);
		expect(values).toContain(EXTRA_SECRET);
	});
});
