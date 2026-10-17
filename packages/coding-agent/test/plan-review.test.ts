/**
 * Contract: with `plan.review.enabled`, `AgentSession.submitPlanProposal` reviews the
 * resolved plan with a different-family reviewer before the plan-mode handler sees it.
 * REJECT inside the round cap returns a refine result and never reaches the handler;
 * OKAY, the cap and every unreviewed outcome reach the handler (fail-open); only the
 * caller's own abort throws. Reviewer text never reaches a trusted channel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentMessage, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { createMockModel, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { resolveLocalUrlToPath } from "@oh-my-pi/pi-coding-agent/internal-urls";
import {
	type PlanApprovalDetails,
	planContentSha256,
	type ResolvedApprovedPlan,
} from "@oh-my-pi/pi-coding-agent/plan-mode/approved-plan";
import { AgentSession, type AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import * as structuredSubagentModule from "@oh-my-pi/pi-coding-agent/task/structured-subagent";
import type { StructuredSubagentResult } from "@oh-my-pi/pi-coding-agent/task/structured-subagent";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { dispatchResolutionDevice, type PlanProposalHandler } from "@oh-my-pi/pi-coding-agent/tools/resolve";
import { ToolAbortError } from "@oh-my-pi/pi-coding-agent/tools/tool-errors";
import type { SingleResult, StructuredSubagentOutput } from "@oh-my-pi/pi-tui/tools/task";
import { TempDir } from "@oh-my-pi/pi-utils";

const PLANNER = { provider: "anthropic", model: "claude-sonnet-4-5" } as const;
/** The real-loop mock stamps its own provider/id on every assistant message. */
const PLANNER_MOCK = { provider: PLANNER.provider, id: PLANNER.model };
const OPENAI_REVIEWER = { provider: "openai", model: "gpt-4o" } as const;
const PLAN_URL = "local://demo-plan.md";
const PLAN_TEXT = "# Demo plan\n\nShip it.\n";
const HANDLER_TEXT = "handled by host";
const BLOCKER = {
	area: "correctness",
	defect: "cites a missing\tfunction",
	evidence: "src/a.ts:10",
	change: "cite the real one",
};

type Verdict = { verdict: "OKAY" | "REJECT"; summary: string; blockers?: (typeof BLOCKER)[]; notes?: string[] };

function reviewerResult(options: {
	verdict?: Verdict;
	structured?: StructuredSubagentOutput;
	answeringModels?: SingleResult["answeringModels"];
	aborted?: boolean;
	exitCode?: number;
}): StructuredSubagentResult {
	const structured: StructuredSubagentOutput | undefined =
		options.structured ??
		(options.verdict ? { source: "caller", mode: "permissive", status: "valid", data: options.verdict } : undefined);
	const result: SingleResult = {
		index: 0,
		id: "PlanReview",
		agent: "plan-reviewer",
		agentSource: "bundled",
		task: "review",
		exitCode: options.exitCode ?? 0,
		output: "",
		stderr: "",
		truncated: false,
		durationMs: 5,
		tokens: 0,
		requests: 1,
		answeringModels: options.answeringModels ?? [OPENAI_REVIEWER],
		...(structured ? { structuredOutput: structured } : {}),
		...(options.aborted ? { aborted: true, abortReason: "runtime limit exceeded" } : {}),
	};
	return {
		result,
		policy: {} as StructuredSubagentResult["policy"],
		mergeSummary: "",
		changesApplied: null,
		artifactsDir: "/tmp",
		temporaryArtifacts: true,
	};
}

const okay = (notes?: string[]) => reviewerResult({ verdict: { verdict: "OKAY", summary: "fine", notes } });
const reject = () => reviewerResult({ verdict: { verdict: "REJECT", summary: "bad", blockers: [BLOCKER] } });

function resultText(result: { content: { type: string; text?: string }[] }): string {
	return result.content.map(block => (block.type === "text" ? (block.text ?? "") : "")).join("\n");
}

function messageText(message: AgentMessage): string {
	if (!("content" in message)) return "";
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map(block => (block.type === "text" ? block.text : "")).join("\n");
}

interface Harness {
	session: AgentSession;
	toolSession: ToolSession;
	handled: ResolvedApprovedPlan[];
	notices: Extract<AgentSessionEvent, { type: "notice" }>[];
	writeResults: { content: { type: string; text?: string }[]; details?: unknown }[];
	planPath: (url: string) => string;
}

describe("plan review runtime", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession | undefined;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@pi-plan-review-");
		authStorage = await AuthStorage.create(tempDir.join("auth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		authStorage.keys.setRuntime("openai", "test-key");
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		try {
			await session?.dispose();
		} finally {
			session = undefined;
			authStorage.close();
			await tempDir.remove();
		}
	});

	function createHarness(options: { responses?: MockResponse[]; enabled?: boolean } = {}): Harness {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled anthropic model to exist");
		const writeResults: Harness["writeResults"] = [];
		const sessionRef: { current?: AgentSession } = {};
		const toolSession = {
			cwd: tempDir.path(),
			submitPlanProposal: (title, call) => {
				if (!sessionRef.current) throw new Error("session not ready");
				return sessionRef.current.submitPlanProposal(title, call);
			},
		} as Pick<ToolSession, "cwd" | "submitPlanProposal"> as ToolSession;
		const writeTool: AgentTool = {
			name: "write",
			label: "write",
			description: "Test write that dispatches xd://propose",
			parameters: type({ path: "string", content: "string" }),
			async execute(toolCallId, params, signal) {
				const args = params as { path: string; content: string };
				if (args.path !== "xd://propose") return { content: [{ type: "text", text: "ok" }] };
				const { result, xdev } = await dispatchResolutionDevice(toolSession, "propose", args.content, {
					toolCallId,
					signal,
				});
				writeResults.push(result);
				return { content: result.content, details: { xdev } };
			},
		};
		const readTool: AgentTool = {
			name: "read",
			label: "read",
			description: "Fake read",
			parameters: type({}),
			async execute() {
				return { content: [{ type: "text", text: "ok" }] };
			},
		};
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [writeTool, readTool], messages: [] },
			streamFn: createMockModel({ ...PLANNER_MOCK, responses: options.responses ?? [] }).stream,
		});
		const created = new AgentSession({
			agent,
			sessionManager: SessionManager.create(tempDir.path(), tempDir.join("sessions")),
			settings: Settings.isolated({
				"compaction.enabled": false,
				"retry.enabled": false,
				"plan.review.enabled": options.enabled ?? true,
				"plan.review.models": ["openai/gpt-4o"],
			}),
			modelRegistry: new ModelRegistry(authStorage, tempDir.join("models.yml")),
		});
		session = created;
		sessionRef.current = created;
		created.setPlanModeState({ enabled: true, planFilePath: "local://PLAN.md" });
		const handled: ResolvedApprovedPlan[] = [];
		const handler: PlanProposalHandler = async plan => {
			handled.push(plan);
			const details: PlanApprovalDetails = { planFilePath: plan.planFilePath, title: plan.title, planExists: true };
			return { content: [{ type: "text", text: HANDLER_TEXT }], details };
		};
		created.setPlanProposalHandler(handler);
		const notices: Harness["notices"] = [];
		created.subscribe(event => {
			if (event.type === "notice") notices.push(event);
		});
		const planPath = (url: string) =>
			resolveLocalUrlToPath(url, {
				getArtifactsDir: () => created.sessionManager.getArtifactsDir(),
				getSessionId: () => created.sessionManager.getSessionId(),
			});
		return { session: created, toolSession, handled, notices, writeResults, planPath };
	}

	/** Records `assistant` as the proposer of `toolCallId`, the way the agent loop does. */
	function plannerMessage(toolCallId: string, provider: string = PLANNER.provider, model: string = PLANNER.model) {
		return {
			role: "assistant",
			content: [
				{ type: "toolCall", id: toolCallId, name: "write", arguments: { path: "xd://propose", content: "demo" } },
			],
			api: "anthropic-messages",
			provider,
			model,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		} satisfies AssistantMessage;
	}

	/** Drive one proposal through the real `#beforeToolCall` + `submitPlanProposal` path. */
	async function propose(harness: Harness, options: { signal?: AbortSignal; message?: AssistantMessage } = {}) {
		const toolCallId = `propose-${crypto.randomUUID()}`;
		const message = options.message ?? plannerMessage(toolCallId);
		const toolCall = message.content.find(block => block.type === "toolCall");
		if (!toolCall || toolCall.type !== "toolCall") throw new Error("planner message needs a tool call");
		const hook = harness.session.agent.beforeToolCall;
		if (!hook) throw new Error("session must install beforeToolCall");
		const tool = harness.session.agent.state.tools.find(candidate => candidate.name === "write");
		if (!tool) throw new Error("write tool missing");
		await hook({
			assistantMessage: message,
			toolCall,
			tool,
			args: toolCall.arguments,
			context: harness.session.agent.state as never,
		});
		return harness.session.submitPlanProposal("demo", {
			toolCallId: toolCall.id,
			signal: options.signal,
			toolSession: harness.toolSession,
		});
	}

	function auditEntries(harness: Harness): Record<string, unknown>[] {
		return harness.session.sessionManager
			.getEntries()
			.filter(entry => entry.type === "custom" && entry.customType === "plan-review")
			.map(entry => (entry.type === "custom" ? (entry.data as Record<string, unknown>) : {}));
	}

	it("T5-a OKAY: handler runs once, status line leads, notes go only to a notice", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const spy = vi
			.spyOn(structuredSubagentModule, "runStructuredSubagent")
			.mockResolvedValue(okay(["unverified: x-note"]));

		const result = await propose(harness);

		expect(harness.handled).toEqual([{ planFilePath: PLAN_URL, planContent: PLAN_TEXT, title: "demo" }]);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(result.content.length).toBe(2);
		expect(result.content.at(1)).toEqual({ type: "text", text: HANDLER_TEXT });
		expect(resultText(result)).not.toContain("x-note");
		expect(JSON.stringify(result.details)).not.toContain("x-note");
		expect(harness.notices.some(notice => notice.source === "plan-review" && notice.message.includes("x-note"))).toBe(
			true,
		);
		expect(harness.session.agent.state.messages.some(message => messageText(message).includes("x-note"))).toBe(false);
		expect((result.details as PlanApprovalDetails).planSha256).toBe(planContentSha256(PLAN_TEXT));
		const [audit] = auditEntries(harness);
		expect(audit).toMatchObject({ outcome: "okay", round: 1, planSha256: planContentSha256(PLAN_TEXT) });
		expect(JSON.stringify(audit)).not.toContain("x-note");
	});

	it("T5-b REJECT rounds 1 and 2 block, carry the sanitized blocker, and promote the reviewed path", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(reject());

		const first = await propose(harness);
		const second = await propose(harness);

		expect(harness.handled).toEqual([]);
		for (const [index, result] of [first, second].entries()) {
			expect(resultText(result)).toContain("cites a missing   function");
			expect(resultText(result)).not.toContain("\t");
			expect(result.details).toEqual({ planReview: { outcome: "reject", round: index + 1 } });
		}
		expect(harness.session.getPlanModeState()?.planFilePath).toBe(PLAN_URL);
		expect(auditEntries(harness).map(entry => entry.outcome)).toEqual(["reject", "reject"]);
		expect(JSON.stringify(auditEntries(harness))).not.toContain("cites a missing");
	});

	it("T5-c third REJECT passes with a blocker notice and resets the series", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(reject());

		await propose(harness);
		await propose(harness);
		const capped = await propose(harness);
		const afterReset = await propose(harness);

		expect(harness.handled.length).toBe(1);
		expect(resultText(capped)).toContain(HANDLER_TEXT);
		expect((capped.details as PlanApprovalDetails).planSha256).toBe(planContentSha256(PLAN_TEXT));
		expect(
			harness.notices.some(
				notice => notice.level === "warning" && notice.message.includes("cites a missing   function"),
			),
		).toBe(true);
		expect(afterReset.details).toEqual({ planReview: { outcome: "reject", round: 1 } });
		expect(auditEntries(harness).map(entry => entry.outcome)).toEqual(["reject", "reject", "cap", "reject"]);
	});

	it("T5-d a reviewer answered by the planner's family is unreviewed/family-unverified and passes", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(
			reviewerResult({
				verdict: { verdict: "REJECT", summary: "bad", blockers: [BLOCKER] },
				answeringModels: [OPENAI_REVIEWER, { provider: "anthropic", model: "claude-opus-4-1" }],
			}),
		);

		const result = await propose(harness);

		expect(harness.handled.length).toBe(1);
		expect(resultText(result)).toContain(HANDLER_TEXT);
		expect(resultText(result)).not.toContain("cites a missing");
		expect((result.details as PlanApprovalDetails).planSha256).toBeUndefined();
		expect(
			harness.notices.some(notice => notice.level === "warning" && notice.message.includes("family-unverified")),
		).toBe(true);
		expect(auditEntries(harness)[0]).toMatchObject({ outcome: "unreviewed", reason: "family-unverified" });
	});

	it("T5-e caller abort throws ToolAbortError and counts no round", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const controller = new AbortController();
		const spy = vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockImplementationOnce(async () => {
			controller.abort();
			throw new structuredSubagentModule.StructuredSubagentError("execution", "aborted");
		});

		await expect(propose(harness, { signal: controller.signal })).rejects.toBeInstanceOf(ToolAbortError);
		spy.mockResolvedValue(reject());
		const next = await propose(harness);

		expect(harness.handled).toEqual([]);
		expect(next.details).toEqual({ planReview: { outcome: "reject", round: 1 } });
		expect(auditEntries(harness).map(entry => entry.outcome)).toEqual(["reject"]);
	});

	it("T5-l a child-only abort (runtime limit) is unreviewed/reviewer-failed and passes", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(
			reviewerResult({ aborted: true, exitCode: 1 }),
		);

		const result = await propose(harness, { signal: new AbortController().signal });

		expect(harness.handled.length).toBe(1);
		expect(resultText(result)).toContain(HANDLER_TEXT);
		expect(
			harness.notices.some(notice => notice.level === "warning" && notice.message.includes("reviewer-failed")),
		).toBe(true);
	});

	it("T5-f an unclassifiable planner is unreviewed/planner-unknown and never spawns the reviewer", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const spy = vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(reject());
		const toolCallId = "propose-unknown";

		const result = await propose(harness, { message: plannerMessage(toolCallId, "mock", "mock-model") });

		expect(spy).not.toHaveBeenCalled();
		expect(harness.handled.length).toBe(1);
		expect(resultText(result)).toContain(HANDLER_TEXT);
		expect(auditEntries(harness)[0]).toMatchObject({ outcome: "unreviewed", reason: "planner-unknown" });
	});

	it("T5-g the planner identity is the message that proposed, driven through the real loop", async () => {
		const harness = createHarness({
			responses: [
				{ content: [{ type: "toolCall", name: "write", arguments: { path: "xd://propose", content: "demo" } }] },
				{ content: ["waiting for review"] },
			],
		});
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const assignments: string[] = [];
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockImplementation(async request => {
			assignments.push(request.assignment);
			return okay();
		});

		await harness.session.prompt("propose the plan");
		await harness.session.waitForIdle();

		expect(assignments.length).toBe(1);
		expect(assignments[0]).toContain("Ship it.");
		expect(harness.handled.length).toBe(1);
		expect(auditEntries(harness)[0]?.planner).toEqual({ provider: PLANNER.provider, model: PLANNER.model });
	});

	it("T5-h a proposal without a recorded identity is refused", async () => {
		const harness = createHarness({
			responses: [{ content: [{ type: "toolCall", name: "read", arguments: {} }] }, { content: ["done"] }],
		});
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const spy = vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(okay());
		await harness.session.prompt("look around");
		await harness.session.waitForIdle();

		await expect(
			harness.session.submitPlanProposal("demo", { toolCallId: "never-recorded", toolSession: harness.toolSession }),
		).rejects.toThrow("write xd://propose as a top-level tool call");
		expect(spy).not.toHaveBeenCalled();
		expect(harness.handled).toEqual([]);
	});

	it("T5-i a propose call followed by another call in its message is refused", async () => {
		const harness = createHarness({
			responses: [
				{
					content: [
						{ type: "toolCall", name: "write", arguments: { path: "xd://propose", content: "demo" } },
						{ type: "toolCall", name: "read", arguments: {} },
					],
				},
				{ content: ["done"] },
			],
		});
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const spy = vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(okay());

		await harness.session.prompt("propose the plan");
		await harness.session.waitForIdle();

		const proposeResult = harness.session.agent.state.messages.find(
			message => message.role === "toolResult" && message.toolName === "write",
		);
		expect(proposeResult && messageText(proposeResult)).toContain("last tool call of its message");
		expect(spy).not.toHaveBeenCalled();
		expect(harness.handled).toEqual([]);
	});

	it("T5-j disabled review: no reviewer, no status line, the handler result unchanged", async () => {
		const harness = createHarness({ enabled: false });
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		const spy = vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(reject());

		const result = await harness.session.submitPlanProposal("demo", { toolCallId: "unrecorded" });

		expect(spy).not.toHaveBeenCalled();
		expect(result.content).toEqual([{ type: "text", text: HANDLER_TEXT }]);
		expect(result.details).toEqual({ planFilePath: PLAN_URL, title: "demo", planExists: true });
		expect(auditEntries(harness)).toEqual([]);
	});

	it("T5-k an invalid structured verdict is unreviewed/no-verdict and passes", async () => {
		const harness = createHarness();
		await Bun.write(harness.planPath(PLAN_URL), PLAN_TEXT);
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockResolvedValue(
			reviewerResult({
				structured: { source: "caller", mode: "permissive", status: "invalid", data: { verdict: "MAYBE" } },
			}),
		);

		const result = await propose(harness);

		expect(harness.handled.length).toBe(1);
		expect(resultText(result)).toContain(HANDLER_TEXT);
		expect(auditEntries(harness)[0]).toMatchObject({ outcome: "unreviewed", reason: "no-verdict" });
	});
});
