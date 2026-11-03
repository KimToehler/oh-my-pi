import { cmp, sortedBy } from "./report-math";
import type { AttemptTiming, CostBucket, CostSummary, Span, TimingSummary } from "./report-types";
import type { Attempt, Trial } from "./types";

function bucket(attempts: readonly Attempt[]): CostBucket {
	let amount = 0;
	let unknownCost = 0;
	for (const a of attempts) {
		if (a.cost === null) unknownCost++;
		else amount += a.cost;
	}
	return { attempts: attempts.length, unknownCost, amount };
}

/** Every attempt is costed, including excluded and failed ones; null cost makes totals lower bounds. */
export function summarizeCosts(attempts: readonly Attempt[], trials: readonly Trial[]): CostSummary {
	const armOf = new Map(trials.map(t => [t.id, t.arm]));
	const arms = [
		...new Set(attempts.flatMap(a => (a.trial !== null && armOf.has(a.trial) ? [armOf.get(a.trial) ?? ""] : []))),
	].sort(cmp);
	const total = bucket(attempts);
	return {
		reviewer: bucket(attempts.filter(a => a.stage === "reviewer")),
		verifier: bucket(attempts.filter(a => a.stage === "verifier")),
		adjudicator: bucket(attempts.filter(a => a.stage === "adjudicator")),
		unsuccessful: bucket(attempts.filter(a => a.status !== "completed")),
		total,
		totalIsLowerBound: total.unknownCost > 0,
		complete: total.unknownCost === 0,
		byArm: arms.map(arm => ({
			arm,
			bucket: bucket(attempts.filter(a => a.trial !== null && armOf.get(a.trial) === arm)),
		})),
	};
}

interface Interval {
	readonly start: number;
	readonly end: number;
}

function interval(a: Attempt): { interval: Interval | null; reason: string | null } {
	if (a.dispatched === null || a.terminal === null) {
		return { interval: null, reason: "dispatch or terminal timestamp unavailable" };
	}
	const start = Date.parse(a.dispatched);
	const end = Date.parse(a.terminal);
	if (Number.isNaN(start) || Number.isNaN(end)) return { interval: null, reason: "unparseable timestamp" };
	if (end < start) return { interval: null, reason: "terminal precedes dispatch" };
	return { interval: { start, end }, reason: null };
}

/** Envelope of the known intervals; incomplete when any attempt lacks a usable interval. */
function envelope(attempts: readonly Attempt[], emptyReason: string): Span {
	const found = attempts.map(interval);
	const known = found.flatMap(f => (f.interval === null ? [] : [f.interval]));
	if (known.length === 0) return { ms: null, complete: false, reason: emptyReason };
	const start = Math.min(...known.map(k => k.start));
	const end = Math.max(...known.map(k => k.end));
	const complete = known.length === attempts.length;
	return {
		ms: end - start,
		complete,
		reason: complete ? null : "some attempts lack timestamps; span is a lower bound",
	};
}

/** Actual timestamps only; trial span is the reviewer+verifier envelope, wall time is the new-experiment envelope. */
export function summarizeTiming(attempts: readonly Attempt[], trials: readonly Trial[]): TimingSummary {
	const byId = new Map(attempts.map(a => [a.id, a]));
	const timings: AttemptTiming[] = sortedBy(attempts, a => a.id).map(a => {
		const i = interval(a);
		return {
			attempt: a.id,
			stage: a.stage,
			elapsedMs: i.interval === null ? null : i.interval.end - i.interval.start,
			reason: i.reason,
		};
	});
	const trialSpans = sortedBy(trials, t => t.id).map(t => {
		// Every attempt bound to the trial, not only the selected ones: a failed or excluded reviewer or
		// verifier call consumed trial time, and dropping it would publish a shorter span as the whole trial.
		const listed = [...t.reviewAttempts, ...(t.verifierAttempt === null ? [] : [t.verifierAttempt])];
		const bound = attempts.filter(a => a.trial === t.id).map(a => a.id);
		const ids = [...new Set([...listed, ...bound])];
		const mine = ids.flatMap(id => {
			const a = byId.get(id);
			return a === undefined ? [] : [a];
		});
		// A trial whose verifier never completed has no reviewer-plus-verifier envelope, whether its verifier
		// failed, was excluded or was never dispatched — a pointer to a failed attempt is not a result. An
		// empty trial makes no verifier call and is settled.
		const verifier = t.verifierAttempt === null ? undefined : byId.get(t.verifierAttempt);
		const unfinishedVerifier = t.triage !== "empty" && verifier?.status !== "completed";
		const span =
			mine.length < ids.length || mine.length === 0
				? ({ ms: null, complete: false, reason: "attempts missing from dataset" } satisfies Span)
				: envelope(mine, "no trial attempt has usable timestamps");
		return {
			trial: t.id,
			span:
				unfinishedVerifier && span.ms !== null
					? {
							ms: span.ms,
							complete: false,
							reason: "verifier stage never completed; span covers the attempts that ran",
						}
					: span,
		};
	});
	return {
		attempts: timings,
		trialSpans,
		experimentWall: envelope(
			attempts.filter(a => !a.historical),
			"no experiment attempt has usable timestamps",
		),
		note: "wall envelope is min dispatch to max terminal; concurrent durations are never summed",
	};
}
