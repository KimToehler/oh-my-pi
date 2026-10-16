/**
 * Recommends which configured role model should implement an approved plan.
 * Asks one choice question of the live `judge` role chain (resolved by
 * {@link resolveJudge}); the options are the caller's role tiers in cycle
 * order, cheapest first, labelled with their model names.
 */
import type { AgentTelemetryConfig } from "@oh-my-pi/pi-agent-core";
import { type ChoiceQuestion, judgeQuestions, type Model } from "@oh-my-pi/pi-ai";
import { logger } from "@oh-my-pi/pi-utils";
import type { ModelRegistry } from "../config/model-registry";
import type { Settings } from "../config/settings";
import { type JudgmentUsage, resolveJudge, sharedJudgmentCache } from "../judgment";
import questionFile from "../prompts/judge/plan-execution-model.json" with { type: "json" };
import type { ResolvedRoleModel } from "../session/agent-session-types";
import { preprocessTinyMessage } from "../tiny/message-preproc";

const QUESTIONS = judgeQuestions(questionFile);

/** Upper bound on the recommendation; the approval dialog waits for it. */
const PLAN_EXECUTION_JUDGE_TIMEOUT_MS = 8000;

export interface RecommendPlanExecutionRoleDeps {
	settings: Settings;
	registry: ModelRegistry;
	/** Active session model; last resort of the judge role chain. */
	model?: Model;
	sessionId: string;
	metadataResolver?: (provider: string) => Record<string, unknown> | undefined;
	/** Session ledger for the recommendation's billed attempts. */
	onUsage?: (usage: JudgmentUsage) => void;
	telemetry?: AgentTelemetryConfig;
}

/** Role id from `models` the judge recommends, or `undefined` when no judge answered. */
export async function recommendPlanExecutionRole(
	planContent: string,
	models: readonly ResolvedRoleModel[],
	deps: RecommendPlanExecutionRoleDeps,
): Promise<string | undefined> {
	if (models.length < 2) return undefined;
	const criteria: Record<string, string> = {};
	for (const entry of models) {
		const name = entry.model.name || entry.model.id;
		criteria[entry.role] = entry.thinkingLevel ? `${name} (thinking ${entry.thinkingLevel})` : name;
	}
	const question: ChoiceQuestion = { ...QUESTIONS.model, criteria };
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PLAN_EXECUTION_JUDGE_TIMEOUT_MS);
	try {
		const judge = resolveJudge({
			settings: deps.settings,
			registry: deps.registry,
			sessionModel: deps.model,
			sessionId: deps.sessionId,
			metadataResolver: deps.metadataResolver,
			purpose: "plan-execution-model",
			onUsage: deps.onUsage,
			telemetry: deps.telemetry,
			cache: sharedJudgmentCache(),
		});
		const { answers } = await judge.judge(
			{ state: { plan: preprocessTinyMessage(planContent) }, questions: { model: question } },
			{ signal: controller.signal },
		);
		const choice = answers.model.choice;
		return models.some(entry => entry.role === choice) ? choice : undefined;
	} catch (error) {
		logger.debug("plan-execution-model: classification failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	} finally {
		clearTimeout(timer);
	}
}
