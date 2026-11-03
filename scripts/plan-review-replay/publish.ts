import { createHash } from "node:crypto";
import type { Adjudication, Dataset, Finding, Source, Target, Triage } from "./types";

/**
 * Deterministic publication sanitizer: derives the committed dataset from the local run dataset.
 *
 * The rules are field-wise, never item-wise: a coordinate or text is withheld because it carries
 * private repository content, not because its item is private. Everything else stays auditable.
 */
export interface PublishOptions {
	/** Item ids whose plans and code live in a private repository. */
	readonly privateItems: readonly string[];
	/** Item id to the short code used in published placeholders. */
	readonly itemCodes: Readonly<Record<string, string>>;
}

/** An absolute session path; a run-relative one names a file of the run directory and is safe. */
const SESSION_PATH = /"session":"\/[^"]*"/g;
const LOCAL_PATH = /\/Users\/[^\s"]+/g;
/** A coordinate that names a file of an OpenSpec change; only the item's own change is published. */
const PLAN_COORDINATE = /^openspec\/changes\/([^/]+)\/[^:]+(:.*)?$/;
/** A coordinate that names a row of the experiment itself, never repository content. */
const INTERNAL_COORDINATE = /^(annotation|trial|finding|attempt|triage|target):/;
/** The fixed sentence every annotated row carries; it names the experiment decision and quotes nothing. */
const ANNOTATION_TEMPLATE = /^Historical target annotation reproduced as descriptive reference\b/;

function digest(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

/**
 * Coordinates of a public item are published as they are. A private item's own plan files and the
 * experiment's internal references are published too; every other path becomes a stable pseudonym, so
 * distinct files stay distinguishable and repeats stay traceable without naming private code.
 */
export function publishCoordinate(coordinate: string, isPrivate: boolean, item: string): string {
	if (!isPrivate || INTERNAL_COORDINATE.test(coordinate)) return coordinate;
	if (PLAN_COORDINATE.exec(coordinate)?.[1] === item) return coordinate;
	const match = /^(.*?)(:[0-9][^:]*)?$/.exec(coordinate);
	const file = match?.[1] ?? coordinate;
	const lines = match?.[2] ?? "";
	const extension = /\.([A-Za-z0-9]+)$/.exec(file)?.[1] ?? "file";
	return `private-source:${extension}#${digest(file)}${lines}`;
}

function redactLocalPaths(text: string): string {
	return text.replace(SESSION_PATH, '"session":"local-path-redacted"').replace(LOCAL_PATH, "local-path-redacted");
}

function publishSource(source: Source): Source {
	const provenance = redactLocalPaths(source.provenance);
	return {
		...source,
		path: null,
		provided: false,
		// Only a source whose bytes were supplied needs the note about where those bytes stayed.
		provenance: source.provided
			? `Local frozen input; digest retained, bytes stay in the local run directory. ${provenance}`
			: provenance,
	};
}

function publishFinding(
	finding: Finding,
	item: string | undefined,
	historical: boolean,
	options: PublishOptions,
): Finding {
	// Historical descriptions are extraction placeholders already; only fresh reviewer prose is withheld.
	if (historical || item === undefined || !options.privateItems.includes(item)) {
		return { ...finding, description: redactLocalPaths(finding.description) };
	}
	const code = options.itemCodes[item] ?? item;
	return { ...finding, description: `Fresh finding ${finding.id} (item ${code}); claim text retained locally.` };
}

function publishTarget(target: Target, options: PublishOptions): Target {
	const isPrivate = options.privateItems.includes(target.item);
	const evidence = target.evidence.map(e => publishCoordinate(e, isPrivate, target.item));
	if (!isPrivate) return { ...target, evidence, reason: redactLocalPaths(target.reason) };
	return {
		...target,
		evidence,
		reason: "Target assessment retained locally; private-repository claim text is not published.",
	};
}

function publishAdjudication(a: Adjudication, item: string | undefined, options: PublishOptions): Adjudication {
	const isPrivate = item !== undefined && options.privateItems.includes(item);
	const evidence = a.evidence.map(e => publishCoordinate(e, isPrivate, item ?? ""));
	// An annotated row reproduces a historical annotation through a fixed template sentence that quotes
	// nothing, so withholding it would hide an experiment decision. Only that sentence is exempt: any
	// other annotated prose is reviewer text and stays withheld like every private claim.
	const template = a.validity === "annotated" && ANNOTATION_TEMPLATE.test(a.reason);
	if (!isPrivate || template) return { ...a, evidence, reason: redactLocalPaths(a.reason) };
	return {
		...a,
		evidence,
		reason: "Adjudication reasoning retained locally; private-repository claim text is not published.",
	};
}

function publishTriage(t: Triage, item: string | undefined, options: PublishOptions): Triage {
	if (item === undefined || !options.privateItems.includes(item)) return { ...t, reason: redactLocalPaths(t.reason) };
	return { ...t, reason: "Triage reasoning retained locally; private-repository claim text is not published." };
}

/** Sanitized copy of the local dataset; scoring-relevant fields are never touched. */
export function publishDataset(data: Dataset, options: PublishOptions): Dataset {
	const historicalArms = new Set(data.arms.filter(a => a.historical).map(a => a.id));
	const itemOfTrial = new Map(data.trials.map(t => [t.id, t.item]));
	const historicalTrials = new Set(data.trials.filter(t => historicalArms.has(t.arm)).map(t => t.id));
	const itemOfFinding = new Map(data.findings.map(f => [f.id, itemOfTrial.get(f.trial)]));
	return {
		...data,
		sources: data.sources.map(publishSource),
		targets: data.targets.map(t => publishTarget(t, options)),
		attempts: data.attempts.map(a => ({ ...a, provenance: redactLocalPaths(a.provenance) })),
		findings: data.findings.map(f =>
			publishFinding(f, itemOfTrial.get(f.trial), historicalTrials.has(f.trial), options),
		),
		adjudications: data.adjudications.map(a => publishAdjudication(a, itemOfFinding.get(a.finding), options)),
		triage: data.triage.map(t => publishTriage(t, itemOfFinding.get(t.finding), options)),
	};
}
