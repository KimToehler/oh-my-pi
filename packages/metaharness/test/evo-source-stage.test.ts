import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { formatSourceIdentity, parseRegisteredIdentity, sourceIdentity } from "../src/evo/source-identity";
import {
	assertSourceClean,
	assertStagedMatchesRegistered,
	removeStagedSource,
	stageSource,
	verifyStagedSource,
} from "../src/evo/source-stage";
import { listInventory, readManifestEntry } from "../src/evo/execution-manifest";
import { buildMountsJson } from "../src/runner";
import "./registry-stub";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
	for (const fn of cleanups.splice(0)) await fn();
});

const ADDON_DIR = "packages/natives/native";
const ADDON = `${ADDON_DIR}/pi_natives.linux-arm64.node`;

function tmp(prefix: string): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
	cleanups.push(() => removeStagedSource(dir));
	return dir;
}

function write(dir: string, rel: string, content: string | Uint8Array): void {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), content);
}

async function git(cwd: string, ...args: string[]): Promise<void> {
	const proc = Bun.spawn(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
		cwd,
		stdout: "ignore",
		stderr: "pipe",
	});
	if ((await proc.exited) !== 0) throw new Error(`git ${args.join(" ")}: ${await new Response(proc.stderr).text()}`);
}

/** Repo with a gitignored linux-arm64 addon, like the real tree (`.gitignore: *.node`). */
async function makeRepo(addon: string | null = "addon-v1"): Promise<string> {
	const dir = tmp("evo-stage-");
	await git(dir, "init", "-q", "-b", "main");
	write(dir, ".gitignore", "*.node\n");
	write(dir, "a.txt", "one\n");
	write(dir, "src/b.ts", "export const b = 1;\n");
	await git(dir, "add", "-A");
	await git(dir, "commit", "-q", "-m", "init");
	if (addon !== null) write(dir, ADDON, addon);
	return dir;
}

describe("source identity covers native addons", () => {
	it("gives different identities to roots that differ only in *.node bytes", async () => {
		const a = await makeRepo("addon-v1");
		const b = await makeRepo("addon-v2");
		// Same tree, same commit: force the same HEAD so only addon bytes can differ.
		const head = (await sourceIdentity(a)).ref;
		const idA = await sourceIdentity(a);
		const idB = await sourceIdentity(b);
		expect(head).toMatch(/^[0-9a-f]{40,64}$/);
		expect(idA.dirtyHash).toMatch(/^[0-9a-f]{64}$/);
		expect(idB.dirtyHash).toMatch(/^[0-9a-f]{64}$/);
		expect(idA.dirtyHash).not.toBe(idB.dirtyHash);
		// Same addon bytes: stable.
		write(b, ADDON, "addon-v1");
		expect((await sourceIdentity(b)).dirtyHash).toBe(idA.dirtyHash);
		// Mutating an addon after identity changes the identity.
		write(a, ADDON, "addon-v3");
		expect(formatSourceIdentity(await sourceIdentity(a))).not.toContain(idA.dirtyHash as string);
	});

	it("keeps a clean tree without addons clean", async () => {
		const dir = await makeRepo(null);
		// R80 hardening: even a clean tree carries the manifest hash, and the identity round-trips with `+<hash>`.
		const id = await sourceIdentity(dir);
		expect(id.dirtyHash).toMatch(/^[0-9a-f]{64}$/);
		expect(formatSourceIdentity(id)).toBe(`${id.ref}+${id.dirtyHash}`);
	});
});

describe("stageSource", () => {
	it("copies worktree content for tracked (incl. unstaged edits), untracked and addon files", async () => {
		const root = await makeRepo();
		write(root, "a.txt", "edited, unstaged\n");
		write(root, "new.txt", "untracked\n");
		write(root, "ignored.log", "ignored\n");
		write(root, ".gitignore", "*.node\n*.log\n");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: ["node_modules"], secrets: [] });
		expect(fs.readFileSync(path.join(dest, "a.txt"), "utf8")).toBe("edited, unstaged\n");
		expect(fs.readFileSync(path.join(dest, "src/b.ts"), "utf8")).toBe("export const b = 1;\n");
		expect(fs.readFileSync(path.join(dest, "new.txt"), "utf8")).toBe("untracked\n");
		expect(fs.readFileSync(path.join(dest, ADDON), "utf8")).toBe("addon-v1");
		// R80: every gitignored file outside node_modules is staged (and hashed), not just addons.
		expect(fs.readFileSync(path.join(dest, "ignored.log"), "utf8")).toBe("ignored\n");
		expect(fs.statSync(path.join(dest, "node_modules")).isDirectory()).toBe(true);
		expect(staged.manifest.map(entry => entry.path)).toContain(ADDON);
	});

	it("is read-only and detects tampering", async () => {
		const root = await makeRepo();
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		expect(fs.statSync(path.join(dest, "a.txt")).mode & 0o222).toBe(0);
		expect(fs.statSync(dest).mode & 0o222).toBe(0);
		expect(await verifyStagedSource(staged)).toEqual([]);
		fs.chmodSync(path.join(dest, "src"), 0o755);
		fs.chmodSync(path.join(dest, "src/b.ts"), 0o644);
		fs.writeFileSync(path.join(dest, "src/b.ts"), "tampered");
		expect(await verifyStagedSource(staged)).toEqual(["src/b.ts"]);
	});

	it("refuses the launch when the container addon is missing", async () => {
		const root = await makeRepo(null);
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] })).rejects.toThrow(
			/pi_natives\.linux-arm64.*missing/,
		);
		expect(fs.existsSync(dest)).toBe(false);
		// An addon for the other platform does not satisfy the requirement.
		write(root, `${ADDON_DIR}/pi_natives.darwin-arm64.node`, "mac");
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] })).rejects.toThrow(/missing/);
	});

	it("staged identity inputs equal the live identity: mounts target the staged dir", async () => {
		const root = await makeRepo();
		const dest = path.join(tmp("evo-stage-dest-"), "_bench", "job", "source");
		await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		const mounts = JSON.parse(
			buildMountsJson({ arch: "arm64", depsDir: "/deps", nodeModules: ["node_modules"], stagedDir: dest }) ?? "[]",
		) as Array<{ source: string; target: string }>;
		const src = mounts.find(m => m.target === "/opt/omp/src");
		expect(src?.source).toBe(dest);
		expect(mounts.some(m => m.source === root)).toBe(false);
	});
});

const SECRET = "sk-r77-forwarded-secret-0123456789";
describe("R80 gitignored generated files", () => {
	async function makeGenRepo(genBytes: string): Promise<string> {
		const root = await makeRepo();
		write(root, ".gitignore", "*.node\ngen/\nnode_modules/\n.env\n");
		await git(root, "add", ".gitignore");
		await git(root, "commit", "-q", "-m", "ignore gen");
		write(root, "gen/out.js", genBytes);
		return root;
	}

	it("stages ignored gen/out.js and hashes its bytes", async () => {
		const a = await makeGenRepo("v1");
		const b = await makeGenRepo("v2");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root: a, dest, arch: "arm64", mountDirs: [], secrets: [] });
		expect(fs.readFileSync(path.join(dest, "gen/out.js"), "utf8")).toBe("v1");
		expect(staged.manifest.map(entry => entry.path)).toContain("gen/out.js");
		const idA = await sourceIdentity(a);
		const idB = await sourceIdentity(b);
		// Positive control: identity is exactly the staged manifest hash.
		expect(staged.manifestHash).toBe(idA.dirtyHash as string);
		expect(idA.dirtyHash).not.toBe(idB.dirtyHash);
		write(b, "gen/out.js", "v1");
		expect((await sourceIdentity(b)).dirtyHash).toBe(idA.dirtyHash);
	});

	it("excludes node_modules at any depth from staging and identity", async () => {
		const root = await makeGenRepo("v1");
		const before = await sourceIdentity(root);
		write(root, "node_modules/x/index.js", "one");
		write(root, "pkg/node_modules/y.js", "two");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		expect(fs.existsSync(path.join(dest, "node_modules"))).toBe(false);
		expect(fs.existsSync(path.join(dest, "pkg"))).toBe(false);
		expect(staged.manifest.map(entry => entry.path).some(rel => rel.includes("node_modules"))).toBe(false);
		expect((await sourceIdentity(root)).dirtyHash).toBe(before.dirtyHash);
		write(root, "node_modules/x/index.js", "changed");
		write(root, "pkg/node_modules/y.js", "changed");
		expect((await sourceIdentity(root)).dirtyHash).toBe(before.dirtyHash);
	});

	it("refuses staging when an ignored file holds a forwarded secret", async () => {
		const root = await makeGenRepo("v1");
		write(root, ".env", `TOKEN=${SECRET}\n`);
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [SECRET] })).rejects.toThrow(
			/embeds a host credential/,
		);
		expect(fs.existsSync(dest)).toBe(false);
		await expect(assertSourceClean(root, [SECRET])).rejects.toThrow(/embeds a host credential/);
	});
});

describe("R77 staged tree hardening", () => {
	it("refuses an untracked file holding a forwarded value and stages nothing", async () => {
		const root = await makeRepo();
		write(root, "secret.env", `KEY=${SECRET}\n`);
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const err = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [SECRET] }).then(
			() => undefined,
			(e: unknown) => e as Error,
		);
		expect(err?.message).toContain("secret.env");
		expect(err?.message).not.toContain(SECRET);
		expect(fs.existsSync(dest)).toBe(false);
		await expect(assertSourceClean(root, [SECRET])).rejects.toThrow("secret.env");
	});

	it("refuses a path component carrying the value without echoing it", async () => {
		const root = await makeRepo();
		write(root, `dir-${SECRET}/x.txt`, "x");
		const err = await assertSourceClean(root, [SECRET]).then(
			() => undefined,
			(e: unknown) => e as Error,
		);
		expect(err?.message).toContain("dir-***");
		expect(err?.message).not.toContain(SECRET);
	});

	it("clean control: a tree without the value stages", async () => {
		const root = await makeRepo();
		write(root, "ok.env", "KEY=other\n");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [SECRET] });
		expect(fs.existsSync(path.join(dest, "ok.env"))).toBe(true);
	});

	it("scans the bytes it copies: a file turning credential-bearing after enumeration never reaches the tree", async () => {
		const root = await makeRepo();
		write(root, "late.txt", "clean\n");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		// Swap the file to credential-bearing content right after its first read. A stager that scans in one pass
		// and copies in a second reads the clean bytes, then copies the swapped ones; only a scan of the exact bytes
		// being written can refuse it.
		const realReadFile = fsp.readFile;
		let reads = 0;
		const spy = spyOn(fsp, "readFile").mockImplementation((async (
			file: Parameters<typeof fsp.readFile>[0],
			...rest: unknown[]
		) => {
			const result = await (realReadFile as (...args: unknown[]) => Promise<unknown>)(file, ...rest);
			if (String(file).endsWith(`${path.sep}late.txt`) && !String(file).startsWith(dest) && ++reads === 1) {
				fs.writeFileSync(path.join(root, "late.txt"), `KEY=${SECRET}\n`);
			}
			return result;
		}) as typeof fsp.readFile);
		let staged = false;
		try {
			await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [SECRET] });
			staged = true;
		} catch (err) {
			expect((err as Error).message).not.toContain(SECRET);
		} finally {
			spy.mockRestore();
		}
		expect(reads).toBeGreaterThanOrEqual(1);
		// Either outcome is safe (refused, or staged the scanned clean bytes); the secret must never land in the tree.
		if (staged) expect(fs.readFileSync(path.join(dest, "late.txt"), "utf8")).toBe("clean\n");
		else expect(fs.existsSync(dest)).toBe(false);
	});

	it("reports a file added to the staged tree, a chmod, and a non-empty mount dir", async () => {
		const root = await makeRepo();
		write(root, "run.sh", "#!/bin/sh\n");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: ["pkg/node_modules"], secrets: [] });
		expect(await verifyStagedSource(staged)).toEqual([]);
		fs.chmodSync(path.join(dest, "pkg/node_modules"), 0o755);
		write(dest, "pkg/node_modules/planted.js", "x");
		fs.chmodSync(dest, 0o755);
		write(dest, "added.txt", "new");
		fs.chmodSync(path.join(dest, "src"), 0o755);
		fs.symlinkSync("/etc/passwd", path.join(dest, "src/link"));
		fs.chmodSync(path.join(dest, "run.sh"), 0o755);
		const bad = await verifyStagedSource(staged);
		expect(bad.sort()).toEqual(["added.txt", "pkg/node_modules/planted.js", "run.sh", "src/link"]);
	});

	it("reports a chmod alone", async () => {
		const root = await makeRepo();
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		fs.chmodSync(path.join(dest, "a.txt"), 0o755);
		expect(await verifyStagedSource(staged)).toEqual(["a.txt"]);
	});

	it("gives different identities to the same bytes with a different exec bit", async () => {
		const a = await makeRepo();
		const b = await makeRepo();
		write(a, "tool.sh", "same");
		write(b, "tool.sh", "same");
		expect((await sourceIdentity(a)).dirtyHash).toBe((await sourceIdentity(b)).dirtyHash);
		fs.chmodSync(path.join(b, "tool.sh"), 0o755);
		expect((await sourceIdentity(a)).dirtyHash).not.toBe((await sourceIdentity(b)).dirtyHash);
		const before = (await sourceIdentity(a)).dirtyHash;
		fs.chmodSync(path.join(a, ADDON), 0o755);
		expect((await sourceIdentity(a)).dirtyHash).not.toBe(before);
	});
});

describe("R80 canonical execution manifest", () => {
	async function makeGenRepo(): Promise<string> {
		const root = await makeRepo();
		write(root, ".gitignore", "*.node\nruns/\n.worktrees/\nnode_modules/\n");
		await git(root, "add", ".gitignore");
		await git(root, "commit", "-q", "-m", "ignore");
		return root;
	}

	it("identity equals the staged manifestHash for the same root", async () => {
		const root = await makeGenRepo();
		write(root, "new.txt", "untracked\n");
		const staged = await stageSource({
			root,
			dest: path.join(tmp("evo-stage-dest-"), "source"),
			arch: "arm64",
			mountDirs: [],
			secrets: [],
		});
		expect((await sourceIdentity(root)).dirtyHash).toBe(staged.manifestHash);
		await assertStagedMatchesRegistered(staged, formatSourceIdentity(await sourceIdentity(root)), root);
	});

	it("refuses a file mutated during the copy and restored afterwards", async () => {
		const root = await makeGenRepo();
		write(root, "late.txt", "v1\n");
		const registered = await sourceIdentity(root);
		// Mutated before staging reads it, restored right after the copy read it: the live identity matches the
		// registered one again, but the staged bytes are ones the identity never saw.
		write(root, "late.txt", "v2\n");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const realReadFile = fsp.readFile;
		const spy = spyOn(fsp, "readFile").mockImplementation((async (
			file: Parameters<typeof fsp.readFile>[0],
			...rest: unknown[]
		) => {
			const result = await (realReadFile as (...args: unknown[]) => Promise<unknown>)(file, ...rest);
			if (String(file) === path.join(root, "late.txt")) fs.writeFileSync(path.join(root, "late.txt"), "v1\n");
			return result;
		}) as typeof fsp.readFile);
		let staged: Awaited<ReturnType<typeof stageSource>>;
		try {
			staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		} finally {
			spy.mockRestore();
		}
		expect(fs.readFileSync(path.join(dest, "late.txt"), "utf8")).toBe("v2\n");
		expect(await sourceIdentity(root)).toEqual(registered);
		await expect(assertStagedMatchesRegistered(staged, formatSourceIdentity(registered), root)).rejects.toThrow(
			"staged source bytes differ from the registered identity",
		);
	});

	it("index history does not change the staged hash", async () => {
		const a = await makeGenRepo();
		const b = await makeGenRepo();
		write(a, "a.txt", "final\n");
		write(b, "a.txt", "final\n");
		await git(b, "add", "a.txt");
		const dest = () => path.join(tmp("evo-stage-dest-"), "source");
		const sa = await stageSource({ root: a, dest: dest(), arch: "arm64", mountDirs: [], secrets: [] });
		const sb = await stageSource({ root: b, dest: dest(), arch: "arm64", mountDirs: [], secrets: [] });
		expect(sa.manifestHash).toBe(sb.manifestHash);
	});

	it("excludes runs/, .worktrees/ and nested node_modules from staging and identity", async () => {
		const root = await makeGenRepo();
		const before = await sourceIdentity(root);
		write(root, "runs/job/out.log", "a");
		write(root, ".worktrees/w/file.txt", "b");
		write(root, "pkg/node_modules/y.js", "c");
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] });
		for (const dir of ["runs", ".worktrees", "pkg"]) expect(fs.existsSync(path.join(dest, dir))).toBe(false);
		expect(staged.manifest.some(entry => /^(runs|\.worktrees)\/|node_modules/.test(entry.path))).toBe(false);
		expect(await sourceIdentity(root)).toEqual(before);
	});

	it("refuses a FIFO in identity and staging, naming the path", async () => {
		const root = await makeGenRepo();
		const mk = Bun.spawnSync(["mkfifo", path.join(root, "pipe.fifo")]);
		expect(mk.exitCode).toBe(0);
		await expect(sourceIdentity(root)).rejects.toThrow(/unsupported file type.*pipe\.fifo/);
		const dest = path.join(tmp("evo-stage-dest-"), "source");
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [], secrets: [] })).rejects.toThrow(
			/pipe\.fifo/,
		);
		expect(fs.existsSync(dest)).toBe(false);
	});
});

describe("R80 hardening", () => {
	const dest = () => path.join(tmp("evo-stage-dest-"), "source");
	const stage = (root: string, secrets: string[] = []) =>
		stageSource({ root, dest: dest(), arch: "arm64", mountDirs: [], secrets });

	async function gitOut(cwd: string, ...args: string[]): Promise<string> {
		const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
		const out = await new Response(proc.stdout).text();
		if ((await proc.exited) !== 0)
			throw new Error(`git ${args.join(" ")}: ${await new Response(proc.stderr).text()}`);
		return out.trim();
	}

	it("gives different identities to trees whose bytes differ under an assume-unchanged path", async () => {
		const a = await makeRepo();
		const b = await makeRepo();
		const before = (await sourceIdentity(a)).dirtyHash;
		expect((await sourceIdentity(b)).dirtyHash).toBe(before);
		for (const root of [a, b]) await git(root, "update-index", "--assume-unchanged", "a.txt");
		write(b, "a.txt", "hidden edit\n");
		// git status is blind to the edit; the manifest reads the worktree bytes.
		expect(await gitOut(b, "status", "--porcelain")).toBe("");
		expect((await sourceIdentity(b)).dirtyHash).not.toBe((await sourceIdentity(a)).dirtyHash);
	});

	it("refuses a bare-ref registration with a re-register error, and a registered HEAD that moved", async () => {
		const root = await makeRepo();
		const id = await sourceIdentity(root);
		const staged = await stage(root);
		expect(() => parseRegisteredIdentity(id.ref)).toThrow(/re-register/);
		await expect(assertStagedMatchesRegistered(staged, id.ref, root)).rejects.toThrow(/re-register/);
		const wrongRef = `${"0".repeat(40)}+${id.dirtyHash}`;
		await expect(assertStagedMatchesRegistered(staged, wrongRef, root)).rejects.toThrow(/registered 0{40}/);
		await assertStagedMatchesRegistered(staged, formatSourceIdentity(id), root);
	});

	it("refuses paths that collide under case folding, naming both", async () => {
		const root = await makeRepo();
		const blob = await gitOut(root, "hash-object", "-w", "a.txt");
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},A.txt`);
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},a.txt`);
		await expect(sourceIdentity(root)).rejects.toThrow(/collide.*(A\.txt and a\.txt|a\.txt and A\.txt)/);
		await expect(stage(root)).rejects.toThrow(/collide/);
		// Negative control: names that differ beyond folding are fine.
		await git(root, "update-index", "--force-remove", "A.txt");
		write(root, "a.txt", "one\n");
		await sourceIdentity(root);
	});

	it("refuses an NFC/NFD collision (fake repo: git itself may precompose names on macOS)", async () => {
		const fake = {
			lsFiles: async (others: boolean) => (others ? [] : ["caf\u00e9.txt", "cafe\u0301.txt"]),
			submodulePaths: async () => [],
		};
		await expect(listInventory(fake as never, r => r, new Set())).rejects.toThrow(/collide/);
		// Negative control: distinct names pass.
		const ok = { ...fake, lsFiles: async (others: boolean) => (others ? [] : ["cafe.txt", "cafe\u0301.txt"]) };
		expect((await listInventory(ok as never, r => r, new Set())).paths).toHaveLength(2);
	});

	it("propagates a non-ENOENT lstat error instead of treating the path as absent", async () => {
		const root = await makeRepo();
		fs.chmodSync(path.join(root, "src"), 0o000);
		let probe: unknown;
		try {
			probe = await readManifestEntry(root, "src/b.ts", new Set(), r => r).catch((err: unknown) => err);
		} finally {
			fs.chmodSync(path.join(root, "src"), 0o755);
		}
		expect((probe as NodeJS.ErrnoException).code).toBe("EACCES");
		// Negative control: a path that really is absent is skipped.
		expect(await readManifestEntry(root, "src/gone.ts", new Set(), r => r)).toBeNull();
	});

	async function withSubmodule(): Promise<string> {
		const root = await makeRepo();
		const sub = tmp("evo-sub-");
		await git(sub, "init", "-q", "-b", "main");
		write(sub, "s.txt", "sub\n");
		await git(sub, "add", "-A");
		await git(sub, "commit", "-q", "-m", "sub");
		await git(root, "-c", "protocol.file.allow=always", "submodule", "add", "-q", sub, "vendor/sub");
		await git(root, "commit", "-q", "-m", "add sub");
		return root;
	}

	it("does not refuse a FIFO inside a confirmed submodule, and skips the submodule", async () => {
		const root = await withSubmodule();
		expect(Bun.spawnSync(["mkfifo", path.join(root, "vendor/sub/pipe.fifo")]).exitCode).toBe(0);
		const staged = await stage(root);
		expect(staged.manifest.some(entry => entry.path.startsWith("vendor/sub"))).toBe(false);
		await sourceIdentity(root);
		// Negative control: the same FIFO outside the submodule refuses.
		expect(Bun.spawnSync(["mkfifo", path.join(root, "vendor/outer.fifo")]).exitCode).toBe(0);
		await expect(sourceIdentity(root)).rejects.toThrow(/outer\.fifo/);
	});

	it("refuses a directory in the inventory that is not an index gitlink", async () => {
		const root = await makeRepo();
		// Tracked regular file replaced by a populated directory: a gitlink would be skipped, this must not be.
		fs.rmSync(path.join(root, "a.txt"));
		fs.mkdirSync(path.join(root, "a.txt"));
		write(root, "a.txt/x.txt", "x");
		await expect(sourceIdentity(root)).rejects.toThrow(/not an index gitlink: a\.txt/);
		await expect(stage(root)).rejects.toThrow(/not an index gitlink: a\.txt/);
	});

	it("refuses a tracked file under a reserved harness root, naming it", async () => {
		const root = await makeRepo();
		for (const reserved of ["runs", ".worktrees", ".worktree", ".wt"]) {
			const blob = await gitOut(root, "hash-object", "-w", "a.txt");
			await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},${reserved}/tracked.txt`);
			write(root, `${reserved}/tracked.txt`, "x");
			await expect(sourceIdentity(root)).rejects.toThrow(
				`reserved harness namespace (runs, .worktrees, .worktree, .wt): ${reserved}/tracked.txt`,
			);
			await git(root, "update-index", "--force-remove", `${reserved}/tracked.txt`);
		}
		// Negative control: untracked files there stay excluded, not refused.
		write(root, "runs/untracked.log", "x");
		await sourceIdentity(root);
	});

	it("redacts credential values out of every inventory error that names a path", async () => {
		const secret = "sk-evo-secret-value-1234567890";
		const root = await makeRepo();
		const blob = await gitOut(root, "hash-object", "-w", "a.txt");
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},dir-${secret}`);
		fs.mkdirSync(path.join(root, `dir-${secret}`));
		const refusals = async (r: string): Promise<string> =>
			String(((await assertSourceClean(r, [secret]).catch((err: unknown) => err)) as Error).message);
		const dirErr = await refusals(root);
		expect(dirErr).toContain("not an index gitlink");
		expect(dirErr).not.toContain(secret);
		expect(dirErr).toContain("***");
		await git(root, "update-index", "--force-remove", `dir-${secret}`);
		fs.rmdirSync(path.join(root, `dir-${secret}`));
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},A-${secret}.txt`);
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},a-${secret}.txt`);
		const collide = await refusals(root);
		expect(collide).toContain("collide");
		expect(collide).not.toContain(secret);
		expect(Bun.spawnSync(["mkfifo", path.join(root, `fifo-${secret}`)]).exitCode).toBe(0);
		await git(root, "update-index", "--force-remove", `A-${secret}.txt`);
		await git(root, "update-index", "--force-remove", `a-${secret}.txt`);
		const fifo = await refusals(root);
		expect(fifo).toContain("unsupported file type");
		expect(fifo).not.toContain(secret);
		fs.rmSync(path.join(root, `fifo-${secret}`));
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},runs/${secret}.txt`);
		const reserved = await refusals(root);
		expect(reserved).toContain("reserved harness namespace");
		expect(reserved).not.toContain(secret);
		await git(root, "update-index", "--force-remove", `runs/${secret}.txt`);
		await git(root, "update-index", "--add", "--cacheinfo", `100644,${blob},plain.txt`);
		// listInventory takes the same redactor directly.
		const inv = await listInventory((await import("@oh-my-pi/pi-natives/vcs")).requireGit(root), r => r, new Set());
		expect(inv.paths).toContain("plain.txt");
	});

	it("assertSourceClean returns the manifest hash of the bytes it scanned, with or without secrets", async () => {
		const root = await makeRepo();
		const id = await sourceIdentity(root);
		expect(await assertSourceClean(root, [])).toBe(id.dirtyHash as string);
		expect(await assertSourceClean(root, ["unrelated-secret-value-xyz"])).toBe(id.dirtyHash as string);
		write(root, "a.txt", "changed\n");
		expect(await assertSourceClean(root, [])).not.toBe(id.dirtyHash as string);
	});

	it("skips a deinitialized gitlink (empty or missing directory) but refuses a populated non-gitlink", async () => {
		const root = await withSubmodule();
		const before = (await sourceIdentity(root)).dirtyHash;
		// Deinitialized: directory emptied, then removed outright.
		fs.rmSync(path.join(root, "vendor/sub"), { recursive: true, force: true });
		fs.mkdirSync(path.join(root, "vendor/sub"));
		const empty = await stage(root);
		expect(empty.manifest.some(entry => entry.path.startsWith("vendor/sub"))).toBe(false);
		fs.rmdirSync(path.join(root, "vendor/sub"));
		expect((await sourceIdentity(root)).dirtyHash).toBe(before ?? "");
		// Without a .gitmodules entry the index still says gitlink.
		fs.rmSync(path.join(root, ".gitmodules"));
		fs.mkdirSync(path.join(root, "vendor/sub"));
		await sourceIdentity(root);
		// Negative control: a populated plain directory over a regular tracked path is not a gitlink.
		write(root, "plain/x.txt", "x");
		await git(root, "add", "plain/x.txt");
		fs.rmSync(path.join(root, "plain/x.txt"));
		fs.mkdirSync(path.join(root, "plain/x.txt"));
		await expect(sourceIdentity(root)).rejects.toThrow(/not an index gitlink: plain\/x\.txt/);
	});

	it("catches full-fold and compatibility collisions (ss vs SS, fi ligature vs fi)", async () => {
		const mk = (names: string[]) => ({
			lsFiles: async (others: boolean) => (others ? [] : names),
		});
		for (const pair of [
			["stra\u00dfe.txt", "STRASSE.txt"],
			["\ufb01le.txt", "file.txt"],
			["\uff21.txt", "A.txt"],
		]) {
			await expect(listInventory(mk(pair) as never, r => r, new Set())).rejects.toThrow(/collide/);
		}
		// Negative control: unrelated names pass.
		expect((await listInventory(mk(["strasse.txt", "other.txt"]) as never, r => r, new Set())).paths).toHaveLength(2);
	});

	it("redacts a raw filesystem error naming a secret path, keeping code and attaching no unredacted cause", async () => {
		const secret = "sk-evo-secret-value-1234567890";
		const root = await makeRepo();
		write(root, `d-${secret}/f.txt`, "x");
		fs.chmodSync(path.join(root, `d-${secret}`), 0o000);
		let err: unknown;
		try {
			err = await assertSourceClean(root, [secret]).catch((e: unknown) => e);
		} finally {
			fs.chmodSync(path.join(root, `d-${secret}`), 0o755);
		}
		expect(err).toBeInstanceOf(Error);
		expect((err as NodeJS.ErrnoException).code).toBe("EACCES");
		expect((err as Error).message).not.toContain(secret);
		expect((err as Error).message).toContain("***");
		expect((err as Error).cause).toBeUndefined();
		expect(Bun.inspect(err)).not.toContain(secret);
	});
});
