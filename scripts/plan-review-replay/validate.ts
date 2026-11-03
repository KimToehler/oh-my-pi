import type { Dataset } from "./types";
import { type AddIssue, checkAttempts, checkTrials } from "./validate-attempts";

export class InputError extends Error {
	readonly issues: readonly string[];
	constructor(issues: readonly string[]) {
		super(issues.join("\n"));
		this.name = "InputError";
		this.issues = issues;
	}
}

function blank(value: string): boolean {
	return value.trim() === "";
}

function checkUnique(data: Dataset, add: AddIssue): void {
	const groups: ReadonlyArray<readonly [string, readonly string[]]> = [
		["source", data.sources.map(x => x.id)],
		["arm", data.arms.map(x => x.id)],
		["item", data.items.map(x => x.id)],
		["target", data.targets.map(x => x.id)],
		["attempt", data.attempts.map(x => x.id)],
		["trial", data.trials.map(x => x.id)],
		["finding", data.findings.map(x => x.id)],
		["adjudication", data.adjudications.map(x => x.finding)],
		["triage", data.triage.map(x => x.finding)],
		["round record", data.rounds.map(x => `${x.item}\u0000${x.path}`)],
	];
	for (const [kind, ids] of groups) {
		const seen = new Set<string>();
		for (const id of ids) {
			if (blank(id)) add(`${kind}: empty id`);
			if (seen.has(id)) add(`${kind}: duplicate id ${id.replace("\u0000", "/")}`);
			seen.add(id);
		}
	}
}

function checkSources(data: Dataset, add: AddIssue): void {
	for (const s of data.sources) {
		if (!/^[0-9a-f]{64}$/.test(s.sha256)) add(`source ${s.id}: sha256 must be 64 lowercase hex characters`);
		if (blank(s.provenance)) add(`source ${s.id}: provenance required`);
		if (s.provided && (s.path === null || blank(s.path))) add(`source ${s.id}: provided source needs a path`);
	}
}

function checkItemsAndTargets(data: Dataset, add: AddIssue): void {
	const items = new Set(data.items.map(i => i.id));
	for (const i of data.items) {
		if ([i.revision, i.tree, i.snapshot].some(blank)) add(`item ${i.id}: revision, tree and snapshot required`);
	}
	for (const a of data.arms) {
		if ([a.model, a.effort, a.brief, a.contract, a.rules, a.snapshot, a.triage, a.sampling].some(blank)) {
			add(`arm ${a.id}: every axis field must be non-empty`);
		}
	}
	for (const t of data.targets) {
		if (!items.has(t.item)) add(`target ${t.id}: unknown item ${t.item}`);
		if (t.evidence.length === 0 || t.evidence.some(blank)) add(`target ${t.id}: snapshot evidence required`);
		if (blank(t.reason) || blank(t.mechanism)) add(`target ${t.id}: mechanism and reason required`);
	}
	for (const r of data.rounds) {
		if (!items.has(r.item)) add(`round record ${r.path}: unknown item ${r.item}`);
		if (!Number.isInteger(r.lastRound) || r.lastRound < 1)
			add(`round record ${r.path}: lastRound must be a positive integer`);
		if (blank(r.revision) || blank(r.path)) add(`round record ${r.path}: revision and path required`);
	}
}

function checkFindings(data: Dataset, add: AddIssue): void {
	const trials = new Map(data.trials.map(t => [t.id, t]));
	const indices = new Map<string, number[]>();
	for (const f of data.findings) {
		if (!trials.has(f.trial)) add(`finding ${f.id}: unknown trial ${f.trial}`);
		if (blank(f.description)) add(`finding ${f.id}: description required`);
		indices.set(f.trial, [...(indices.get(f.trial) ?? []), f.index]);
	}
	for (const [trial, list] of indices) {
		const sorted = [...list].sort((x, y) => x - y);
		if (sorted.some((n, i) => n !== i + 1)) add(`trial ${trial}: finding indices must be consecutive from 1`);
	}
	const byFinding = new Map(data.findings.map(f => [f.id, f]));
	const triaged = new Set<string>();
	for (const t of data.triage) {
		const f = byFinding.get(t.finding);
		if (f === undefined) {
			add(`triage ${t.finding}: unknown finding`);
			continue;
		}
		triaged.add(t.finding);
		if (trials.get(f.trial)?.triage !== "available")
			add(`triage ${t.finding}: trial ${f.trial} triage is not available`);
		if (t.blocking && t.result !== "confirmed") add(`triage ${t.finding}: blocking requires a confirmed result`);
		if (blank(t.reason)) add(`triage ${t.finding}: reason required`);
	}
	for (const f of data.findings) {
		if (trials.get(f.trial)?.triage === "available" && !triaged.has(f.id)) {
			add(`finding ${f.id}: missing triage verdict (verifier index incomplete)`);
		}
	}
}

function checkAdjudications(data: Dataset, add: AddIssue): void {
	const byFinding = new Map(data.findings.map(f => [f.id, f]));
	const trials = new Map(data.trials.map(t => [t.id, t]));
	const targets = new Map(data.targets.map(t => [t.id, t]));
	const historicalArms = new Set(data.arms.filter(a => a.historical).map(a => a.id));
	const historicalTrials = new Set(data.trials.filter(t => historicalArms.has(t.arm)).map(t => t.id));
	for (const a of data.adjudications) {
		const f = byFinding.get(a.finding);
		if (f === undefined) add(`adjudication ${a.finding}: unknown finding`);
		if (new Set(a.targets).size !== a.targets.length) add(`adjudication ${a.finding}: duplicate targets`);
		for (const id of a.targets) {
			const target = targets.get(id);
			if (target === undefined) add(`adjudication ${a.finding}: unknown target ${id}`);
			else if (f !== undefined && trials.get(f.trial)?.item !== target.item) {
				add(`adjudication ${a.finding}: target ${id} belongs to a different item`);
			}
		}
		if (blank(a.reason)) add(`adjudication ${a.finding}: reason required`);
		const judged = a.validity === "valid" || a.validity === "annotated";
		if (!judged && a.targets.length > 0) add(`adjudication ${a.finding}: ${a.validity} finding cannot match targets`);
		if (judged) {
			if (a.mechanism === null || blank(a.mechanism))
				add(`adjudication ${a.finding}: ${a.validity} finding needs a mechanism`);
			if (a.evidence.length === 0 || a.evidence.some(blank))
				add(`adjudication ${a.finding}: ${a.validity} match needs snapshot evidence`);
		}
		// `annotated` carries no independent judgement, so it may only describe a historical arm's rows.
		if (a.validity === "annotated" && f !== undefined && historicalTrials.has(f.trial) === false)
			add(`adjudication ${a.finding}: annotated validity is only for historical reference trials`);
		if (a.kind === "known-target" && a.targets.length === 0)
			add(`adjudication ${a.finding}: known-target needs a matched target`);
		if (a.kind === "additional-defect" && a.targets.length > 0)
			add(`adjudication ${a.finding}: additional-defect cannot match a target`);
		if (a.validity === "invalid" && (a.kind === "known-target" || a.kind === "additional-defect"))
			add(`adjudication ${a.finding}: invalid finding cannot be ${a.kind}`);
		if ((a.validity === "pending") !== (a.kind === "pending"))
			add(`adjudication ${a.finding}: pending finding needs kind pending`);
	}
}

function checkTargetRepeats(data: Dataset, add: AddIssue): void {
	const seen = new Set<string>();
	for (const r of data.targetRepeats) {
		const key = `${r.round}\u0000${r.target}`;
		if (seen.has(key)) add(`target repeat ${r.target}: duplicate assessment in round ${r.round}`);
		seen.add(key);
		if (blank(r.round)) add(`target repeat ${r.target}: round required`);
		if (blank(r.source)) add(`target repeat ${r.target}: source required`);
	}
}

export function validateDataset(data: Dataset): void {
	const issues: string[] = [];
	const add: AddIssue = message => {
		issues.push(message);
	};
	checkUnique(data, add);
	checkSources(data, add);
	checkItemsAndTargets(data, add);
	checkAttempts(data, add);
	checkTrials(data, add);
	checkFindings(data, add);
	checkAdjudications(data, add);
	checkTargetRepeats(data, add);
	if (issues.length > 0) throw new InputError(issues);
}
