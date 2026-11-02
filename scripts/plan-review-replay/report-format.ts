import type { Ratio, ScoreSummary, Span } from "./report-types";

function pct(r: Ratio): string {
	if (r.value === null) return `n/a (${r.reason ?? "unavailable"})`;
	return `${r.numerator}/${r.denominator} = ${(r.value * 100).toFixed(1)}%`;
}

function ms(s: Span): string {
	if (s.ms === null) return `unavailable (${s.reason ?? "unknown"})`;
	return s.complete ? `${s.ms} ms` : `>= ${s.ms} ms (incomplete)`;
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): readonly string[] {
	return [
		`| ${header.join(" | ")} |`,
		`|${header.map(() => "---").join("|")}|`,
		...rows.map(r => `| ${r.join(" | ")} |`),
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
			s.arms.map(a => [
				a.arm,
				`${a.completedTrials}/${a.intendedTrials}`,
				pct(a.macroPre),
				pct(a.macroPost),
				pct(a.microPre),
				pct(a.microPost),
				pct(a.falseDrop),
				pct(a.falsePositive),
			]),
		),
		"## Items (trial mean vs best-of-repeats union)",
		...table(
			["arm", "item", "trial mean pre", "trial mean post", "union", "union pre", "union post"],
			s.items.map(i => [
				i.arm,
				i.item,
				pct(i.trialMeanPre),
				pct(i.trialMeanPost),
				i.unionLabel,
				pct(i.unionPre),
				pct(i.unionPost),
			]),
		),
		"## Trials",
		...table(
			["trial", "pre", "post", "false drop", "protected", "undecided", "pending", "invalid", "pending findings"],
			s.trials.map(t => [
				t.id,
				pct(t.preRecall),
				pct(t.postRecall),
				pct(t.falseDropRate),
				String(t.triage?.protected ?? "n/a"),
				String(t.triage?.undecided ?? "n/a"),
				String(t.triage?.pending ?? "n/a"),
				String(t.findings.invalid),
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
		"## Costs",
		`- reviewer: ${money(c.reviewer)}`,
		`- verifier: ${money(c.verifier)}`,
		`- adjudicator: ${money(c.adjudicator)}`,
		`- unsuccessful: ${money(c.unsuccessful)}`,
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
		"## Exclusions",
		...table(
			["kind", "id", "status", "reason"],
			s.exclusions.map(e => [e.kind, e.id, e.status, e.reason ?? "none"]),
		),
	];
	return `${lines.join("\n")}\n`;
}
