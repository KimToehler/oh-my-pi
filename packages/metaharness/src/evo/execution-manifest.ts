/**
 * Canonical execution manifest: the one derivation of "what runs" for a source worktree. Source identity
 * (`dirtyHash`) and source staging both consume it, so the hash a variant is registered under is by construction the
 * hash of the bytes the container executes.
 *
 * Inventory = sorted union of tracked files at their WORKTREE state (a tracked file deleted in the worktree is
 * absent), untracked non-ignored files, and gitignored files. Index history (staged vs unstaged) is not part of it:
 * only the final bytes are. Excluded: any path with a `node_modules` segment (shadowed by the container deps mounts)
 * and the harness-owned top-level roots `runs/`, `.worktrees/`, `.worktree/`, `.wt/` (job output, sibling worktrees).
 *
 * Entries are regular files (`{path, type: "file", exec, sha256}`) and symlinks (`{path, type: "link", target}`).
 * Sockets, FIFOs and devices, and directory entries reported by `lsFiles` with a trailing `/` (nested repositories),
 * refuse the launch with an error naming the path instead of being dropped silently.
 *
 * Submodule gitlinks are the INDEX entries with mode 160000 (`git ls-files -s -z`), independent of `.gitmodules` and of
 * whether the submodule is checked out. They are SKIPPED, in identity and staging alike because both go through
 * `readManifestEntry`: a gitlink carries no bytes in this repository and its pinned commit is already covered by
 * `ref`. A deinitialized gitlink (empty or missing directory) is skipped too. The special-file walk prunes them. Any
 * other directory in the inventory is refused. Tracked files under a harness-owned root are refused (reserved
 * namespaces). Two distinct paths that fold to the same name (NFKC plus lower or upper case) are refused, because one
 * filesystem could silently merge them. Raw filesystem errors are rewrapped so path bytes are redacted when secrets
 * are known; `code` is preserved, the original error is not attached (its message carries the unredacted path).
 */
import type { VcsGitRepo } from "@oh-my-pi/pi-natives";
import { isEnoent } from "@oh-my-pi/pi-utils";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { redactSecrets } from "./credential-scan";

export type ManifestEntry =
	| { path: string; type: "file"; exec: boolean; sha256: string }
	| { path: string; type: "link"; target: string };

/** What one read of an inventory path saw. */
export type ManifestRead = { kind: "link"; target: string } | { kind: "file"; bytes: Uint8Array; mode: number };

export interface ExecutionManifest {
	/** Sorted by path. */
	entries: ManifestEntry[];
	/** SHA-256 over the length-framed serialization of `entries`. */
	manifestHash: string;
	/** Inventory paths that are gitignored (container addon check) and whether any untracked or ignored path exists. */
	ignored: string[];
	hasUntrackedOrIgnored: boolean;
}

export interface ManifestOptions {
	/** Called with the inventory's gitignored paths before any file is read; throw to refuse early. */
	inspectIgnored?: (ignored: string[]) => void;
	/** Called with the single read of each present entry, before it is added; throw to refuse. */
	visit?: (rel: string, read: ManifestRead) => Promise<void> | void;
	/** Host credential values redacted out of every error that names a path. */
	secrets?: readonly string[];
}

/** Top-level directories owned by the harness; never part of the executed source. */
export const HARNESS_ROOTS = ["runs", ".worktrees", ".worktree", ".wt"] as const;

export const sha256 = (data: Uint8Array | string): string => new Bun.CryptoHasher("sha256").update(data).digest("hex");

/** True for a path under a `node_modules` directory at any depth or under a harness-owned root. */
export function isExcludedPath(rel: string): boolean {
	const parts = rel.replace(/\/$/, "").split("/");
	return parts.includes("node_modules") || isReservedPath(rel);
}

/** True for a path strictly under a harness-owned top-level root. */
export function isReservedPath(rel: string): boolean {
	const parts = rel.replace(/\/$/, "").split("/");
	return parts.length > 1 && (HARNESS_ROOTS as readonly string[]).includes(parts[0]);
}

/**
 * Collision keys: NFKC, then lower and upper case (locale-independent). Two paths collide when either key matches, so
 * full-fold pairs that only meet in upper case (`ß` vs `SS`) and compatibility pairs (`ﬁ` vs `fi`) are caught. This is a
 * deterministic rule rather than a probe of the staging filesystem: identity must not depend on where it is computed.
 */
const foldKeys = (rel: string): [string, string] => {
	const n = rel.normalize("NFKC");
	return [n.toLocaleLowerCase("und"), n.toLocaleUpperCase("und")];
};

/**
 * Rewrap a filesystem error: message redacted and `code` kept (so ENOENT discrimination still works). The original
 * error is deliberately NOT attached as `cause`: its message holds the raw path, and logs print causes.
 */
async function guarded<T>(show: Show, op: () => Promise<T>): Promise<T> {
	try {
		return await op();
	} catch (err) {
		if (!(err instanceof Error)) throw err;
		const wrapped = new Error(show(err.message)) as NodeJS.ErrnoException;
		if ((err as NodeJS.ErrnoException).code !== undefined) wrapped.code = (err as NodeJS.ErrnoException).code;
		throw wrapped;
	}
}

/** Index entries with mode 160000: the only directories (or missing paths) the inventory may skip. */
export async function gitlinkPaths(root: string): Promise<Set<string>> {
	// spawnSync, not Bun.spawn: tests that stub Bun.spawn to fake harbor must not intercept this read.
	const proc = Bun.spawnSync(["git", "ls-files", "-s", "-z"], { cwd: root, maxBuffer: 1 << 30 });
	if (proc.exitCode !== 0)
		throw new Error(`git ls-files -s failed (exit ${proc.exitCode}): ${proc.stderr.toString().trim()}`);
	const out = proc.stdout.toString();
	const links = new Set<string>();
	for (const record of out.split("\0")) {
		const tab = record.indexOf("\t");
		if (tab !== -1 && record.startsWith("160000 ")) links.add(record.slice(tab + 1));
	}
	return links;
}

interface Inventory {
	paths: string[];
	ignored: string[];
	hasUntrackedOrIgnored: boolean;
	/** Index gitlink paths (mode 160000): the only directories allowed in the inventory. */
	submodules: Set<string>;
}

type Show = (rel: string) => string;

/**
 * Git never lists sockets, FIFOs or devices (not even as untracked), so `lsFiles` cannot see them. Walk the worktree,
 * pruning exclusions, `.git` and index gitlinks (never staged), and refuse the first one found.
 */
async function assertNoSpecialFiles(root: string, submodules: Set<string>, show: Show, rel = ""): Promise<void> {
	for (const entry of await guarded(show, () => fs.readdir(path.join(root, rel), { withFileTypes: true }))) {
		const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
		if (entry.name === ".git" || isExcludedPath(child) || submodules.has(child)) continue;
		if (entry.isDirectory()) await assertNoSpecialFiles(root, submodules, show, child);
		else if (!entry.isFile() && !entry.isSymbolicLink()) {
			throw new Error(`source contains an unsupported file type (socket, FIFO or device): ${show(child)}`);
		}
	}
}

/**
 * Sorted union of tracked, untracked and ignored paths minus exclusions. Refuses nested repository directories,
 * tracked files under harness-owned roots, and paths that collide after NFKC plus case folding.
 */
export async function listInventory(repo: VcsGitRepo, show: Show, gitlinks: Set<string>): Promise<Inventory> {
	const [tracked, untrackedRaw, othersRaw] = await Promise.all([
		repo.lsFiles(false, false),
		repo.lsFiles(true, true),
		repo.lsFiles(true, false),
	]);
	const reserved = tracked.find(isReservedPath);
	if (reserved)
		throw new Error(
			`tracked file under a reserved harness namespace (${HARNESS_ROOTS.join(", ")}): ${show(reserved)}`,
		);
	const keep = (list: string[]): string[] => list.filter(rel => !isExcludedPath(rel));
	const untracked = keep(untrackedRaw);
	const visible = new Set(untrackedRaw);
	const ignored = keep(othersRaw.filter(rel => !visible.has(rel)));
	const all = [...keep(tracked), ...untracked, ...ignored];
	const nested = all.find(rel => rel.endsWith("/"));
	if (nested)
		throw new Error(`source contains a nested repository directory, which cannot be staged: ${show(nested)}`);
	const paths = [...new Set(all)].sort();
	const folded = [new Map<string, string>(), new Map<string, string>()];
	for (const rel of paths) {
		foldKeys(rel).forEach((key, i) => {
			const other = folded[i].get(key);
			if (other !== undefined) {
				throw new Error(
					`source paths collide on a case-insensitive or normalizing filesystem: ${show(other)} and ${show(rel)}`,
				);
			}
			folded[i].set(key, rel);
		});
	}
	return {
		paths,
		ignored: ignored.sort(),
		hasUntrackedOrIgnored: untracked.length > 0 || ignored.length > 0,
		submodules: gitlinks,
	};
}

/**
 * One read of an inventory path. Refuses sockets, FIFOs, devices and any directory that is not an index gitlink;
 * returns null for an absent path (ENOENT only; every other error propagates) and for an index gitlink.
 */
export async function readManifestEntry(
	root: string,
	rel: string,
	submodules: Set<string>,
	show: Show,
): Promise<ManifestRead | null> {
	const src = path.join(root, rel);
	let stat: Awaited<ReturnType<typeof fs.lstat>>;
	try {
		stat = await guarded(show, () => fs.lstat(src));
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
	if (stat.isSymbolicLink()) return { kind: "link", target: await guarded(show, () => fs.readlink(src)) };
	if (stat.isDirectory()) {
		if (submodules.has(rel)) return null;
		throw new Error(`source contains a directory that is not an index gitlink: ${show(rel)}`);
	}
	if (!stat.isFile()) {
		throw new Error(`source contains an unsupported file type (socket, FIFO or device): ${show(rel)}`);
	}
	try {
		return { kind: "file", bytes: await guarded(show, () => fs.readFile(src)), mode: stat.mode };
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
}

export function toManifestEntry(rel: string, read: ManifestRead): ManifestEntry {
	if (read.kind === "link") return { path: rel, type: "link", target: read.target };
	return { path: rel, type: "file", exec: (read.mode & 0o111) !== 0, sha256: sha256(read.bytes) };
}

/** Length-framed (`<label><byteLength>:<bytes>`) hash of the sorted entries: no path or target can imitate a delimiter. */
export function hashManifestEntries(entries: readonly ManifestEntry[]): string {
	const hasher = new Bun.CryptoHasher("sha256");
	const frame = (label: string, data: string): void => {
		hasher.update(`${label}${Buffer.byteLength(data)}:`);
		hasher.update(data);
	};
	frame("count", String(entries.length));
	for (const entry of entries) {
		frame("path", entry.path);
		frame("type", entry.type);
		if (entry.type === "file") {
			frame("exec", entry.exec ? "1" : "0");
			frame("sha256", entry.sha256);
		} else {
			frame("target", entry.target);
		}
	}
	return hasher.digest("hex");
}

/** Build the manifest of the worktree rooted at `root` (a realpath'd git worktree root), reading each path once. */
export async function readExecutionManifest(
	root: string,
	repo: VcsGitRepo,
	opts: ManifestOptions = {},
): Promise<ExecutionManifest> {
	const secrets = opts.secrets ?? [];
	const show: Show = rel => redactSecrets(rel, secrets);
	const inventory = await listInventory(repo, show, await gitlinkPaths(root));
	await assertNoSpecialFiles(root, inventory.submodules, show);
	opts.inspectIgnored?.(inventory.ignored);
	const entries: ManifestEntry[] = [];
	for (const rel of inventory.paths) {
		const read = await readManifestEntry(root, rel, inventory.submodules, show);
		if (read === null) continue;
		await opts.visit?.(rel, read);
		entries.push(toManifestEntry(rel, read));
	}
	return {
		entries,
		manifestHash: hashManifestEntries(entries),
		ignored: inventory.ignored,
		hasUntrackedOrIgnored: inventory.hasUntrackedOrIgnored,
	};
}
