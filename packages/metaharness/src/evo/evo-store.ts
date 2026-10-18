/** SQLite tables for the evo variant registry; shares the connection owned by `RunStore`. */
import type { Database } from "bun:sqlite";
import type { Mutation, ProposalOutcome, ProposalRow, VariantRow, VariantSummary } from "./variant-types";

export const EVO_SCHEMA = `
CREATE TABLE IF NOT EXISTS evo_variants (
	id TEXT PRIMARY KEY,
	config_hash TEXT NOT NULL,
	source_ref TEXT NOT NULL,
	source_dirty_hash TEXT,
	snapshot_path TEXT NOT NULL,
	parent_id TEXT,
	donor_variant_id TEXT,
	depth INTEGER NOT NULL,
	mutation TEXT NOT NULL,
	strategy TEXT NOT NULL DEFAULT '',
	directive TEXT NOT NULL DEFAULT '',
	expected_signals_json TEXT NOT NULL DEFAULT '[]',
	diff_path TEXT NOT NULL,
	changed_files_json TEXT NOT NULL DEFAULT '[]',
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS evo_proposals (
	id TEXT PRIMARY KEY,
	parent_id TEXT,
	candidate_variant_id TEXT,
	mutation TEXT NOT NULL,
	donor_variant_id TEXT,
	outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'noop', 'apply_failed')),
	detail TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL
);
`;

function strings(value: unknown): string[] {
	try {
		const parsed: unknown = JSON.parse(String(value));
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

function nullable(value: unknown): string | null {
	return value === null || value === undefined ? null : String(value);
}

function rowToVariant(r: Record<string, unknown>): VariantRow {
	return {
		id: String(r.id),
		configHash: String(r.config_hash),
		sourceRef: String(r.source_ref),
		sourceDirtyHash: nullable(r.source_dirty_hash),
		snapshotPath: String(r.snapshot_path),
		parentId: nullable(r.parent_id),
		donorVariantId: nullable(r.donor_variant_id),
		depth: Number(r.depth),
		mutation: String(r.mutation) as Mutation,
		strategy: String(r.strategy),
		directive: String(r.directive),
		expectedSignals: strings(r.expected_signals_json),
		diffPath: String(r.diff_path),
		changedFiles: strings(r.changed_files_json),
		createdAt: Number(r.created_at),
	};
}

function rowToProposal(r: Record<string, unknown>): ProposalRow {
	return {
		id: String(r.id),
		parentId: nullable(r.parent_id),
		candidateVariantId: nullable(r.candidate_variant_id),
		mutation: String(r.mutation) as Mutation,
		donorVariantId: nullable(r.donor_variant_id),
		outcome: String(r.outcome) as ProposalOutcome,
		detail: String(r.detail),
		createdAt: Number(r.created_at),
	};
}

export class EvoStore {
	#db: Database;

	constructor(db: Database) {
		this.#db = db;
		db.run(EVO_SCHEMA);
	}

	insertVariant(v: VariantRow): void {
		this.#db
			.query(
				`INSERT INTO evo_variants
				 (id, config_hash, source_ref, source_dirty_hash, snapshot_path, parent_id, donor_variant_id, depth,
				  mutation, strategy, directive, expected_signals_json, diff_path, changed_files_json, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				v.id,
				v.configHash,
				v.sourceRef,
				v.sourceDirtyHash,
				v.snapshotPath,
				v.parentId,
				v.donorVariantId,
				v.depth,
				v.mutation,
				v.strategy,
				v.directive,
				JSON.stringify(v.expectedSignals),
				v.diffPath,
				JSON.stringify(v.changedFiles),
				v.createdAt,
			);
	}

	getVariant(id: string): VariantRow | null {
		const r = this.#db.query("SELECT * FROM evo_variants WHERE id = ?").get(id) as Record<string, unknown> | null;
		return r ? rowToVariant(r) : null;
	}

	listVariants(): VariantSummary[] {
		const rows = this.#db
			.query(
				`SELECT v.*, (SELECT COUNT(*) FROM runs WHERE runs.variant_id = v.id) AS run_count
				 FROM evo_variants v ORDER BY v.rowid`,
			)
			.all() as Array<Record<string, unknown>>;
		return rows.map(r => ({ ...rowToVariant(r), runCount: Number(r.run_count) }));
	}

	insertProposal(p: ProposalRow): void {
		this.#db
			.query(
				`INSERT INTO evo_proposals
				 (id, parent_id, candidate_variant_id, mutation, donor_variant_id, outcome, detail, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(p.id, p.parentId, p.candidateVariantId, p.mutation, p.donorVariantId, p.outcome, p.detail, p.createdAt);
	}

	/** Proposals that produced, reused, or were attempted against this variant. */
	listProposals(variantId: string): ProposalRow[] {
		const rows = this.#db
			.query(
				`SELECT * FROM evo_proposals WHERE candidate_variant_id = ? OR parent_id = ?
				 ORDER BY rowid`,
			)
			.all(variantId, variantId) as Array<Record<string, unknown>>;
		return rows.map(rowToProposal);
	}
}
