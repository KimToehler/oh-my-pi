/** Variant storage layout, worktree containment, and launch-time snapshot integrity. */
import * as nodeFs from "node:fs";
import * as path from "node:path";
import { EvoHttpError } from "./boundary";
import { collectConfigSync, hashConfig } from "./config-snapshot";
import type { SourceIdentity } from "./source-identity";
import type { VariantRow } from "./variant-types";

export function evoRoot(jobsDir: string): string {
	return path.join(jobsDir, "_evo");
}

/** Task-owned git worktrees; the only place a source variant's worktree may live. */
export function worktreesRoot(jobsDir: string): string {
	return path.join(evoRoot(jobsDir), "worktrees");
}

function realpathOr(target: string): string {
	try {
		return nodeFs.realpathSync(target);
	} catch {
		return target;
	}
}

/**
 * Throws unless `worktree` resolves (symlinks followed) inside the realpathed worktrees root.
 * Shared by registration and launch so a stored row cannot bypass containment.
 */
export function assertWorktreeOwned(jobsDir: string, worktree: string, label: string): string {
	const requiredRoot = worktreesRoot(jobsDir);
	const rel = path.relative(realpathOr(requiredRoot), realpathOr(worktree));
	if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
		throw new Error(`${label} must be a task-owned worktree under ${requiredRoot}: ${worktree}`);
	}
	return requiredRoot;
}

export function variantsRoot(jobsDir: string): string {
	return path.join(evoRoot(jobsDir), "variants");
}

/** Immutable config snapshot for a variant (always present, source variants included). */
export function variantConfigDir(jobsDir: string, variantId: string): string {
	return path.join(variantsRoot(jobsDir), variantId, "config");
}

/** Source variants point `snapshotPath` at their git worktree instead of the variant dir. */
export function isSourceVariant(jobsDir: string, variant: VariantRow): boolean {
	return variant.snapshotPath !== path.join(variantsRoot(jobsDir), variant.id);
}

/**
 * Launch-time integrity boundary: the registered `configHash` must still describe the bytes on disk.
 * Read-only modes do not protect the snapshot (the owner can unlink and replace a file), so every
 * launch re-collects the whitelisted config and compares. Messages name the variant, never file bytes.
 */
export function assertVariantSnapshotIntact(jobsDir: string, variant: VariantRow): void {
	let actual: string;
	try {
		actual = hashConfig(collectConfigSync(variantConfigDir(jobsDir, variant.id)));
	} catch {
		throw new EvoHttpError(
			422,
			`variant '${variant.id}' snapshot is unreadable; cannot verify its registered configHash`,
		);
	}
	if (actual !== variant.configHash) {
		throw new EvoHttpError(422, `variant '${variant.id}' snapshot no longer matches its registered configHash`);
	}
}

export function variantId(configHash: string, source: SourceIdentity): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(`${configHash}\0${source.ref}\0${source.dirtyHash ?? ""}`);
	return hasher.digest("hex").slice(0, 16);
}

export function sourceOf(variant: VariantRow): SourceIdentity {
	return { ref: variant.sourceRef, dirtyHash: variant.sourceDirtyHash };
}
