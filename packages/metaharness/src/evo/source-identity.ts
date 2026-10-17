/** Source identity of a git worktree: HEAD plus a hash of dirty tracked/untracked content and native addons. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";

/** Repo-relative dir holding the gitignored native addons the agent loads at runtime. */
export const NATIVE_ADDON_DIR = "packages/natives/native";

/** Repo-relative paths (sorted) of every `*.node` addon under {@link NATIVE_ADDON_DIR} in `root`. */
export async function listNativeAddons(root: string): Promise<string[]> {
	const entries = await fs.readdir(path.join(root, NATIVE_ADDON_DIR)).catch(() => [] as string[]);
	return entries
		.filter(name => name.endsWith(".node"))
		.sort()
		.map(name => `${NATIVE_ADDON_DIR}/${name}`);
}

export interface SourceIdentity {
	/** `git rev-parse HEAD`. */
	ref: string;
	/** SHA-256 of the tracked diff, untracked file names/content and native addon bytes; null when clean with no addons. */
	dirtyHash: string | null;
}

/** Compact `<ref>` / `<ref>+<dirtyHash>` form used on runner flags and in error messages. */
export function formatSourceIdentity(identity: SourceIdentity): string {
	return identity.dirtyHash ? `${identity.ref}+${identity.dirtyHash}` : identity.ref;
}

export function parseSourceIdentity(text: string): SourceIdentity {
	const plus = text.indexOf("+");
	const ref = plus === -1 ? text : text.slice(0, plus);
	const dirtyHash = plus === -1 ? null : text.slice(plus + 1);
	if (!/^[0-9a-f]{40,64}$/.test(ref) || (dirtyHash !== null && !/^[0-9a-f]{64}$/.test(dirtyHash))) {
		throw new Error(`invalid source identity: ${text}`);
	}
	return { ref, dirtyHash };
}

/** True when the worktree has no staged, unstaged or untracked non-ignored changes (addons not considered). */
export async function isTreeClean(root: string): Promise<boolean> {
	return (await vcs.requireGit(root).statusPorcelain({ untracked: "all" })).trim() === "";
}

/** Compute the identity of the git worktree rooted exactly at `root`. */
export async function sourceIdentity(root: string): Promise<SourceIdentity> {
	const real = await fs.realpath(root).catch(() => {
		throw new Error(`source root does not exist: ${root}`);
	});
	const repo = vcs.git(real);
	if (!repo || path.resolve(repo.info().repoRoot) !== real) {
		throw new Error(`source root is not a git worktree root: ${root}`);
	}
	const ref = await repo.headSha();
	if (!ref) throw new Error(`source root has no HEAD commit: ${root}`);
	const status = await repo.statusPorcelain({ untracked: "all" });
	const addons = await listNativeAddons(real);
	if (status.trim() === "" && addons.length === 0) return { ref, dirtyHash: null };
	const hasher = new Bun.CryptoHasher("sha256");
	// Length-framed sections in fixed order: staged (index vs HEAD), unstaged (worktree vs index).
	// Hashing the two sides separately (not one worktree-vs-HEAD diff) keeps a staged edit that was
	// later overwritten in the worktree distinguishable.
	for (const [label, options] of [
		["staged", { cached: true, binary: true }],
		["unstaged", { binary: true }],
	] as const) {
		const text = await repo.diffText(options);
		hasher.update(`${label}${Buffer.byteLength(text)}:`);
		hasher.update(text);
	}
	// Every field is framed as `<byte length>:<bytes>` so no path or content can imitate a delimiter.
	const frame = (label: string, data: string | Uint8Array): void => {
		const bytes = typeof data === "string" ? Buffer.from(data) : data;
		hasher.update(`${label}${bytes.byteLength}:`);
		hasher.update(bytes);
	};
	const untracked = (await repo.lsFiles(true, true)).sort();
	hasher.update(`untracked-count${untracked.length}:`);
	for (const rel of untracked) {
		frame("path", rel);
		const stat = await fs.lstat(path.join(real, rel)).catch(() => null);
		if (!stat) {
			frame("type", "missing");
		} else if (stat.isSymbolicLink()) {
			frame("type", "symlink");
			frame("content", await fs.readlink(path.join(real, rel)));
		} else if (stat.isFile()) {
			frame("type", "file");
			frame("exec", stat.mode & 0o111 ? "1" : "0");
			frame("content", await fs.readFile(path.join(real, rel)));
		} else {
			frame("type", "other");
		}
	}
	// Gitignored native addons are executed from the source tree, so their bytes are identity.
	hasher.update(`native-count${addons.length}:`);
	for (const rel of addons) {
		frame("path", rel);
		const mode = (await fs.stat(path.join(real, rel))).mode;
		frame("exec", mode & 0o111 ? "1" : "0");
		frame("content", await fs.readFile(path.join(real, rel)));
	}
	return { ref, dirtyHash: hasher.digest("hex") };
}
