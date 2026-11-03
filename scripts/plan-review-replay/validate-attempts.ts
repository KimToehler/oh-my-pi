import type { Attempt, Dataset, Trial } from "./types";

export type AddIssue = (message: string) => void;

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function validTimestamp(value: string): boolean {
	return TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function blank(value: string | null): boolean {
	return value === null || value.trim() === "";
}

function checkTimes(a: Attempt, add: AddIssue): void {
	const { dispatched, terminal } = a;
	if (dispatched !== null && !validTimestamp(dispatched)) add(`attempt ${a.id}: invalid dispatched timestamp`);
	if (terminal !== null && !validTimestamp(terminal)) add(`attempt ${a.id}: invalid terminal timestamp`);
	if (terminal !== null && dispatched === null) add(`attempt ${a.id}: terminal timestamp without dispatched`);
	if (
		dispatched !== null &&
		terminal !== null &&
		validTimestamp(dispatched) &&
		validTimestamp(terminal) &&
		Date.parse(terminal) < Date.parse(dispatched)
	) {
		add(`attempt ${a.id}: terminal precedes dispatched`);
	}
}

function checkPins(a: Attempt, add: AddIssue): void {
	const wrongModel = a.actualModels.some(m => m !== a.expectedModel);
	const wrongEffort = a.actualEfforts.some(e => e !== a.expectedEffort);
	if (a.status === "completed" && (wrongModel || wrongEffort)) {
		add(`attempt ${a.id}: actual pin differs from expected; must be failed or excluded with a reason`);
	}
	if (a.status === "completed" && !a.historical) {
		if (a.actualModels.length === 0 || a.actualEfforts.length === 0) {
			add(`attempt ${a.id}: fresh completed attempt lacks actual model/effort`);
		}
		if (a.dispatched === null || a.terminal === null)
			add(`attempt ${a.id}: fresh completed attempt lacks timestamps`);
		if (a.cost === null) add(`attempt ${a.id}: fresh completed attempt lacks usage cost`);
	}
}

export function checkAttempts(data: Dataset, add: AddIssue): void {
	const arms = new Map(data.arms.map(arm => [arm.id, arm]));
	const items = new Set(data.items.map(item => item.id));
	const trials = new Map(data.trials.map(trial => [trial.id, trial]));
	for (const a of data.attempts) {
		if (!items.has(a.item)) add(`attempt ${a.id}: unknown item ${a.item}`);
		if (blank(a.provenance)) add(`attempt ${a.id}: provenance required`);
		if (a.cost !== null && !(Number.isFinite(a.cost) && a.cost >= 0)) add(`attempt ${a.id}: invalid cost`);
		if (a.status !== "completed" && blank(a.reason)) add(`attempt ${a.id}: ${a.status} attempt needs a reason`);
		checkTimes(a, add);
		checkPins(a, add);
		if (a.trial === null) {
			if (a.stage !== "adjudicator") add(`attempt ${a.id}: ${a.stage} attempt requires a trial`);
			continue;
		}
		const trial = trials.get(a.trial);
		if (trial === undefined) {
			add(`attempt ${a.id}: unknown trial ${a.trial}`);
			continue;
		}
		if (a.stage === "adjudicator") add(`attempt ${a.id}: adjudicator attempt must not belong to a trial`);
		if (trial.item !== a.item) add(`attempt ${a.id}: item differs from trial ${trial.id}`);
		if (a.stage === "reviewer" && !trial.reviewAttempts.includes(a.id)) {
			add(`attempt ${a.id}: not listed in trial ${trial.id} reviewAttempts`);
		}
		if (a.stage === "verifier" && a.status === "completed" && trial.verifierAttempt !== a.id) {
			add(`attempt ${a.id}: not the verifierAttempt of trial ${trial.id}`);
		}
		const arm = arms.get(trial.arm);
		if (arm === undefined) continue;
		if (a.historical !== arm.historical) add(`attempt ${a.id}: historical flag differs from arm ${arm.id}`);
		if (a.stage === "reviewer" && (a.expectedModel !== arm.model || a.expectedEffort !== arm.effort)) {
			add(`attempt ${a.id}: expected pin differs from arm ${arm.id}`);
		}
	}
}

function checkTrialAttempts(t: Trial, data: Dataset, add: AddIssue): void {
	const byId = new Map(data.attempts.map(a => [a.id, a]));
	if (new Set(t.reviewAttempts).size !== t.reviewAttempts.length) add(`trial ${t.id}: duplicate reviewAttempts`);
	for (const id of t.reviewAttempts) {
		const a = byId.get(id);
		if (a === undefined) add(`trial ${t.id}: unknown review attempt ${id}`);
		else if (a.stage !== "reviewer" || a.trial !== t.id) add(`trial ${t.id}: attempt ${id} is not its reviewer`);
	}
	if (t.verifierAttempt !== null) {
		const v = byId.get(t.verifierAttempt);
		if (v === undefined) add(`trial ${t.id}: unknown verifier attempt ${t.verifierAttempt}`);
		else if (v.stage !== "verifier" || v.trial !== t.id) add(`trial ${t.id}: verifier attempt is not its verifier`);
	}
}

export function checkTrials(data: Dataset, add: AddIssue): void {
	const arms = new Map(data.arms.map(arm => [arm.id, arm]));
	const items = new Set(data.items.map(item => item.id));
	const byId = new Map(data.attempts.map(a => [a.id, a]));
	const repeats = new Map<string, number[]>();
	for (const t of data.trials) {
		const arm = arms.get(t.arm);
		if (arm === undefined) add(`trial ${t.id}: unknown arm ${t.arm}`);
		if (!items.has(t.item)) add(`trial ${t.id}: unknown item ${t.item}`);
		if (!Number.isInteger(t.repeat) || t.repeat < 1) add(`trial ${t.id}: repeat must be a positive integer`);
		const key = `${t.arm}\u0000${t.item}`;
		repeats.set(key, [...(repeats.get(key) ?? []), t.repeat]);
		checkTrialAttempts(t, data, add);
		const findings = data.findings.filter(f => f.trial === t.id).length;
		if (t.status !== "completed") {
			if (blank(t.reason)) add(`trial ${t.id}: ${t.status} trial needs a reason`);
			if (t.triage !== "unavailable") add(`trial ${t.id}: ${t.status} trial must have triage unavailable`);
			continue;
		}
		const historical = arm?.historical ?? false;
		const eligible = t.reviewAttempts.filter(id => byId.get(id)?.status === "completed").length;
		if (eligible === 0) add(`trial ${t.id}: completed trial has no eligible reviewer attempt`);
		if (!historical && eligible > 1) add(`trial ${t.id}: fresh trial has ${eligible} eligible reviewer attempts`);
		if (findings === 0) {
			if (t.triage !== "empty") add(`trial ${t.id}: zero findings requires explicit triage "empty"`);
			if (!historical && t.verifierAttempt !== null) add(`trial ${t.id}: empty trial must make no verifier call`);
			continue;
		}
		if (t.triage === "empty") add(`trial ${t.id}: triage "empty" with ${findings} findings`);
		const v = t.verifierAttempt === null ? undefined : byId.get(t.verifierAttempt);
		if (!historical && t.triage === "unavailable") {
			if (blank(t.reason)) add(`trial ${t.id}: unavailable triage needs a reason`);
			if (v?.status === "completed") add(`trial ${t.id}: unavailable triage with a completed verifier attempt`);
		}
		if (t.triage === "available" && !historical && v?.status !== "completed") {
			add(`trial ${t.id}: available triage needs a completed verifier attempt`);
		}
	}
	for (const [key, list] of repeats) {
		const sorted = [...list].sort((x, y) => x - y);
		if (sorted.some((r, i) => r !== i + 1))
			add(`arm/item ${key.replace("\u0000", "/")}: repeats must be consecutive from 1`);
	}
}
