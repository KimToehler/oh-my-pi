import type { ArmScore, ItemScore, Ratio, ScoreSummary, Span } from "./report-types";

function pct(r: Ratio): string {
	if (r.value === null) return `n/a (${r.reason ?? "unavailable"})`;
	return `${r.numerator}/${r.denominator} = ${(r.value * 100).toFixed(1)}%`;
}

/**
 * Post-triage figures pooled over fewer trials than completed are never arm-wide results,
 * so every such cell carries the trial coverage it was computed from.
 */
function post(r: Ratio, triaged: number, completed: number): string {
	if (r.value === null || triaged === completed) return pct(r);
	return `${pct(r)} (triaged ${triaged}/${completed} trials)`;
}

function ms(s: Span): string {
	if (s.ms === null) return `unavailable (${s.reason ?? "unknown"})`;
	return s.complete ? `${s.ms} ms` : `>= ${s.ms} ms (incomplete)`;
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): readonly string[] {
	// Target ids carry a `|`; an unescaped one would split the cell and corrupt the rendered table.
	const cell = (text: string) => text.replaceAll("|", "\\|");
	return [
		`| ${header.map(cell).join(" | ")} |`,
		`|${header.map(() => "---").join("|")}|`,
		...rows.map(r => `| ${r.map(cell).join(" | ")} |`),
		"",
	];
}

/** Deterministic Markdown view of the one computed summary. */
export function formatMarkdown(s: ScoreSummary): string {
	const c = s.costs;
	const money = (b: { amount: number; attempts: number; unknownCost: number }) =>
		`${b.amount.toFixed(4)} (${b.attempts} attempts, ${b.unknownCost} unknown)`;
	const lines: string[] = [
		"# Plan review replay report",
		"",
		`Unit: ${s.unit}. Targets: ${s.targets.total} (blocking ${s.targets.byBlocking.blocking}, below-threshold ${s.targets.byBlocking["below-threshold"]}, unresolved ${s.targets.byBlocking.unresolved}).`,
		"Savings: not measured. Round budgets: counterfactual. No comparison is causal.",
		"",
		"## Arms",
		...table(
			[
				"arm",
				"trials done/intended",
				"macro pre",
				"macro post",
				"micro pre",
				"micro post",
				"false drop",
				"false positive",
			],
			s.arms.map((a: ArmScore) => [
				a.arm,
				`${a.completedTrials}/${a.intendedTrials}`,
				pct(a.macroPre),
				post(a.macroPost, a.triagedTrials, a.completedTrials),
				pct(a.microPre),
				post(a.microPost, a.triagedTrials, a.completedTrials),
				post(a.falseDrop, a.triagedTrials, a.completedTrials),
				pct(a.falsePositive),
			]),
		),
		"## Items (trial mean vs best-of-repeats union)",
		...table(
			["arm", "item", "trial mean pre", "trial mean post", "union", "union pre", "union post"],
			s.items.map((i: ItemScore) => [
				i.arm,
				i.item,
				pct(i.trialMeanPre),
				post(i.trialMeanPost, i.triagedTrials, i.completedTrials),
				i.unionLabel,
				pct(i.unionPre),
				post(i.unionPost, i.triagedTrials, i.completedTrials),
			]),
		),
		"## Trials",
		...table(
			[
				"trial",
				"pre",
				"post",
				"false drop",
				"protected",
				"surviving non-blocker",
				"undecided",
				"pending",
				"invalid",
				"annotated",
				"pending findings",
			],
			s.trials.map(t => [
				t.id,
				pct(t.preRecall),
				pct(t.postRecall),
				pct(t.falseDropRate),
				String(t.triage?.protected ?? "n/a"),
				String(t.triage?.survivingNonBlocker ?? "n/a"),
				String(t.triage?.undecided ?? "n/a"),
				String(t.triage?.pending ?? "n/a"),
				String(t.findings.invalid),
				String(t.findings.annotated),
				String(t.findings.pending),
			]),
		),
		"## Finding kinds",
		...table(
			[
				"trial",
				"known target",
				"additional",
				"useful note",
				"evidence error",
				"consequence",
				"false claim",
				"severity",
				"pending",
			],
			s.trials.map(t => [
				t.id,
				String(t.findings.kinds["known-target"]),
				String(t.findings.kinds["additional-defect"]),
				String(t.findings.kinds["useful-note"]),
				String(t.findings.kinds["evidence-error"]),
				String(t.findings.kinds["unsupported-consequence"]),
				String(t.findings.kinds["false-claim"]),
				String(t.findings.kinds["severity-error"]),
				String(t.findings.kinds.pending),
			]),
		),
		"## Blocking discoveries outside the frozen ledger (verifier outcome; not part of any target denominator)",
		"",
		"Unit: mechanisms per trial, deduplicated within a trial and summed over trials.",
		"",
		...table(
			["arm", "discovered", "retained", "protected", "undecided", "pending", "dropped", "drop rate"],
			s.arms.map((a: ArmScore) => {
				const b = a.additionalBlocking;
				const cover =
					a.triagedTrials === a.completedTrials ? "" : ` (triaged ${a.triagedTrials}/${a.completedTrials} trials)`;
				const cell = (n: number) => (b === null ? "n/a (triage unavailable)" : `${n}${cover}`);
				return [
					a.arm,
					cell(b?.discovered ?? 0),
					cell(b?.retained ?? 0),
					cell(b?.protected ?? 0),
					cell(b?.undecided ?? 0),
					cell(b?.pending ?? 0),
					cell(b?.dropped ?? 0),
					post(a.additionalBlockingDrop, a.triagedTrials, a.completedTrials),
				];
			}),
		),
		"## Costs",
		`- reviewer: ${money(c.reviewer)}`,
		`- verifier: ${money(c.verifier)}`,
		`- adjudicator: ${money(c.adjudicator)}`,
		`- unsuccessful (subset of the stage rows above, not an additional bucket): ${money(c.unsuccessful)}`,
		`- total: ${money(c.total)}${c.totalIsLowerBound ? " lower bound, incomplete" : ""}`,
		"",
		"## Timing",
		`- experiment wall envelope: ${ms(s.timing.experimentWall)}`,
		...s.timing.trialSpans.map(t => `- trial ${t.trial} span: ${ms(t.span)}`),
		...s.timing.attempts.map(
			a =>
				`- attempt ${a.attempt} (${a.stage}): ${a.elapsedMs === null ? `unavailable (${a.reason ?? "unknown"})` : `${a.elapsedMs} ms`}`,
		),
		"",
		"## Comparisons",
		...table(
			["a", "b", "changed axes", "label", "historical", "asymmetric repeats"],
			s.comparisons.map(x => [
				x.a,
				x.b,
				x.changedAxes.join(",") || "none",
				x.label,
				String(x.historicalReference),
				String(x.asymmetricRepeats),
			]),
		),
		"## Rounds (recorded last rounds; savings not measured)",
		...table(
			["item", "revision", "path", "last round", "workflow"],
			s.rounds.observed.map(r => [r.item, r.revision, r.path, String(r.lastRound), r.workflow ?? "unknown"]),
		),
		"## Target severity repeats (reproducibility of the ledger, not a revision of it)",
		...table(
			["round", "assessed", "agreed with ledger", "disagreements", "unknown targets"],
			s.targetRepeats.map(r => [
				r.round,
				String(r.assessed),
				pct(r.agreed),
				r.disagreements.map(d => `${d.target}: ${d.authoritative} -> ${d.repeat}`).join("; ") || "none",
				r.unknownTargets.join("; ") || "none",
			]),
		),
		"## Exclusions",
		...table(
			["kind", "id", "status", "reason"],
			s.exclusions.map(e => [e.kind, e.id, e.status, e.reason ?? "none"]),
		),
	];
	return `${lines.join("\n")}\n`;
}
