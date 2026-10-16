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
import { withDirLock } from "../src/evo/dir-lock";
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

describe("symlink target checks", () => {
	const SENTINEL = "sentinel-secret-bytes-ABCDEF123456";

	function rootWith(files: Record<string, string>): string {
		return agentDir(files);
	}

	it("rejects file symlinks that alias root models.yml or .env, naming the logical path only", async () => {
		for (const secret of ["models.yml", ".env", "nested/models.yaml"]) {
			const dir = rootWith({ "AGENTS.md": "x", [secret]: SENTINEL });
			fs.mkdirSync(path.join(dir, "rules"));
			fs.symlinkSync(path.join(dir, secret), path.join(dir, "rules", "forwarded.md"));
			const err = await collectConfig(dir).catch((e: Error) => e);
			expect((err as Error).message).toBe("symlink target is secret-bearing: rules/forwarded.md");
			expect((err as Error).message).not.toContain(SENTINEL);
		}
	});

	it("rejects symlinked directories that land on state dirs and nested forbidden segments", async () => {
		for (const state of ["sessions", "cache"]) {
			const dir = rootWith({ "AGENTS.md": "x", [`${state}/a.md`]: "state" });
			fs.symlinkSync(path.join(dir, state), path.join(dir, "skills"));
			await expect(collectConfig(dir)).rejects.toThrow("symlink target is excluded state: skills");
		}
		const nested = rootWith({ "AGENTS.md": "x", "private/models.yml/sub/a.md": SENTINEL });
		fs.symlinkSync(path.join(nested, "private", "models.yml", "sub"), path.join(nested, "agents"));
		await expect(collectConfig(nested)).rejects.toThrow("symlink target is secret-bearing: agents");
		// A directory symlink whose children contain a secret is rejected by the recursive walk.
		const holder = rootWith({ "AGENTS.md": "x", "bundle/models.yml": SENTINEL, "bundle/a.md": "a" });
		fs.symlinkSync(path.join(holder, "bundle"), path.join(holder, "extensions"));
		await expect(collectConfig(holder)).rejects.toThrow("secret-bearing path not allowed: extensions/models.yml");
		// A symlinked directory below a secret-named parent segment is rejected by segment.
		const parent = rootWith({ "AGENTS.md": "x", "auth.json/inner/x.md": "i" });
		fs.symlinkSync(path.join(parent, "auth.json", "inner"), path.join(parent, "rules"));
		await expect(collectConfig(parent)).rejects.toThrow("symlink target is secret-bearing: rules");
	});

	it("still dereferences safe in-root symlinks with stable hashes", async () => {
		const dir = rootWith({ "AGENTS.md": "x", "shared/rule.md": "shared\n", "shared/more/a.md": "a\n" });
		fs.mkdirSync(path.join(dir, "rules"));
		fs.symlinkSync(path.join(dir, "shared", "rule.md"), path.join(dir, "rules", "alias.md"));
		fs.symlinkSync(path.join(dir, "shared", "more"), path.join(dir, "skills"));
		const files = await collectConfig(dir);
		expect(files.map(f => f.rel)).toEqual(["AGENTS.md", "rules/alias.md", "skills/a.md"]);
		expect(hashConfig(files)).toBe(hashConfig(await collectConfig(dir)));
		const copy = rootWith({ "AGENTS.md": "x", "rules/alias.md": "shared\n", "skills/a.md": "a\n" });
		expect(hashConfig(await collectConfig(copy))).toBe(hashConfig(files));
	});

	it("a rejected alias records apply_failed and leaves no secret bytes or diff on disk", async () => {
		const { jobsDir, store, registry } = await setup();
		const base = await registry.register(root(agentDir({ "AGENTS.md": "base" })));
		const bad = rootWith({ "AGENTS.md": "x", "models.yml": SENTINEL });
		fs.mkdirSync(path.join(bad, "rules"));
		fs.symlinkSync(path.join(bad, "models.yml"), path.join(bad, "rules", "forwarded.md"));
		const err = await registry
			.register(parseVariantRequest({ mutation: "manual", parentId: base.variant.id, configDir: bad }))
			.catch((e: Error) => e);
		expect((err as { status?: number }).status).toBe(422);
		expect((err as Error).message).toBe("symlink target is secret-bearing: rules/forwarded.md");
		expect(store.evo.listVariants()).toHaveLength(1);
		const failed = store.evo.listProposals(base.variant.id).filter(p => p.outcome === "apply_failed");
		expect(failed).toHaveLength(1);
		expect(failed[0].detail).not.toContain(SENTINEL);
		const leaked: string[] = [];
		const scan = (dir: string): void => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) scan(full);
				else if (entry.isFile() && fs.readFileSync(full).includes(SENTINEL)) leaked.push(full);
			}
		};
		scan(jobsDir);
		expect(leaked).toEqual([]);
		expect(fs.readdirSync(path.join(jobsDir, "_evo", "variants"))).toEqual([base.variant.id]);
		expect(fs.readdirSync(path.join(jobsDir, "_evo", "tmp")).length).toBe(0);
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

	it("hashes staged-only edits, distinguishes them, and separates staged from unstaged content", async () => {
		const stagedHash = async (content: string): Promise<string | null> => {
			const src = await makeSource();
			write(src, "a.txt", content);
			await git(src, "add", "a.txt");
			return (await sourceIdentity(src)).dirtyHash;
		};
		const one = await stagedHash("staged one\n");
		const two = await stagedHash("staged two\n");
		expect(one).toMatch(/^[0-9a-f]{64}$/);
		expect(two).toMatch(/^[0-9a-f]{64}$/);
		expect(one).not.toBe(two);
		// Same final worktree bytes, different staging: must not collide.
		const mixed = await makeSource();
		write(mixed, "a.txt", "final\n");
		const unstagedOnly = (await sourceIdentity(mixed)).dirtyHash;
		await git(mixed, "add", "a.txt");
		const stagedOnly = (await sourceIdentity(mixed)).dirtyHash;
		write(mixed, "a.txt", "other\n");
		await git(mixed, "add", "a.txt");
		write(mixed, "a.txt", "final\n");
		const stagedThenReverted = (await sourceIdentity(mixed)).dirtyHash;
		expect(new Set([unstagedOnly, stagedOnly, stagedThenReverted]).size).toBe(3);
	});

	it("frames untracked paths and content so delimiter-shaped names cannot collide", async () => {
		const hashFor = async (files: Record<string, string>): Promise<string | null> => {
			const src = await makeSource();
			for (const [rel, content] of Object.entries(files)) write(src, rel, content);
			return (await sourceIdentity(src)).dirtyHash;
		};
		// Under the old `\0untracked\0<path>\0<content>` scheme these two byte streams were identical.
		const a = await hashFor({ x: "\0untracked\0y\0z" });
		const b = await hashFor({ "x\0untracked\0y": "z" }).catch(() => null);
		const c = await hashFor({ p: "q", r: "" });
		const d = await hashFor({ p: "", qr: "" });
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		if (b !== null) expect(a).not.toBe(b);
		expect(c).not.toBe(d);
		// Content moving across the path boundary changes the hash.
		expect(await hashFor({ ab: "c" })).not.toBe(await hashFor({ a: "bc" }));
		// A symlink and a regular file with the same target text differ by type.
		const link = await makeSource();
		fs.symlinkSync("target-text", path.join(link, "l"));
		const file = await makeSource();
		write(file, "l", "target-text");
		expect((await sourceIdentity(link)).dirtyHash).not.toBe((await sourceIdentity(file)).dirtyHash);
	});

	it("detects a staged change made after registration as drift", async () => {
		const { registry, source } = await setup();
		const cfg = agentDir({ "AGENTS.md": "a" });
		const wtParent = tmp("evo-wt-");
		const wt = path.join(wtParent, "wt");
		await git(source, "worktree", "add", "-q", "--detach", wt, "HEAD");
		cleanups.push(() => Bun.spawnSync(["git", "worktree", "remove", "--force", wt], { cwd: source }));
		const base = await registry.register(root(cfg));
		const registered = await registry.register(
			parseVariantRequest({
				mutation: "manual",
				parentId: base.variant.id,
				configDir: agentDir({ "AGENTS.md": "b" }),
				sourceWorktree: wt,
			}),
		);
		const expected = formatSourceIdentity({
			ref: registered.variant.sourceRef,
			dirtyHash: registered.variant.sourceDirtyHash,
		});
		expect(formatSourceIdentity(await sourceIdentity(wt))).toBe(expected);
		write(wt, "a.txt", "staged after registration\n");
		await git(wt, "add", "a.txt");
		expect(formatSourceIdentity(await sourceIdentity(wt))).not.toBe(expected);
	});
});

describe("suite identities", () => {
	it("preserves the original explicit include strings", async () => {
		const registry = new SuiteRegistry(tmp());
		const { suite } = await registry.register({
			id: "orgs",
			split: "search",
			benchmark: "harbor",
			dataset: "d",
			include: ["org-a/foo", "org-b/bar"],
			attempts: 1,
			timeoutMultiplier: 1,
			model: "m/x",
			thinking: "low",
			environment: "docker",
		});
		expect(suite.manifest.include).toEqual(["org-a/foo", "org-b/bar"]);
		expect((await registry.get("orgs"))?.manifest.include).toEqual(["org-a/foo", "org-b/bar"]);
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

	it("publishes concurrently created manifests atomically: identical is idempotent, conflicting is 409", async () => {
		const dir = tmp();
		const registries = [
			new SuiteRegistry(dir),
			new SuiteRegistry(dir),
			new SuiteRegistry(dir),
			new SuiteRegistry(dir),
		];
		const same = await Promise.all(registries.map(r => r.register(manifest)));
		expect(same.filter(r => r.created)).toHaveLength(1);
		expect(new Set(same.map(r => r.suite.hash)).size).toBe(1);
		const conflicting = { ...manifest, id: "search-2" };
		const mixed = await Promise.allSettled([
			registries[0].register(conflicting),
			registries[1].register({ ...conflicting, attempts: 9 }),
			registries[2].register(conflicting),
			registries[3].register({ ...conflicting, attempts: 9 }),
		]);
		const winners = mixed.filter(r => r.status === "fulfilled");
		const losers = mixed.filter(r => r.status === "rejected") as PromiseRejectedResult[];
		expect(winners.length + losers.length).toBe(4);
		expect(losers.length).toBeGreaterThan(0);
		for (const loser of losers) {
			expect((loser.reason as { status?: number }).status).toBe(409);
			expect((loser.reason as Error).message).toBe("suite 'search-2' already exists with different content");
		}
		// Exactly one content survives, complete and readable; no temp files remain.
		const stored = await registries[0].get("search-2");
		expect(stored?.hash).toBeDefined();
		expect(fs.readdirSync(path.join(dir, "_evo", "suites")).sort()).toEqual(["search-1.json", "search-2.json"]);
	});

	it("rejects implicit sampling and malformed fields with exact errors", async () => {
		const registry = new SuiteRegistry(tmp());
		const reject = (patch: Record<string, unknown>, message: string) =>
			expect(registry.register({ ...manifest, ...patch })).rejects.toThrow(message);
		await reject({ include: [] }, "suite.include must name at least one task");
		await reject({ include: undefined }, "suite.include must be an array of non-empty strings");
		await reject({ include: ["a", "a"] }, "suite.include must not contain duplicate task IDs");
		await reject(
			{ include: ["org-a/foo", "org-b/foo"] },
			"suite.include must not contain task IDs that normalize to the same task name",
		);
		await reject(
			{ include: ["foo", "org/foo"] },
			"suite.include must not contain task IDs that normalize to the same task name",
		);
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

describe("concurrent registration", () => {
	const cfgFiles = { "AGENTS.md": "same\n", "rules/r.md": "r\n" };

	function verifyIntact(jobsDir: string, id: string): void {
		const dir = path.join(jobsDir, "_evo", "variants", id);
		expect(fs.readFileSync(path.join(dir, "config", "AGENTS.md"), "utf8")).toBe("same\n");
		expect(fs.readFileSync(path.join(dir, "config", "rules", "r.md"), "utf8")).toBe("r\n");
		expect(fs.existsSync(path.join(dir, "diff.patch"))).toBe(true);
		expect(fs.readdirSync(path.join(jobsDir, "_evo", "tmp"))).toEqual([]);
	}

	it("serializes identical requests across independent registries: one applied, the rest noop, one variant", async () => {
		const jobsDir = tmp("evo-jobs-");
		const source = await makeSource();
		const stores = [new RunStore(jobsDir), new RunStore(jobsDir), new RunStore(jobsDir)];
		cleanups.push(() => stores.forEach(store => store.close()));
		const registries = stores.map(store => new VariantRegistry(store.evo, jobsDir, source));
		const cfg = agentDir(cfgFiles);
		const results = await Promise.all(registries.map(r => r.register(root(cfg))));
		expect(results.filter(r => r.created)).toHaveLength(1);
		expect(results.map(r => r.proposal.outcome).sort()).toEqual(["applied", "noop", "noop"]);
		expect(new Set(results.map(r => r.variant.id)).size).toBe(1);
		expect(stores[0].evo.listVariants()).toHaveLength(1);
		verifyIntact(jobsDir, results[0].variant.id);
	});

	it("a concurrently failing loser can never remove the winner's published directory", async () => {
		const jobsDir = tmp("evo-jobs-");
		const source = await makeSource();
		const a = new RunStore(jobsDir);
		const b = new RunStore(jobsDir);
		cleanups.push(() => {
			a.close();
			b.close();
		});
		const good = new VariantRegistry(a.evo, jobsDir, source);
		const faulty = new VariantRegistry(b.evo, jobsDir, source, async () => {
			throw new Error("injected");
		});
		const cfg = agentDir(cfgFiles);
		const settled = await Promise.allSettled([good.register(root(cfg)), faulty.register(root(cfg))]);
		const variants = a.evo.listVariants();
		expect(variants).toHaveLength(1);
		verifyIntact(jobsDir, variants[0].id);
		// Whichever order the lock was taken in, the good registry's variant exists and is intact.
		expect(settled[0].status).toBe("fulfilled");
		// Deterministic order: once published, a later faulty registration is a noop and cannot delete it.
		const later = await faulty.register(root(cfg));
		expect(later.proposal.outcome).toBe("noop");
		verifyIntact(jobsDir, variants[0].id);
	});

	function deadPid(): number {
		const child = Bun.spawnSync(["true"]);
		return child.pid;
	}

	function plantLock(lock: string, pid: number | null): void {
		fs.mkdirSync(lock, { recursive: true });
		if (pid !== null) fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid, token: "planted" }));
		const old = new Date(Date.now() - 60 * 60 * 1000);
		fs.utimesSync(lock, old, old);
	}

	it("reclaims a stale lock whose recorded owner PID is dead", async () => {
		const jobsDir = tmp("evo-jobs-");
		const source = await makeSource();
		const store = new RunStore(jobsDir);
		cleanups.push(() => store.close());
		const registry = new VariantRegistry(store.evo, jobsDir, source);
		const cfg = agentDir(cfgFiles);
		const first = await registry.register(root(cfg));
		const lock = path.join(jobsDir, "_evo", "locks", `${first.variant.id}.lock`);
		plantLock(lock, deadPid());
		const again = await registry.register(root(cfg));
		expect(again.proposal.outcome).toBe("noop");
		expect(fs.existsSync(lock)).toBe(false);
		expect(fs.existsSync(`${lock}.breaker`)).toBe(false);
	});

	it("never steals a stale-mtime lock whose owner is alive, has no metadata, or is unknown", async () => {
		const dir = tmp("evo-lock-");
		for (const [name, pid] of [
			["live", process.pid],
			["bare", null],
		] as const) {
			const lock = path.join(dir, `${name}.lock`);
			plantLock(lock, pid);
			await expect(
				withDirLock(lock, async () => "x", { waitMs: 150, staleMs: 1000, pollMs: 5 }),
			).rejects.toMatchObject({
				status: 503,
				message: `timed out waiting for lock ${name}.lock`,
			});
			expect(fs.existsSync(lock)).toBe(true);
			expect(fs.existsSync(`${lock}.breaker`)).toBe(false);
		}
	});

	it("release is ownership-checked: a lock whose token changed is left in place", async () => {
		const dir = tmp("evo-lock-");
		const lock = path.join(dir, "o.lock");
		await withDirLock(lock, async () => {
			fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, token: "someone-else" }));
		});
		expect(fs.existsSync(lock)).toBe(true);
		// Normal release removes the lock.
		const normal = path.join(dir, "n.lock");
		await withDirLock(normal, async () => {
			expect(JSON.parse(fs.readFileSync(path.join(normal, "owner.json"), "utf8")).pid).toBe(process.pid);
		});
		expect(fs.existsSync(normal)).toBe(false);
	});

	it("a held breaker blocks reclaim; a live holder re-acquiring is not disturbed", async () => {
		const dir = tmp("evo-lock-");
		const lock = path.join(dir, "b.lock");
		plantLock(lock, deadPid());
		fs.mkdirSync(`${lock}.breaker`);
		await expect(withDirLock(lock, async () => "x", { waitMs: 100, staleMs: 1000, pollMs: 5 })).rejects.toMatchObject(
			{ status: 503 },
		);
		expect(fs.existsSync(lock)).toBe(true);
		fs.rmSync(`${lock}.breaker`, { recursive: true });
		expect(await withDirLock(lock, async () => "ok", { waitMs: 1000, staleMs: 1000, pollMs: 5 })).toBe("ok");
		expect(fs.existsSync(lock)).toBe(false);
	});
});
