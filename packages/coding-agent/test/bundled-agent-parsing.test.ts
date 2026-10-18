import { describe, expect, it } from "bun:test";
import { Effort } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import {
	resolveAgentModelPatterns,
	resolveAgentModelSelection,
	resolveModelOverride,
} from "@oh-my-pi/pi-coding-agent/config/model-resolver";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { getBundledAgent } from "@oh-my-pi/pi-coding-agent/task/agents";
import { buildOutputValidator } from "@oh-my-pi/pi-coding-agent/tools/output-schema-validator";
import { AUTO_THINKING } from "@oh-my-pi/pi-tui/thinking";

describe("bundled agent parsing", () => {
	it("defaults the task agent to the auto thinking selector", () => {
		const task = getBundledAgent("task");

		expect(task).toBeDefined();
		expect(task?.model).toEqual(["@task"]);
		expect(task?.thinkingLevel).toBe(AUTO_THINKING);
	});

	it("accepts security-reviewer findings with optional remediation metadata", () => {
		const securityReviewer = getBundledAgent("security-reviewer");
		const findingValidator = buildOutputValidator(securityReviewer?.output).validator?.validateSection.get(
			"findings",
		);

		expect(findingValidator).toBeDefined();
		expect(
			findingValidator?.({
				rule_id: "command-injection",
				title: "Unsanitized command input",
				summary: "User input reaches a shell command",
				severity: "high",
				confidence: "high",
				category: "injection",
				locations: [{ path: "src/run.ts", start_line: 10 }],
				cwe: ["CWE-78"],
				evidence: [{ label: "data flow", explanation: "Input reaches exec" }],
				anchor: "run",
				remediation: "Pass arguments without a shell",
			}).success,
		).toBe(true);
	});

	// The plan-review runtime spawns this agent with plan-mode tool forcing and reads the verdict
	// from its structured output; a widened tool list or a schema that accepts any verdict would
	// let the reviewer write files or slip an unknown verdict past the outcome rules.
	it("parses plan-reviewer as a read-only agent whose output schema only accepts OKAY or REJECT", () => {
		const planReviewer = getBundledAgent("plan-reviewer");
		expect(planReviewer?.tools).toEqual(["read", "grep", "glob"]);

		const built = buildOutputValidator(planReviewer?.output);
		expect(built.error).toBeUndefined();
		const validator = built.validator;
		if (!validator) throw new Error("plan-reviewer output schema must build a validator");

		expect(
			validator.validate({
				verdict: "REJECT",
				summary: "Plan claims a symbol that does not exist",
				blockers: [
					{
						area: "correctness",
						defect: "cited function is missing",
						evidence: "src/a.ts:10",
						change: "cite the real function",
					},
				],
				notes: ["unverified: runtime ordering"],
			}).success,
		).toBe(true);
		expect(validator.validate({ verdict: "OKAY", summary: "No evidenced blocker" }).success).toBe(true);
		expect(validator.validate({ verdict: "MAYBE", summary: "x" }).success).toBe(false);
		// A blocker without evidence is not a blocker: the schema requires every field.
		expect(
			validator.validate({
				verdict: "REJECT",
				summary: "x",
				blockers: [{ area: "correctness", defect: "d", change: "c" }],
			}).success,
		).toBe(false);
	});

	// Issue #4761: with `modelRoles.slow: ...:xhigh`, the role's explicit effort
	// suffix must survive agent-pattern expansion and model resolution for the
	// bundled agents routed at that role. The executor prefers an explicit
	// resolved suffix over the agent-definition default (task/executor.ts), so
	// the resolved level below is what the subagent runs at.
	it("resolves the configured slow-role effort suffix for reviewer", () => {
		const gpt55 = buildModel({
			id: "gpt-5.5",
			name: "GPT-5.5 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api/codex",
			reasoning: true,
			thinking: { mode: "effort", efforts: [Effort.Low, Effort.Medium, Effort.High, Effort.XHigh] },
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 272000,
			maxTokens: 128000,
		});
		const settings = Settings.isolated({
			modelRoles: { slow: "openai-codex/gpt-5.5:xhigh" },
		});
		const registry = { getAvailable: () => [gpt55] } as Parameters<typeof resolveModelOverride>[1];

		const agent = getBundledAgent("reviewer");
		expect(agent?.thinkingLevel).toBeUndefined();
		const patterns = resolveAgentModelPatterns({ agentModel: agent?.model, settings });
		const resolved = resolveModelOverride(patterns, registry, settings);
		expect(resolved.model?.provider).toBe("openai-codex");
		expect(resolved.model?.id).toBe("gpt-5.5");
		expect(resolved.thinkingLevel).toBe(Effort.XHigh);
		expect(resolved.explicitThinkingLevel).toBe(true);
	});

	// The alias is expanded before it reaches the executor, so the role identity
	// only survives as the `role` half of the selection. A subagent's inherited
	// `retry.fallbackChains` entry is keyed off it — lose it and every bundled
	// agent silently retries on the `default` role's chain.
	it("keeps the role identity of every alias-routed bundled agent through expansion", () => {
		const settings = Settings.isolated({
			modelRoles: {
				default: "anthropic/opus",
				task: "anthropic/sonnet",
				smol: "fast/hy3",
				slow: "codex/sol",
			},
		});

		for (const [name, role, model] of [
			["task", "task", "anthropic/sonnet"],
			["sonic", "smol", "fast/hy3"],
			["scout", "smol", "fast/hy3"],
			["reviewer", "slow", "codex/sol"],
		] as const) {
			const agent = getBundledAgent(name);
			expect(resolveAgentModelSelection({ agentModel: agent?.model, settings })).toEqual({
				patterns: [model],
				role,
			});
		}
	});
});
