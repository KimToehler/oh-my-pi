/** Shared shapes for the evo variant registry. */

export const MUTATIONS = ["root", "autonomous", "revision", "crossover", "manual"] as const;
export type Mutation = (typeof MUTATIONS)[number];

export const PROPOSAL_OUTCOMES = ["applied", "noop", "apply_failed"] as const;
export type ProposalOutcome = (typeof PROPOSAL_OUTCOMES)[number];

export interface VariantRow {
	id: string;
	configHash: string;
	sourceRef: string;
	/**
	 * Execution-manifest hash (`execution-manifest.ts`) of the exact bytes that run: always present for a variant
	 * registered under the current scheme, clean trees included. Null only for a pre-manifest registration, which
	 * launch refuses (re-register). `sourceChanged` and diff reporting stay git-tree based, not manifest based.
	 */
	sourceDirtyHash: string | null;
	/** Variant dir for config variants; the clean git worktree for source variants. */
	snapshotPath: string;
	parentId: string | null;
	/** Crossover donor; the recipient stays `parentId`. */
	donorVariantId: string | null;
	depth: number;
	mutation: Mutation;
	strategy: string;
	directive: string;
	expectedSignals: string[];
	diffPath: string;
	changedFiles: string[];
	createdAt: number;
}

export interface ProposalRow {
	id: string;
	parentId: string | null;
	candidateVariantId: string | null;
	mutation: Mutation;
	donorVariantId: string | null;
	outcome: ProposalOutcome;
	detail: string;
	createdAt: number;
}

export interface VariantSummary extends VariantRow {
	runCount: number;
}
