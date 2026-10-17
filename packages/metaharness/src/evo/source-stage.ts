/**
 * Run-owned, read-only copy of a source worktree. The container mounts this tree instead of the live
 * checkout, so what executes is exactly what `sourceIdentity` hashed: tracked files at their worktree
 * state, untracked non-ignored files, and the gitignored native addons.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { EvoHttpError } from "./boundary";
import { redactSecrets, textCarriesSecret } from "./credential-scan";
import { NATIVE_ADDON_DIR, listNativeAddons } from "./source-identity";

export interface StagedSource {
	/** Staged tree root (read-only). */
	dir: string;
	/** Repo-relative path -> `<sha256>:x|-` of the staged bytes and exec bit (`link:<target>` for symlinks). */
	manifest: Record<string, string>;
	/** Repo-relative mount points that exist as empty dirs; the only entries besides manifest files. */
	mountDirs: string[];
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

/** `<sha256>:x` / `<sha256>:-`: the exec bit is part of what runs, so the manifest (and verify) carries it. */
const fileDigest = (bytes: Uint8Array, mode: number): string => `${sha256(bytes)}:${mode & 0o111 ? "x" : "-"}`;

/** Exactly the paths `stageSource` copies: tracked, untracked non-ignored and native addons (sorted, unique). */
async function candidatePaths(root: string): Promise<{ rels: string[]; addons: string[] }> {
	const repo = vcs.requireGit(root);
	const addons = await listNativeAddons(root);
	const tracked = await repo.lsFiles(false, false);
	const untracked = await repo.lsFiles(true, true);
	return { rels: [...new Set([...tracked, ...untracked, ...addons])].sort(), addons };
}

/**
 * Throw 422 when any candidate path component, file body or symlink target carries a host credential value.
 * Messages name the file only (path redacted), never the value. Call before any byte is staged or persisted.
 */
export async function assertSourceClean(root: string, secrets: readonly string[]): Promise<void> {
	const values = secrets.filter(value => value.length > 0);
	if (values.length === 0) return;
	const real = await fs.realpath(root);
	const decoder = new TextDecoder();
	for (const rel of (await candidatePaths(real)).rels) {
		if (textCarriesSecret(rel, values) || rel.split("/").some(part => textCarriesSecret(part, values))) {
			throw new EvoHttpError(
				422,
				`source path ${redactSecrets(rel, values)} embeds a host credential value; rename it (the value must not appear in a filename)`,
			);
		}
		const stat = await fs.lstat(path.join(real, rel)).catch(() => null);
		let body: string | null = null;
		if (stat?.isSymbolicLink()) body = await fs.readlink(path.join(real, rel));
		else if (stat?.isFile()) body = decoder.decode(await fs.readFile(path.join(real, rel)));
		if (body !== null && textCarriesSecret(body, values)) {
			throw new EvoHttpError(
				422,
				`source file ${rel} embeds a host credential value; remove it or add the file to .gitignore before launching`,
			);
		}
	}
}

async function stageOne(root: string, dest: string, rel: string): Promise<string | null> {
	const src = path.join(root, rel);
	const stat = await fs.lstat(src).catch(() => null);
	if (!stat) return null; // tracked file deleted in the worktree: absent from the staged tree too
	const out = path.join(dest, rel);
	if (stat.isSymbolicLink()) {
		const target = await fs.readlink(src);
		await fs.mkdir(path.dirname(out), { recursive: true });
		await fs.symlink(target, out);
		return `link:${target}`;
	}
	if (!stat.isFile()) return null; // submodule gitlinks and other non-files carry no bytes (and no empty parent dirs)
	const bytes = await fs.readFile(src);
	await fs.mkdir(path.dirname(out), { recursive: true });
	await Bun.write(out, bytes);
	await fs.chmod(out, stat.mode & 0o111 ? 0o555 : 0o444);
	return fileDigest(bytes, stat.mode);
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
	/** Host credential values the staged tree must not carry; a hit refuses staging before any byte is written. */
	secrets: readonly string[];
}

export async function stageSource(opts: StageOptions): Promise<StagedSource> {
	const root = await fs.realpath(opts.root);
	const { rels, addons } = await candidatePaths(root);
	assertContainerAddon(addons, opts.arch, root);
	await assertSourceClean(root, opts.secrets);
	await removeStagedSource(opts.dest);
	try {
		await fs.mkdir(opts.dest, { recursive: true });
		const manifest: Record<string, string> = {};
		for (const rel of rels) {
			const digest = await stageOne(root, opts.dest, rel);
			if (digest !== null) manifest[rel] = digest;
		}
		for (const rel of opts.mountDirs) await fs.mkdir(path.join(opts.dest, rel), { recursive: true });
		// Read-only: deepest dirs first so every chmod still has a searchable parent.
		const dirs = new Set<string>([opts.dest, ...opts.mountDirs.map(rel => path.join(opts.dest, rel))]);
		for (const rel of Object.keys(manifest)) {
			for (let dir = path.dirname(path.join(opts.dest, rel)); dir !== opts.dest; dir = path.dirname(dir))
				dirs.add(dir);
		}
		for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await fs.chmod(dir, 0o555);
		return { dir: opts.dest, manifest, mountDirs: [...opts.mountDirs] };
	} catch (err) {
		await removeStagedSource(opts.dest);
		throw err;
	}
}

/** Repo-relative ancestors of `rel` (excluding `rel` itself and the root). */
function ancestors(rel: string): string[] {
	const out: string[] = [];
	for (let dir = path.dirname(rel); dir !== "." && dir !== "/"; dir = path.dirname(dir)) out.push(dir);
	return out;
}

/**
 * Compare the staged tree with its manifest exactly: same path set, same bytes, same exec bit. Only the declared
 * mount dirs (empty) and the directories leading to manifest entries or mount dirs may exist besides the files.
 * Returns the offending paths: changed, vanished, added files/symlinks, unexpected or non-empty dirs.
 */
export async function verifyStagedSource(staged: StagedSource): Promise<string[]> {
	const bad = new Set<string>();
	for (const [rel, expected] of Object.entries(staged.manifest)) {
		const file = path.join(staged.dir, rel);
		const stat = await fs.lstat(file).catch(() => null);
		let actual: string | null = null;
		if (stat?.isSymbolicLink()) actual = `link:${await fs.readlink(file)}`;
		else if (stat?.isFile()) actual = fileDigest(await fs.readFile(file), stat.mode);
		if (actual !== expected) bad.add(rel);
	}
	const mounts = staged.mountDirs.map(dir => path.normalize(dir));
	const expectedDirs = new Set<string>();
	for (const rel of [...Object.keys(staged.manifest), ...mounts])
		for (const dir of ancestors(rel)) expectedDirs.add(dir);
	for (const dir of mounts) expectedDirs.add(dir);
	const walk = async (rel: string): Promise<void> => {
		for (const entry of await fs.readdir(path.join(staged.dir, rel), { withFileTypes: true })) {
			const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				if (expectedDirs.has(child)) await walk(child);
				else bad.add(child);
			} else if (!(child in staged.manifest)) {
				bad.add(child);
			}
		}
	};
	await walk("").catch(() => bad.add("."));
	return [...bad];
}
