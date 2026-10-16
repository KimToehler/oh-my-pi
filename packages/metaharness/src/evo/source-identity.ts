/** Source identity of a git worktree: HEAD plus a hash of dirty tracked and untracked content. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";

export interface SourceIdentity {
	/** `git rev-parse HEAD`. */
	ref: string;
	/** SHA-256 of the tracked diff against HEAD plus untracked file names/content; null when clean. */
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
	if (status.trim() === "") return { ref, dirtyHash: null };
	const hasher = new Bun.CryptoHasher("sha256");
	// Length-framed sections in fixed order: staged (index vs HEAD), unstaged (worktree vs index).
	// Hashing the two sides separately (not one worktree-vs-HEAD diff) keeps a staged edit that was
	// later overwritten in the worktree distinguishable.
	for (const [label, options] of [
		["staged", { cached: true, binary: true }],
		["unstaged", { binary: true }],
	] as const) {
		const text = await repo.diffText(options);
		hasher.update(`\0${label}\0${Buffer.byteLength(text)}\0`);
		hasher.update(text);
	}
	const untracked = (await repo.lsFiles(true, true)).sort();
	for (const rel of untracked) {
		hasher.update(`\0untracked\0${rel}\0`);
		const abs = path.join(real, rel);
		const stat = await fs.lstat(abs).catch(() => null);
		if (!stat) continue;
		hasher.update(stat.isSymbolicLink() ? await fs.readlink(abs) : stat.isFile() ? await fs.readFile(abs) : "");
	}
	return { ref, dirtyHash: hasher.digest("hex") };
}
