export interface Source {
	readonly id: string;
	readonly path: string | null;
	readonly sha256: string;
	readonly provided: boolean;
	readonly provenance: string;
}
export interface Arm {
	readonly id: string;
	readonly historical: boolean;
	readonly model: string;
	readonly effort: string;
	readonly brief: string;
	readonly contract: string;
	readonly rules: string;
	readonly snapshot: string;
	readonly triage: string;
	readonly sampling: string;
}
export interface Item {
	readonly id: string;
	readonly revision: string;
	readonly tree: string;
	readonly snapshot: string;
}
export type Blocking = "blocking" | "below-threshold" | "unresolved";
export interface Target {
	readonly id: string;
	readonly item: string;
	readonly mechanism: string;
	readonly blocking: Blocking;
	readonly evidence: readonly string[];
	readonly reason: string;
}
export interface Attempt {
	readonly id: string;
	readonly item: string;
	readonly trial: string | null;
	readonly stage: "reviewer" | "verifier" | "adjudicator";
	readonly historical: boolean;
	readonly status: "completed" | "excluded" | "failed";
	readonly expectedModel: string;
	readonly expectedEffort: string;
	readonly actualModels: readonly string[];
	readonly actualEfforts: readonly string[];
	readonly dispatched: string | null;
	readonly terminal: string | null;
	readonly cost: number | null;
	readonly reason: string | null;
	readonly provenance: string;
}
export interface Trial {
	readonly id: string;
	readonly arm: string;
	readonly item: string;
	readonly repeat: number;
	readonly status: "completed" | "excluded" | "missing";
	readonly reviewAttempts: readonly string[];
	readonly verifierAttempt: string | null;
	readonly triage: "available" | "empty" | "unavailable";
	readonly reason: string | null;
}
export interface Finding {
	readonly id: string;
	readonly trial: string;
	readonly index: number;
	readonly description: string;
}
export type AdjudicationKind =
	| "known-target"
	| "additional-defect"
	| "useful-note"
	| "evidence-error"
	| "unsupported-consequence"
	| "false-claim"
	| "severity-error"
	| "pending";
export interface Adjudication {
	readonly finding: string;
	readonly targets: readonly string[];
	readonly mechanism: string | null;
	readonly validity: "valid" | "invalid" | "pending" | "annotated";
	readonly blocking: Blocking;
	readonly kind: AdjudicationKind;
	readonly evidence: readonly string[];
	readonly reason: string;
}
export interface Triage {
	readonly finding: string;
	readonly result: "confirmed" | "refuted" | "undecided";
	readonly blocking: boolean;
	readonly protected: boolean;
	readonly consequence: boolean;
	readonly reason: string;
}
/** A later independent assessment of a frozen target's current severity. */
export interface TargetRepeat {
	readonly target: string;
	readonly round: string;
	readonly blocking: Blocking;
	readonly source: string;
}
export interface RoundRecord {
	readonly item: string;
	readonly revision: string;
	readonly path: string;
	readonly lastRound: number;
	readonly workflow: string | null;
}
export interface Dataset {
	readonly version: 1;
	readonly sources: readonly Source[];
	readonly arms: readonly Arm[];
	readonly items: readonly Item[];
	readonly targets: readonly Target[];
	readonly attempts: readonly Attempt[];
	readonly trials: readonly Trial[];
	readonly findings: readonly Finding[];
	readonly adjudications: readonly Adjudication[];
	readonly triage: readonly Triage[];
	readonly rounds: readonly RoundRecord[];
	readonly targetRepeats: readonly TargetRepeat[];
}
