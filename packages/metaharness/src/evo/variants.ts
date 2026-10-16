/**
 * Content-addressed harness variants: snapshot a config genome (and optional source worktree),
 * record lineage, and classify every proposal as applied / noop / apply_failed.
 */
import * as nodeFs from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import {
	badRequest,
	enumValue,
	EvoHttpError,
	expectObject,
	optionalString,
	rejectUnknownKeys,
	requiredString,
	stringArray,
} from "./boundary";
import { type ConfigFile, collectConfig, diffConfigs, hashConfig } from "./config-snapshot";
import { withDirLock } from "./dir-lock";
import type { EvoStore } from "./evo-store";
import { optionalPlainPath as optionalPath } from "./path-guard";
import { publishSnapshot } from "./snapshot-publish";
import { type SourceIdentity, sourceIdentity } from "./source-identity";
import { MUTATIONS, type Mutation, type ProposalRow, type VariantRow } from "./variant-types";

const REQUEST_FIELDS = [
	"parentId",
	"mutation",
	"donorVariantId",
	"strategy",
	"directive",
	"expectedSignals",
	"configDir",
	"sourceWorktree",
] as const;
const SIGNAL_PATTERN = /^(tool|skill|rule|agent|mark):\S+$/;

export interface VariantRequest {
	parentId: string | null;
	mutation: Mutation;
	donorVariantId: string | null;
	strategy: string;
	directive: string;
	expectedSignals: string[];
	/** Agent dir to snapshot; omitted children inherit the parent's config. */
	configDir: string | null;
	/** Clean git worktree providing the source genome. */
	sourceWorktree: string | null;
}

export interface RegisterResult {
	variant: VariantRow;
	proposal: ProposalRow;
	/** True when a new variant was materialized. */
	created: boolean;
}

export function parseVariantRequest(raw: unknown): VariantRequest {
	const obj = expectObject(raw, "variant");
	rejectUnknownKeys(obj, REQUEST_FIELDS, "variant");
	const mutation = enumValue(obj, "mutation", "variant", MUTATIONS);
	const parentId = optionalString(obj, "parentId", "variant");
	const donorVariantId = optionalString(obj, "donorVariantId", "variant");
	const configDir = optionalPath(obj, "configDir");
	if (mutation === "root") {
		if (parentId) throw badRequest("variant.parentId must be omitted for a root variant");
		if (!configDir) throw badRequest("variant.configDir is required for a root variant");
	} else if (!parentId) throw badRequest(`variant.parentId is required for a ${mutation} variant`);
	if (mutation === "crossover" && !donorVariantId)
		throw badRequest("variant.donorVariantId is required for a crossover variant");
	if (mutation !== "crossover" && donorVariantId)
		throw badRequest("variant.donorVariantId is only valid for a crossover variant");
	const expectedSignals = stringArray(obj, "expectedSignals", "variant") ?? [];
	for (const signal of expectedSignals) {
		if (!SIGNAL_PATTERN.test(signal))
			throw badRequest(
				`variant.expectedSignals entry '${signal}' must look like tool:<name>|skill:<name>|rule:<name>|agent:<name>|mark:<id>`,
			);
	}
	return {
		parentId,
		mutation,
		donorVariantId,
		strategy: obj.strategy === undefined ? "" : requiredString(obj, "strategy", "variant"),
		directive: obj.directive === undefined ? "" : requiredString(obj, "directive", "variant"),
		expectedSignals: [...new Set(expectedSignals)].sort(),
		configDir,
		sourceWorktree: optionalPath(obj, "sourceWorktree"),
	};
}

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

export function variantId(configHash: string, source: SourceIdentity): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(`${configHash}\0${source.ref}\0${source.dirtyHash ?? ""}`);
	return hasher.digest("hex").slice(0, 16);
}

export function sourceOf(variant: VariantRow): SourceIdentity {
	return { ref: variant.sourceRef, dirtyHash: variant.sourceDirtyHash };
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
			if (published) await fs.rm(variantDir, { recursive: true, force: true }).catch(() => {});
			const detail = err instanceof Error ? err.message : String(err);
			const proposal = this.#propose(req, "apply_failed", detail, null);
			throw new EvoHttpError(422, detail, { outcome: "apply_failed", proposalId: proposal.id });
		}
	}
}
