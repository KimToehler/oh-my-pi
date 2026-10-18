/**
 * Settings declared by this domain (see `config/registry.ts`). Declaration order is the
 * settings-panel order; `config/all-settings.ts` registers every domain.
 */
import { register } from "../config/registry";

// ────────────────────────────────────────────────────────────────────────
// Tasks
// ────────────────────────────────────────────────────────────────────────

// Plan mode
export const cfgPlanEnabled = register({
	id: "plan.enabled",
	type: "boolean",
	default: true,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Plan Mode",
		description: "Enable plan mode for read-only exploration and planning before execution",
	},
});

export const cfgPlanDefaultOnStartup = register({
	id: "plan.defaultOnStartup",
	type: "boolean",
	default: false,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Start in Plan Mode",
		description: "Automatically enter plan mode at the start of every new session",
		condition: "planModeEnabled",
	},
});

export const cfgPlanAutosave = register({
	id: "plan.autosave",
	type: "boolean",
	default: false,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Autosave Plans",
		description: "Automatically save approved plans to disk when plan mode completes",
		condition: "planModeEnabled",
	},
});

export const cfgPlanAutosaveDir = register({
	id: "plan.autosaveDir",
	type: "string",
	default: undefined,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Autosave Directory",
		description:
			"Directory for autosaved plans. Supports ~, absolute, and cwd-relative paths. Empty uses <project>/.omp/plans/.",
		condition: "planAutosaveEnabled",
	},
});

export const cfgPlanReviewEnabled = register({
	id: "plan.review.enabled",
	type: "boolean",
	default: false,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Cross-family Plan Review",
		description:
			"Before a plan reaches approval, a reviewer from a different model family checks it. A rejection goes back to the planner (at most 2 rounds); a review that cannot run never blocks.",
		condition: "planModeEnabled",
	},
});

export const cfgPlanReviewAgent = register({
	id: "plan.review.agent",
	type: "string",
	default: "plan-reviewer",
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Plan Review Agent",
		description:
			"Agent that reviews proposed plans. Any discovered agent works, e.g. a user ~/.omp/agent/agents/momus.md; the default is the bundled plan-reviewer.",
		condition: "planReviewEnabled",
	},
});

const DEFAULT_PLAN_REVIEW_MODELS: readonly string[] = ["@advisor", "@slow", "@default"];

export const cfgPlanReviewModels = register({
	id: "plan.review.models",
	type: "array",
	default: DEFAULT_PLAN_REVIEW_MODELS,
	ui: {
		tab: "tasks",
		group: "Modes",
		label: "Plan Review Models",
		editor: "json",
		description:
			"Reviewer model candidates in order; the first whose model family differs from the planner's is used",
		condition: "planReviewEnabled",
	},
});
