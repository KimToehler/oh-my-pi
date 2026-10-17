/**
 * Run-owned, read-only copy of a source worktree. The container mounts this tree instead of the live
 * checkout, so what executes is exactly what `sourceIdentity` hashed: tracked files at their worktree
 * state, untracked non-ignored files, and the gitignored native addons.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { NATIVE_ADDON_DIR, listNativeAddons } from "./source-identity";

export interface StagedSource {
	/** Staged tree root (read-only). */
	dir: string;
	/** Repo-relative path -> sha256 of the staged bytes (`link:<target>` for symlinks). */
	manifest: Record<string, string>;
}

const sha256 = (data: Uint8Array | string): string => new Bun.CryptoHasher("sha256").update(data).digest("hex");

/** Remove a previously staged tree, restoring write permission on its read-only dirs first. */
export async function removeStagedSource(dir: string): Promise<void> {
	const walk = async (current: string): Promise<void> => {
		const stat = await fs.lstat(current).catch(() => null);
		if (!stat?.isDirectory()) return;
		await fs.chmod(current, 0o755);
		for (const entry of await fs.readdir(current)) await walk(path.join(current, entry));
	};
	await walk(dir);
	await fs.rm(dir, { recursive: true, force: true });
}

/** Linux addon the container loads for `arch`; staging refuses the launch when it is absent. */
function assertContainerAddon(addons: string[], arch: string, root: string): void {
	const prefix = `pi_natives.linux-${arch}`;
	if (addons.some(rel => path.basename(rel).startsWith(prefix))) return;
	throw new Error(
		`native addon ${NATIVE_ADDON_DIR}/${prefix}*.node is missing from ${root}; build it before launching a source run`,
	);
}

async function stageOne(root: string, dest: string, rel: string): Promise<string | null> {
	const src = path.join(root, rel);
	const stat = await fs.lstat(src).catch(() => null);
	if (!stat) return null; // tracked file deleted in the worktree: absent from the staged tree too
	const out = path.join(dest, rel);
	await fs.mkdir(path.dirname(out), { recursive: true });
	if (stat.isSymbolicLink()) {
		const target = await fs.readlink(src);
		await fs.symlink(target, out);
		return `link:${target}`;
	}
	if (!stat.isFile()) return null; // submodule gitlinks and other non-files carry no bytes
	const bytes = await fs.readFile(src);
	await Bun.write(out, bytes);
	await fs.chmod(out, stat.mode & 0o111 ? 0o555 : 0o444);
	return sha256(bytes);
}

export interface StageOptions {
	/** Git worktree root to copy from. */
	root: string;
	/** Destination dir; replaced when it exists. */
	dest: string;
	/** Container architecture; its `pi_natives.linux-<arch>*.node` addon must exist. */
	arch: "arm64" | "x64";
	/** Repo-relative dirs that must exist as mount points (shadowed `node_modules`). */
	mountDirs: string[];
}

export async function stageSource(opts: StageOptions): Promise<StagedSource> {
	const root = await fs.realpath(opts.root);
	const repo = vcs.requireGit(root);
	const addons = await listNativeAddons(root);
	assertContainerAddon(addons, opts.arch, root);
	await removeStagedSource(opts.dest);
	await fs.mkdir(opts.dest, { recursive: true });
	const tracked = await repo.lsFiles(false, false);
	const untracked = await repo.lsFiles(true, true);
	const manifest: Record<string, string> = {};
	for (const rel of new Set([...tracked, ...untracked, ...addons])) {
		const digest = await stageOne(root, opts.dest, rel);
		if (digest !== null) manifest[rel] = digest;
	}
	for (const rel of opts.mountDirs) await fs.mkdir(path.join(opts.dest, rel), { recursive: true });
	// Read-only: deepest dirs first so every chmod still has a searchable parent.
	const dirs = new Set<string>([opts.dest, ...opts.mountDirs.map(rel => path.join(opts.dest, rel))]);
	for (const rel of Object.keys(manifest)) {
		for (let dir = path.dirname(path.join(opts.dest, rel)); dir !== opts.dest; dir = path.dirname(dir)) dirs.add(dir);
	}
	for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await fs.chmod(dir, 0o555);
	return { dir: opts.dest, manifest };
}

/** Re-hash the staged tree against its manifest; returns the paths that differ, appeared or vanished. */
export async function verifyStagedSource(staged: StagedSource): Promise<string[]> {
	const bad: string[] = [];
	for (const [rel, expected] of Object.entries(staged.manifest)) {
		const file = path.join(staged.dir, rel);
		const stat = await fs.lstat(file).catch(() => null);
		let actual: string | null = null;
		if (stat?.isSymbolicLink()) actual = `link:${await fs.readlink(file)}`;
		else if (stat?.isFile()) actual = sha256(await fs.readFile(file));
		if (actual !== expected) bad.push(rel);
	}
	return bad;
}
