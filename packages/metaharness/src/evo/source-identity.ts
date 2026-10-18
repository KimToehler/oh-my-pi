/**
 * Source identity of a git worktree: HEAD plus the hash of the canonical execution manifest (`execution-manifest.ts`),
 * i.e. the exact executed bytes. Identities recorded before the manifest scheme (diff-text based) are invalid.
 */
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { readExecutionManifest } from "./execution-manifest";

/** Written to `runner-config.json` by the runner for every source run; reports refuse a run without it. */
export const SOURCE_IDENTITY_SCHEME = 2;

/** Repo-relative dir holding the gitignored native addons the agent loads at runtime. */
export const NATIVE_ADDON_DIR = "packages/natives/native";

export interface SourceIdentity {
	/** `git rev-parse HEAD`. */
	ref: string;
	/** Execution manifest hash. Null only for a bare-ref (pre-manifest) identity that was parsed, never computed. */
	dirtyHash: string | null;
}

/** Compact `<ref>` / `<ref>+<dirtyHash>` form used on runner flags and in error messages. */
export function formatSourceIdentity(identity: SourceIdentity): string {
	return identity.dirtyHash ? `${identity.ref}+${identity.dirtyHash}` : identity.ref;
}

/** Parse an identity that must carry the manifest hash; a bare ref (older scheme) is refused with a re-register hint. */
export function parseRegisteredIdentity(text: string): SourceIdentity & { dirtyHash: string } {
	const identity = parseSourceIdentity(text);
	if (identity.dirtyHash === null) {
		throw new Error(
			`source identity '${text}' predates the execution-manifest scheme (no manifest hash); re-register the variant`,
		);
	}
	return identity as SourceIdentity & { dirtyHash: string };
}

/** Accepts a bare ref only so callers requiring the current scheme can reject it with a clear error. */
export function parseSourceIdentity(text: string): SourceIdentity {
	const plus = text.indexOf("+");
	const ref = plus === -1 ? text : text.slice(0, plus);
	const dirtyHash = plus === -1 ? null : text.slice(plus + 1);
	if (!/^[0-9a-f]{40,64}$/.test(ref) || (dirtyHash !== null && !/^[0-9a-f]{64}$/.test(dirtyHash))) {
		throw new Error(`invalid source identity: ${text}`);
	}
	return { ref, dirtyHash };
}

/** True when the worktree has no staged, unstaged or untracked non-ignored changes (ignored files not considered). */
export async function isTreeClean(root: string): Promise<boolean> {
	return (await vcs.requireGit(root).statusPorcelain({ untracked: "all" })).trim() === "";
}

/**
 * Compute the identity of the git worktree rooted exactly at `root`. `dirtyHash` is ALWAYS the canonical execution
 * manifest hash (the exact bytes that run and are staged), clean trees included; index history does not matter, and
 * sparse-checkout or `assume-unchanged` files are covered because the manifest reads the actual worktree bytes.
 */
export async function sourceIdentity(
	root: string,
	secrets: readonly string[] = [],
): Promise<SourceIdentity & { dirtyHash: string }> {
	const real = await fs.realpath(root).catch(() => {
		throw new Error(`source root does not exist: ${root}`);
	});
	const repo = vcs.git(real);
	if (!repo || path.resolve(repo.info().repoRoot) !== real) {
		throw new Error(`source root is not a git worktree root: ${root}`);
	}
	const ref = await repo.headSha();
	if (!ref) throw new Error(`source root has no HEAD commit: ${root}`);
	const manifest = await readExecutionManifest(real, repo, { secrets });
	return { ref, dirtyHash: manifest.manifestHash };
}
