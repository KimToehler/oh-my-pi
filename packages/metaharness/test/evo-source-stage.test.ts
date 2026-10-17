import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { formatSourceIdentity, sourceIdentity } from "../src/evo/source-identity";
import { assertSourceClean, removeStagedSource, stageSource, verifyStagedSource } from "../src/evo/source-stage";
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
		expect((await sourceIdentity(dir)).dirtyHash).toBeNull();
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
		expect(fs.existsSync(path.join(dest, "ignored.log"))).toBe(false);
		expect(fs.statSync(path.join(dest, "node_modules")).isDirectory()).toBe(true);
		expect(Object.keys(staged.manifest)).toContain(ADDON);
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
