import type { AdjudicationKind, Blocking } from "./types";

/** numerator/denominator pair; value is null with a reason whenever it is not computable. */
export interface Ratio {
	readonly numerator: number;
	readonly denominator: number;
	readonly value: number | null;
	readonly reason: string | null;
}

export interface TriageCounts {
	readonly retained: number;
	readonly protected: number;
	readonly undecided: number;
	readonly pending: number;
	/**
	 * Discovered targets that are not independently blocking yet keep a surviving blocking match.
	 * They are neither retained automatic blockers nor triage losses.
	 */
	readonly survivingNonBlocker: number;
	/** Discovered targets whose only surviving matches are confirmed but nonblocking. */
	readonly downgraded: number;
	/** Independently blocking discovered targets lost by triage (includes downgraded). */
	readonly falseDrop: number;
	/**
	 * Discovered targets independently below threshold and lost by triage, with a stated consequence.
	 * The frozen contract requires both before a loss may be called legitimate.
	 */
	readonly legitimateResidual: number;
	/** Below-threshold losses whose triage row states no consequence; not a justified residual. */
	readonly unstatedResidual: number;
	/** Discovered targets with unresolved severity lost by triage; outside the definitive denominator. */
	readonly unresolvedDrop: number;
}

/**
 * Triage outcome of independently blocking discoveries that match no frozen target, deduplicated per
 * trial by mechanism. They are outside the frozen-ledger denominators, so a loss here is never a
 * `falseDrop`; it is still a verifier loss and is reported on its own.
 */
export interface AdditionalBlocking {
	readonly discovered: number;
	readonly retained: number;
	readonly protected: number;
	readonly undecided: number;
	readonly pending: number;
	/** Refuted, or confirmed as nonblocking. */
	readonly dropped: number;
}

export type KindCounts = Readonly<Record<AdjudicationKind, number>>;

export interface FindingCounts {
	readonly total: number;
	readonly valid: number;
	readonly invalid: number;
	readonly pending: number;
	/** Descriptive rows that were never independently judged; outside every precision figure. */
	readonly annotated: number;
	/** Valid findings beyond the first per target set or mechanism. */
	readonly duplicates: number;
	readonly additionalMechanisms: readonly string[];
	/** Adjudicated classification per finding; sums to total. */
	readonly kinds: KindCounts;
}

export interface TrialScore {
	readonly id: string;
	readonly arm: string;
	readonly item: string;
	readonly repeat: number;
	readonly targetCount: number;
	readonly discovered: readonly string[];
	/** Targets retained as confirmed blocking; null when triage is unavailable. */
	readonly retained: readonly string[] | null;
	readonly undiscovered: number;
	readonly preRecall: Ratio;
	readonly postRecall: Ratio;
	readonly triage: TriageCounts | null;
	readonly triageReason: string | null;
	readonly falseDropRate: Ratio;
	/** Null exactly when triage is unavailable. */
	readonly additionalBlocking: AdditionalBlocking | null;
	readonly findings: FindingCounts;
	readonly falsePositiveRate: Ratio;
}

export interface ItemScore {
	readonly arm: string;
	readonly item: string;
	readonly targetCount: number;
	readonly completedTrials: number;
	/** Completed trials of this item whose triage outcome exists; denominator coverage for the post figures. */
	readonly triagedTrials: number;
	/** numerator = mean discovered targets per completed trial. */
	readonly trialMeanPre: Ratio;
	readonly trialMeanPost: Ratio;
	readonly unionLabel: string;
	readonly unionPre: Ratio;
	readonly unionPost: Ratio;
	readonly falseDrop: Ratio;
	/** `null` when no completed trial of this item has triage: the figure is unavailable, not zero. */
	readonly additionalBlocking: AdditionalBlocking | null;
	/** Dropped over discovered blocking additional mechanisms of the triaged trials. */
	readonly additionalBlockingDrop: Ratio;
	readonly additionalMechanisms: readonly string[];
}

export interface ArmScore {
	readonly arm: string;
	readonly historical: boolean;
	readonly intendedTrials: number;
	readonly completedTrials: number;
	readonly excludedTrials: number;
	readonly missingTrials: number;
	/** Completed trials of this arm whose triage outcome exists; denominator coverage for the post figures. */
	readonly triagedTrials: number;
	readonly macroPre: Ratio;
	readonly macroPost: Ratio;
	readonly microPre: Ratio;
	readonly microPost: Ratio;
	readonly microUnionPre: Ratio;
	readonly microUnionPost: Ratio;
	readonly falseDrop: Ratio;
	readonly falsePositive: Ratio;
	readonly triage: TriageCounts;
	/** `null` when no completed trial of this arm has triage: the figure is unavailable, not zero. */
	readonly additionalBlocking: AdditionalBlocking | null;
	/** Dropped over discovered blocking additional mechanisms of the triaged trials. */
	readonly additionalBlockingDrop: Ratio;
	readonly pendingFindings: number;
	readonly additionalMechanisms: number;
}

export interface CostBucket {
	readonly attempts: number;
	readonly unknownCost: number;
	readonly amount: number;
}

export interface CostSummary {
	readonly reviewer: CostBucket;
	readonly verifier: CostBucket;
	readonly adjudicator: CostBucket;
	readonly unsuccessful: CostBucket;
	readonly total: CostBucket;
	readonly totalIsLowerBound: boolean;
	readonly complete: boolean;
	readonly byArm: readonly { readonly arm: string; readonly bucket: CostBucket }[];
}

export interface AttemptTiming {
	readonly attempt: string;
	readonly stage: string;
	readonly elapsedMs: number | null;
	readonly reason: string | null;
}

export interface Span {
	readonly ms: number | null;
	readonly complete: boolean;
	readonly reason: string | null;
}

export interface TimingSummary {
	readonly attempts: readonly AttemptTiming[];
	readonly trialSpans: readonly { readonly trial: string; readonly span: Span }[];
	readonly experimentWall: Span;
	readonly note: string;
}

export type ChangedAxis = "model" | "effort" | "brief" | "contract" | "rules" | "snapshot" | "triage" | "sampling";
export type ComparisonLabel = "no-binding-change" | "single-axis" | "confounded";

export interface Comparison {
	readonly a: string;
	readonly b: string;
	readonly changedAxes: readonly ChangedAxis[];
	readonly label: ComparisonLabel;
	readonly historicalReference: boolean;
	readonly asymmetricRepeats: boolean;
	readonly causalClaim: false;
	readonly attribution: ChangedAxis | null;
}

export interface RoundRow {
	readonly item: string;
	readonly revision: string;
	readonly path: string;
	readonly lastRound: number;
	readonly workflow: string | null;
	readonly workflowProvenance: "recorded" | "unknown";
}

export interface RoundsSummary {
	readonly observed: readonly RoundRow[];
	readonly measuredRoundsSaved: "not-measured";
	readonly fullCycleSavings: "not-measured";
	readonly budgets: "counterfactual";
}

export interface Exclusion {
	readonly kind: "trial" | "attempt";
	readonly id: string;
	readonly status: string;
	readonly reason: string | null;
}

export interface TargetSummary {
	readonly total: number;
	readonly byBlocking: Readonly<Record<Blocking, number>>;
}

export interface TargetRepeatDisagreement {
	readonly target: string;
	readonly authoritative: Blocking;
	readonly repeat: Blocking;
}

/** Agreement of one later independent assessment round with the authoritative target ledger. */
export interface TargetRepeatRound {
	readonly round: string;
	readonly assessed: number;
	readonly agreed: Ratio;
	readonly disagreements: readonly TargetRepeatDisagreement[];
	readonly unknownTargets: readonly string[];
	readonly byBlocking: Readonly<Record<Blocking, number>>;
}

export interface ScoreSummary {
	readonly version: 1;
	readonly unit: "first-pass-replay";
	readonly targets: TargetSummary;
	readonly targetRepeats: readonly TargetRepeatRound[];
	readonly trials: readonly TrialScore[];
	readonly items: readonly ItemScore[];
	readonly arms: readonly ArmScore[];
	readonly costs: CostSummary;
	readonly timing: TimingSummary;
	readonly comparisons: readonly Comparison[];
	readonly rounds: RoundsSummary;
	readonly exclusions: readonly Exclusion[];
}
