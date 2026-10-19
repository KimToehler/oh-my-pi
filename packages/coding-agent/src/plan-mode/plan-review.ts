/**
 * Cross-family review of a proposed plan, run by `AgentSession.submitPlanProposal`
 * between plan resolution and the plan-mode handler.
 *
 * Trust boundary: every string derived from reviewer output is untrusted. This
 * module only parses and sanitizes it; the session decides which untrusted
 * channel (tool result or notice) carries it.
 */
import { type } from "@oh-my-pi/omptype";
import type { AssistantMessage, Usage } from "@oh-my-pi/pi-ai";
import { classifyModel } from "@oh-my-pi/pi-catalog/identity";
import { replaceTabs, TRUNCATE_LENGTHS, truncateToWidth } from "@oh-my-pi/pi-tui/render/render-utils";
import type { SingleResult } from "@oh-my-pi/pi-tui/tools/task";
import { prompt, sanitizeText } from "@oh-my-pi/pi-utils";
import type { ModelRegistry } from "../config/model-registry";
import { getModelMatchPreferences, resolveModelRoleValue } from "../config/model-resolver";
import type { Settings } from "../config/settings";
import planReviewAssignmentPrompt from "../prompts/system/plan-review-assignment.md" with { type: "text" };
import { escapeHarnessTags } from "../session/harness-tags";
import { getBundledAgent } from "../task/agents";
import { runStructuredSubagent, type StructuredSubagentResult } from "../task/structured-subagent";
import type { ToolSession } from "../tools";
import { ToolAbortError } from "../tools/tool-errors";
import type { ResolvedApprovedPlan } from "./approved-plan";
import { cfgPlanReviewAgent, cfgPlanReviewModels } from "./settings";

export type PlanReviewSkip = "planner-unknown" | "no-reviewer" | "reviewer-failed" | "family-unverified" | "no-verdict";

export interface PlanReviewBlocker {
	readonly area: string;
	readonly defect: string;
	readonly evidence: string;
	readonly change: string;
}

export type AnsweringModel = NonNullable<SingleResult["answeringModels"]>[number];

/** Audit facts of one review; never carries reviewer text. */
export interface PlanReviewTrace {
	readonly plannerClass?: string;
	readonly reviewerEntry?: string;
	readonly answeringModels?: readonly AnsweringModel[];
	readonly durationMs: number;
	readonly usage?: Usage;
}

export type PlanReviewOutcome = (
	| { readonly kind: "okay"; readonly reviewer: string; readonly notes: readonly string[] }
	| { readonly kind: "reject"; readonly reviewer: string; readonly blockers: readonly PlanReviewBlocker[] }
	| { readonly kind: "unreviewed"; readonly reason: PlanReviewSkip; readonly detail: string }
) & { readonly trace: PlanReviewTrace };

export interface PlanReviewInput {
	readonly toolSession: ToolSession | undefined;
	readonly plannerMessage: AssistantMessage;
	readonly plan: ResolvedApprovedPlan;
	readonly settings: Settings;
	readonly modelRegistry: ModelRegistry;
	readonly signal: AbortSignal | undefined;
}

/** Rejections per proposal series that block; the next one passes to approval with its blockers. */
export const PLAN_REVIEW_MAX_ROUNDS = 2;
const REVIEW_MAX_RUNTIME_MS = 300_000;

const blockerSchema = type({ area: "string", defect: "string", evidence: "string", change: "string" });
const verdictSchema = type({
	verdict: "'OKAY' | 'REJECT'",
	summary: "string",
	"blockers?": blockerSchema.array(),
	"notes?": "string[]",
});

/** The JTD output schema the reviewer must yield: the bundled `plan-reviewer`'s own,
 *  passed as caller schema so a user-chosen agent (`plan.review.agent`) returns the same shape. */
export function planReviewSchema(): unknown {
	return getBundledAgent("plan-reviewer")?.output;
}

/** Model class from the catalog taxonomy; `undefined` when unknown or ambiguous. */
export function modelClass(provider: string, id: string): string | undefined {
	try {
		const cls = classifyModel(provider, id, { lenient: true }).class;
		return cls === "unknown" ? undefined : cls;
	} catch {
		return undefined;
	}
}

/** Reviewer-derived text for the planner's tool result: one line without tabs, control characters or
 *  harness tags (model output must not open or close a harness-authored block), never cut. */
function sanitizeReviewField(text: string): string {
	return escapeHarnessTags(sanitizeText(replaceTabs(text)))
		.replace(/\s*\n\s*/g, " ")
		.trim();
}

/** One display-safe line of reviewer-derived text. */
export function sanitizeReviewText(text: string): string {
	return truncateToWidth(sanitizeReviewField(text), TRUNCATE_LENGTHS.CONTENT);
}

function answeringClass(model: AnsweringModel): string | undefined {
	return modelClass(model.provider, model.upstreamModel ?? model.model);
}

function reviewerLabel(models: readonly AnsweringModel[]): string {
	const labels = models.map(m =>
		m.upstreamModel && m.upstreamModel !== m.model
			? `${m.provider}/${m.model} (upstream ${m.upstreamModel})`
			: `${m.provider}/${m.model}`,
	);
	return sanitizeReviewText([...new Set(labels)].join(", "));
}

function pickReviewerEntry(input: PlanReviewInput, plannerClass: string): string | undefined {
	const available = input.modelRegistry.getAvailable();
	const options = { settings: input.settings, matchPreferences: getModelMatchPreferences(input.settings) };
	for (const entry of reviewerCandidates(input.settings)) {
		const { model } = resolveModelRoleValue(entry, available, options);
		if (!model) continue;
		const cls = modelClass(model.provider, model.id);
		if (cls !== undefined && cls !== plannerClass) return entry;
	}
	return undefined;
}

/** The settings registry does not validate array elements: skip non-string or blank entries. */
function reviewerCandidates(settings: Settings): string[] {
	const raw: readonly unknown[] = cfgPlanReviewModels.get(settings);
	return raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function errorDetail(error: unknown): string {
	return sanitizeReviewText(error instanceof Error ? error.message : String(error));
}

interface Interpretation {
	readonly result: SingleResult;
	readonly plannerClass: string;
	readonly trace: PlanReviewTrace;
}

function interpretResult({ result, plannerClass, trace }: Interpretation): PlanReviewOutcome {
	if (result.aborted) {
		const detail = sanitizeReviewText(result.abortReason ?? result.error ?? "the reviewer run was stopped");
		return { kind: "unreviewed", reason: "reviewer-failed", detail, trace };
	}
	if (result.exitCode !== 0 || result.error) {
		const detail = sanitizeReviewText(result.error ?? result.stderr ?? `exit code ${result.exitCode}`);
		return { kind: "unreviewed", reason: "reviewer-failed", detail, trace };
	}
	const answering = result.answeringModels ?? [];
	const classes = answering.map(answeringClass);
	if (answering.length === 0 || classes.some(cls => cls === undefined || cls === plannerClass)) {
		const detail = "the answering reviewer model is not provably from a different model family";
		return { kind: "unreviewed", reason: "family-unverified", detail, trace };
	}
	const reviewer = reviewerLabel(answering);
	const verdict =
		result.structuredOutput?.status === "valid" ? verdictSchema(result.structuredOutput.data) : undefined;
	if (verdict === undefined || verdict instanceof type.errors) {
		return { kind: "unreviewed", reason: "no-verdict", detail: "the reviewer returned no valid verdict", trace };
	}
	if (verdict.verdict === "OKAY") {
		return { kind: "okay", reviewer, notes: (verdict.notes ?? []).map(sanitizeReviewText), trace };
	}
	// Blockers reach the planner whole: a cut evidence list hides sites the plan must fix. The reject text is an
	// ordinary tool result, so renderers bound it like any other output; only the cap notice truncates here.
	const blockers = (verdict.blockers ?? []).map(blocker => ({
		area: sanitizeReviewField(blocker.area),
		defect: sanitizeReviewField(blocker.defect),
		evidence: sanitizeReviewField(blocker.evidence),
		change: sanitizeReviewField(blocker.change),
	}));
	if (blockers.length === 0) {
		return { kind: "unreviewed", reason: "no-verdict", detail: "the reviewer rejected without a blocker", trace };
	}
	return { kind: "reject", reviewer, blockers, trace };
}

function runReviewer(input: PlanReviewInput, session: ToolSession, entry: string): Promise<StructuredSubagentResult> {
	return runStructuredSubagent({
		session,
		invocationKind: "task",
		agent: cfgPlanReviewAgent.get(input.settings),
		model: entry,
		assignment: prompt.render(planReviewAssignmentPrompt, {
			cwd: session.cwd,
			planFilePath: input.plan.planFilePath,
			title: input.plan.title,
			planContent: input.plan.planContent,
			fence: "`".repeat(Math.max(3, longestBacktickRun(input.plan.planContent) + 1)),
		}),
		structured: true,
		outputSchema: planReviewSchema(),
		enableIrc: false,
		enableLsp: false,
		maxRuntimeMs: REVIEW_MAX_RUNTIME_MS,
		keepAlive: false,
		signal: input.signal,
		identity: { label: "PlanReview" },
		bypassSpawnPolicy: true,
	});
}

function longestBacktickRun(text: string): number {
	let longest = 0;
	for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
	return longest;
}

/**
 * Review the resolved plan with the first configured reviewer whose model class
 * differs from the planner's. Every failure is an `unreviewed` outcome (fail-open);
 * only the caller's own abort throws `ToolAbortError`.
 */
export async function reviewProposedPlan(input: PlanReviewInput): Promise<PlanReviewOutcome> {
	const startedAt = Date.now();
	const planner = input.plannerMessage;
	const plannerClass = modelClass(planner.provider, planner.upstreamModel ?? planner.model);
	const elapsed = (): number => Date.now() - startedAt;
	const session = input.toolSession;
	if (!session) {
		const trace = { plannerClass, durationMs: elapsed() };
		return { kind: "unreviewed", reason: "reviewer-failed", detail: "no tool session to run the reviewer", trace };
	}
	if (plannerClass === undefined) {
		const detail = "the proposing model's family is unknown";
		return { kind: "unreviewed", reason: "planner-unknown", detail, trace: { durationMs: elapsed() } };
	}
	const reviewerEntry = pickReviewerEntry(input, plannerClass);
	if (reviewerEntry === undefined) {
		const detail = sanitizeReviewText(
			`no candidate of a different family: ${reviewerCandidates(input.settings).join(", ")}`,
		);
		return { kind: "unreviewed", reason: "no-reviewer", detail, trace: { plannerClass, durationMs: elapsed() } };
	}
	let settled: StructuredSubagentResult;
	try {
		settled = await runReviewer(input, session, reviewerEntry);
	} catch (error) {
		if (input.signal?.aborted) throw new ToolAbortError(undefined, { cause: error });
		const trace = { plannerClass, reviewerEntry, durationMs: elapsed() };
		return { kind: "unreviewed", reason: "reviewer-failed", detail: errorDetail(error), trace };
	}
	if (input.signal?.aborted) throw new ToolAbortError();
	const { result } = settled;
	const trace = {
		plannerClass,
		reviewerEntry,
		answeringModels: result.answeringModels,
		durationMs: elapsed(),
		usage: result.usage,
	};
	return interpretResult({ result, plannerClass, trace });
}
