import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { formatSourceIdentity, sourceIdentity } from "../src/evo/source-identity";
import { removeStagedSource, stageSource, verifyStagedSource } from "../src/evo/source-stage";
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
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: ["node_modules"] });
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
		const staged = await stageSource({ root, dest, arch: "arm64", mountDirs: [] });
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
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [] })).rejects.toThrow(
			/pi_natives\.linux-arm64.*missing/,
		);
		expect(fs.existsSync(dest)).toBe(false);
		// An addon for the other platform does not satisfy the requirement.
		write(root, `${ADDON_DIR}/pi_natives.darwin-arm64.node`, "mac");
		await expect(stageSource({ root, dest, arch: "arm64", mountDirs: [] })).rejects.toThrow(/missing/);
	});

	it("staged identity inputs equal the live identity: mounts target the staged dir", async () => {
		const root = await makeRepo();
		const dest = path.join(tmp("evo-stage-dest-"), "_bench", "job", "source");
		await stageSource({ root, dest, arch: "arm64", mountDirs: [] });
		const mounts = JSON.parse(
			buildMountsJson({ arch: "arm64", depsDir: "/deps", nodeModules: ["node_modules"], stagedDir: dest }) ?? "[]",
		) as Array<{ source: string; target: string }>;
		const src = mounts.find(m => m.target === "/opt/omp/src");
		expect(src?.source).toBe(dest);
		expect(mounts.some(m => m.source === root)).toBe(false);
	});
});
