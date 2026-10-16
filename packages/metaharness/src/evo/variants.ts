/**
 * Content-addressed harness variants: snapshot a config genome (and optional source worktree),
 * record lineage, and classify every proposal as applied / noop / apply_failed.
 * Request parsing and path/containment helpers live in `variant-request` / `variant-paths` and are re-exported here.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { EvoHttpError } from "./boundary";
import { type ConfigFile, collectConfig, diffConfigs, hashConfig, unlockTree } from "./config-snapshot";
import { withDirLock } from "./dir-lock";
import type { EvoStore } from "./evo-store";
import { publishSnapshot } from "./snapshot-publish";
import { type SourceIdentity, sourceIdentity } from "./source-identity";
import type { ProposalRow, VariantRow } from "./variant-types";
import { assertWorktreeOwned, evoRoot, sourceOf, variantConfigDir, variantId, variantsRoot } from "./variant-paths";
import type { VariantRequest } from "./variant-request";

export {
	assertVariantSnapshotIntact,
	assertWorktreeOwned,
	evoRoot,
	isSourceVariant,
	sourceOf,
	variantConfigDir,
	variantId,
	variantsRoot,
	worktreesRoot,
} from "./variant-paths";
export { parseVariantRequest, type VariantRequest } from "./variant-request";

export interface RegisterResult {
	variant: VariantRow;
	proposal: ProposalRow;
	/** True when a new variant was materialized. */
	created: boolean;
}

interface Resolved {
	files: ConfigFile[];
	configHash: string;
	source: SourceIdentity;
	snapshotPath: string | null;
	sourceChanged: string[];
	sourcePatch: string;
}

export class VariantRegistry {
	readonly #store: EvoStore;
	readonly #jobsDir: string;
	readonly #defaultSourceRoot: string;
	readonly #afterMaterialize: ((variantDir: string) => Promise<void>) | undefined;

	/** `afterMaterialize` is a fault-injection seam: it runs once the snapshot files are on disk. */
	constructor(
		store: EvoStore,
		jobsDir: string,
		defaultSourceRoot: string,
		afterMaterialize?: (variantDir: string) => Promise<void>,
	) {
		this.#afterMaterialize = afterMaterialize;
		this.#store = store;
		this.#jobsDir = jobsDir;
		this.#defaultSourceRoot = defaultSourceRoot;
	}

	#need(id: string, label: string): VariantRow {
		const variant = this.#store.getVariant(id);
		if (!variant) throw new EvoHttpError(404, `${label} variant '${id}' not found`);
		return variant;
	}

	#propose(
		req: VariantRequest,
		outcome: ProposalRow["outcome"],
		detail: string,
		candidate: string | null,
	): ProposalRow {
		const proposal: ProposalRow = {
			id: crypto.randomUUID(),
			parentId: req.parentId,
			candidateVariantId: candidate,
			mutation: req.mutation,
			donorVariantId: req.donorVariantId,
			outcome,
			detail,
			createdAt: Date.now(),
		};
		this.#store.insertProposal(proposal);
		return proposal;
	}

	async #resolve(req: VariantRequest, parent: VariantRow | null): Promise<Resolved> {
		let files: ConfigFile[];
		if (req.configDir) files = await collectConfig(req.configDir);
		else files = await collectConfig(variantConfigDir(this.#jobsDir, (parent as VariantRow).id));
		const configHash = hashConfig(files);
		if (!req.sourceWorktree) {
			const source = parent ? sourceOf(parent) : await sourceIdentity(this.#defaultSourceRoot);
			return { files, configHash, source, snapshotPath: null, sourceChanged: [], sourcePatch: "" };
		}
		const worktree = await fs.realpath(req.sourceWorktree).catch(() => {
			throw new Error(`source worktree not found: ${req.sourceWorktree}`);
		});
		assertWorktreeOwned(this.#jobsDir, worktree, "source worktree");
		const source = await sourceIdentity(worktree);
		if (source.dirtyHash) throw new Error(`source worktree must be clean: ${worktree}`);
		let sourceChanged: string[] = [];
		let sourcePatch = "";
		if (parent && parent.sourceRef !== source.ref) {
			const repo = vcs.requireGit(worktree);
			sourceChanged = (await repo.changedFiles({ base: parent.sourceRef, head: source.ref })).map(
				file => `src:${file}`,
			);
			sourcePatch = await repo.diffTree(parent.sourceRef, source.ref, false);
		}
		return { files, configHash, source, snapshotPath: worktree, sourceChanged, sourcePatch };
	}

	async register(req: VariantRequest): Promise<RegisterResult> {
		const parent = req.parentId ? this.#need(req.parentId, "parent") : null;
		if (req.donorVariantId) this.#need(req.donorVariantId, "donor");
		let resolved: Resolved;
		try {
			resolved = await this.#resolve(req, parent);
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			const proposal = this.#propose(req, "apply_failed", detail, null);
			throw new EvoHttpError(422, detail, { outcome: "apply_failed", proposalId: proposal.id });
		}
		const id = variantId(resolved.configHash, resolved.source);
		// Serialize on the deterministic id across async calls and processes; the lock lives outside
		// the variants dir so it can never be mistaken for a snapshot.
		return withDirLock(path.join(evoRoot(this.#jobsDir), "locks", `${id}.lock`), () =>
			this.#publish(req, parent, resolved, id),
		);
	}

	async #publish(
		req: VariantRequest,
		parent: VariantRow | null,
		resolved: Resolved,
		id: string,
	): Promise<RegisterResult> {
		// Re-read inside the lock: a concurrent winner may have published while we waited.
		const existing = this.#store.getVariant(id);
		if (existing) {
			const reason = existing.id === parent?.id ? "identical to parent" : "identical to an existing variant";
			const proposal = this.#propose(req, "noop", `${reason} (${id})`, existing.id);
			return { variant: existing, proposal, created: false };
		}
		const variantDir = path.join(variantsRoot(this.#jobsDir), id);
		let published = false;
		let inserted = false;
		try {
			const parentFiles = parent ? await collectConfig(variantConfigDir(this.#jobsDir, parent.id)) : [];
			const diff = diffConfigs(parentFiles, resolved.files);
			const { diffPath } = await publishSnapshot({
				finalDir: variantDir,
				tmpRoot: path.join(evoRoot(this.#jobsDir), "tmp"),
				files: resolved.files,
				diffText: diff.patch + resolved.sourcePatch,
				afterMaterialize: this.#afterMaterialize,
			});
			published = true;
			const variant: VariantRow = {
				id,
				configHash: resolved.configHash,
				sourceRef: resolved.source.ref,
				sourceDirtyHash: resolved.source.dirtyHash,
				snapshotPath: resolved.snapshotPath ?? variantDir,
				parentId: parent?.id ?? null,
				donorVariantId: req.donorVariantId,
				depth: parent ? parent.depth + 1 : 0,
				mutation: req.mutation,
				strategy: req.strategy,
				directive: req.directive,
				expectedSignals: req.expectedSignals,
				diffPath,
				changedFiles: [...diff.changedFiles, ...resolved.sourceChanged],
				createdAt: Date.now(),
			};
			this.#store.insertVariant(variant);
			inserted = true;
			const proposal = this.#propose(req, "applied", `materialized ${id}`, id);
			return { variant, proposal, created: true };
		} catch (err) {
			if (inserted) throw err;
			// Only our own unregistered publication is removed; a registered winner is never touched.
			if (published) await unlockTree(variantDir);
			if (published) await fs.rm(variantDir, { recursive: true, force: true }).catch(() => {});
			const detail = err instanceof Error ? err.message : String(err);
			const proposal = this.#propose(req, "apply_failed", detail, null);
			throw new EvoHttpError(422, detail, { outcome: "apply_failed", proposalId: proposal.id });
		}
	}
}
