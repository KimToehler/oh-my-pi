/**
 * Contract: a `write xd://propose` that the model emits and the real agent loop executes
 * reaches each plan-approval installer (interactive-shaped, plan-yolo, ACP) only through
 * the cross-family review. A REJECT leaves the installer's side effects untouched; an
 * OKAY runs the installer once, with exactly the plan bytes the reviewer was shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentMessage, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolResultMessage } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { resolveLocalUrlToPath } from "@oh-my-pi/pi-coding-agent/internal-urls";
import { AcpAgent } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-agent";
import {
	planContentSha256,
	planReviewResult,
	type ResolvedApprovedPlan,
} from "@oh-my-pi/pi-coding-agent/plan-mode/approved-plan";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { PrewalkCoordinator, type PrewalkCoordinatorHost } from "@oh-my-pi/pi-coding-agent/session/prewalk";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import * as structuredSubagentModule from "@oh-my-pi/pi-coding-agent/task/structured-subagent";
import type { StructuredSubagentResult } from "@oh-my-pi/pi-coding-agent/task/structured-subagent";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { dispatchResolutionDevice } from "@oh-my-pi/pi-coding-agent/tools/resolve";
import type { SingleResult } from "@oh-my-pi/pi-tui/tools/task";
import { getConfigRootDir, isEnoent, setAgentDir, TempDir } from "@oh-my-pi/pi-utils";
import type {
	AgentSideConnection,
	CreateElicitationRequest,
	CreateElicitationResponse,
	SessionNotification,
} from "@oh-my-pi/pi-utils/acp";

const PLANNER_MOCK = { provider: "anthropic", id: "claude-sonnet-4-5" };
const PLAN_URL = "local://demo-plan.md";
/** Carries a backtick run so the reviewer's adaptive fence is exercised, not just the 3-tick default. */
const PLAN_TEXT = "# Demo plan\n\nRun ```bun test``` before shipping.\n";
const AUTOSAVE_FILE = "DEMO_PLAN.md";
const BLOCKER = { area: "correctness", defect: "cites a missing function", evidence: "src/a.ts:10", change: "fix" };

type Verdict = "OKAY" | "REJECT";

function reviewerResult(verdict: Verdict): StructuredSubagentResult {
	const data = verdict === "OKAY" ? { verdict, summary: "fine" } : { verdict, summary: "bad", blockers: [BLOCKER] };
	const result: SingleResult = {
		index: 0,
		id: "PlanReview",
		agent: "plan-reviewer",
		agentSource: "bundled",
		task: "review",
		exitCode: 0,
		output: "",
		stderr: "",
		truncated: false,
		durationMs: 5,
		tokens: 0,
		requests: 1,
		answeringModels: [{ provider: "openai", model: "gpt-4o" }],
		structuredOutput: { source: "caller", mode: "permissive", status: "valid", data },
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

function messageContent(message: AgentMessage): string {
	if (!("content" in message)) return "";
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map(block => (block.type === "text" ? block.text : "")).join("\n");
}

/** The plan body inside the reviewer assignment's fenced block (fence length adapts to the plan). */
function reviewedPlanText(assignment: string): string | undefined {
	return /(`{3,})markdown\n([\s\S]*?)\n\1/.exec(assignment)?.[2];
}

interface Harness {
	session: AgentSession;
	cwd: string;
	planPath: string;
}

describe("plan review through the real agent loop, per approval installer", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession | undefined;
	let acpAgent: AcpAgent | undefined;
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@pi-plan-review-dispatch-");
		authStorage = await AuthStorage.create(tempDir.join("auth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		authStorage.keys.setRuntime("openai", "test-key");
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		try {
			await acpAgent?.dispose();
			await session?.dispose();
		} finally {
			acpAgent = undefined;
			session = undefined;
			if (originalAgentDir) setAgentDir(originalAgentDir);
			else {
				setAgentDir(path.join(getConfigRootDir(), "agent"));
				delete process.env.PI_CODING_AGENT_DIR;
			}
			authStorage.close();
			await tempDir.remove();
		}
	});

	/**
	 * A real session whose model proposes `demo` through a `write` tool that dispatches
	 * `xd://propose` from inside the loop, so `#beforeToolCall` records the planner.
	 */
	function createHarness(options: { reviewEnabled?: boolean } = {}): Harness {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled anthropic model to exist");
		const cwd = tempDir.path();
		const sessionRef: { current?: AgentSession } = {};
		const toolSession = {
			cwd,
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
		const mock = createMockModel({
			...PLANNER_MOCK,
			responses: [
				{ content: [{ type: "toolCall", name: "write", arguments: { path: "xd://propose", content: "demo" } }] },
			],
			handler: () => ({ content: ["done"] }),
		});
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [readTool, writeTool], messages: [] },
			streamFn: mock.stream,
		});
		const created = new AgentSession({
			agent,
			sessionManager: SessionManager.create(cwd, tempDir.join("sessions")),
			settings: Settings.isolated({
				"compaction.enabled": false,
				"retry.enabled": false,
				"plan.autosave": true,
				"plan.review.enabled": options.reviewEnabled ?? true,
				"plan.review.models": ["openai/gpt-4o"],
			}),
			modelRegistry: new ModelRegistry(authStorage, tempDir.join("models.yml")),
			toolRegistry: new Map([
				["read", readTool],
				["write", writeTool],
			]),
			builtInToolNames: ["read", "write"],
		});
		session = created;
		sessionRef.current = created;
		const planPath = resolveLocalUrlToPath(PLAN_URL, {
			getArtifactsDir: () => created.sessionManager.getArtifactsDir(),
			getSessionId: () => created.sessionManager.getSessionId(),
		});
		return { session: created, cwd, planPath };
	}

	/** Stubs the reviewer subagent and records each assignment it is given. */
	function stubReviewer(verdict: Verdict): string[] {
		const assignments: string[] = [];
		vi.spyOn(structuredSubagentModule, "runStructuredSubagent").mockImplementation(async request => {
			assignments.push(request.assignment);
			return reviewerResult(verdict);
		});
		return assignments;
	}

	/** Wraps the installer's handler so a row can see the plan it was handed; behaviour is unchanged. */
	function recordInstalledHandler(harness: Harness): ResolvedApprovedPlan[] {
		const installed = harness.session.peekPlanProposalHandler();
		if (!installed) throw new Error("installer did not register a plan proposal handler");
		const handled: ResolvedApprovedPlan[] = [];
		harness.session.setPlanProposalHandler(plan => {
			handled.push(plan);
			return installed(plan);
		});
		return handled;
	}

	async function driveProposal(harness: Harness): Promise<void> {
		await Bun.write(harness.planPath, PLAN_TEXT);
		await harness.session.prompt("propose the plan");
		await harness.session.waitForIdle();
	}

	function proposeToolResult(harness: Harness): ToolResultMessage {
		const proposeResult = harness.session.agent.state.messages.find(
			(message: AgentMessage) => message.role === "toolResult" && message.toolName === "write",
		);
		if (!proposeResult || proposeResult.role !== "toolResult") throw new Error("propose produced no tool result");
		return proposeResult;
	}

	/** The xdev `inner` details of the loop's propose tool result. */
	function proposeInner(harness: Harness): Record<string, unknown> {
		const details = proposeToolResult(harness).details as { xdev?: { inner?: Record<string, unknown> } } | undefined;
		return details?.xdev?.inner ?? {};
	}

	function autosavePath(harness: Harness): string {
		return path.join(harness.cwd, ".omp", "plans", AUTOSAVE_FILE);
	}

	function reviewAuditSha(harness: Harness): unknown {
		const audit = harness.session.sessionManager
			.getEntries()
			.find(entry => entry.type === "custom" && entry.customType === "plan-review");
		return audit?.type === "custom" ? (audit.data as { planSha256?: unknown }).planSha256 : undefined;
	}

	function localPath(harness: Harness, url: string): string {
		return resolveLocalUrlToPath(url, {
			getArtifactsDir: () => harness.session.sessionManager.getArtifactsDir(),
			getSessionId: () => harness.session.sessionManager.getSessionId(),
		});
	}

	async function approvedSnapshots(harness: Harness): Promise<string[]> {
		try {
			return await fs.readdir(localPath(harness, "local://approved"));
		} catch (error) {
			if (isEnoent(error)) return [];
			throw error;
		}
	}

	function expectReviewedBytesReachedInstaller(assignments: string[], handled: ResolvedApprovedPlan[]): void {
		expect(assignments.length).toBe(1);
		expect(handled.length).toBe(1);
		expect(handled[0]?.planContent).toBe(PLAN_TEXT);
		expect(reviewedPlanText(assignments[0] ?? "")).toBe(handled[0]?.planContent);
	}

	describe("interactive-shaped installer (planReviewResult)", () => {
		function installInteractive(harness: Harness): ResolvedApprovedPlan[] {
			harness.session.setPlanModeState({ enabled: true, planFilePath: "local://PLAN.md" });
			harness.session.setPlanProposalHandler(async plan => planReviewResult(plan));
			return recordInstalledHandler(harness);
		}

		it("REJECT: the approval details never reach the propose result", async () => {
			const harness = createHarness();
			const handled = installInteractive(harness);
			const assignments = stubReviewer("REJECT");

			await driveProposal(harness);

			expect(assignments.length).toBe(1);
			expect(handled).toEqual([]);
			expect(proposeInner(harness)).not.toHaveProperty("planExists");
		});

		it("OKAY: the installer runs once and its approval binds the reviewed bytes", async () => {
			const harness = createHarness();
			const handled = installInteractive(harness);
			const assignments = stubReviewer("OKAY");

			await driveProposal(harness);

			expectReviewedBytesReachedInstaller(assignments, handled);
			expect(proposeInner(harness)).toMatchObject({
				planFilePath: PLAN_URL,
				planExists: true,
				planSha256: planContentSha256(PLAN_TEXT),
			});
		});
	});

	describe("plan-yolo installer (PrewalkCoordinator)", () => {
		async function installPlanYolo(
			harness: Harness,
		): Promise<{ handled: ResolvedApprovedPlan[]; switches: string[]; targetId: string }> {
			const target = getBundledModel("anthropic", "claude-opus-4-1");
			if (!target) throw new Error("Expected bundled anthropic target model to exist");
			const live = harness.session;
			const switches: string[] = [];
			const host: PrewalkCoordinatorHost = {
				agent: live.agent,
				sessionManager: live.sessionManager,
				settings: live.settings,
				model: () => live.model,
				configuredThinkingLevel: () => live.configuredThinkingLevel(),
				restoreThinkingLevel: () => {},
				resolveDefaultPrewalk: () => undefined,
				emitNotice: (level, message, source) => live.emitNotice(level, message, source),
				setModelTemporary: async model => {
					switches.push(model.id);
				},
				setActiveToolsByName: names => live.setActiveToolsByName(names),
				restoreNonMCPToolPresentation: (enabled, mounted) => live.restoreNonMCPToolPresentation(enabled, mounted),
				getActiveToolNames: () => live.getActiveToolNames(),
				getEnabledToolNames: () => live.getEnabledToolNames(),
				getMountedXdevToolNames: () => live.getMountedXdevToolNames(),
				hasBuiltInTool: name => live.hasBuiltInTool(name),
				getPlanModeState: () => live.getPlanModeState(),
				setPlanModeState: state => live.setPlanModeState(state),
				getPlanReferencePath: () => live.getPlanReferencePath(),
				adoptApprovedPlan: plan => live.adoptApprovedPlan(plan),
				setPlanProposalHandler: handler => live.setPlanProposalHandler(handler),
				waitForSessionMessagePersistence: async () => {},
			};
			await new PrewalkCoordinator(host, { planYolo: { target } }).armPlanYoloIfNeeded();
			return { handled: recordInstalledHandler(harness), switches, targetId: target.id };
		}

		it("REJECT: plan mode stays on, no model switch, no autosave", async () => {
			const harness = createHarness();
			const { handled, switches } = await installPlanYolo(harness);
			const assignments = stubReviewer("REJECT");

			await driveProposal(harness);

			expect(assignments.length).toBe(1);
			expect(handled).toEqual([]);
			expect(harness.session.getPlanModeState()?.enabled).toBe(true);
			expect(switches).toEqual([]);
			expect(await Bun.file(autosavePath(harness)).exists()).toBe(false);
		});

		it("OKAY: one hand-off to the target model, autosaving the reviewed bytes", async () => {
			const harness = createHarness();
			const { handled, switches, targetId } = await installPlanYolo(harness);
			const assignments = stubReviewer("OKAY");

			await driveProposal(harness);

			expectReviewedBytesReachedInstaller(assignments, handled);
			expect(switches).toEqual([targetId]);
			expect(harness.session.getPlanModeState()).toBeUndefined();
			expect(await Bun.file(autosavePath(harness)).text()).toBe(PLAN_TEXT);
		});

		it("OKAY: the executor is handed the reviewed bytes, not the plan file edited afterwards", async () => {
			const harness = createHarness();
			await installPlanYolo(harness);
			stubReviewer("OKAY");

			await driveProposal(harness);
			await Bun.write(harness.planPath, "# Swapped plan\n");

			const handoffs = harness.session.agent.state.messages.filter(
				message => message.role === "custom" && message.customType === "plan-yolo-handoff",
			);
			expect(handoffs.length).toBe(1);
			const handoff = handoffs[0];
			const details = handoff?.role === "custom" ? (handoff.details as { planFilePath?: string }) : undefined;
			const handedUrl = details?.planFilePath ?? "";
			expect(handedUrl).toStartWith("local://");
			expect(handedUrl).not.toBe(PLAN_URL);
			expect(handoff && messageContent(handoff)).toContain(handedUrl);
			const handedBytes = await Bun.file(localPath(harness, handedUrl)).text();
			expect(handedBytes).toBe(PLAN_TEXT);
			expect(planContentSha256(handedBytes)).toBe(reviewAuditSha(harness) as string);
		});

		it("review disabled: the executor is handed the agent-chosen plan file and no snapshot is written", async () => {
			const harness = createHarness({ reviewEnabled: false });
			const { switches, targetId } = await installPlanYolo(harness);

			await driveProposal(harness);

			const handoffs = harness.session.agent.state.messages.filter(
				message => message.role === "custom" && message.customType === "plan-yolo-handoff",
			);
			expect(handoffs.length).toBe(1);
			const handoff = handoffs[0];
			const details = handoff?.role === "custom" ? (handoff.details as { planFilePath?: string }) : undefined;
			expect(details?.planFilePath).toBe(PLAN_URL);
			expect(handoff && messageContent(handoff)).toContain(PLAN_URL);
			expect(switches).toEqual([targetId]);
			expect(await approvedSnapshots(harness)).toEqual([]);
		});
	});

	describe("ACP installer (AcpAgent plan mode)", () => {
		async function installAcp(harness: Harness): Promise<{
			handled: ResolvedApprovedPlan[];
			elicitations: CreateElicitationRequest[];
			updates: SessionNotification[];
		}> {
			setAgentDir(tempDir.join("agent"));
			const elicitations: CreateElicitationRequest[] = [];
			const updates: SessionNotification[] = [];
			const connection = {
				sessionUpdate: async (notification: SessionNotification) => {
					updates.push(notification);
				},
				unstable_createElicitation: async (
					request: CreateElicitationRequest,
				): Promise<CreateElicitationResponse> => {
					elicitations.push(request);
					return { action: "accept", content: { value: "approve" } };
				},
				signal: new AbortController().signal,
				closed: Promise.withResolvers<void>().promise,
			} as unknown as AgentSideConnection;
			const live = harness.session;
			acpAgent = new AcpAgent(connection, async () => ({ session: live, setToolUIContext: () => {} }));
			await acpAgent.initialize({
				protocolVersion: 1,
				clientCapabilities: { elicitation: { form: {} } },
			} as Parameters<AcpAgent["initialize"]>[0]);
			const created = await acpAgent.newSession({ cwd: harness.cwd, mcpServers: [] });
			expect(created.sessionId).toBe(live.sessionId);
			await acpAgent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });
			return { handled: recordInstalledHandler(harness), elicitations, updates };
		}

		it("REJECT: no approval elicitation, plan mode stays on", async () => {
			const harness = createHarness();
			const { handled, elicitations } = await installAcp(harness);
			const assignments = stubReviewer("REJECT");

			await driveProposal(harness);

			expect(assignments.length).toBe(1);
			expect(handled).toEqual([]);
			expect(elicitations).toEqual([]);
			expect(harness.session.getPlanModeState()?.enabled).toBe(true);
			expect(await Bun.file(autosavePath(harness)).exists()).toBe(false);
		});

		it("OKAY: one approval elicitation, then plan mode exits on the reviewed plan", async () => {
			const harness = createHarness();
			const { handled, elicitations, updates } = await installAcp(harness);
			const assignments = stubReviewer("OKAY");
			const updatesBefore = updates.length;

			await driveProposal(harness);

			expectReviewedBytesReachedInstaller(assignments, handled);
			expect(elicitations.length).toBe(1);
			expect(harness.session.getPlanModeState()).toBeUndefined();
			expect(await Bun.file(autosavePath(harness)).text()).toBe(PLAN_TEXT);
			expect(
				updates
					.slice(updatesBefore)
					.some(
						notification =>
							notification.update.sessionUpdate === "current_mode_update" &&
							notification.update.currentModeId === "default",
					),
			).toBe(true);
		});

		it("OKAY: the next execution turn carries the reviewed bytes, not the plan file edited afterwards", async () => {
			const harness = createHarness();
			await installAcp(harness);
			stubReviewer("OKAY");

			await driveProposal(harness);
			await Bun.write(harness.planPath, "# Swapped plan\n");
			await harness.session.prompt("implement it");
			await harness.session.waitForIdle();

			const referenceUrl = harness.session.getPlanReferencePath();
			expect(referenceUrl).not.toBe(PLAN_URL);
			expect(messageContent(proposeToolResult(harness))).toContain(referenceUrl);
			const referencedBytes = await Bun.file(localPath(harness, referenceUrl)).text();
			expect(referencedBytes).toBe(PLAN_TEXT);
			expect(planContentSha256(referencedBytes)).toBe(reviewAuditSha(harness) as string);
			const references = harness.session.agent.state.messages.filter(
				message => message.role === "custom" && message.customType === "plan-mode-reference",
			);
			expect(references.length).toBe(1);
			const injected = references[0] ? messageContent(references[0]) : "";
			expect(injected).toContain(PLAN_TEXT.trim());
			expect(injected).not.toContain("Swapped plan");
		});

		it("review disabled: approval references the agent-chosen plan file and no snapshot is written", async () => {
			const harness = createHarness({ reviewEnabled: false });
			const { elicitations } = await installAcp(harness);

			await driveProposal(harness);

			expect(elicitations.length).toBe(1);
			expect(harness.session.getPlanModeState()).toBeUndefined();
			expect(harness.session.getPlanReferencePath()).toBe(PLAN_URL);
			expect(messageContent(proposeToolResult(harness))).toContain(PLAN_URL);
			expect(await approvedSnapshots(harness)).toEqual([]);
		});
	});
});
