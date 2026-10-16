import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	collectConfig,
	hashConfig,
	MAX_CONFIG_FILE_BYTES,
	MAX_CONFIG_FILES,
	MAX_CONFIG_TOTAL_BYTES,
} from "../src/evo/config-snapshot";
import { EvoStore } from "../src/evo/evo-store";
import { formatSourceIdentity, sourceIdentity } from "../src/evo/source-identity";
import { SuiteRegistry } from "../src/evo/suites";
import { parseVariantRequest, VariantRegistry, variantConfigDir } from "../src/evo/variants";
import { RunStore } from "../src/store";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

function tmp(prefix = "evo-test-"): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function write(dir: string, rel: string, content: string): void {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), content);
}

async function git(cwd: string, ...args: string[]): Promise<string> {
	const proc = Bun.spawn(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, code] = [await proc.stdout.text(), await proc.exited];
	if (code !== 0) throw new Error(`git ${args.join(" ")} failed`);
	return out.trim();
}

async function makeSource(): Promise<string> {
	const dir = tmp("evo-src-");
	await git(dir, "init", "-q", "-b", "main");
	write(dir, "a.txt", "one\n");
	await git(dir, "add", "-A");
	await git(dir, "commit", "-q", "-m", "init");
	return dir;
}

function agentDir(files: Record<string, string>): string {
	const dir = tmp("evo-agent-");
	for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
	return dir;
}

async function setup() {
	const jobsDir = tmp("evo-jobs-");
	const store = new RunStore(jobsDir);
	cleanups.push(() => store.close());
	const source = await makeSource();
	const registry = new VariantRegistry(store.evo, jobsDir, source);
	return { jobsDir, store, source, registry };
}

const root = (configDir: string) => parseVariantRequest({ mutation: "root", configDir });

describe("config snapshot", () => {
	it("dereferences safe symlinks, excludes state, and hashes content stably", async () => {
		const outside = tmp();
		write(outside, "shared.md", "shared rule\n");
		const a = agentDir({
			"AGENTS.md": "hi\n",
			"rules/r.md": "r\n",
			"sessions/s.jsonl": "x",
			"cache/c": "x",
			"models.yml.bak": "x",
		});
		fs.symlinkSync(path.join(a, "rules", "r.md"), path.join(a, "rules", "link.md"));
		const b = agentDir({
			"AGENTS.md": "hi\n",
			"rules/r.md": "r\n",
			"rules/link.md": "r\n",
			"state.db": "x",
			"x.log": "y",
		});
		const filesA = await collectConfig(a);
		expect(filesA.map(f => f.rel)).toEqual(["AGENTS.md", "rules/link.md", "rules/r.md"]);
		expect(hashConfig(filesA)).toBe(hashConfig(await collectConfig(b)));
		write(b, "rules/r.md", "changed\n");
		expect(hashConfig(await collectConfig(b))).not.toBe(hashConfig(filesA));
	});

	it("rejects escaping symlinks, secrets, malformed YAML and non-regular files", async () => {
		const outside = tmp();
		write(outside, "secret.txt", "s");
		const escaping = agentDir({ "AGENTS.md": "x" });
		fs.mkdirSync(path.join(escaping, "rules"));
		fs.symlinkSync(path.join(outside, "secret.txt"), path.join(escaping, "rules", "e.md"));
		await expect(collectConfig(escaping)).rejects.toThrow(/symlink escapes source root: rules\/e.md/);
		await expect(collectConfig(agentDir({ "skills/.env": "K=1" }))).rejects.toThrow(
			/secret-bearing path not allowed: skills\/.env/,
		);
		await expect(collectConfig(agentDir({ "agents/models.yml": "k: v" }))).rejects.toThrow(/secret-bearing/);
		await expect(collectConfig(agentDir({ "config.yml": "a: [1" }))).rejects.toThrow(/config.yml is malformed YAML/);
		const fifo = agentDir({ "AGENTS.md": "x" });
		fs.mkdirSync(path.join(fifo, "rules"));
		Bun.spawnSync(["mkfifo", path.join(fifo, "rules", "pipe")]);
		await expect(collectConfig(fifo)).rejects.toThrow(/unsupported file type/);
		await expect(collectConfig(path.join(outside, "missing"))).rejects.toThrow(/config directory not found/);
	});
});

describe("variant registry", () => {
	it("registers root, reuses parent on identical content (noop), and links a changed child", async () => {
		const { jobsDir, store, registry } = await setup();
		const rootDir = agentDir({ "AGENTS.md": "base\n", "config.yml": "retry:\n  enabled: true\n" });
		const rootResult = await registry.register(root(rootDir));
		expect(rootResult.created).toBe(true);
		expect(rootResult.proposal.outcome).toBe("applied");
		expect(rootResult.variant.depth).toBe(0);
		expect(fs.existsSync(path.join(variantConfigDir(jobsDir, rootResult.variant.id), "AGENTS.md"))).toBe(true);
		// Immutable: snapshot files are read-only.
		expect(fs.statSync(path.join(variantConfigDir(jobsDir, rootResult.variant.id), "AGENTS.md")).mode & 0o222).toBe(
			0,
		);

		const noop = await registry.register(
			parseVariantRequest({ mutation: "autonomous", parentId: rootResult.variant.id, configDir: rootDir }),
		);
		expect(noop.created).toBe(false);
		expect(noop.proposal.outcome).toBe("noop");
		expect(noop.variant.id).toBe(rootResult.variant.id);
		expect(noop.proposal.candidateVariantId).toBe(rootResult.variant.id);

		const childDir = agentDir({ "AGENTS.md": "base\nplus\n", "config.yml": "retry:\n  enabled: true\n" });
		const child = await registry.register(
			parseVariantRequest({
				mutation: "revision",
				parentId: rootResult.variant.id,
				configDir: childDir,
				strategy: "s",
				directive: "d",
				expectedSignals: ["tool:read", "mark:x", "tool:read"],
			}),
		);
		expect(child.created).toBe(true);
		expect(child.variant.id).not.toBe(rootResult.variant.id);
		expect(child.variant.parentId).toBe(rootResult.variant.id);
		expect(child.variant.depth).toBe(1);
		expect(child.variant.changedFiles).toEqual(["AGENTS.md"]);
		expect(child.variant.expectedSignals).toEqual(["mark:x", "tool:read"]);
		const diff = fs.readFileSync(child.variant.diffPath, "utf8");
		expect(diff).toContain("+plus");
		expect(child.variant.sourceRef).toBe(rootResult.variant.sourceRef);
		expect(store.evo.listProposals(rootResult.variant.id).map(p => p.outcome)).toEqual([
			"applied",
			"noop",
			"applied",
		]);
		expect(store.evo.listVariants().map(v => v.id)).toEqual([rootResult.variant.id, child.variant.id]);
	});

	it("records apply failures without creating a variant", async () => {
		const { store, registry } = await setup();
		const rootResult = await registry.register(root(agentDir({ "AGENTS.md": "a" })));
		const bad = agentDir({ "config.yml": "a: [1" });
		try {
			await registry.register(
				parseVariantRequest({ mutation: "manual", parentId: rootResult.variant.id, configDir: bad }),
			);
			throw new Error("expected failure");
		} catch (err) {
			expect((err as { status?: number }).status).toBe(422);
			expect((err as Error).message).toMatch(/malformed YAML/);
		}
		expect(store.evo.listVariants()).toHaveLength(1);
		const failed = store.evo.listProposals(rootResult.variant.id).filter(p => p.outcome === "apply_failed");
		expect(failed).toHaveLength(1);
		expect(failed[0].candidateVariantId).toBeNull();
	});

	it("keeps the recipient as parent for crossover and records the donor separately", async () => {
		const { registry } = await setup();
		const a = await registry.register(root(agentDir({ "AGENTS.md": "a" })));
		const donor = await registry.register(
			parseVariantRequest({
				mutation: "manual",
				parentId: a.variant.id,
				configDir: agentDir({ "AGENTS.md": "donor" }),
			}),
		);
		const cross = await registry.register(
			parseVariantRequest({
				mutation: "crossover",
				parentId: a.variant.id,
				donorVariantId: donor.variant.id,
				configDir: agentDir({ "AGENTS.md": "a", "rules/x.md": "from donor" }),
			}),
		);
		expect(cross.variant.parentId).toBe(a.variant.id);
		expect(cross.variant.donorVariantId).toBe(donor.variant.id);
	});

	it("rejects invalid boundaries with exact errors", () => {
		expect(() => parseVariantRequest({ mutation: "bogus", configDir: "/x" })).toThrow(
			"variant.mutation must be one of root|autonomous|revision|crossover|manual",
		);
		expect(() => parseVariantRequest({ mutation: "root", parentId: "p", configDir: "/x" })).toThrow(
			"variant.parentId must be omitted for a root variant",
		);
		expect(() => parseVariantRequest({ mutation: "root" })).toThrow(
			"variant.configDir is required for a root variant",
		);
		expect(() => parseVariantRequest({ mutation: "revision" })).toThrow(
			"variant.parentId is required for a revision variant",
		);
		expect(() => parseVariantRequest({ mutation: "crossover", parentId: "p" })).toThrow(
			"variant.donorVariantId is required for a crossover variant",
		);
		expect(() => parseVariantRequest({ mutation: "revision", parentId: "p", donorVariantId: "d" })).toThrow(
			"variant.donorVariantId is only valid for a crossover variant",
		);
		expect(() => parseVariantRequest({ mutation: "root", configDir: "/x", surprise: 1 })).toThrow(
			"variant: unknown field 'surprise'",
		);
		expect(() => parseVariantRequest({ mutation: "root", configDir: "/x", expectedSignals: ["nope"] })).toThrow(
			/expectedSignals entry 'nope'/,
		);
	});

	it("gives a source variant its own identity via a clean worktree", async () => {
		const { registry, source } = await setup();
		const cfg = agentDir({ "AGENTS.md": "a" });
		const base = await registry.register(root(cfg));
		write(source, "a.txt", "two\n");
		await git(source, "add", "-A");
		await git(source, "commit", "-q", "-m", "second");
		const wt = path.join(tmp("evo-wt-"), "wt");
		await git(source, "worktree", "add", "-q", "--detach", wt, "HEAD");
		cleanups.push(() => Bun.spawnSync(["git", "worktree", "remove", "--force", wt], { cwd: source }));
		const sourceVariant = await registry.register(
			parseVariantRequest({ mutation: "manual", parentId: base.variant.id, configDir: cfg, sourceWorktree: wt }),
		);
		expect(sourceVariant.created).toBe(true);
		expect(sourceVariant.variant.sourceRef).not.toBe(base.variant.sourceRef);
		expect(sourceVariant.variant.snapshotPath).toBe(wt);
		expect(sourceVariant.variant.changedFiles).toContain("src:a.txt");
		// Dirty worktrees are refused.
		write(wt, "dirty.txt", "x");
		await expect(
			registry.register(
				parseVariantRequest({ mutation: "manual", parentId: base.variant.id, configDir: cfg, sourceWorktree: wt }),
			),
		).rejects.toThrow(/source worktree must be clean/);
	});
});

describe("source identity", () => {
	it("hashes dirty tracked and untracked content and is stable", async () => {
		const src = await makeSource();
		const clean = await sourceIdentity(src);
		expect(clean.dirtyHash).toBeNull();
		write(src, "a.txt", "changed\n");
		const dirty1 = await sourceIdentity(src);
		expect(dirty1.dirtyHash).toMatch(/^[0-9a-f]{64}$/);
		expect((await sourceIdentity(src)).dirtyHash).toBe(dirty1.dirtyHash);
		write(src, "new.txt", "untracked one\n");
		const dirty2 = await sourceIdentity(src);
		expect(dirty2.dirtyHash).not.toBe(dirty1.dirtyHash);
		write(src, "new.txt", "untracked two\n");
		expect((await sourceIdentity(src)).dirtyHash).not.toBe(dirty2.dirtyHash);
		expect(formatSourceIdentity(clean)).toBe(clean.ref);
		await expect(sourceIdentity(path.join(src, "nope"))).rejects.toThrow(/does not exist/);
	});
});

describe("suites", () => {
	const manifest = {
		id: "search-1",
		split: "search",
		benchmark: "harbor",
		dataset: "terminal-bench@2.0",
		include: ["t1", "t2"],
		attempts: 2,
		timeoutMultiplier: 1,
		model: "onara/cc/claude-sonnet-5-5",
		thinking: "medium",
		environment: "docker",
	};

	it("snapshots immutable manifests and rejects changed content under an existing id", async () => {
		const registry = new SuiteRegistry(tmp());
		const first = await registry.register(manifest);
		expect(first.created).toBe(true);
		expect((await registry.register(manifest)).created).toBe(false);
		await expect(registry.register({ ...manifest, attempts: 3 })).rejects.toThrow(
			/already exists with different content/,
		);
		expect((await registry.get("search-1"))?.hash).toBe(first.suite.hash);
		expect((await registry.list()).map(s => s.manifest.id)).toEqual(["search-1"]);
		expect(await registry.get("../etc")).toBeNull();
	});

	it("rejects implicit sampling and malformed fields with exact errors", async () => {
		const registry = new SuiteRegistry(tmp());
		const reject = (patch: Record<string, unknown>, message: string) =>
			expect(registry.register({ ...manifest, ...patch })).rejects.toThrow(message);
		await reject({ include: [] }, "suite.include must name at least one task");
		await reject({ include: undefined }, "suite.include must be an array of non-empty strings");
		await reject({ include: ["a", "a"] }, "suite.include must not contain duplicate task IDs");
		await reject({ split: "dev" }, "suite.split must be one of search|heldout");
		await reject({ benchmark: "edit" }, "suite.benchmark must be one of harbor");
		await reject({ attempts: 0 }, "suite.attempts must be a positive integer");
		await reject({ timeoutMultiplier: 0 }, "suite.timeoutMultiplier must be a positive number");
		await reject({ thinking: "wild" }, "suite.thinking must be one of off|minimal|low|medium|high|xhigh|max");
		await reject({ environment: "k8s" }, "suite.environment must be one of docker|apple-container");
		await reject({ extra: 1 }, "suite: unknown field 'extra'");
		await expect(registry.register([])).rejects.toThrow("suite must be a JSON object");
	});
});

describe("EvoStore schema", () => {
	it("rejects unknown proposal outcomes at the database", () => {
		const jobsDir = tmp();
		const store = new RunStore(jobsDir);
		cleanups.push(() => store.close());
		expect(store.evo).toBeInstanceOf(EvoStore);
		expect(() =>
			store.evo.insertProposal({
				id: "p",
				parentId: null,
				candidateVariantId: null,
				mutation: "root",
				donorVariantId: null,
				outcome: "bogus" as never,
				detail: "",
				createdAt: 0,
			}),
		).toThrow();
	});
});

describe("snapshot bounds", () => {
	it("exports conservative caps and rejects per-file, total, and file-count overflow with stable errors", async () => {
		expect(MAX_CONFIG_FILE_BYTES).toBeLessThanOrEqual(1024 * 1024);
		expect(MAX_CONFIG_TOTAL_BYTES).toBeLessThanOrEqual(16 * 1024 * 1024);
		expect(MAX_CONFIG_FILES).toBeLessThanOrEqual(2000);
		const limits = { maxFiles: 3, maxFileBytes: 10, maxTotalBytes: 15 };
		await expect(collectConfig(agentDir({ "AGENTS.md": "x".repeat(11) }), limits)).rejects.toThrow(
			"file AGENTS.md exceeds 10 bytes",
		);
		await expect(
			collectConfig(agentDir({ "AGENTS.md": "x".repeat(8), "rules/a.md": "y".repeat(8) }), limits),
		).rejects.toThrow("config exceeds 15 total bytes");
		await expect(
			collectConfig(agentDir({ "AGENTS.md": "a", "rules/a.md": "a", "rules/b.md": "a", "rules/c.md": "a" }), limits),
		).rejects.toThrow("config exceeds 3 files");
		// At the limit is accepted (negative control for off-by-one).
		expect(await collectConfig(agentDir({ "AGENTS.md": "x".repeat(10) }), limits)).toHaveLength(1);
	});

	it("surfaces an over-limit snapshot as a recorded apply_failed proposal", async () => {
		const { store, registry } = await setup();
		const huge = agentDir({ "AGENTS.md": "x".repeat(MAX_CONFIG_FILE_BYTES + 1) });
		await expect(registry.register(root(huge))).rejects.toThrow(/exceeds/);
		expect(store.evo.listVariants()).toHaveLength(0);
	});
});

describe("materialization failures", () => {
	it("records apply_failed, removes the partial variant dir, and inserts no variant", async () => {
		const jobsDir = tmp("evo-jobs-");
		const store = new RunStore(jobsDir);
		cleanups.push(() => store.close());
		const source = await makeSource();
		let failingDir = "";
		const registry = new VariantRegistry(store.evo, jobsDir, source, async dir => {
			failingDir = dir;
			throw new Error("disk full");
		});
		await expect(registry.register(root(agentDir({ "AGENTS.md": "a" })))).rejects.toThrow("disk full");
		expect(failingDir).not.toBe("");
		expect(fs.existsSync(failingDir)).toBe(false);
		expect(store.evo.listVariants()).toHaveLength(0);
		const proposals = (store.evo as unknown as { listProposals(id: string): unknown }).listProposals;
		expect(typeof proposals).toBe("function");
		// A retry on the same content succeeds: no debris blocks it.
		const ok = await new VariantRegistry(store.evo, jobsDir, source).register(root(agentDir({ "AGENTS.md": "a" })));
		expect(ok.created).toBe(true);
	});

	it("turns a conflicting target path (file where the dir must go) into apply_failed", async () => {
		const { jobsDir, store, registry } = await setup();
		const cfg = agentDir({ "AGENTS.md": "a" });
		const first = await registry.register(root(cfg));
		const childCfg = agentDir({ "AGENTS.md": "b" });
		// Pre-create a regular file where the child's config dir must be created, after cleanup removes it.
		const blocked = new VariantRegistry(
			store.evo,
			jobsDir,
			first.variant.sourceRef && (await makeSource()),
			async dir => {
				fs.rmSync(dir, { recursive: true, force: true });
				fs.writeFileSync(dir, "not a dir");
			},
		);
		await expect(
			blocked.register(parseVariantRequest({ mutation: "manual", parentId: first.variant.id, configDir: childCfg })),
		).rejects.toMatchObject({ status: 422 });
		expect(store.evo.listVariants()).toHaveLength(1);
		expect(store.evo.listProposals(first.variant.id).filter(p => p.outcome === "apply_failed")).toHaveLength(1);
		expect(
			fs.existsSync(path.join(jobsDir, "_evo", "variants")) &&
				fs.readdirSync(path.join(jobsDir, "_evo", "variants")).length,
		).toBe(1);
	});
});
