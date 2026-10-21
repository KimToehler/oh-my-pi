import { afterEach, describe, expect, it, spyOn, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AgentBusyError } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import type { ExtensionUIContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { resolveLocalUrlToPath } from "@oh-my-pi/pi-coding-agent/internal-urls";
import {
	ACP_BOOTSTRAP_RACE_GUARD_MS,
	AcpAgent,
	createAcpExtensionUiContext,
} from "@oh-my-pi/pi-coding-agent/modes/acp/acp-agent";
import {
	isPlanApprovalDetails,
	planContentSha256,
	type ResolvedApprovedPlan,
	resolveApprovedPlan,
} from "@oh-my-pi/pi-coding-agent/plan-mode/approved-plan";
import { listPlanFiles, readPlanFile } from "@oh-my-pi/pi-coding-agent/plan-mode/plan-files";
import type { PlanModeState } from "@oh-my-pi/pi-coding-agent/plan-mode/state";
import type { PlanProposalHandler, PlanProposalOwnershipReserver } from "@oh-my-pi/pi-coding-agent/tools/resolve";
import type {
	AgentSession,
	AgentSessionEvent,
	ResolvedRoleModel,
	RoleModelCycle,
	UsageFallbackConfirmation,
} from "@oh-my-pi/pi-coding-agent/session/agent-session";
import * as executionModelModule from "@oh-my-pi/pi-coding-agent/plan-mode/execution-model";
import { SILENT_ABORT_MARKER } from "@oh-my-pi/pi-coding-agent/session/messages";
import { closeSessionIndex } from "@oh-my-pi/pi-coding-agent/session/session-index";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TaskTool } from "@oh-my-pi/pi-coding-agent/task";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { getConfigRootDir, setAgentDir } from "@oh-my-pi/pi-utils";
import type {
	AgentSideConnection,
	ClientCapabilities,
	CreateElicitationRequest,
	CreateElicitationResponse,
	ElicitationPropertySchema,
	InitializeRequest,
	PromptRequest,
	SessionConfigOption,
	SessionNotification,
	Validator,
} from "@oh-my-pi/pi-utils/acp";
import {
	RequestError,
	zForkSessionResponse,
	zLoadSessionResponse,
	zNewSessionResponse,
	zPromptResponse,
	zSessionNotification,
} from "@oh-my-pi/pi-utils/acp";
import { TOOL_NAME as DELAYED_MCP_TOOL_NAME } from "./fixtures/delayed-tool-mcp";

import { cfgPlanAutosave, cfgPlanAutosaveDir, cfgPlanEnabled } from "@oh-my-pi/pi-coding-agent/plan-mode/settings";
import { cfgGoalEnabled } from "@oh-my-pi/pi-coding-agent/goals/settings";
import { type GoalOwnerStamp, GoalRuntime } from "@oh-my-pi/pi-coding-agent/goals/runtime";
import type { GoalHostSession } from "@oh-my-pi/pi-coding-agent/goals/host-controller";
import { AcpGoalActor } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-goal";
import type { GoalModeState, GoalRuntimeEvent } from "@oh-my-pi/pi-coding-agent/goals/state";
import type { Goal } from "@oh-my-pi/pi-tui/tools/goal";

/** Validates an ACP wire payload against the in-house protocol schemas. */
function expectAcpStructure(schema: Validator<unknown>, value: unknown): void {
	const result = schema.safeParse(value);
	expect(result.success, result.success ? undefined : JSON.stringify(result.error.issues, null, 2)).toBe(true);
}

const TEST_MODELS: Model[] = [
	buildModel({
		id: "claude-sonnet-4-20250514",
		name: "Claude Sonnet",
		api: "anthropic-messages",
		provider: "anthropic",
		baseUrl: "https://example.invalid",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200_000,
		maxTokens: 8_192,
	}),
	buildModel({
		id: "gpt-5.4",
		name: "GPT-5.4",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200_000,
		maxTokens: 8_192,
	}),
];

function createTaskSession(cwd: string): ToolSession {
	return {
		cwd,
		hasUI: false,
		settings: Settings.isolated({}),
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
	} as unknown as ToolSession;
}

function makeAssistantMessage(text: string, thinking?: string) {
	const content: Array<{ type: "text"; text: string } | { type: "thinking"; thinking: string }> = [
		{ type: "text", text },
	];
	if (thinking) {
		content.push({ type: "thinking" as const, thinking });
	}
	return {
		role: "assistant" as const,
		content,
		api: "anthropic-messages" as const,
		provider: "anthropic" as const,
		model: TEST_MODELS[0].id,
		usage: {
			input: 10,
			output: 5,
			cacheRead: 2,
			cacheWrite: 1,
			totalTokens: 18,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop" as const,
		timestamp: Date.now(),
	};
}

class FakeAgentSession {
	sessionManager: SessionManager;
	sessionId: string;
	agent: { sessionId: string; waitForIdle: () => Promise<void> };
	model: Model | undefined;
	thinkingLevel: string | undefined;
	customCommands: [] = [];
	extensionRunner: ExtensionRunner | undefined = undefined;
	isStreaming = false;
	queuedMessageCount = 0;
	systemPrompt = "system";
	disposed = false;
	fastMode = false;
	forcedToolChoice: string | undefined;
	get settings(): Settings {
		return Settings.instance;
	}
	promptCalls: string[] = [];
	/** Images forwarded with each `prompt()` call, index-aligned with `promptCalls`. */
	promptImages: unknown[][] = [];
	steerCalls: Array<{ text: string; images?: unknown[] }> = [];
	/** Resolved when `prompt()` starts streaming; lets a test await turn start. */
	promptEntered = Promise.withResolvers<void>();
	/** Awaited inside `prompt()` after streaming starts, so a test can hold a turn open. */
	promptGate: Promise<void> | undefined;
	contextUsage: { tokens: number | null; contextWindow: number; percent: number } | undefined;
	customMessages: Array<{ customType: string; content: string; details?: unknown }> = [];
	customMessageOptions: Array<{ streamingBehavior?: "steer" | "followUp"; queueChipText?: string } | undefined> = [];
	skillsSettings = { enableSkillCommands: true };
	skills: Array<{ name: string; description: string; filePath: string; baseDir: string; source: string }> = [];
	async refreshSkillsAndCommands(): Promise<void> {}
	subscribeCommandMetadataChanged(_listener: () => void): () => void {
		return () => {};
	}
	planModeState: PlanModeState | undefined;
	waitForIdleCalls = 0;
	waitForIdleBlocker: (() => Promise<void>) | undefined;
	hasAdmittedSubmission = false;
	hasPostPromptWork = false;
	/** Owner-scoped background work that can still wake the session; see `settleAsyncWork`. */
	pendingAsyncWork = false;
	/** Settles one generation of background work; tests override it to gate or emit a wake turn. */
	settleAsyncWork: () => Promise<void> = async () => {
		this.pendingAsyncWork = false;
	};
	abortCalls = 0;
	acpPromptOpen: boolean[] = [];
	/** Goal state the real `GoalRuntime` below reads and writes, as on `AgentSession`. */
	goalModeState: GoalModeState | undefined;
	enabledTools: string[] = ["read"];
	/** Names `isRegisteredPromptCommand` treats as extension/custom/file commands. */
	registeredPromptCommands: string[] = [];
	goalContextSends: string[] = [];
	/** Awaited by the fake runtime's `goal_updated` emit after listeners ran, as an awaited extension handler is. */
	goalEmitBlocker: ((event: GoalRuntimeEvent) => Promise<void>) | undefined;
	/** Added to the fake runtime's clock, so a test can make a usage flush find wall-clock time to account. */
	goalClockSkewMs = 0;
	/** Token total the fake runtime's usage reads report, so a test can make a flush find tokens to account. */
	goalUsageTokens = 0;
	isSessionTransitioning = false;
	readonly goalRuntime: GoalRuntime;
	usageFallbackConfirmer: ((confirmation: UsageFallbackConfirmation) => Promise<boolean>) | undefined;
	retryResult = false;
	retryCalls = 0;
	#listeners = new Set<(event: AgentSessionEvent) => void>();

	constructor(
		cwd: string,
		private readonly models: Model[] = TEST_MODELS,
	) {
		this.sessionManager = SessionManager.create(cwd);
		this.sessionId = this.sessionManager.getSessionId();
		this.agent = {
			sessionId: this.sessionId,
			waitForIdle: async () => {
				await this.waitForIdle();
			},
		};
		this.model = models[0];
		this.goalRuntime = new GoalRuntime({
			getState: () => this.goalModeState,
			setState: state => {
				this.goalModeState = state;
			},
			getCurrentUsage: () => ({ input: this.goalUsageTokens, output: 0, cacheRead: 0, cacheWrite: 0 }),
			now: () => Date.now() + this.goalClockSkewMs,
			emit: event => {
				if (event.type !== "goal_updated") return;
				for (const listener of this.#listeners) {
					listener({ type: "goal_updated", goal: event.goal, state: event.state } as AgentSessionEvent);
				}
				return this.goalEmitBlocker?.(event);
			},
			persist: (mode, state) => {
				if (mode === "none") this.sessionManager.appendModeChange("none");
				else if (state) this.sessionManager.appendModeChange(mode, { goal: state.goal });
			},
			sendHiddenMessage: async () => {},
		});
	}

	get sessionName(): string {
		return this.sessionManager.getHeader()?.title ?? `Session ${this.sessionId}`;
	}

	get modelRegistry(): { getApiKey: (model: Model) => Promise<string> } {
		return {
			getApiKey: async (_model: Model) => "test-key",
		};
	}

	getAvailableModels(): Model[] {
		return this.models;
	}

	getAvailableEffortSelectors(): ReadonlyArray<string> {
		return ["off", "auto", ...this.getAvailableThinkingLevels()];
	}

	getAvailableThinkingLevels(): ReadonlyArray<string> {
		return ["low", "medium", "high"];
	}

	setThinkingLevel(level: string | undefined): void {
		const isChanging = this.thinkingLevel !== level;
		this.thinkingLevel = level;
		if (isChanging) {
			for (const listener of this.#listeners) {
				listener({
					type: "thinking_level_changed",
					thinkingLevel: level,
				} as AgentSessionEvent);
			}
		}
	}

	setSlashCommands(_commands: unknown[]): void {
		// no-op for tests
	}
	setUsageFallbackConfirmer(
		confirmer: ((confirmation: UsageFallbackConfirmation) => Promise<boolean>) | undefined,
	): void {
		this.usageFallbackConfirmer = confirmer;
	}

	/** Role tiers `getRoleModelCycle` reports; unset means no cycle (single tier). */
	roleModelCycle: RoleModelCycle | undefined;
	appliedRoleModels: ResolvedRoleModel[] = [];

	getRoleModelCycle(_roleOrder: readonly string[]): RoleModelCycle | undefined {
		return this.roleModelCycle;
	}

	async applyRoleModel(entry: ResolvedRoleModel): Promise<void> {
		this.appliedRoleModels.push(entry);
		await this.setModel(entry.model);
	}

	async setModel(model: Model): Promise<void> {
		const isChanging = this.model?.provider !== model.provider || this.model?.id !== model.id;
		this.model = model;
		if (isChanging) {
			for (const listener of this.#listeners) {
				listener({ type: "model_changed" } as AgentSessionEvent);
			}
		}
	}

	subscribe(listener: (event: AgentSessionEvent) => void): () => void {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	listeners(): Array<(event: AgentSessionEvent) => void> {
		return [...this.#listeners];
	}

	async prompt(text: string, options?: { images?: unknown[]; streamingBehavior?: string }): Promise<boolean> {
		this.promptCalls.push(text);
		this.promptImages.push(options?.images ?? []);
		this.isStreaming = true;
		this.promptEntered.resolve();
		await this.promptGate;
		this.sessionManager.appendMessage({ role: "user", content: text, timestamp: Date.now() });
		const assistantMessage = makeAssistantMessage("pong");
		for (const listener of this.#listeners) {
			listener({
				type: "message_update",
				message: assistantMessage,
				assistantMessageEvent: { type: "text_delta", delta: "pong" },
			} as AgentSessionEvent);
		}
		this.sessionManager.appendMessage(assistantMessage);
		for (const listener of this.#listeners) {
			listener({
				type: "agent_end",
				messages: [assistantMessage],
			} as AgentSessionEvent);
		}
		this.isStreaming = false;
		return true;
	}

	async retry(): Promise<boolean> {
		this.retryCalls++;
		return this.retryResult;
	}

	async waitForIdle(): Promise<void> {
		this.waitForIdleCalls++;
		await this.waitForIdleBlocker?.();
	}

	hasPendingAsyncWork(): boolean {
		return this.pendingAsyncWork;
	}

	setAcpPromptOpen(open: boolean): void {
		this.acpPromptOpen.push(open);
	}

	/** Resolved when `abort()` has reserved its goal owner stamp and starts to unwind. */
	abortEntered = Promise.withResolvers<void>();
	/** Awaited inside `abort()` before the runtime's abort accounting, so a test can hold an abort open. */
	abortHold: Promise<void> | undefined;
	async abort(options?: { goalStamp?: GoalOwnerStamp }): Promise<void> {
		this.abortCalls++;
		this.isStreaming = false;
		// As `AgentSession.abort`: ownership is reserved when the abort is requested (a Stop supplies its own
		// stamp), and a user interrupt pauses an active goal bound to it.
		const stamp = options?.goalStamp ?? this.goalRuntime.reserveOwner();
		this.abortEntered.resolve();
		await this.abortHold;
		await this.goalRuntime.onTaskAborted({ reason: "interrupted", stamp });
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	isRegisteredPromptCommand(text: string): boolean {
		if (!text.startsWith("/")) return false;
		const spaceIndex = text.indexOf(" ");
		const name = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		return this.registeredPromptCommands.includes(name);
	}

	async promptCustomMessage(
		message: { customType: string; content: string; details?: unknown },
		options?: { streamingBehavior?: "steer" | "followUp"; queueChipText?: string },
	): Promise<boolean> {
		this.customMessages.push(message);
		this.customMessageOptions.push(options);
		this.isStreaming = true;
		const assistantMessage = makeAssistantMessage("skill pong");
		for (const listener of this.#listeners) {
			listener({
				type: "message_update",
				message: assistantMessage,
				assistantMessageEvent: { type: "text_delta", delta: "skill pong" },
			} as AgentSessionEvent);
		}
		this.sessionManager.appendMessage(assistantMessage);
		for (const listener of this.#listeners) {
			listener({
				type: "agent_end",
				messages: [assistantMessage],
			} as AgentSessionEvent);
		}
		this.isStreaming = false;
		return true;
	}

	async refreshMCPTools(_tools: unknown[]): Promise<void> {}

	async steer(text: string, images?: unknown[]): Promise<void> {
		this.steerCalls.push({ text, images });
	}

	getContextUsage(): { tokens: number | null; contextWindow: number; percent: number } | undefined {
		return this.contextUsage;
	}

	async switchSession(sessionPath: string): Promise<boolean> {
		await this.sessionManager.setSessionFile(sessionPath);
		this.sessionId = this.sessionManager.getSessionId();
		this.agent.sessionId = this.sessionId;
		return true;
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		await this.sessionManager.close();
	}

	async reload(): Promise<void> {}

	async newSession(): Promise<boolean> {
		await this.sessionManager.newSession();
		this.sessionId = this.sessionManager.getSessionId();
		this.agent.sessionId = this.sessionId;
		return true;
	}

	async branch(_entryId: string): Promise<{ cancelled: boolean }> {
		return { cancelled: false };
	}

	async navigateTree(_targetId: string): Promise<{ cancelled: boolean }> {
		return { cancelled: false };
	}

	getActiveToolNames(): string[] {
		return [];
	}

	getAllToolNames(): string[] {
		return [];
	}

	getEnabledToolNames(): string[] {
		return [...this.enabledTools];
	}

	async setActiveToolsByName(toolNames: string[]): Promise<void> {
		this.enabledTools = [...toolNames];
	}

	setClientBridge(_bridge: unknown): void {}

	getPlanModeState(): PlanModeState | undefined {
		return this.planModeState;
	}

	setPlanModeState(state: PlanModeState | undefined): void {
		this.planModeState = state;
	}

	getGoalModeState(): GoalModeState | undefined {
		return this.goalModeState;
	}

	setGoalModeState(state: GoalModeState | undefined): void {
		this.goalModeState = state;
	}

	async sendGoalModeContext(options?: { deliverAs?: string }): Promise<void> {
		this.goalContextSends.push(options?.deliverAs ?? "");
	}

	getTodoPhases(): [] {
		return [];
	}

	planProposalHandler: PlanProposalHandler | undefined;

	reservePlanProposalOwnership: PlanProposalOwnershipReserver | undefined;

	setPlanProposalHandler(handler: PlanProposalHandler | null, reserveOwnership?: PlanProposalOwnershipReserver): void {
		this.planProposalHandler = handler ?? undefined;
		this.reservePlanProposalOwnership = handler ? reserveOwnership : undefined;
	}

	peekPlanProposalHandler(): PlanProposalHandler | undefined {
		return this.planProposalHandler;
	}

	planReferencePath: string | undefined;

	setPlanReferencePath(path: string): void {
		this.planReferencePath = path;
	}

	getPlanReferencePath(): string {
		return this.planReferencePath ?? "";
	}

	adoptedPlans: ResolvedApprovedPlan[] = [];

	async createApprovedPlanSnapshot(plan: ResolvedApprovedPlan): Promise<string> {
		this.adoptedPlans.push(plan);
		return `local://approved/${plan.planFilePath.replace("local://", "")}`;
	}

	async adoptApprovedPlan(plan: ResolvedApprovedPlan): Promise<string> {
		this.planReferencePath = await this.createApprovedPlanSnapshot(plan);
		return this.planReferencePath;
	}

	getToolByName(_name: string): undefined {
		return undefined;
	}

	toggleFastMode(): boolean {
		this.fastMode = !this.fastMode;
		return this.fastMode;
	}

	setFastMode(enabled: boolean): boolean {
		this.fastMode = enabled;
		return true;
	}

	isFastModeEnabled(): boolean {
		return this.fastMode;
	}

	isUltrafastModeEnabled(): boolean {
		return false;
	}

	setForcedToolChoice(toolName: string): void {
		this.forcedToolChoice = toolName;
	}

	async sendCustomMessage(_message: string, _options?: unknown): Promise<void> {}

	async sendUserMessage(_content: string, _options?: unknown): Promise<void> {}

	compactCalls: Array<string | undefined> = [];
	/** Runs inside `compact()`; tests override it to gate or model an aborted run. */
	compactImpl: (() => Promise<void>) | undefined;
	async compact(instructions?: string, _options?: unknown): Promise<void> {
		this.compactCalls.push(instructions);
		await this.compactImpl?.();
	}

	async fork(): Promise<boolean> {
		await this.sessionManager.flush();
		const forked = await this.sessionManager.fork();
		if (!forked) {
			return false;
		}
		this.sessionId = this.sessionManager.getSessionId();
		this.agent.sessionId = this.sessionId;
		return true;
	}
}

/**
 * Resolve the plan the way `AgentSession.submitPlanProposal` does, then call the installed ACP handler.
 * Ownership is reserved at dispatch, before resolution; `resolving` holds the dispatch where the real one
 * awaits plan resolution and review. `reviewed` stands in for a completed review, which binds the resolved bytes.
 */
async function proposePlan(
	session: FakeAgentSession,
	title: string,
	options: { reviewed?: boolean; resolving?: Promise<void> } = {},
): Promise<unknown> {
	const handler = session.planProposalHandler;
	const state = session.planModeState;
	if (!handler || !state?.enabled) throw new Error("expected ACP plan mode with a proposal handler");
	const owns = session.reservePlanProposalOwnership?.() ?? (() => true);
	await options.resolving;
	const planPathOptions = {
		localProtocolOptions: {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		},
		cwd: session.sessionManager.getCwd(),
	};
	const plan = await resolveApprovedPlan({
		suppliedTitle: title,
		statePlanFilePath: state.planFilePath,
		readPlan: url => readPlanFile(url, planPathOptions),
		listPlanFiles: () => listPlanFiles(planPathOptions),
	});
	return handler(options.reviewed ? { ...plan, reviewedSha256: planContentSha256(plan.planContent) } : plan, owns);
}

/** A superseded proposal's result carries a structured outcome that is never an approval payload. */
function expectSupersededProposal(result: unknown): void {
	const details = (result as { details?: unknown }).details;
	expect(details).toEqual({ superseded: true, title: expect.any(String) });
	expect(isPlanApprovalDetails(details)).toBe(false);
}

function holdPromptStreaming(session: FakeAgentSession): () => void {
	let finishPrompt!: () => void;
	session.prompt = async (text: string): Promise<boolean> => {
		session.promptCalls.push(text);
		session.isStreaming = true;
		const blocker = Promise.withResolvers<void>();
		finishPrompt = blocker.resolve;
		await blocker.promise;
		const assistantMessage = makeAssistantMessage("pong");
		for (const listener of session.listeners()) {
			listener({
				type: "message_update",
				message: assistantMessage,
				assistantMessageEvent: { type: "text_delta", delta: "pong" },
			} as AgentSessionEvent);
		}
		session.sessionManager.appendMessage(assistantMessage);
		for (const listener of session.listeners()) {
			listener({
				type: "agent_end",
				messages: [assistantMessage],
			} as AgentSessionEvent);
		}
		session.isStreaming = false;
		return true;
	};
	return () => finishPrompt();
}

type SetToolUIContextSpy = (uiContext: ExtensionUIContext, hasUI: boolean) => void;

interface AgentHarness {
	agent: AcpAgent;
	updates: SessionNotification[];
	abortController: AbortController;
	sessions: FakeAgentSession[];
	setToolUIContextSpies: SetToolUIContextSpy[];
	sessionFactoryOptions: Array<{ interactivePrompts?: boolean } | undefined>;
	cwdA: string;
	cwdB: string;
	findSession(sessionId: string): FakeAgentSession | undefined;
}

function getChunkMessageId(notification: SessionNotification): string | undefined {
	const update = notification.update as { messageId?: string | null };
	return typeof update.messageId === "string" ? update.messageId : undefined;
}

/** Yield `count` macrotasks so already-scheduled work runs; no wall-clock delay. */
async function eventLoopTurns(count: number): Promise<void> {
	for (let turn = 0; turn < count; turn++) {
		const { promise, resolve } = Promise.withResolvers<void>();
		setImmediate(resolve);
		await promise;
	}
}

function expectAcpNotifications(updates: SessionNotification[]): void {
	for (const update of updates) {
		expectAcpStructure(zSessionNotification, update);
	}
}

const cleanupRoots: string[] = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const fallbackAgentDir = path.join(getConfigRootDir(), "agent");

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	if (originalAgentDir) {
		setAgentDir(originalAgentDir);
	} else {
		setAgentDir(fallbackAgentDir);
		delete process.env.PI_CODING_AGENT_DIR;
	}
	resetSettingsForTest();

	// Renames index titles in the process-wide `<agentDir>/history.db`; Windows cannot delete it while open.
	closeSessionIndex();
	for (const root of cleanupRoots.splice(0)) {
		await fs.promises.rm(root, { recursive: true, force: true });
	}
});

async function createHarness(
	options: {
		elicitationHandler?: (req: CreateElicitationRequest) => Promise<CreateElicitationResponse>;
		clientCapabilities?: ClientCapabilities;
		/** Runs before a notification is recorded, so a test can delay one delivery. */
		sessionUpdateHook?: (notification: SessionNotification) => Promise<void> | void;
		/** Gives each session the factory creates a real extension runner with no extensions. */
		extensionRunners?: boolean;
		/** Sent with `initialize`; `{ _meta: { platform: "intellij" } }` identifies a JetBrains client. */
		clientInfo?: InitializeRequest["clientInfo"];
	} = {},
): Promise<AgentHarness> {
	const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "omp-acp-test-"));
	cleanupRoots.push(root);
	const agentDir = path.join(root, "agent");
	const cwdA = path.join(root, "cwd-a");
	const cwdB = path.join(root, "cwd-b");
	await fs.promises.mkdir(agentDir, { recursive: true });
	await fs.promises.mkdir(cwdA, { recursive: true });
	await fs.promises.mkdir(cwdB, { recursive: true });
	setAgentDir(agentDir);
	await Settings.init({ agentDir, inMemory: true });

	const updates: SessionNotification[] = [];
	const abortController = new AbortController();
	const sessions: FakeAgentSession[] = [];
	const setToolUIContextSpies: SetToolUIContextSpy[] = [];
	const sessionFactoryOptions: Array<{ interactivePrompts?: boolean } | undefined> = [];
	const connection = {
		sessionUpdate: async (notification: SessionNotification) => {
			// Only await when a hook is configured: `await undefined` would insert a
			// microtask before the push and perturb ordering-sensitive tests.
			if (options.sessionUpdateHook) await options.sessionUpdateHook(notification);
			updates.push(notification);
		},
		unstable_createElicitation: options.elicitationHandler
			? async (req: CreateElicitationRequest) => options.elicitationHandler!(req)
			: undefined,
		signal: abortController.signal,
		closed: Promise.withResolvers<void>().promise,
	} as unknown as AgentSideConnection;

	const initialSession = new FakeAgentSession(cwdA);
	sessions.push(initialSession);
	const factory = async (cwd: string, factoryOptions?: { interactivePrompts?: boolean }) => {
		const session = new FakeAgentSession(cwd);
		if (options.extensionRunners) {
			session.extensionRunner = new ExtensionRunner(
				[],
				new ExtensionRuntime(),
				cwd,
				session.sessionManager,
				{} as ModelRegistry,
			);
		}
		const setToolUIContext = vi.fn();
		sessions.push(session);
		setToolUIContextSpies.push(setToolUIContext);
		sessionFactoryOptions.push(factoryOptions);
		return { session: session as unknown as AgentSession, setToolUIContext };
	};

	const agent = new AcpAgent(connection, factory, initialSession as unknown as AgentSession);
	const clientCapabilities =
		options.clientCapabilities ?? (options.elicitationHandler ? { elicitation: { form: {} } } : undefined);
	if (clientCapabilities || options.clientInfo) {
		await agent.initialize({
			protocolVersion: 1,
			clientCapabilities: clientCapabilities ?? {},
			clientInfo: options.clientInfo,
		} as Parameters<typeof agent.initialize>[0]);
	}

	return {
		agent,
		updates,
		abortController,
		sessions,
		setToolUIContextSpies,
		sessionFactoryOptions,
		cwdA,
		cwdB,
		findSession: (sessionId: string) => sessions.find(session => session.sessionId === sessionId),
	};
}

/** Fire `#scheduleBootstrapUpdates`'s guard without paying wall-clock time. */
async function advanceBootstrapGuard(): Promise<void> {
	vi.advanceTimersByTime(ACP_BOOTSTRAP_RACE_GUARD_MS);
	await Promise.resolve();
}

describe("ACP agent", () => {
	it("supports multiple live ACP sessions with model and lifecycle handlers", async () => {
		const harness = await createHarness();
		const first = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const second = await harness.agent.newSession({ cwd: harness.cwdB, mcpServers: [] });
		expectAcpStructure(zNewSessionResponse, first);
		expectAcpStructure(zNewSessionResponse, second);

		const modelOption = first.configOptions?.find(opt => opt.id === "model");
		expect(modelOption?.type).toBe("select");
		expect((modelOption as any).options?.map((opt: any) => opt.value)).toEqual(
			TEST_MODELS.map(model => `${model.provider}/${model.id}`),
		);

		await harness.agent.setSessionConfigOption({
			sessionId: first.sessionId,
			configId: "model",
			value: `${TEST_MODELS[1]!.provider}/${TEST_MODELS[1]!.id}`,
		});
		await harness.agent.setSessionConfigOption({
			sessionId: first.sessionId,
			configId: "thinking",
			value: "high",
		});
		// Both model and thinking-level changes must surface as ACP
		// `config_option_update` notifications scoped to the right session;
		// the schema check alone would still pass if either method stopped
		// emitting notifications entirely.
		const configUpdatesForFirst = harness.updates.filter(
			n => n.sessionId === first.sessionId && n.update.sessionUpdate === "config_option_update",
		);
		expect(configUpdatesForFirst.length).toBeGreaterThanOrEqual(2);
		expectAcpNotifications(harness.updates);

		const firstSession = harness.findSession(first.sessionId);
		const secondSession = harness.findSession(second.sessionId);
		expect(firstSession?.model?.id).toBe(TEST_MODELS[1]!.id);
		expect(firstSession?.thinkingLevel).toBe("high");
		expect(secondSession?.model?.id).toBe(TEST_MODELS[0]!.id);
		expect(secondSession?.thinkingLevel).toBeUndefined();

		firstSession?.sessionManager.appendMessage({ role: "user", content: "fork me", timestamp: Date.now() });
		await firstSession?.sessionManager.flush();

		const forked = await harness.agent.unstable_forkSession({
			sessionId: first.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});
		expectAcpStructure(zForkSessionResponse, forked);
		const forkedSession = harness.findSession(forked.sessionId);
		const forkedMessages = forkedSession?.sessionManager.buildSessionContext().messages ?? [];
		expect(forked.sessionId).not.toBe(first.sessionId);
		expect(forkedMessages.some(message => message.role === "user" && message.content === "fork me")).toBe(true);

		await harness.agent.closeSession({ sessionId: forked.sessionId });
		await expect(harness.agent.setSessionMode({ sessionId: forked.sessionId, modeId: "default" })).rejects.toThrow(
			"Unsupported ACP session",
		);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("advertises plan mode and emits schema-valid mode updates", async () => {
		const harness = await createHarness();
		cfgPlanEnabled.set(Settings.instance, true);

		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		expectAcpStructure(zNewSessionResponse, created);
		expect(created.modes?.availableModes.map(mode => mode.id)).toEqual(["default", "plan", "goal"]);
		const initialModeConfig = created.configOptions?.find(option => option.id === "mode") as
			| { currentValue?: unknown; options?: Array<{ value: string }> }
			| undefined;
		expect(initialModeConfig?.currentValue).toBe("default");
		expect(initialModeConfig?.options?.map(option => option.value)).toEqual(["default", "plan", "goal"]);

		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });

		const session = harness.findSession(created.sessionId)!;
		expect(session.planModeState).toEqual(
			expect.objectContaining({ enabled: true, planFilePath: "local://PLAN.md", workflow: "parallel" }),
		);
		const modeNotifications = harness.updates.filter(
			notification =>
				notification.sessionId === created.sessionId &&
				(notification.update.sessionUpdate === "current_mode_update" ||
					notification.update.sessionUpdate === "config_option_update"),
		);
		expectAcpNotifications(modeNotifications);
		expect(
			modeNotifications.some(
				notification =>
					notification.update.sessionUpdate === "current_mode_update" &&
					notification.update.currentModeId === "plan",
			),
		).toBe(true);
		const configNotification = modeNotifications.findLast(
			notification => notification.update.sessionUpdate === "config_option_update",
		);
		const currentModeConfig =
			configNotification?.update.sessionUpdate === "config_option_update"
				? (configNotification.update.configOptions.find(option => option.id === "mode") as
						| { currentValue?: unknown }
						| undefined)
				: undefined;
		expect(currentModeConfig?.currentValue).toBe("plan");

		// Regression for #1869: entering plan mode must wire a plan-proposal
		// handler so the agent's `xd://propose` write has a gate to dispatch to
		// instead of erroring with no approval path.
		expect(typeof session.planProposalHandler).toBe("function");

		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "default" });
		expect(session.planModeState).toBeUndefined();
		expect(session.planProposalHandler).toBeUndefined();

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("plan-proposal handler approves the agent-named plan and exits plan mode on submit", async () => {
		const harness = await createHarness();
		cfgPlanEnabled.set(Settings.instance, true);

		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });

		const localOptions = {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		};
		cleanupRoots.push(resolveLocalUrlToPath("local://", localOptions));
		// On Windows, long artifact roots are shortened by the local:// resolver to
		// avoid MAX_PATH. Write through the same resolver the ACP handler reads from.
		const planPath = resolveLocalUrlToPath("local://words-counter-plan.md", localOptions);
		await Bun.write(planPath, "# Words Counter\n\nFile contents.");

		const updatesBefore = harness.updates.length;
		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
			details: { planFilePath: string; title: string; planExists: boolean };
		};

		// Plan-approval payload is shaped for `event-controller` / ACP renderers.
		expect(result.details.title).toBe("words-counter");
		expect(result.details.planFilePath).toBe("local://words-counter-plan.md");
		expect(result.details.planExists).toBe(true);
		expect(result.content[0]?.text).toMatch(/Plan approved/);
		// Plan file keeps its agent-chosen name — no rename.
		expect(await Bun.file(planPath).exists()).toBe(true);
		// Mode + handler are cleared; the agent regains write tools next turn.
		expect(session.planModeState).toBeUndefined();
		expect(session.planProposalHandler).toBeUndefined();
		expect(session.planReferencePath).toBe("local://words-counter-plan.md");
		expect(session.adoptedPlans).toEqual([]);
		const approvalUpdates = harness.updates.slice(updatesBefore);
		// Mode-change notifications reached the client so Zed's UI and config
		// selector both reflect the approval-driven exit.
		expect(
			approvalUpdates.some(
				notification =>
					notification.update.sessionUpdate === "current_mode_update" &&
					notification.update.currentModeId === "default",
			),
		).toBe(true);
		const configUpdate = approvalUpdates.find(
			notification => notification.update.sessionUpdate === "config_option_update",
		);
		if (configUpdate?.update.sessionUpdate !== "config_option_update") {
			throw new Error("expected config_option_update after plan approval");
		}
		const modeConfig = configUpdate.update.configOptions.find(option => option.id === "mode") as
			| { currentValue?: unknown }
			| undefined;
		expect(modeConfig?.currentValue).toBe("default");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("plan-proposal handler executes a reviewed plan from its snapshot and names that snapshot", async () => {
		const harness = await createHarness();
		const { session } = await enterPlanWithPlanFile(harness);

		const result = (await proposePlan(session, "words-counter", { reviewed: true })) as {
			content: Array<{ type: string; text: string }>;
			details: { planFilePath: string };
		};

		expect(session.adoptedPlans.map(plan => plan.planContent)).toEqual(["# Words Counter\n\nFile contents."]);
		const snapshotUrl = session.planReferencePath ?? "";
		expect(snapshotUrl).not.toBe("local://words-counter-plan.md");
		expect(result.content[0]?.text).toContain(snapshotUrl);
		expect(result.details.planFilePath).toBe("local://words-counter-plan.md");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("plan-proposal handler autosaves the approved plan without leaking the path", async () => {
		const harness = await createHarness();
		cfgPlanEnabled.set(Settings.instance, true);
		cfgPlanAutosave.set(Settings.instance, true);

		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });

		const localOptions = {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		};
		cleanupRoots.push(resolveLocalUrlToPath("local://", localOptions));
		const planPath = resolveLocalUrlToPath("local://words-counter-plan.md", localOptions);
		await Bun.write(planPath, "# Words Counter\n\nFile contents.");

		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
			details: { planFilePath: string; title: string; planExists: boolean };
		};

		expect(result.details.planExists).toBe(true);
		expect(result.content[0]?.text).toMatch(/Plan approved/);
		expect(result.content[0]?.text).not.toContain(harness.cwdA);
		expect(result.content[0]?.text).not.toContain("autosaved to");
		const saved = path.join(harness.cwdA, ".omp", "plans", "WORDS_COUNTER_PLAN.md");
		expect(await Bun.file(saved).text()).toBe("# Words Counter\n\nFile contents.");
		expect(session.planModeState).toBeUndefined();

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("plan-proposal handler approves and notes autosave failure without the path", async () => {
		const harness = await createHarness();
		cfgPlanEnabled.set(Settings.instance, true);
		const blocker = path.join(harness.cwdA, "blocker");
		await Bun.write(blocker, "x");
		cfgPlanAutosave.set(Settings.instance, true);
		cfgPlanAutosaveDir.set(Settings.instance, path.join(blocker, "sub"));

		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });

		const localOptions = {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		};
		cleanupRoots.push(resolveLocalUrlToPath("local://", localOptions));
		const planPath = resolveLocalUrlToPath("local://words-counter-plan.md", localOptions);
		await Bun.write(planPath, "# Words Counter\n\nFile contents.");

		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
		};
		const text = result.content[0]?.text ?? "";

		expect(text).toMatch(/Plan approved/);
		expect(text).toMatch(/autosave failed/);
		expect(text).not.toContain(harness.cwdA);
		expect(session.planModeState).toBeUndefined();
		expect(session.planReferencePath).toBe("local://words-counter-plan.md");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("plan-proposal handler treats dismissed elicitation as refine, never approves", async () => {
		// Regression for the P1 review finding on #1870: when a form-capable
		// ACP client dismissed/cancelled the elicitation, the handler was
		// returning the dismissal as approval — silently granting write
		// access without explicit consent. Dismissal MUST fall through to
		// refine semantics: plan mode stays active, the plan file stays put,
		// and no mode/config updates are emitted.
		const harness = await createHarness({
			elicitationHandler: async () => ({ action: "cancel" }),
		});
		cfgPlanEnabled.set(Settings.instance, true);

		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });

		const localOptions = {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		};
		cleanupRoots.push(resolveLocalUrlToPath("local://", localOptions));
		const planPath = resolveLocalUrlToPath("local://PLAN.md", localOptions);
		await Bun.write(planPath, "# Words Counter\n\nFile contents.");

		const updatesBefore = harness.updates.length;
		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
		};

		expect(result.content[0]?.text).toMatch(/refinement requested/i);
		// Plan file stays put; no rename, no write-access grant.
		expect(await Bun.file(planPath).exists()).toBe(true);
		expect(await Bun.file(resolveLocalUrlToPath("local://words-counter.md", localOptions)).exists()).toBe(false);
		// Plan mode + proposal handler stay active so the agent can iterate.
		expect(session.planModeState?.enabled).toBe(true);
		expect(typeof session.planProposalHandler).toBe("function");
		expect(session.planReferencePath).toBeUndefined();
		expect(session.adoptedPlans).toEqual([]);
		// No mode-exit notifications were emitted.
		const postDismissUpdates = harness.updates.slice(updatesBefore);
		expect(
			postDismissUpdates.some(
				notification =>
					notification.update.sessionUpdate === "current_mode_update" &&
					notification.update.currentModeId === "default",
			),
		).toBe(false);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	/** ACP session in plan mode with `local://words-counter-plan.md` written; returns the plan's absolute path. */
	async function enterPlanWithPlanFile(
		harness: AgentHarness,
	): Promise<{ session: FakeAgentSession; planPath: string }> {
		cfgPlanEnabled.set(Settings.instance, true);
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await harness.agent.setSessionMode({ sessionId: created.sessionId, modeId: "plan" });
		const localOptions = {
			getArtifactsDir: () => session.sessionManager.getArtifactsDir(),
			getSessionId: () => session.sessionManager.getSessionId(),
		};
		cleanupRoots.push(resolveLocalUrlToPath("local://", localOptions));
		const planPath = resolveLocalUrlToPath("local://words-counter-plan.md", localOptions);
		await Bun.write(planPath, "# Words Counter\n\nFile contents.");
		return { session, planPath };
	}

	/** The single `value` field of a form elicitation; throws for non-form requests. */
	function planApprovalField(request: CreateElicitationRequest | undefined): ElicitationPropertySchema {
		if (!request || !("requestedSchema" in request) || !request.requestedSchema) {
			throw new Error("expected a form elicitation");
		}
		return request.requestedSchema.properties.value;
	}

	const TWO_TIERS: RoleModelCycle = {
		models: [
			{ role: "default", model: TEST_MODELS[0], explicitThinkingLevel: false },
			{ role: "task", model: TEST_MODELS[1], explicitThinkingLevel: false },
		],
		currentIndex: 0,
	};

	it("plan-proposal elicitation is a single plain line with the plan path in the field description", async () => {
		const requests: CreateElicitationRequest[] = [];
		const harness = await createHarness({
			elicitationHandler: async request => {
				requests.push(request);
				return { action: "accept", content: { value: "approve" } };
			},
		});
		const { session, planPath } = await enterPlanWithPlanFile(harness);

		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
		};

		expect(requests).toHaveLength(1);
		const message = requests[0].message;
		expect(message).not.toContain("\n");
		expect(message).not.toContain("# Words Counter");
		expect(message).not.toContain("File contents.");
		const field = planApprovalField(requests[0]);
		expect(field.description).toContain(path.basename(planPath));
		expect(result.content[0]?.text).toMatch(/Plan approved/);
		expect(session.planModeState).toBeUndefined();

		harness.abortController.abort();
	});

	it("plan approval publishes the plan file as a clickable read location before the dialog", async () => {
		const updatesAtElicit: SessionNotification[] = [];
		const harness: AgentHarness = await createHarness({
			elicitationHandler: async () => {
				updatesAtElicit.push(...harness.updates);
				return { action: "accept", content: { value: "approve" } };
			},
		});
		const { session, planPath } = await enterPlanWithPlanFile(harness);

		await proposePlan(session, "words-counter");

		const toolCalls = updatesAtElicit
			.map(notification => notification.update)
			.filter(update => update.sessionUpdate === "tool_call");
		expect(toolCalls).toHaveLength(1);
		expect(toolCalls[0]).toMatchObject({
			kind: "read",
			status: "completed",
			title: "Plan: words-counter",
			locations: [{ path: planPath }],
		});

		harness.abortController.abort();
	});

	it("plan approval offers one approve option per cycle role, preselects the judge's pick, and applies it", async () => {
		const requests: CreateElicitationRequest[] = [];
		const harness = await createHarness({
			elicitationHandler: async request => {
				requests.push(request);
				return { action: "accept", content: { value: "approve:task" } };
			},
		});
		const recommend = spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue("task");
		const { session } = await enterPlanWithPlanFile(harness);
		session.roleModelCycle = TWO_TIERS;

		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
		};

		expect(recommend).toHaveBeenCalledTimes(1);
		const field = planApprovalField(requests[0]);
		expect(field.oneOf).toEqual([
			{ const: "approve:default", title: "Approve → default · Claude Sonnet" },
			{ const: "approve:task", title: "Approve → task · GPT-5.4 (recommended)" },
			{ const: "refine", title: "Refine plan" },
		]);
		expect(field.default).toBe("approve:task");
		expect(session.appliedRoleModels.map(entry => entry.role)).toEqual(["task"]);
		expect(session.model).toBe(TEST_MODELS[1]);
		expect(result.content[0]?.text).toContain("Implementation model: task");
		expect(session.planModeState).toBeUndefined();

		harness.abortController.abort();
	});

	it("plan approval on the already-active tier applies no model switch", async () => {
		const harness = await createHarness({
			elicitationHandler: async () => ({ action: "accept", content: { value: "approve:default" } }),
		});
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue(undefined);
		const { session } = await enterPlanWithPlanFile(harness);
		session.roleModelCycle = TWO_TIERS;

		const result = (await proposePlan(session, "words-counter")) as {
			content: Array<{ type: string; text: string }>;
		};

		expect(session.appliedRoleModels).toEqual([]);
		expect(result.content[0]?.text).not.toContain("Implementation model");
		expect(session.planModeState).toBeUndefined();

		harness.abortController.abort();
	});

	it("plan approval preselects the default tier when the judge gives no answer", async () => {
		const requests: CreateElicitationRequest[] = [];
		const harness = await createHarness({
			elicitationHandler: async request => {
				requests.push(request);
				return { action: "cancel" };
			},
		});
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue(undefined);
		const { session } = await enterPlanWithPlanFile(harness);
		session.roleModelCycle = TWO_TIERS;

		await proposePlan(session, "words-counter");

		expect(planApprovalField(requests[0]).default).toBe("approve:default");

		harness.abortController.abort();
	});

	it("plan approval with tiers keeps plan mode and the model on dismissal or an unknown role", async () => {
		const answers: CreateElicitationResponse[] = [
			{ action: "cancel" },
			{ action: "accept", content: { value: "approve:ghost" } },
			{ action: "accept", content: { value: "refine" } },
		];
		const harness = await createHarness({ elicitationHandler: async () => answers.shift()! });
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue("task");
		const { session } = await enterPlanWithPlanFile(harness);
		session.roleModelCycle = TWO_TIERS;

		for (let attempt = 0; attempt < 3; attempt++) {
			const result = (await proposePlan(session, "words-counter")) as {
				content: Array<{ type: string; text: string }>;
			};
			expect(result.content[0]?.text).toMatch(/refinement requested/i);
			expect(session.planModeState?.enabled).toBe(true);
		}
		expect(session.appliedRoleModels).toEqual([]);
		expect(session.model).toBe(TEST_MODELS[0]);

		harness.abortController.abort();
	});

	/** A harness whose approval dialog stays open until `answer` is called; `opened` resolves once the client was asked. */
	async function pendingApprovalHarness(value: string) {
		const opened = Promise.withResolvers<void>();
		const answered = Promise.withResolvers<void>();
		const harness = await createHarness({
			elicitationHandler: async () => {
				opened.resolve();
				await answered.promise;
				return { action: "accept", content: { value } };
			},
		});
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue(undefined);
		const { session } = await enterPlanWithPlanFile(harness);
		return { harness, session, opened: opened.promise, answer: () => answered.resolve() };
	}

	it("a rejection answered after the client selected Goal leaves Plan disabled and Goal armed", async () => {
		const { harness, session, opened, answer } = await pendingApprovalHarness("refine");
		const pending = proposePlan(session, "words-counter") as Promise<{ content: Array<{ text: string }> }>;
		await opened;

		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "goal" });
		answer();
		expectSupersededProposal(await pending);

		expect(session.planModeState).toBeUndefined();
		await harness.agent.prompt({ sessionId: session.sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
		expect(session.goalModeState?.goal.objective).toBe("Ship feature X");

		harness.abortController.abort();
	});

	for (const reviewed of [false, true]) {
		it(`an approval answered after Goal and a new Plan were selected leaves the new Plan enabled (reviewed: ${reviewed})`, async () => {
			const { harness, session, opened, answer } = await pendingApprovalHarness("approve");
			const pending = proposePlan(session, "words-counter", { reviewed }) as Promise<{
				content: Array<{ text: string }>;
			}>;
			await opened;

			await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "goal" });
			await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "plan" });
			answer();
			expectSupersededProposal(await pending);

			expect(session.planModeState?.enabled).toBe(true);
			expect(session.planReferencePath).toBeUndefined();

			harness.abortController.abort();
		});
	}

	it("a reviewed approval whose snapshot creation straddles a mode selection writes no plan reference and exits nothing", async () => {
		const { harness, session, answer } = await pendingApprovalHarness("approve");
		const adoptStarted = Promise.withResolvers<void>();
		const adoptRelease = Promise.withResolvers<void>();
		const createSnapshot = session.createApprovedPlanSnapshot.bind(session);
		session.createApprovedPlanSnapshot = async plan => {
			adoptStarted.resolve();
			await adoptRelease.promise;
			return createSnapshot(plan);
		};
		const pending = proposePlan(session, "words-counter", { reviewed: true }) as Promise<{
			content: Array<{ text: string }>;
		}>;
		answer();
		await adoptStarted.promise;

		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "goal" });
		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "plan" });
		adoptRelease.resolve();
		expectSupersededProposal(await pending);

		expect(session.planModeState?.enabled).toBe(true);
		expect(session.planReferencePath).toBeUndefined();

		harness.abortController.abort();
	});

	it("a proposal still resolving when Goal and then a new Plan were selected writes nothing into the new Plan", async () => {
		const asked = vi.fn();
		const harness = await createHarness({
			elicitationHandler: async () => {
				asked();
				return { action: "accept", content: { value: "refine" } };
			},
		});
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue(undefined);
		const { session } = await enterPlanWithPlanFile(harness);
		const newPlanPath = session.planModeState?.planFilePath;
		const resolving = Promise.withResolvers<void>();
		const pending = proposePlan(session, "words-counter", { resolving: resolving.promise }) as Promise<{
			content: Array<{ text: string }>;
		}>;

		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "goal" });
		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "plan" });
		resolving.resolve();
		expectSupersededProposal(await pending);

		expect(asked).not.toHaveBeenCalled();
		expect(session.planModeState?.enabled).toBe(true);
		expect(session.planModeState?.planFilePath).toBe(newPlanPath);
		expect(session.planReferencePath).toBeUndefined();

		harness.abortController.abort();
	});

	for (const modeId of ["goal", "default"]) {
		it(`a proposal still resolving when ${modeId} was selected directly from Plan resolves without asking or writing`, async () => {
			const asked = vi.fn();
			const harness = await createHarness({
				elicitationHandler: async () => {
					asked();
					return { action: "accept", content: { value: "approve" } };
				},
			});
			spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue(undefined);
			const { session } = await enterPlanWithPlanFile(harness);
			const resolving = Promise.withResolvers<void>();
			const pending = proposePlan(session, "words-counter", { resolving: resolving.promise, reviewed: true });

			await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId });
			expect(session.planModeState).toBeUndefined();
			resolving.resolve();
			expectSupersededProposal(await pending);

			expect(asked).not.toHaveBeenCalled();
			expect(session.planModeState).toBeUndefined();
			expect(session.planReferencePath).toBeUndefined();

			harness.abortController.abort();
		});
	}

	for (const value of ["refine", "approve"]) {
		it(`a ${value} answered after the transcript switched while the dialog was open writes nothing into the new transcript`, async () => {
			const { harness, session, opened, answer } = await pendingApprovalHarness(value);
			const planBefore = session.planModeState;
			const pending = proposePlan(session, "words-counter", { reviewed: true }) as Promise<{
				content: Array<{ text: string }>;
			}>;
			await opened;

			await session.newSession();
			answer();
			expectSupersededProposal(await pending);

			expect(session.planModeState).toEqual(planBefore);
			expect(session.planReferencePath).toBeUndefined();
			expect(session.adoptedPlans).toEqual([]);

			harness.abortController.abort();
		});
	}

	it("a newer approval's plan reference survives an older reviewed approval still creating its snapshot", async () => {
		const { harness, session, answer } = await pendingApprovalHarness("approve");
		const snapshotStarted = Promise.withResolvers<void>();
		const snapshotRelease = Promise.withResolvers<void>();
		const createSnapshot = session.createApprovedPlanSnapshot.bind(session);
		session.createApprovedPlanSnapshot = async plan => {
			snapshotStarted.resolve();
			await snapshotRelease.promise;
			return createSnapshot(plan);
		};
		const older = proposePlan(session, "words-counter", { reviewed: true }) as Promise<{
			content: Array<{ text: string }>;
		}>;
		answer();
		await snapshotStarted.promise;

		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "goal" });
		await harness.agent.setSessionMode({ sessionId: session.sessionId, modeId: "plan" });
		session.createApprovedPlanSnapshot = createSnapshot;
		await proposePlan(session, "words-counter");
		expect(session.planReferencePath).toBe("local://words-counter-plan.md");
		snapshotRelease.resolve();
		expectSupersededProposal(await older);

		expect(session.planReferencePath).toBe("local://words-counter-plan.md");
		expect(session.planModeState).toBeUndefined();

		harness.abortController.abort();
	});

	const INTELLIJ_CLIENT_INFO = { name: "JetBrains.IntelliJ IDEA", version: "262", _meta: { platform: "intellij" } };

	async function approvePlanOnTaskTier(
		clientInfo?: InitializeRequest["clientInfo"],
	): Promise<{ harness: AgentHarness; session: FakeAgentSession }> {
		const harness = await createHarness({
			elicitationHandler: async () => ({ action: "accept", content: { value: "approve:task" } }),
			clientInfo,
		});
		spyOn(executionModelModule, "recommendPlanExecutionRole").mockResolvedValue("task");
		const { session } = await enterPlanWithPlanFile(harness);
		session.roleModelCycle = TWO_TIERS;
		await proposePlan(session, "words-counter");
		expect(session.planModeState).toBeUndefined();
		expect(session.model).toBe(TEST_MODELS[1]);
		return { harness, session };
	}

	/** The model value the IDE stored before approval switched to the `task` tier. */
	const PRE_APPROVAL_MODEL_VALUE = `${TEST_MODELS[0]!.provider}/${TEST_MODELS[0]!.id}`;

	/** What a JetBrains IDE sends before every prompt: its stored dropdown choices. */
	async function reassertStoredChoices(harness: AgentHarness, sessionId: string): Promise<void> {
		await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "plan" });
		await harness.agent.setSessionConfigOption({ sessionId, configId: "model", value: PRE_APPROVAL_MODEL_VALUE });
	}

	it("ignores a JetBrains client re-sending the pre-approval mode and model, across a resume", async () => {
		const { harness, session } = await approvePlanOnTaskTier(INTELLIJ_CLIENT_INFO);
		const sessionId = session.sessionId;

		await reassertStoredChoices(harness, sessionId);
		expect(session.planModeState).toBeUndefined();
		expect(session.model).toBe(TEST_MODELS[1]);

		// Agent restart: the guard must come back from the session file, not memory.
		await session.sessionManager.flush();
		await harness.agent.closeSession({ sessionId });
		const resumed = await harness.agent.resumeSession({ sessionId, cwd: harness.cwdA, mcpServers: [] });
		const modeOption = resumed.configOptions?.find(option => option.id === "mode");
		expect(modeOption?.currentValue).toBe("default");
		const resumedSession = harness.sessions.at(-1)!;
		await resumedSession.setModel(TEST_MODELS[1]!);
		await reassertStoredChoices(harness, sessionId);
		expect(resumedSession.planModeState).toBeUndefined();
		expect(resumedSession.model).toBe(TEST_MODELS[1]);

		harness.abortController.abort();
	});

	it("applies plan mode again once the JetBrains user picks another mode first", async () => {
		const { harness, session } = await approvePlanOnTaskTier(INTELLIJ_CLIENT_INFO);
		const sessionId = session.sessionId;

		await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "default" });
		await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "plan" });
		expect(session.planModeState?.enabled).toBe(true);
		// The model guard is independent: re-sending the old model is still ignored.
		await harness.agent.setSessionConfigOption({ sessionId, configId: "model", value: PRE_APPROVAL_MODEL_VALUE });
		expect(session.model).toBe(TEST_MODELS[1]);

		harness.abortController.abort();
	});

	it("applies the same mode and model requests from clients that do not re-send stored choices", async () => {
		const { harness, session } = await approvePlanOnTaskTier();

		await reassertStoredChoices(harness, session.sessionId);
		expect(session.planModeState?.enabled).toBe(true);
		expect(session.model).toBe(TEST_MODELS[0]);

		harness.abortController.abort();
	});

	it("pushes config_option_update when thinking level changes internally", async () => {
		// Internal callers (slash commands, model auto-adjust, extension UI) call
		// AgentSession.setThinkingLevel directly without going through the ACP
		// setSessionConfigOption surface. Once the session-lifetime subscription
		// is installed (after the 50ms bootstrap guard so the response has
		// reached the client first), those changes must surface to clients as
		// `config_option_update` so TORTAS-style fleet views stay in sync.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		// Advance past the 50ms bootstrap timer so the lifetime subscription is
		// installed before we drive an internal thinking-level change.
		await advanceBootstrapGuard();

		const updatesBefore = harness.updates.length;
		session.setThinkingLevel("high");

		const pushedAfter = harness.updates.slice(updatesBefore);
		const configUpdates = pushedAfter.filter(
			notification =>
				notification.sessionId === created.sessionId &&
				notification.update.sessionUpdate === "config_option_update",
		);
		expect(configUpdates.length).toBeGreaterThanOrEqual(1);
		expectAcpNotifications(configUpdates);
		const firstUpdate = configUpdates[0]!.update;
		if (firstUpdate.sessionUpdate !== "config_option_update") {
			throw new Error("expected config_option_update");
		}
		const thinkingConfig = firstUpdate.configOptions.find(option => option.id === "thinking") as
			| { currentValue?: unknown }
			| undefined;
		expect(thinkingConfig?.currentValue).toBe("high");

		// Setting to the same level must not produce a redundant notification.
		const updatesBeforeRedundant = harness.updates.length;
		session.setThinkingLevel("high");
		expect(harness.updates.length).toBe(updatesBeforeRedundant);

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("suppresses lifetime config_option_update during the bootstrap window", async () => {
		// Regression for codex review on #1060: an extension `session_start`
		// handler calling `setThinkingLevel` must not push a
		// `config_option_update` for a session id the client has not been told
		// about yet (matches Zed's `Received session notification for unknown
		// session` race that `#scheduleBootstrapUpdates` already guards).
		// The fake harness lets us simulate that pre-bootstrap window by
		// driving the change before advancing past the 50ms guard.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		const updatesBefore = harness.updates.length;
		// Synchronously after `newSession` returns, the bootstrap timer has
		// not fired yet, so the lifetime subscription is not installed.
		session.setThinkingLevel("high");

		const beforeBootstrap = harness.updates
			.slice(updatesBefore)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(beforeBootstrap.length).toBe(0);
		// After advancing through the 50ms bootstrap timer, the subscription is
		// installed and subsequent changes do surface.
		await advanceBootstrapGuard();
		const baseline = harness.updates.length;
		session.setThinkingLevel("medium");
		const afterBootstrap = harness.updates
			.slice(baseline)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(afterBootstrap.length).toBeGreaterThanOrEqual(1);

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("emits a single config_option_update per setSessionConfigOption(thinking) call", async () => {
		// Client-initiated thinking changes flow through #setThinkingLevelById,
		// which fires `thinking_level_changed` and lets the lifetime subscription
		// push the notification. The ACP surface must not also push a duplicate
		// `config_option_update` of its own.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		// Wait past the bootstrap guard so the lifetime subscription is
		// installed and the client-driven setSessionConfigOption produces
		// exactly one notification through it.
		await advanceBootstrapGuard();

		const updatesBefore = harness.updates.length;
		const response = await harness.agent.setSessionConfigOption({
			sessionId: created.sessionId,
			configId: "thinking",
			value: "high",
		});

		const configUpdates = harness.updates
			.slice(updatesBefore)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(configUpdates.length).toBe(1);
		expectAcpNotifications(configUpdates);

		// The response still carries the fresh configOptions tree so the caller
		// gets the new state without relying on the notification.
		const thinkingOption = response.configOptions.find(option => option.id === "thinking") as
			| { currentValue?: unknown }
			| undefined;
		expect(thinkingOption?.currentValue).toBe("high");

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("emits a single config_option_update per /effort change", async () => {
		// `/effort <level>` calls AgentSession.setThinkingLevel, which fires
		// `thinking_level_changed`; the lifetime subscription turns that into a
		// `config_option_update`. The command's explicit notifyConfigChanged
		// must not add a second identical push, or clients redraw their config
		// UI twice per change.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await advanceBootstrapGuard();

		const updatesBefore = harness.updates.length;
		await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/effort high" }],
		});

		const configUpdates = harness.updates
			.slice(updatesBefore)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(session.thinkingLevel).toBe("high");
		expect(configUpdates.length).toBe(1);
		expectAcpNotifications(configUpdates);
		const update = configUpdates[0]!.update;
		if (update.sessionUpdate !== "config_option_update") {
			throw new Error("expected config_option_update");
		}
		const thinkingOption = update.configOptions.find(option => option.id === "thinking") as
			| { currentValue?: unknown }
			| undefined;
		expect(thinkingOption?.currentValue).toBe("high");

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("delivers the thinking config update before resolving the command", async () => {
		const blocked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		let holdConfig = false;
		const harness = await createHarness({
			sessionUpdateHook: async notification => {
				if (holdConfig && notification.update.sessionUpdate === "config_option_update") {
					blocked.resolve();
					await release.promise;
				}
			},
		});
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		await advanceBootstrapGuard();
		vi.useRealTimers();
		holdConfig = true;
		const baseline = harness.updates.length;
		const prompt = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/effort high" }],
		});
		await blocked.promise;
		try {
			expect(await Promise.race([prompt.then(() => true), Bun.sleep(0).then(() => false)])).toBe(false);
			release.resolve();
			expect((await prompt).stopReason).toBe("end_turn");
			const updates = harness.updates.slice(baseline).filter(n => n.update.sessionUpdate === "config_option_update");
			expect(updates).toHaveLength(1);
			const update = updates[0]!.update;
			if (update.sessionUpdate !== "config_option_update") throw new Error("Expected config update");
			expect(update.configOptions.find(option => option.id === "thinking")?.currentValue).toBe("high");
		} finally {
			release.resolve();
			await prompt;
			harness.abortController.abort();
			await Bun.sleep(0);
		}
	});

	it("still pushes config_option_update for /effort before the lifetime subscription exists", async () => {
		// Pre-bootstrap there is no lifetime subscription, so the explicit
		// notifyConfigChanged is the only path that tells the client — same
		// contract as `setSessionConfigOption`'s pre-bootstrap push.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		// Deliberately do not advance the 50ms bootstrap guard: the lifetime
		// subscription is not installed yet.

		const updatesBefore = harness.updates.length;
		await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/effort high" }],
		});

		const configUpdates = harness.updates
			.slice(updatesBefore)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(configUpdates.length).toBe(1);

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("pushes config_option_update when the model changes internally", async () => {
		// Internal callers (prewalk hand-offs, retry-fallback, model cycling)
		// change AgentSession's model directly without going through the ACP
		// setSessionConfigOption surface. Once the session-lifetime subscription
		// is installed, those changes must surface to clients as
		// `config_option_update` — otherwise a client's model indicator (e.g.
		// Zed's status bar) goes stale the moment prewalk hands off to a
		// cheaper model mid-session.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		await advanceBootstrapGuard();

		const updatesBefore = harness.updates.length;
		await session.setModel(TEST_MODELS[1]!);

		const pushedAfter = harness.updates.slice(updatesBefore);
		const configUpdates = pushedAfter.filter(
			notification =>
				notification.sessionId === created.sessionId &&
				notification.update.sessionUpdate === "config_option_update",
		);
		expect(configUpdates.length).toBeGreaterThanOrEqual(1);
		expectAcpNotifications(configUpdates);
		const firstUpdate = configUpdates[0]!.update;
		if (firstUpdate.sessionUpdate !== "config_option_update") {
			throw new Error("expected config_option_update");
		}
		const modelConfig = firstUpdate.configOptions.find(option => option.id === "model") as
			| { currentValue?: unknown }
			| undefined;
		expect(modelConfig?.currentValue).toBe(`${TEST_MODELS[1]!.provider}/${TEST_MODELS[1]!.id}`);

		// Setting to the same model must not produce a redundant notification.
		const updatesBeforeRedundant = harness.updates.length;
		await session.setModel(TEST_MODELS[1]!);
		expect(harness.updates.length).toBe(updatesBeforeRedundant);

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("emits a single config_option_update per setSessionConfigOption(model) call", async () => {
		// Client-initiated model changes flow through #setModelById, which now
		// changes the session model and fires `model_changed`, letting the
		// lifetime subscription push the notification. The ACP surface must not
		// also push a duplicate `config_option_update` of its own.
		const harness = await createHarness();
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		await advanceBootstrapGuard();

		const updatesBefore = harness.updates.length;
		const response = await harness.agent.setSessionConfigOption({
			sessionId: created.sessionId,
			configId: "model",
			value: `${TEST_MODELS[1]!.provider}/${TEST_MODELS[1]!.id}`,
		});

		const configUpdates = harness.updates
			.slice(updatesBefore)
			.filter(
				notification =>
					notification.sessionId === created.sessionId &&
					notification.update.sessionUpdate === "config_option_update",
			);
		expect(configUpdates.length).toBe(1);
		expectAcpNotifications(configUpdates);

		const modelOption = response.configOptions.find(option => option.id === "model") as
			| { currentValue?: unknown }
			| undefined;
		expect(modelOption?.currentValue).toBe(`${TEST_MODELS[1]!.provider}/${TEST_MODELS[1]!.id}`);

		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("lists role selectors for ACP mobile voice settings", async () => {
		const harness = await createHarness();

		const result = (await harness.agent.extMethod("speech.models.list", {})) as Record<string, unknown> & {
			speechToText: { models: Array<{ value: string }> };
			textToSpeech: {
				models: Array<{ value: string; voices: unknown[] }>;
				voices: unknown[];
				speeds: Array<{ value: unknown }>;
			};
		};

		expect(result).toMatchObject({
			settings: {
				speechToTextModel: "modelRoles.dictation",
				textToSpeechModel: "modelRoles.speech",
				textToSpeechVoice: "tts.localVoice",
				speechVoice: "speech.voice",
				textToSpeechSpeed: "tts.localSpeed",
				speechSpeed: "speech.speed",
			},
			defaults: {
				speechToTextModel: "local/parakeet-tdt-0.6b-v3",
				textToSpeechModel: "local/kokoro",
				voice: "af_heart",
				speed: 1,
			},
			speechToText: {
				setting: "modelRoles.dictation",
				defaultValue: "local/parakeet-tdt-0.6b-v3",
			},
			textToSpeech: {
				modelSetting: "modelRoles.speech",
				voiceSetting: "tts.localVoice",
				speechVoiceSetting: "speech.voice",
				speedSetting: "tts.localSpeed",
				speechSpeedSetting: "speech.speed",
				defaultModel: "local/kokoro",
				defaultVoice: "af_heart",
				defaultSpeed: 1,
				speedRange: { min: 0.5, max: 2.5 },
			},
		});
		expect(result.speechToText.models).toContainEqual(
			expect.objectContaining({ value: "local/nemotron-streaming-en-0.6b" }),
		);
		expect(result.textToSpeech.models.map(model => model.value)).toEqual(["local/kokoro"]);
		expect(result.textToSpeech.models[0]?.voices).toEqual(result.textToSpeech.voices);
		// Speed presets are numbers so clients can write them straight into the numeric settings.
		expect(result.textToSpeech.speeds.map(speed => speed.value)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("accepts OMP extension methods and rejects unknown unprefixed methods", async () => {
		const harness = await createHarness();

		const result = await harness.agent.extMethod("_omp/sessions/listAll", { limit: 2 });

		expect(Array.isArray(result.sessions)).toBe(true);
		expect(typeof result.total).toBe("number");
		await expect(harness.agent.extMethod("omp/sessions/listAll", { limit: 2 })).rejects.toThrow(
			"Unknown ACP ext method",
		);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("advertises steering support for IntelliJ in initialize _meta", async () => {
		const harness = await createHarness();
		const response = await harness.agent.initialize({ protocolVersion: 1, clientCapabilities: {} } as Parameters<
			typeof harness.agent.initialize
		>[0]);
		expect(response._meta).toEqual({ steering: { supported: true } });
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("advertises resume but not loadSession to IntelliJ clients", async () => {
		// Given/When: a JetBrains client identifies itself via clientInfo._meta.platform.
		const harness = await createHarness();
		const response = await harness.agent.initialize({
			protocolVersion: 1,
			clientCapabilities: {},
			clientInfo: { name: "JetBrains.IntelliJ IDEA", version: "262", _meta: { platform: "intellij", jbai: false } },
		});
		// Then: no session/load replay path is offered; session/resume remains.
		expect(response.agentCapabilities).toMatchObject({ loadSession: false, sessionCapabilities: { resume: {} } });
		await harness.agent.dispose();
	});

	it("keeps advertising loadSession to non-IntelliJ clients", async () => {
		const harness = await createHarness();
		const response = await harness.agent.initialize({
			protocolVersion: 1,
			clientCapabilities: {},
			clientInfo: { name: "zed", version: "1" },
		});
		expect(response.agentCapabilities?.loadSession).toBe(true);
		await harness.agent.dispose();
	});

	it("reports integer context usage before the first prompt", async () => {
		const usageSeen = Promise.withResolvers<SessionNotification>();
		const harness = await createHarness({
			sessionUpdateHook: notification => {
				if (notification.update.sessionUpdate === "usage_update") usageSeen.resolve(notification);
			},
		});
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		harness.findSession(created.sessionId)!.contextUsage = { tokens: 1234.6, contextWindow: 200_000, percent: 0.6 };
		await advanceBootstrapGuard();
		vi.useRealTimers();

		const usage = await usageSeen.promise;
		expect(usage.sessionId).toBe(created.sessionId);
		expect(usage.update).toEqual({ sessionUpdate: "usage_update", used: 1235, size: 200_000 });

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("reports context usage after each model turn while the prompt is still running", async () => {
		const usageSeen = Promise.withResolvers<SessionNotification>();
		const harness = await createHarness({
			sessionUpdateHook: notification => {
				if (notification.update.sessionUpdate === "usage_update") usageSeen.resolve(notification);
			},
		});
		// Bootstrap guard never fires, so the only usage_update must come from turn_end.
		vi.useFakeTimers();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.contextUsage = { tokens: 4_000, contextWindow: 100_000, percent: 4 };
		const gate = Promise.withResolvers<void>();
		session.promptGate = gate.promise;

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] })
			.finally(() => {
				settled = true;
			});
		await session.promptEntered.promise;
		for (const listener of session.listeners()) {
			listener({ type: "turn_end", message: makeAssistantMessage("step"), toolResults: [] } as AgentSessionEvent);
		}

		const midTurn = await usageSeen.promise;
		expect(settled).toBe(false);
		expect(midTurn.update).toEqual({ sessionUpdate: "usage_update", used: 4_000, size: 100_000 });

		gate.resolve();
		await prompt;
		vi.useRealTimers();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("injects _session/steering into a running turn", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const gate = Promise.withResolvers<void>();
		session.promptGate = gate.promise;

		const prompt = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] });
		await session.promptEntered.promise;
		const steered = await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "also check X" }],
		});

		expect(steered).toEqual({ outcome: "injected" });
		expect(session.steerCalls).toEqual([{ text: "also check X", images: [] }]);
		expect(session.promptCalls).toEqual(["work"]);

		gate.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("starts a new turn for _session/steering while idle", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		const steered = await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "start over" }],
		});
		await session.promptEntered.promise;

		expect(steered).toEqual({ outcome: "startedNewTurn" });
		expect(session.steerCalls).toEqual([]);
		expect(session.promptCalls).toEqual(["start over"]);
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	/** Yield macrotasks until `predicate` holds; fails instead of hanging. */
	async function waitUntil(predicate: () => boolean): Promise<void> {
		for (let attempt = 0; attempt < 200; attempt++) {
			if (predicate()) return;
			await eventLoopTurns(1);
		}
		throw new Error("condition not reached");
	}

	function hasChunk(harness: AgentHarness, sessionId: string, text: string): boolean {
		return harness.updates.some(
			n =>
				n.sessionId === sessionId &&
				n.update.sessionUpdate === "agent_message_chunk" &&
				n.update.content.type === "text" &&
				n.update.content.text === text,
		);
	}

	it("runs a steered /compact as a command and settles on the resumed run's agent_end", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const gate = Promise.withResolvers<void>();
		session.promptGate = gate.promise;

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] })
			.finally(() => {
				settled = true;
			});
		await session.promptEntered.promise;
		const steered = await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});

		expect(steered).toEqual({ outcome: "injected" });
		await waitUntil(() => hasChunk(harness, created.sessionId, "Compaction complete."));
		expect(session.compactCalls).toEqual([undefined]);
		expect(session.steerCalls).toEqual([]);
		// The run is still streaming (models the resumed turn): the prompt stays open.
		await eventLoopTurns(10);
		expect(settled).toBe(false);

		gate.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("settles the prompt when a steered /compact ends the run without a resume", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		// Never released: the aborted run's agent_end never reaches ACP.
		session.promptGate = Promise.withResolvers<void>().promise;
		session.compactImpl = async () => {
			session.isStreaming = false;
		};

		const prompt = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] });
		await session.promptEntered.promise;
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});

		expect((await prompt).stopReason).toBe("end_turn");
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("runs steered builtins in arrival order and holds the prompt open across the original agent_end", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const gate = Promise.withResolvers<void>();
		session.promptGate = gate.promise;
		const compactGate = Promise.withResolvers<void>();
		session.compactImpl = () => compactGate.promise;

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] })
			.finally(() => {
				settled = true;
			});
		await session.promptEntered.promise;
		const steer = (text: string) =>
			harness.agent.extMethod("_session/steering", {
				sessionId: created.sessionId,
				prompt: [{ type: "text", text }],
			});
		expect(await steer("/compact first")).toEqual({ outcome: "injected" });
		await waitUntil(() => session.compactCalls.length === 1);
		expect(await steer("/compact second")).toEqual({ outcome: "injected" });

		// The original run ends while `second` still waits behind `first`.
		gate.resolve();
		await eventLoopTurns(10);
		expect(session.compactCalls).toEqual(["first"]);
		expect(settled).toBe(false);

		compactGate.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		expect(session.compactCalls).toEqual(["first", "second"]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("runs an idle steered /compact as its own prompt and releases the session", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		const steered = await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});

		expect(steered).toEqual({ outcome: "startedNewTurn" });
		await waitUntil(() => hasChunk(harness, created.sessionId, "Compaction complete."));
		expect(session.compactCalls).toEqual([undefined]);
		expect(session.promptCalls).toEqual([]);

		const next = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "next" }],
		});
		expect(next.stopReason).toBe("end_turn");
		expect(session.promptCalls).toEqual(["next"]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("settles the prompt when a steered command fails after the run went idle", async () => {
		// The client connection drops the command's own output: `/compact` rejects
		// after the aborted run went idle, with no agent_end and no resume.
		const harness = await createHarness({
			sessionUpdateHook: notification => {
				const update = notification.update;
				if (
					update.sessionUpdate === "agent_message_chunk" &&
					update.content.type === "text" &&
					update.content.text === "Compaction complete."
				) {
					throw new Error("client gone");
				}
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.promptGate = Promise.withResolvers<void>().promise;
		session.compactImpl = async () => {
			session.isStreaming = false;
		};

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] })
			.finally(() => {
				settled = true;
			});
		await session.promptEntered.promise;
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});

		await waitUntil(() => settled);
		expect((await prompt).stopReason).toBe("end_turn");
		expect(hasChunk(harness, created.sessionId, "Command /compact failed: client gone")).toBe(true);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("drops builtins queued in a cancelled prompt without cancelling the next prompt", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.promptGate = Promise.withResolvers<void>().promise;
		const compactGate = Promise.withResolvers<void>();
		session.compactImpl = () => compactGate.promise;

		const promptA = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "a" }],
		});
		await session.promptEntered.promise;
		const steer = (text: string) =>
			harness.agent.extMethod("_session/steering", {
				sessionId: created.sessionId,
				prompt: [{ type: "text", text }],
			});
		await steer("/compact first");
		await waitUntil(() => session.compactCalls.length === 1);
		await steer("/compact second");
		await harness.agent.cancel({ sessionId: created.sessionId });
		expect((await promptA).stopReason).toBe("cancelled");

		const gateB = Promise.withResolvers<void>();
		session.promptGate = gateB.promise;
		let settledB = false;
		const promptB = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "b" }] })
			.finally(() => {
				settledB = true;
			});
		await waitUntil(() => session.promptCalls.length === 2);

		compactGate.resolve();
		await eventLoopTurns(10);
		expect(session.compactCalls).toEqual(["first"]);
		expect(settledB).toBe(false);
		expect(hasChunk(harness, created.sessionId, "Compaction complete.")).toBe(false);

		gateB.resolve();
		expect((await promptB).stopReason).toBe("end_turn");
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("never starts a steered builtin queued behind its prompt's own command once that prompt is cancelled", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		// Prompt A is itself a slow builtin that ignores the cancel.
		const releaseA = Promise.withResolvers<void>();
		session.compactImpl = () => (session.compactCalls.length === 1 ? releaseA.promise : Promise.resolve());

		const promptA = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact own" }],
		});
		await waitUntil(() => session.compactCalls.length === 1);
		expect(
			await harness.agent.extMethod("_session/steering", {
				sessionId: created.sessionId,
				prompt: [{ type: "text", text: "/compact steered" }],
			}),
		).toEqual({ outcome: "injected" });
		await harness.agent.cancel({ sessionId: created.sessionId });
		expect((await promptA).stopReason).toBe("cancelled");

		const gateB = Promise.withResolvers<void>();
		session.promptGate = gateB.promise;
		const promptB = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "b" }] });
		await waitUntil(() => session.promptCalls.length === 1);

		releaseA.resolve();
		await eventLoopTurns(10);
		expect(session.compactCalls).toEqual(["own"]);

		gateB.resolve();
		expect((await promptB).stopReason).toBe("end_turn");
		expect(session.compactCalls).toEqual(["own"]);
		expect(session.steerCalls).toEqual([]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("runs a steered builtin against session state its prompt's earlier command left behind", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const releaseOwn = Promise.withResolvers<void>();
		// The prompt's own command relocates the session (as `/move` does) while
		// a steered `/session info` waits behind it.
		session.compactImpl = async () => {
			await releaseOwn.promise;
			spyOn(session.sessionManager, "getCwd").mockReturnValue(harness.cwdB);
		};

		const promptA = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact own" }],
		});
		await waitUntil(() => session.compactCalls.length === 1);
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/session info" }],
		});

		releaseOwn.resolve();
		expect((await promptA).stopReason).toBe("end_turn");
		const info = harness.updates.find(
			n =>
				n.update.sessionUpdate === "agent_message_chunk" &&
				n.update.content.type === "text" &&
				n.update.content.text.startsWith("Session: "),
		);
		expect(info?.update).toMatchObject({ content: { text: expect.stringContaining(`CWD: ${harness.cwdB}`) } });
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("rejects with the prompt command's error only after a steered command's resumed run ended", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const releaseOwn = Promise.withResolvers<void>();
		const resumeGate = Promise.withResolvers<void>();
		const failure = new Error("own command blew up");
		let failNextUsageRead = false;
		// The prompt's own `/compact` rejects when it reads usage after compacting.
		spyOn(session, "getContextUsage").mockImplementation(() => {
			if (!failNextUsageRead) return undefined;
			failNextUsageRead = false;
			throw failure;
		});
		session.compactImpl = async () => {
			if (session.compactCalls.length === 1) {
				await releaseOwn.promise;
				failNextUsageRead = true;
				return;
			}
			// The steered `/compact` resumes a run that streams into the same reply.
			session.isStreaming = true;
			void resumeGate.promise.then(() => {
				const resumed = makeAssistantMessage("resumed");
				for (const listener of session.listeners()) {
					listener({
						type: "message_update",
						message: resumed,
						assistantMessageEvent: { type: "text_delta", delta: "resumed" },
					} as AgentSessionEvent);
				}
				for (const listener of session.listeners()) {
					listener({ type: "agent_end", messages: [resumed] } as AgentSessionEvent);
				}
				session.isStreaming = false;
			});
		};

		let settled = false;
		const promptA = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "/compact own" }] })
			.finally(() => {
				settled = true;
			});
		const outcome = promptA.then(
			() => "resolved" as const,
			(error: unknown) => error,
		);
		await waitUntil(() => session.compactCalls.length === 1);
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact steered" }],
		});

		releaseOwn.resolve();
		await waitUntil(() => session.compactCalls.length === 2);
		await eventLoopTurns(10);
		expect(settled).toBe(false);

		resumeGate.resolve();
		expect(await outcome).toBe(failure);
		expect(hasChunk(harness, created.sessionId, "resumed")).toBe(true);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("keeps a locally handled prompt open until the builtins steered into it ran", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const releaseOwn = Promise.withResolvers<void>();
		session.compactImpl = () => (session.compactCalls.length === 1 ? releaseOwn.promise : Promise.resolve());

		let settled = false;
		const promptA = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "/compact own" }] })
			.finally(() => {
				settled = true;
			});
		await waitUntil(() => session.compactCalls.length === 1);
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [
				{ type: "text", text: "/force read secret-from-a" },
				{ type: "image", data: "aGk=", mimeType: "image/png" },
			],
		});

		releaseOwn.resolve();
		// The steered `/force` runs inside A (its residual goes to A's session
		// steer) before A finishes; nothing is left for a later prompt.
		expect((await promptA).stopReason).toBe("end_turn");
		expect(settled).toBe(true);
		expect(session.forcedToolChoice).toBe("read");
		expect(session.steerCalls).toEqual([
			{ text: "secret-from-a", images: [{ type: "image", data: "aGk=", mimeType: "image/png" }] },
		]);

		const promptB = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "b" }],
		});
		expect(promptB.stopReason).toBe("end_turn");
		expect(session.steerCalls).toHaveLength(1);
		expect(session.promptCalls).toEqual(["b"]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("never overlaps a builtin still running for a cancelled prompt, and keeps later prompts usable", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.promptGate = Promise.withResolvers<void>().promise;
		// A's handler ignores the cancel and never returns.
		session.compactImpl = () => Promise.withResolvers<void>().promise;
		const notRun = "Command /compact not run: /compact from an earlier reply is still running.";
		const notRunCount = () =>
			harness.updates.filter(
				n =>
					n.update.sessionUpdate === "agent_message_chunk" &&
					n.update.content.type === "text" &&
					n.update.content.text === notRun,
			).length;

		const promptA = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "a" }],
		});
		await session.promptEntered.promise;
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact stuck" }],
		});
		await waitUntil(() => session.compactCalls.length === 1);
		await harness.agent.cancel({ sessionId: created.sessionId });
		await promptA;

		// Steered into prompt B: refused, B stays usable and ends normally.
		const gateB = Promise.withResolvers<void>();
		session.promptGate = gateB.promise;
		const promptB = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "b" }] });
		await waitUntil(() => session.promptCalls.length === 2);
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});
		await waitUntil(() => notRunCount() === 1);
		gateB.resolve();
		expect((await promptB).stopReason).toBe("end_turn");

		// Sent as its own prompt C: refused the same way, C settles.
		const promptC = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/compact" }],
		});
		expect(promptC.stopReason).toBe("end_turn");
		expect(notRunCount()).toBe(2);
		expect(session.compactCalls).toEqual(["stuck"]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("steers a builtin's residual text with the original images into the running turn", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const gate = Promise.withResolvers<void>();
		session.promptGate = gate.promise;

		const prompt = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "work" }] });
		await session.promptEntered.promise;
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [
				{ type: "text", text: "/force read inspect this" },
				{ type: "image", data: "aGk=", mimeType: "image/png" },
			],
		});

		await waitUntil(() => session.steerCalls.length === 1);
		expect(session.steerCalls).toEqual([
			{ text: "inspect this", images: [{ type: "image", data: "aGk=", mimeType: "image/png" }] },
		]);
		expect(session.forcedToolChoice).toBe("read");
		expect(session.promptCalls).toEqual(["work"]);

		gate.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("drops a builtin's residual text when its prompt was cancelled while the command ran", async () => {
		// Hold `/force`'s own status output so the command is still running when
		// the user stops prompt A and starts prompt B.
		const outputEntered = Promise.withResolvers<void>();
		const releaseOutput = Promise.withResolvers<void>();
		const harness = await createHarness({
			sessionUpdateHook: async notification => {
				const update = notification.update;
				if (
					update.sessionUpdate === "agent_message_chunk" &&
					update.content.type === "text" &&
					update.content.text === "Next turn forced to use read."
				) {
					outputEntered.resolve();
					await releaseOutput.promise;
				}
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.promptGate = Promise.withResolvers<void>().promise;

		const promptA = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "a" }],
		});
		await session.promptEntered.promise;
		await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [
				{ type: "text", text: "/force read secret-from-a" },
				{ type: "image", data: "aGk=", mimeType: "image/png" },
			],
		});
		await outputEntered.promise;
		await harness.agent.cancel({ sessionId: created.sessionId });
		expect((await promptA).stopReason).toBe("cancelled");

		const gateB = Promise.withResolvers<void>();
		session.promptGate = gateB.promise;
		const promptB = harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "b" }] });
		await waitUntil(() => session.promptCalls.length === 2);

		releaseOutput.resolve();
		await eventLoopTurns(10);
		expect(session.steerCalls).toEqual([]);

		gateB.resolve();
		expect((await promptB).stopReason).toBe("end_turn");
		expect(session.steerCalls).toEqual([]);
		harness.abortController.abort();
		await eventLoopTurns(1);
	});

	it("rejects malformed _session/steering params as invalid params", async () => {
		const harness = await createHarness();
		await expect(harness.agent.extMethod("_session/steering", { sessionId: 1, prompt: [] })).rejects.toMatchObject({
			code: -32602,
		});
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("replays messageIds and returns turn usage for prompts", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "hello", timestamp: Date.now() });
		stored.sessionManager.appendMessage(makeAssistantMessage("reply", "reasoning"));
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		const loaded = await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});
		expectAcpStructure(zLoadSessionResponse, loaded);
		const replayChunks = harness.updates.filter(
			update =>
				update.sessionId === stored.sessionId &&
				(update.update.sessionUpdate === "user_message_chunk" ||
					update.update.sessionUpdate === "agent_message_chunk" ||
					update.update.sessionUpdate === "agent_thought_chunk"),
		);
		const replayAssistantChunks = replayChunks.filter(
			update =>
				update.update.sessionUpdate === "agent_message_chunk" ||
				update.update.sessionUpdate === "agent_thought_chunk",
		);

		expect(
			replayChunks.every(
				update => typeof getChunkMessageId(update) === "string" && getChunkMessageId(update)!.length > 0,
			),
		).toBe(true);
		expect(new Set(replayAssistantChunks.map(update => getChunkMessageId(update))).size).toBe(1);

		const live = await harness.agent.newSession({ cwd: harness.cwdB, mcpServers: [] });
		const response = await harness.agent.prompt({
			sessionId: live.sessionId,
			prompt: [{ type: "text", text: "ping" }],
		});
		expectAcpStructure(zPromptResponse, response);
		expectAcpNotifications(harness.updates);

		const liveChunks = harness.updates.filter(
			update => update.sessionId === live.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		expect(response.usage).toEqual({
			inputTokens: 10,
			outputTokens: 5,
			cachedReadTokens: 2,
			cachedWriteTokens: 1,
			totalTokens: 18,
		});
		expect(
			liveChunks.some(
				update => typeof getChunkMessageId(update) === "string" && getChunkMessageId(update)!.length > 0,
			),
		).toBe(true);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("loads a session stored under a legacy/hashed project directory (#7779)", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "legacy hello", timestamp: Date.now() });
		stored.sessionManager.appendMessage(makeAssistantMessage("legacy reply"));
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		const sessionFile = stored.sessionManager.getSessionFile();
		if (!sessionFile) throw new Error("session file not persisted");
		const sessionId = stored.sessionId;
		// Release the writer so the directory can be renamed out from under it.
		await stored.dispose();

		// Simulate the hashed-directory era (#7397, reverted in #7656): the
		// session file lives under a project directory whose name the current
		// cwd->dir scheme would never produce, so the cwd-scoped scan misses it.
		const cwdDerivedDir = path.dirname(sessionFile);
		const sessionsRoot = path.dirname(cwdDerivedDir);
		const hashedDir = path.join(sessionsRoot, `home-cwd-a-${"a".repeat(64)}`);
		await fs.promises.rename(cwdDerivedDir, hashedDir);

		const loaded = await harness.agent.loadSession({
			sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});
		expectAcpStructure(zLoadSessionResponse, loaded);

		const replayChunks = harness.updates.filter(
			update =>
				update.sessionId === sessionId &&
				(update.update.sessionUpdate === "user_message_chunk" ||
					update.update.sessionUpdate === "agent_message_chunk"),
		);
		expect(replayChunks.length).toBeGreaterThan(0);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("delivers the final visible answer when agent_end overtakes the assistant message_end (#4902)", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session) throw new Error("session not registered");

		// Live turn as observed through the prompt subscription when the
		// fire-and-forget assistant message_end handler loses the race against
		// the agent_end flush: thinking streams, then the turn ends. No
		// text_delta and no message_end ever reach this subscriber — the final
		// text exists only on the agent_end payload.
		const assistantMessage = makeAssistantMessage("Final visible answer.", "Considering the greeting.");
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: assistantMessage,
					assistantMessageEvent: { type: "thinking_delta", delta: "Considering the greeting." },
				} as AgentSessionEvent);
			}
			session.sessionManager.appendMessage(assistantMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [assistantMessage] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "Say hello" }],
		});
		expectAcpStructure(zPromptResponse, response);
		expect(response.stopReason).toBe("end_turn");

		const chunks = harness.updates.filter(update => update.sessionId === created.sessionId);
		const thoughtChunks = chunks.filter(update => update.update.sessionUpdate === "agent_thought_chunk");
		const messageChunks = chunks.filter(update => update.update.sessionUpdate === "agent_message_chunk");
		expect(thoughtChunks).toHaveLength(1);
		// The visible answer must reach the client exactly once even though the
		// assistant message_end never arrived on this subscription.
		expect(messageChunks).toHaveLength(1);
		expect(messageChunks[0]?.update).toEqual(
			expect.objectContaining({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: "Final visible answer." },
			}),
		);
		// Flushed answer belongs to the same live message as the thought chunk.
		expect(getChunkMessageId(messageChunks[0]!)).toBe(getChunkMessageId(thoughtChunks[0]!)!);
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("does not duplicate the final answer when the assistant message_end arrives before agent_end", async () => {
		// Companion to the #4902 regression: when message_end IS delivered, its
		// fallback emission wins and the agent_end flush must stay silent.
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session) throw new Error("session not registered");

		const assistantMessage = makeAssistantMessage("Composed offline.", "quiet planning");
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: assistantMessage,
					assistantMessageEvent: { type: "thinking_delta", delta: "quiet planning" },
				} as AgentSessionEvent);
			}
			for (const listener of session.listeners()) {
				listener({ type: "message_end", message: assistantMessage } as AgentSessionEvent);
			}
			session.sessionManager.appendMessage(assistantMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [assistantMessage] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "Say hello" }],
		});
		expectAcpStructure(zPromptResponse, response);

		const messageChunks = harness.updates.filter(
			update => update.sessionId === created.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		expect(messageChunks).toHaveLength(1);
		expect(messageChunks[0]?.update).toEqual(
			expect.objectContaining({
				content: { type: "text", text: "Composed offline." },
			}),
		);
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("surfaces a provider error that reaches the client only via agent_end", async () => {
		// A request that fails before streaming any assistant events (e.g.
		// GitHub Copilot's HTTP 400 model_not_supported) emits no
		// message_update/message_end — only agent_end carrying an empty
		// assistant message with errorMessage. The client must still see why
		// the turn ended instead of a silent stop.
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session) throw new Error("session not registered");

		const errorText = "400 The requested model is not supported.";
		const failedMessage = {
			...makeAssistantMessage(""),
			stopReason: "error" as const,
			errorMessage: errorText,
		};
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			session.sessionManager.appendMessage(failedMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [failedMessage] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "Say hello" }],
		});
		expectAcpStructure(zPromptResponse, response);

		const messageChunks = harness.updates.filter(
			update => update.sessionId === created.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		expect(messageChunks).toHaveLength(1);
		expect(messageChunks[0]?.update).toEqual(expect.objectContaining({ content: { type: "text", text: errorText } }));
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("does not re-send a streamed error chunk from the agent_end fallback", async () => {
		// When the error DID stream (message_update with an `error` event maps
		// to an agent_message_chunk), the agent_end fallback must stay silent —
		// even though agent_end races the in-flight chunk delivery.
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session) throw new Error("session not registered");

		const errorText = "upstream stream failed";
		const failedMessage = {
			...makeAssistantMessage(""),
			stopReason: "error" as const,
			errorMessage: errorText,
		};
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: failedMessage,
					assistantMessageEvent: { type: "error", error: { errorMessage: errorText } },
				} as AgentSessionEvent);
			}
			session.sessionManager.appendMessage(failedMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [failedMessage] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "Say hello" }],
		});
		expectAcpStructure(zPromptResponse, response);

		const messageChunks = harness.updates.filter(
			update => update.sessionId === created.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		expect(messageChunks).toHaveLength(1);
		expect(messageChunks[0]?.update).toEqual(expect.objectContaining({ content: { type: "text", text: errorText } }));
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("replays assistant tool calls and matching results without duplicating the start", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "run tests", timestamp: Date.now() });
		stored.sessionManager.appendMessage({
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: "toolu_bash_replay",
					name: "bash",
					arguments: { command: "npm test" },
				},
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: TEST_MODELS[0].id,
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		});
		stored.sessionManager.appendMessage({
			role: "toolResult",
			toolCallId: "toolu_bash_replay",
			toolName: "bash",
			content: [{ type: "text", text: "tests passed" }],
			isError: false,
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});

		const toolUpdates = harness.updates
			.filter(update => update.sessionId === stored.sessionId)
			.map(notification => notification.update)
			.filter(update => "toolCallId" in update && update.toolCallId === "toolu_bash_replay");
		const starts = toolUpdates.filter(update => update.sessionUpdate === "tool_call");
		const completions = toolUpdates.filter(
			update => update.sessionUpdate === "tool_call_update" && update.status === "completed",
		);

		expect(starts).toHaveLength(1);
		expect(starts[0]).toEqual(
			expect.objectContaining({
				sessionUpdate: "tool_call",
				toolCallId: "toolu_bash_replay",
				rawInput: { command: "npm test" },
			}),
		);
		expect(starts[0]).toEqual(
			expect.objectContaining({
				content: expect.arrayContaining([{ type: "content", content: { type: "text", text: "$ npm test" } }]),
			}),
		);
		expect(starts.some(update => "rawInput" in update && JSON.stringify(update.rawInput) === "{}")).toBe(false);
		expect(completions).toHaveLength(1);
		expect(completions[0]).toEqual(
			expect.objectContaining({
				content: expect.arrayContaining([{ type: "content", content: { type: "text", text: "tests passed" } }]),
			}),
		);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("does not replay internal peer messages to ACP clients", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "Delegate this task", timestamp: Date.now() });
		stored.sessionManager.appendMessage({
			...makeAssistantMessage(""),
			content: [
				{
					type: "toolCall",
					id: "toolu_hub_replay",
					name: "write",
					arguments: { path: "agent://Scout", content: "Private coordination" },
				},
			],
			stopReason: "toolUse",
		});
		stored.sessionManager.appendMessage({
			role: "toolResult",
			toolCallId: "toolu_hub_replay",
			toolName: "write",
			content: [{ type: "text", text: "Delivered to Scout." }],
			isError: false,
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});

		const hubUpdates = harness.updates
			.filter(update => update.sessionId === stored.sessionId)
			.map(notification => notification.update)
			.filter(update => "toolCallId" in update && update.toolCallId === "toolu_hub_replay");
		expect(hubUpdates).toEqual([]);

		harness.abortController.abort();
	});

	it("preserves tool_use input payloads when replaying assistant tool calls", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "use custom tool", timestamp: Date.now() });
		stored.sessionManager.appendMessage({
			role: "assistant",
			content: [
				{
					type: "tool_use",
					id: "toolu_custom",
					name: "custom_tool",
					input: "raw custom payload",
				},
			] as unknown as Array<{ type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }>,
			api: "openai-responses",
			provider: "openai",
			model: TEST_MODELS[1].id,
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});

		const start = harness.updates
			.filter(update => update.sessionId === stored.sessionId)
			.map(notification => notification.update)
			.find(update => "toolCallId" in update && update.toolCallId === "toolu_custom");

		expect(start).toEqual(
			expect.objectContaining({
				sessionUpdate: "tool_call",
				toolCallId: "toolu_custom",
				rawInput: "raw custom payload",
			}),
		);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("does not replay silent-abort marker as agent_message_chunk to ACP clients", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({ role: "user", content: "start", timestamp: Date.now() });
		// Simulate a silent-abort assistant message: empty content, errorMessage = marker
		stored.sessionManager.appendMessage({
			role: "assistant",
			content: [],
			api: "anthropic-messages",
			provider: "anthropic",
			model: TEST_MODELS[0].id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "aborted",
			errorMessage: SILENT_ABORT_MARKER,
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});
		const replayChunks = harness.updates.filter(
			update => update.sessionId === stored.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		// The silent-abort marker MUST NOT surface as a replayed message chunk
		const markerChunks = replayChunks.filter(
			update =>
				update.update.sessionUpdate === "agent_message_chunk" &&
				update.update.content.type === "text" &&
				update.update.content.text === SILENT_ABORT_MARKER,
		);
		expect(markerChunks).toHaveLength(0);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("emits ACP plan updates from live todo results", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			for (const listener of session.listeners()) {
				listener({
					type: "tool_execution_end",
					toolCallId: "todo_1",
					toolName: "todo",
					isError: false,
					result: {
						content: [{ type: "text", text: "updated" }],
						details: {
							phases: [
								{
									name: "Work",
									tasks: [
										{ content: "Fix bug", status: "in_progress" },
										{ content: "Run tests", status: "completed" },
									],
								},
							],
						},
					},
				} as AgentSessionEvent);
				listener({
					type: "tool_execution_end",
					toolCallId: "todo_empty",
					toolName: "todo",
					isError: false,
					result: {
						content: [{ type: "text", text: "cleared" }],
						details: { phases: [] },
					},
				} as AgentSessionEvent);
				listener({ type: "agent_end", messages: [] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000047",
			prompt: [{ type: "text", text: "write todos" }],
		} as PromptRequest);

		expect(harness.updates.map(update => update.update)).toContainEqual({
			sessionUpdate: "plan",
			entries: [
				{ content: "Fix bug", priority: "medium", status: "in_progress" },
				{ content: "Run tests", priority: "medium", status: "completed" },
			],
		});
		expect(harness.updates.map(update => update.update)).toContainEqual({ sessionUpdate: "plan", entries: [] });
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("replays todo tool results as ACP plan updates", async () => {
		const harness = await createHarness();
		const stored = new FakeAgentSession(harness.cwdA);
		harness.sessions.push(stored);
		stored.sessionManager.appendMessage({
			role: "toolResult",
			toolCallId: "todo_replay",
			toolName: "todo",
			content: [{ type: "text", text: "updated" }],
			details: {
				phases: [{ name: "Replay", tasks: [{ content: "Restore plan", status: "pending" }] }],
			},
			isError: false,
			timestamp: Date.now(),
		});
		await stored.sessionManager.ensureOnDisk();
		await stored.sessionManager.flush();

		await harness.agent.loadSession({
			sessionId: stored.sessionId,
			cwd: harness.cwdA,
			mcpServers: [],
		});

		expect(harness.updates.map(update => update.update)).toContainEqual({
			sessionUpdate: "plan",
			entries: [{ content: "Restore plan", priority: "medium", status: "pending" }],
		});
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("refreshes task agent descriptions on ACP /reload-plugins", async () => {
		const harness = await createHarness();
		const agentDir = path.join(harness.cwdA, ".omp", "agents");
		const agentFile = path.join(agentDir, "acp-reload-agent.md");
		await fs.promises.mkdir(agentDir, { recursive: true });
		await fs.promises.writeFile(
			agentFile,
			"---\nname: acp-reload-agent\ndescription: VERSION_ONE\n---\nACP reload agent.\n",
		);
		const taskTool = await TaskTool.create(createTaskSession(harness.cwdA));
		expect(taskTool.description).toContain("VERSION_ONE");
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });

		await fs.promises.writeFile(
			agentFile,
			"---\nname: acp-reload-agent\ndescription: VERSION_TWO\n---\nACP reload agent.\n",
		);
		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000006",
			prompt: [{ type: "text", text: "/reload-plugins" }],
		} as PromptRequest);

		expect(taskTool.description).toContain("VERSION_TWO");
		expect(taskTool.description).not.toContain("VERSION_ONE");
		harness.abortController.abort();
	});

	it("advertises ACP-safe builtins and skill commands", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const skillDir = path.join(harness.cwdA, ".skills", "sample");
		const skillPath = path.join(skillDir, "SKILL.md");
		await fs.promises.mkdir(skillDir, { recursive: true });
		await fs.promises.writeFile(skillPath, "---\ndescription: Sample skill\n---\n# Sample\nDo work.\n");
		session.skills = [
			{
				name: "sample",
				description: "Sample skill",
				filePath: skillPath,
				baseDir: skillDir,
				source: "test",
			},
		];
		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000004",
			prompt: [{ type: "text", text: "/reload-plugins" }],
		} as PromptRequest);

		const commandUpdates = harness.updates.filter(
			update =>
				update.sessionId === created.sessionId && update.update.sessionUpdate === "available_commands_update",
		);
		const names = commandUpdates.flatMap(update =>
			update.update.sessionUpdate === "available_commands_update"
				? update.update.availableCommands.map(command => command.name)
				: [],
		);
		expect(names).toContain("fast");
		expect(names).toContain("retry");
		expect(names).toContain("force");
		expect(names).toContain("skill:sample");
		expect(names).not.toContain("settings");
		expect(names).not.toContain("copy");
		expect(names).not.toContain("plan");
		expect(names).not.toContain("loop");
		expect(names).not.toContain("login");
		expect(names).not.toContain("new");
		expect(names).toContain("handoff");
		expect(names).not.toContain("fork");
		expect(names).not.toContain("btw");
		expect(names).not.toContain("delete");
		expect(names).not.toContain("resume");
		expect(names).not.toContain("agents");
		expect(names).not.toContain("extensions");
		expect(names).not.toContain("hotkeys");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("includes extension-registered commands in available_commands_update and excludes ACP-builtin collisions", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		// Extension command colliding with a custom TS command; extension wins (dispatch order).
		(session as unknown as { customCommands: unknown[] }).customCommands = [
			{ command: { name: "my-ext-cmd", description: "Custom TS version" } },
		];
		// Extension runner: unique command + one colliding with an ACP builtin
		// ("fast") + a colon-namespaced one whose prefix is a builtin
		// ("model:foo" parses as builtin `/model` with args `foo` at dispatch).
		(session as unknown as { extensionRunner: unknown }).extensionRunner = {
			getRegisteredCommands(reserved?: Set<string>) {
				return [
					{ name: "my-ext-cmd", description: "Extension command", handler: async () => {} },
					{ name: "fast", description: "Would shadow builtin", handler: async () => {} },
					{ name: "model:foo", description: "Colon-shadowed by /model", handler: async () => {} },
				].filter(cmd => !reserved?.has(cmd.name));
			},
		};

		// Drive a deterministic re-advertisement instead of sleeping through
		// the bootstrap timer: under full-suite load the 50ms guard plus the
		// awaited slash-command scan can outlive the fixed wait, leaving zero
		// command updates observed (#flake). `/reload-plugins` awaits the
		// refresh and emits an advertisement that includes the stubs above.
		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000005",
			prompt: [{ type: "text", text: "/reload-plugins" }],
		} as PromptRequest);

		const commandUpdates = harness.updates.filter(
			update =>
				update.sessionId === created.sessionId && update.update.sessionUpdate === "available_commands_update",
		);
		// Each update is a complete advertisement; assert on the latest one
		// (the bootstrap update may or may not have landed by now).
		const lastUpdate = commandUpdates.at(-1);
		const allCommands =
			lastUpdate?.update.sessionUpdate === "available_commands_update" ? lastUpdate.update.availableCommands : [];
		const names = allCommands.map(c => c.name);

		// Extension command must surface.
		expect(names).toContain("my-ext-cmd");
		// Extension wins the name collision: advertised description is the extension's, not the custom TS one.
		const extCmdEntry = allCommands.find(c => c.name === "my-ext-cmd");
		expect(extCmdEntry?.description).toBe("Extension command");
		// ACP builtin "fast" appears exactly once (reserved-set exclusion, no duplicate from extension).
		expect(names.filter(n => n === "fast").length).toBe(1);
		// Colon-namespaced collision with a builtin prefix is not advertised:
		// ACP would dispatch `/model:foo` to the `/model` builtin, not the extension.
		expect(names).not.toContain("model:foo");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("executes skill commands through custom skill messages", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session) throw new Error("expected ACP session to exist after newSession");
		const skillDir = path.join(harness.cwdA, ".skills", "sample");
		const skillPath = path.join(skillDir, "SKILL.md");
		await fs.promises.mkdir(skillDir, { recursive: true });
		await fs.promises.writeFile(skillPath, "---\ndescription: Sample skill\n---\n# Sample\nDo work.\n");
		session.skills = [
			{
				name: "sample",
				description: "Sample skill",
				filePath: skillPath,
				baseDir: skillDir,
				source: "test",
			},
		];

		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000001",
			prompt: [{ type: "text", text: "/skill:sample extra context" }],
		} as PromptRequest);

		expect(session.promptCalls).toEqual([]);
		expect(session.customMessages).toHaveLength(1);
		const customMessage = session.customMessages[0];
		if (!customMessage) throw new Error("expected ACP skill prompt custom message");
		expect(customMessage.customType).toBe("skill-prompt");
		expect(customMessage.content).toContain("# Sample\nDo work.");
		expect(customMessage.content).toContain(`[Skill directory: ${skillDir}]`);
		expect(customMessage.content).toContain("User: extra context");
		expect(session.customMessageOptions[0]).toEqual({ streamingBehavior: "steer" });

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("auto-cancels an in-progress turn and queues a new prompt when called mid-flight", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		// Block abort() until released so we can assert the second prompt waits
		let releaseAbort!: () => void;
		const abortStarted = Promise.withResolvers<void>();
		const abortRelease = new Promise<void>(resolve => {
			releaseAbort = resolve;
		});
		session.abort = async () => {
			session.isStreaming = false;
			abortStarted.resolve();
			await abortRelease;
		};

		const blockers: Array<() => void> = [];
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			session.isStreaming = true;
			const { promise, resolve } = Promise.withResolvers<void>();
			blockers.push(resolve);
			await promise;
			const assistantMessage = makeAssistantMessage("pong");
			session.sessionManager.appendMessage(assistantMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [assistantMessage] } as AgentSessionEvent);
			}
			session.isStreaming = false;
			return true;
		};

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000035",
			prompt: [{ type: "text", text: "long running" }],
		} as PromptRequest);
		await Bun.sleep(0);
		expect(session.promptCalls).toEqual(["long running"]);

		// Second prompt arrives mid-flight — must auto-cancel first, then queue
		const secondPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000036",
			prompt: [{ type: "text", text: "overlap" }],
		} as PromptRequest);

		// First resolves immediately as cancelled
		const firstResponse = await firstPrompt;
		expect(firstResponse.stopReason).toBe("cancelled");

		// abort() must have been called as part of cancel cleanup
		await abortStarted.promise;

		// Second prompt must NOT start until abort cleanup completes
		await Bun.sleep(0);
		expect(session.promptCalls).toEqual(["long running"]);

		// Release abort — second session.prompt should now start
		releaseAbort();
		await Bun.sleep(0);
		expect(session.promptCalls).toEqual(["long running", "overlap"]);

		// Unblock both session.prompt calls (first is fire-and-forget, second drives the response)
		for (const resolve of blockers) resolve();
		const secondResponse = await secondPrompt;
		expect(secondResponse.stopReason).toBe("end_turn");

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("closes the ACP session when implicit cancel cleanup times out", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		harness.agent.setCancelCleanupTimeoutForTesting(10);
		session.abort = async () => new Promise<void>(() => undefined);
		const finishPrompt = holdPromptStreaming(session);

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000045",
			prompt: [{ type: "text", text: "long running" }],
		} as PromptRequest);
		await Bun.sleep(0);

		// Overlapping prompt triggers the implicit cancel; abort() never resolves,
		// so cleanup times out, the queued prompt fails, and the session is closed.
		const secondPrompt = harness.agent
			.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000046",
				prompt: [{ type: "text", text: "overlap" }],
			} as PromptRequest)
			.catch(error => error);

		const firstResponse = await firstPrompt;
		expect(firstResponse.stopReason).toBe("cancelled");

		const queuedError = await secondPrompt;
		expect(queuedError).toBeInstanceOf(Error);
		expect((queuedError as Error).message).toBe("ACP cancel cleanup timed out");

		// The fire-and-forget close runs off the same cleanup rejection; give it a
		// few ticks to settle before asserting.
		for (let i = 0; i < 20 && !session.disposed; i++) {
			await Bun.sleep(0);
		}
		expect(session.disposed).toBe(true);
		await expect(
			harness.agent.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000047",
				prompt: [{ type: "text", text: "after stuck implicit cancel" }],
			} as PromptRequest),
		).rejects.toThrow("Unsupported ACP session");

		finishPrompt();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("waits for AgentSession idle cleanup after agent_end before returning", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const { promise: idleBlocked, resolve: markIdleBlocked } = Promise.withResolvers<void>();
		const { promise: releaseIdle, resolve: unblockIdle } = Promise.withResolvers<void>();
		session.waitForIdleBlocker = async () => {
			markIdleBlocked();
			await releaseIdle;
		};

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "wait for cleanup" }],
		});
		await idleBlocked;

		try {
			const returnedBeforeIdle = await Promise.race([firstPrompt.then(() => true), Bun.sleep(0).then(() => false)]);
			expect(returnedBeforeIdle).toBe(false);
			expect(session.waitForIdleCalls).toBe(1);

			unblockIdle();
			await firstPrompt;
		} finally {
			unblockIdle();
			harness.abortController.abort();
			await Bun.sleep(0);
		}
	});

	it("streams the retried turn inside the /retry prompt turn", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.retryResult = true;

		let emitted = false;
		session.waitForIdleBlocker = async () => {
			// One-shot: `#waitForAcpPromptIdle` calls `session.waitForIdle()` again
			// while handling the retried turn's own `agent_end`, so an unguarded
			// blocker would re-enter and recurse forever.
			if (emitted) return;
			emitted = true;
			const assistantMessage = makeAssistantMessage("Recovered answer.");
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: assistantMessage,
					assistantMessageEvent: { type: "text_delta", delta: "Recovered answer." },
				} as AgentSessionEvent);
			}
			session.sessionManager.appendMessage(assistantMessage);
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages: [assistantMessage] } as AgentSessionEvent);
			}
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/retry" }],
		});

		expect(response.stopReason).toBe("end_turn");
		expect(session.retryCalls).toBe(1);

		const chunkTexts = harness.updates
			.filter(
				update =>
					update.sessionId === created.sessionId &&
					update.update.sessionUpdate === "agent_message_chunk" &&
					update.update.content.type === "text",
			)
			.map(update => (update.update as { content: { type: "text"; text: string } }).content.text);
		expect(chunkTexts).toEqual(["Retrying the last failed turn.", "Recovered answer."]);

		expect(session.waitForIdleCalls).toBeGreaterThanOrEqual(1);
		expectAcpNotifications(harness.updates);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("drains in-flight ACP event handlers before closing a /retry turn with no agent_end", async () => {
		// `AgentSession.#emit()` does not await listeners, so a retried turn's
		// update can still be in delivery once the session reports idle. When the
		// scheduled continuation never emits `agent_end` (e.g. a generation
		// mismatch skips it), `#runPromptOrCommand`'s trailing `#finishPrompt` is
		// what closes the turn — so the turn-holding hook must drain
		// `record.promptEventHandlers` first or the response overtakes its chunk.
		const deliveryBlocked = Promise.withResolvers<void>();
		const deliveryRelease = Promise.withResolvers<void>();
		let held = false;
		const harness = await createHarness({
			sessionUpdateHook: async notification => {
				if (
					held ||
					notification.update.sessionUpdate !== "agent_message_chunk" ||
					notification.update.content.type !== "text" ||
					notification.update.content.text !== "Recovered answer."
				) {
					return;
				}
				held = true;
				deliveryBlocked.resolve();
				await deliveryRelease.promise;
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.retryResult = true;

		let emitted = false;
		session.waitForIdleBlocker = async () => {
			if (emitted) return;
			emitted = true;
			// Deliberately no `agent_end`: this exercises the trailing-finishPrompt
			// path rather than the `#handlePromptEvent` one.
			const assistantMessage = makeAssistantMessage("Recovered answer.");
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: assistantMessage,
					assistantMessageEvent: { type: "text_delta", delta: "Recovered answer." },
				} as AgentSessionEvent);
			}
		};

		const prompt = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/retry" }],
		});
		await deliveryBlocked.promise;

		try {
			const resolvedEarly = await Promise.race([prompt.then(() => true), Bun.sleep(0).then(() => false)]);
			expect(resolvedEarly).toBe(false);

			deliveryRelease.resolve();
			const response = await prompt;
			expect(response.stopReason).toBe("end_turn");
			expect(
				harness.updates.some(
					update =>
						update.update.sessionUpdate === "agent_message_chunk" &&
						update.update.content.type === "text" &&
						update.update.content.text === "Recovered answer.",
				),
			).toBe(true);
		} finally {
			deliveryRelease.resolve();
			harness.abortController.abort();
			await Bun.sleep(0);
		}
	});

	it("keeps the ACP prompt open while an owned background job runs and streams its wake turn inside it", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const emit = (event: AgentSessionEvent) => {
			for (const listener of session.listeners()) listener(event);
		};
		const settleEntered = Promise.withResolvers<void>();
		const jobDone = Promise.withResolvers<void>();
		session.pendingAsyncWork = true;
		session.settleAsyncWork = async () => {
			settleEntered.resolve();
			await jobDone.promise;
			const wake = makeAssistantMessage("job wake");
			emit({
				type: "message_update",
				message: wake,
				assistantMessageEvent: { type: "text_delta", delta: "job wake" },
			} as AgentSessionEvent);
			emit({ type: "agent_end", messages: [wake] } as AgentSessionEvent);
			session.pendingAsyncWork = false;
		};

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "start a background job" }] })
			.finally(() => {
				settled = true;
			});
		// Without the quiescence wait the prompt resolves before background work is ever settled.
		const first = await Promise.race([
			settleEntered.promise.then(() => "settling" as const),
			prompt.then(() => "resolved" as const),
		]);
		expect(first).toBe("settling");
		await eventLoopTurns(5);
		expect(settled).toBe(false);

		jobDone.resolve();
		const response = await prompt;
		expect(response.stopReason).toBe("end_turn");
		const wakeChunks = harness.updates.filter(
			update =>
				update.update.sessionUpdate === "agent_message_chunk" &&
				update.update.content.type === "text" &&
				update.update.content.text === "job wake",
		);
		expect(wakeChunks).toHaveLength(1);
		expect(session.acpPromptOpen).toEqual([true, false]);
		harness.abortController.abort();
	});

	it("waits for a wake turn's agent_end delivery before resolving the ACP prompt", async () => {
		const deliveryGate = Promise.withResolvers<void>();
		const fallbackReached = Promise.withResolvers<void>();
		const harness = await createHarness({
			sessionUpdateHook: async notification => {
				const update = notification.update;
				if (
					update.sessionUpdate === "agent_message_chunk" &&
					update.content.type === "text" &&
					update.content.text === "wake fallback"
				) {
					fallbackReached.resolve();
					await deliveryGate.promise;
				}
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const emit = (event: AgentSessionEvent) => {
			for (const listener of session.listeners()) listener(event);
		};
		// The wake reply streams only thinking and never delivers message_end (#4902 shape),
		// so its visible answer reaches the client only through the agent_end fallback.
		session.pendingAsyncWork = true;
		session.settleAsyncWork = async () => {
			const wake = makeAssistantMessage("wake fallback", "Thinking about the job.");
			emit({
				type: "message_update",
				message: wake,
				assistantMessageEvent: { type: "thinking_delta", delta: "Thinking about the job." },
			} as AgentSessionEvent);
			emit({ type: "agent_end", messages: [wake] } as AgentSessionEvent);
			session.pendingAsyncWork = false;
		};

		let settled = false;
		const prompt = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "start a background job" }] })
			.finally(() => {
				settled = true;
			});
		const first = await Promise.race([
			fallbackReached.promise.then(() => "fallback" as const),
			prompt.then(() => "resolved" as const),
		]);
		expect(first).toBe("fallback");
		// The wake's fallback delivery is parked; the prompt must not finish around it.
		await eventLoopTurns(5);
		expect(settled).toBe(false);

		deliveryGate.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		const chunks = harness.updates.filter(update => update.sessionId === created.sessionId);
		const fallbackChunks = chunks.filter(
			update =>
				update.update.sessionUpdate === "agent_message_chunk" &&
				update.update.content.type === "text" &&
				update.update.content.text === "wake fallback",
		);
		const wakeThought = chunks.find(update => update.update.sessionUpdate === "agent_thought_chunk");
		expect(fallbackChunks).toHaveLength(1);
		expect(getChunkMessageId(fallbackChunks[0]!)).toBe(getChunkMessageId(wakeThought!)!);
		harness.abortController.abort();
	});

	it("completes an ordinary prompt without background work", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "ping" }],
		});
		expect(response.stopReason).toBe("end_turn");
		expect(harness.updates.some(notification => JSON.stringify(notification).includes("pong"))).toBe(true);
		harness.abortController.abort();
	});

	it("cancel during the quiescence wait resolves cancelled and leaves background work running", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const settleEntered = Promise.withResolvers<void>();
		const jobNeverFinishes = Promise.withResolvers<void>();
		session.pendingAsyncWork = true;
		session.settleAsyncWork = async () => {
			settleEntered.resolve();
			await jobNeverFinishes.promise;
		};

		const prompt = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "start a background job" }],
		});
		const first = await Promise.race([
			settleEntered.promise.then(() => "settling" as const),
			prompt.then(() => "resolved" as const),
		]);
		expect(first).toBe("settling");
		await harness.agent.cancel({ sessionId: created.sessionId });

		expect((await prompt).stopReason).toBe("cancelled");
		expect(session.abortCalls).toBe(1);
		// The job is still owed: cancel stops the turn, not the background work.
		expect(session.pendingAsyncWork).toBe(true);
		expect(session.acpPromptOpen.at(-1)).toBe(false);
		harness.abortController.abort();
	});

	it("injects _session/steering while the open prompt waits on background work", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const settleEntered = Promise.withResolvers<void>();
		const jobDone = Promise.withResolvers<void>();
		session.pendingAsyncWork = true;
		session.settleAsyncWork = async () => {
			settleEntered.resolve();
			await jobDone.promise;
			session.pendingAsyncWork = false;
		};

		const prompt = harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "start a background job" }],
		});
		const first = await Promise.race([
			settleEntered.promise.then(() => "settling" as const),
			prompt.then(() => "resolved" as const),
		]);
		expect(first).toBe("settling");
		expect(session.isStreaming).toBe(false);

		const outcome = await harness.agent.extMethod("_session/steering", {
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "mid" }],
		});
		expect(outcome).toEqual({ outcome: "injected" });
		expect(session.steerCalls.map(call => call.text)).toEqual(["mid"]);
		expect(session.promptCalls).toEqual(["start a background job"]);

		jobDone.resolve();
		expect((await prompt).stopReason).toBe("end_turn");
		harness.abortController.abort();
	});

	it("does not wait on deferred next-turn context or interrupt-held follow-ups", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		// A hidden next-turn breadcrumb plus an interrupt-held follow-up: queued, but
		// nothing is scheduled to run them before the user's next prompt. A wait that
		// counted them would never resolve and trip the test timeout.
		session.queuedMessageCount = 2;

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "ping" }],
		});
		expect(response.stopReason).toBe("end_turn");
		harness.abortController.abort();
	});

	it("serializes multiple prompts queued during idle cleanup", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const { promise: idleBlocked, resolve: markIdleBlocked } = Promise.withResolvers<void>();
		const { promise: releaseIdle, resolve: unblockIdle } = Promise.withResolvers<void>();
		session.waitForIdleBlocker = async () => {
			markIdleBlocked();
			await releaseIdle;
		};

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000032",
			prompt: [{ type: "text", text: "wait for cleanup" }],
		} as PromptRequest);
		await idleBlocked;

		try {
			const secondPrompt = harness.agent.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000033",
				prompt: [{ type: "text", text: "after cleanup A" }],
			} as PromptRequest);
			const thirdPrompt = harness.agent.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000034",
				prompt: [{ type: "text", text: "after cleanup B" }],
			} as PromptRequest);
			await Bun.sleep(0);
			expect(session.promptCalls).toEqual(["wait for cleanup"]);

			unblockIdle();
			await firstPrompt;
			await secondPrompt;
			await thirdPrompt;
			expect(session.promptCalls).toEqual(["wait for cleanup", "after cleanup A", "after cleanup B"]);
		} finally {
			unblockIdle();
			harness.abortController.abort();
			await Bun.sleep(0);
		}
	});

	it("suppresses late updates after cancel and waits cleanup before the next prompt", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		let releaseAbort!: () => void;
		const abortBlocked = Promise.withResolvers<void>();
		const releaseAbortPromise = new Promise<void>(resolve => {
			releaseAbort = resolve;
		});
		session.abort = async () => {
			session.isStreaming = false;
			abortBlocked.resolve();
			await releaseAbortPromise;
		};
		const finishPrompt = holdPromptStreaming(session);
		// Each held turn ends only when released; capture when the successor enters
		// so its own turn is released too (the cancelled turn's late agent_end must
		// not be what settles the successor prompt).
		const heldPrompt = session.prompt;
		const successorEntered = Promise.withResolvers<void>();
		session.prompt = async (text: string): Promise<boolean> => {
			const running = heldPrompt(text);
			if (session.promptCalls.length === 2) successorEntered.resolve();
			return running;
		};

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000039",
			prompt: [{ type: "text", text: "cancel me" }],
		} as PromptRequest);
		await Bun.sleep(0);
		const beforeCancelUpdates = harness.updates.length;

		const cancelPrompt = harness.agent.cancel({ sessionId: created.sessionId });
		await abortBlocked.promise;
		const returnedBeforeCleanup = await Promise.race([firstPrompt.then(() => true), Bun.sleep(0).then(() => false)]);
		expect(returnedBeforeCleanup).toBe(true);
		const cancelledResponse = await firstPrompt;
		expect(cancelledResponse.stopReason).toBe("cancelled");

		for (const listener of session.listeners()) {
			listener({
				type: "message_update",
				message: makeAssistantMessage("late"),
				assistantMessageEvent: { type: "text_delta", delta: "late" },
			} as AgentSessionEvent);
		}
		expect(harness.updates).toHaveLength(beforeCancelUpdates);

		const secondPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000040",
			prompt: [{ type: "text", text: "after cancel" }],
		} as PromptRequest);
		await Bun.sleep(0);
		expect(session.promptCalls).toEqual(["cancel me"]);

		releaseAbort();
		await cancelPrompt;
		finishPrompt();
		await successorEntered.promise;
		finishPrompt();
		await secondPrompt;
		expect(session.promptCalls).toEqual(["cancel me", "after cancel"]);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("keeps a cancelled bare rename from updating or settling its successor", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		const inferences = [
			{ started: Promise.withResolvers<void>(), title: Promise.withResolvers<string | null>() },
			{ started: Promise.withResolvers<void>(), title: Promise.withResolvers<string | null>() },
		];
		const titleSignals: Array<AbortSignal | undefined> = [];
		let inferenceIndex = 0;
		try {
			await session.sessionManager.setSessionName("Original title", "user");
			session.sessionManager.appendMessage({
				role: "user",
				content: "Investigate why cancelling a generated session title interrupts the next rename request.",
				timestamp: Date.now(),
			});
			Object.assign(session, {
				messages: session.sessionManager.buildSessionContext().messages,
				titleGenerationSignal: new AbortController().signal,
				renameTitle: (_title?: string, signal?: AbortSignal) => {
					// A generating rename reserves a title revision, as `AgentSession.renameTitle` does.
					session.sessionManager.reserveTitleRevision();
					const inference = inferences[inferenceIndex++];
					titleSignals.push(signal);
					inference.started.resolve();
					// Deliberately ignore abort so a cancelled inference can return late.
					return inference.title.promise;
				},
			});

			const firstPrompt = harness.agent.prompt({
				sessionId: created.sessionId,
				prompt: [{ type: "text", text: "/rename" }],
			});
			await Promise.race([inferences[0].started.promise, firstPrompt]);
			await harness.agent.cancel({ sessionId: created.sessionId });
			expect((await firstPrompt).stopReason).toBe("cancelled");
			expect(titleSignals[0]?.aborted).toBe(true);

			const secondPrompt = harness.agent.prompt({
				sessionId: created.sessionId,
				prompt: [{ type: "text", text: "/rename" }],
			});
			await Promise.race([inferences[1].started.promise, secondPrompt]);
			expect(titleSignals[1]?.aborted).toBe(false);
			const beforeLateResult = harness.updates.length;

			inferences[0].title.resolve("Cancelled title");
			const settledByOldRename = await Promise.race([secondPrompt.then(() => true), Bun.sleep(0).then(() => false)]);
			expect(settledByOldRename).toBe(false);
			expect(session.sessionManager.getSessionName()).toBe("Original title");
			expect(
				harness.updates
					.slice(beforeLateResult)
					.filter(
						update =>
							update.sessionId === created.sessionId &&
							(update.update.sessionUpdate === "session_info_update" ||
								update.update.sessionUpdate === "agent_message_chunk"),
					),
			).toEqual([]);

			inferences[1].title.resolve("Rename cancellation isolation");
			expect((await secondPrompt).stopReason).toBe("end_turn");
			expect(session.sessionManager.getSessionName()).toBe("Rename cancellation isolation");
			expect(harness.updates.slice(beforeLateResult)).toContainEqual({
				sessionId: created.sessionId,
				update: {
					sessionUpdate: "session_info_update",
					title: "Rename cancellation isolation",
					updatedAt: expect.any(String),
				},
			});
		} finally {
			for (const inference of inferences) {
				inference.started.resolve();
				inference.title.resolve(null);
			}
			harness.abortController.abort();
			await Bun.sleep(0);
		}
	});

	it("closes the ACP session when cancel cleanup times out", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		harness.agent.setCancelCleanupTimeoutForTesting(10);
		session.abort = async () => new Promise<void>(() => undefined);
		const finishPrompt = holdPromptStreaming(session);

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000041",
			prompt: [{ type: "text", text: "stuck cancel" }],
		} as PromptRequest);
		await Bun.sleep(0);

		const cancelPrompt = harness.agent.cancel({ sessionId: created.sessionId });
		const returnedBeforeTimeout = await Promise.race([firstPrompt.then(() => true), Bun.sleep(0).then(() => false)]);
		expect(returnedBeforeTimeout).toBe(true);
		await expect(cancelPrompt).resolves.toBeUndefined();
		expect(session.disposed).toBe(true);
		await expect(
			harness.agent.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000042",
				prompt: [{ type: "text", text: "after stuck cancel" }],
			} as PromptRequest),
		).rejects.toThrow("Unsupported ACP session");

		finishPrompt();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("rejects a queued prompt when cancel cleanup closes the session", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		harness.agent.setCancelCleanupTimeoutForTesting(10);
		session.abort = async () => new Promise<void>(() => undefined);
		const finishPrompt = holdPromptStreaming(session);

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000043",
			prompt: [{ type: "text", text: "stuck cancel before queued" }],
		} as PromptRequest);
		await Bun.sleep(0);

		const cancelPrompt = harness.agent.cancel({ sessionId: created.sessionId });
		await firstPrompt;
		const queuedPrompt = harness.agent
			.prompt({
				sessionId: created.sessionId,
				messageId: "00000000-0000-4000-8000-000000000044",
				prompt: [{ type: "text", text: "queued after stuck cancel" }],
			} as PromptRequest)
			.catch(error => error);

		await cancelPrompt;
		const queuedError = await queuedPrompt;
		expect(queuedError).toBeInstanceOf(Error);
		expect(queuedError.message).toBe("ACP cancel cleanup timed out");
		expect(session.promptCalls).toEqual(["stuck cancel before queued"]);

		finishPrompt();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("maps agent-busy rejections to a typed session_busy error instead of internalError", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		// Any AgentBusyError the session raises (e.g. from a builtin command) must
		// surface as a typed session_busy error.
		session.isStreaming = true;
		session.prompt = async (): Promise<boolean> => {
			if (session.isStreaming) throw new AgentBusyError();
			return true;
		};

		const error = await harness.agent
			.prompt({
				sessionId: created.sessionId,
				prompt: [{ type: "text", text: "ping during autonomous turn" }],
			} as PromptRequest)
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(RequestError);
		const requestError = error as RequestError;
		expect(requestError.code).toBe(-32003);
		expect(requestError.message).toContain("already processing");
		expect(requestError.data).toEqual({ reason: "session_busy", hint: "steer|followUp|wait" });
	});

	it("queues a prompt that lands during an autonomous turn as steer and answers after the drain turn", async () => {
		// Given: an autonomous turn streams with no ACP promptTurn owning it. The
		// fake mirrors AgentSession: a bare prompt while streaming throws busy; a
		// steer prompt is only queued, and the running turn later ends on its own.
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		session.isStreaming = true;
		const queued: string[] = [];
		const queuedSignal = Promise.withResolvers<void>();
		session.prompt = async (text: string, options?: { streamingBehavior?: string }): Promise<boolean> => {
			if (session.isStreaming && !options?.streamingBehavior) throw new AgentBusyError();
			if (!session.isStreaming) throw new Error("unexpected idle prompt");
			queued.push(text);
			queuedSignal.resolve();
			return true;
		};
		// The first waitForIdle() call marks the ACP turn reaching its end-of-turn
		// idle wait; holding it models the queued-message drain turn still running.
		const idleWaitEntered = Promise.withResolvers<void>();
		const drainDone = Promise.withResolvers<void>();
		session.waitForIdleBlocker = () => {
			idleWaitEntered.resolve();
			return drainDone.promise;
		};
		const emit = (event: AgentSessionEvent) => {
			for (const listener of session.listeners()) listener(event);
		};

		// When: IntelliJ sends session/prompt mid-turn.
		let settled = false;
		const response = harness.agent
			.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "ping" }] } as PromptRequest)
			.finally(() => {
				settled = true;
			});
		await Promise.race([queuedSignal.promise, response.catch(() => undefined)]);

		// Then: the prompt is queued as steer, not rejected busy.
		expect(queued).toEqual(["ping"]);

		// The autonomous turn ends; the response must wait for the drain turn.
		emit({ type: "agent_end", messages: [makeAssistantMessage("autonomous")] } as AgentSessionEvent);
		await idleWaitEntered.promise;
		expect(settled).toBe(false);

		// The queued steer drains in a second turn that answers it.
		const answer = makeAssistantMessage("pong to ping");
		emit({
			type: "message_update",
			message: answer,
			assistantMessageEvent: { type: "text_delta", delta: "pong to ping" },
		} as AgentSessionEvent);
		emit({ type: "agent_end", messages: [answer] } as AgentSessionEvent);
		session.isStreaming = false;

		drainDone.resolve();
		expect((await response).stopReason).toBe("end_turn");
		const answerChunks = harness.updates.filter(
			update =>
				update.sessionId === created.sessionId &&
				update.update.sessionUpdate === "agent_message_chunk" &&
				update.update.content.type === "text" &&
				update.update.content.text === "pong to ping",
		);
		expect(answerChunks.length).toBeGreaterThan(0);
		await harness.agent.dispose();
	});

	it("keeps closeSession gated while cancel cleanup is pending", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		let releaseAbort!: () => void;
		const abortBlocked = Promise.withResolvers<void>();
		const releaseAbortPromise = new Promise<void>(resolve => {
			releaseAbort = resolve;
		});
		session.abort = async () => {
			session.isStreaming = false;
			abortBlocked.resolve();
			await releaseAbortPromise;
		};
		const finishPrompt = holdPromptStreaming(session);

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000045",
			prompt: [{ type: "text", text: "cancel before close" }],
		} as PromptRequest);
		await Bun.sleep(0);

		const cancelPrompt = harness.agent.cancel({ sessionId: created.sessionId });
		await abortBlocked.promise;
		await firstPrompt;

		const closePrompt = harness.agent.closeSession({ sessionId: created.sessionId });
		await Bun.sleep(0);
		expect(session.disposed).toBe(false);

		releaseAbort();
		await cancelPrompt;
		await closePrompt;
		expect(session.disposed).toBe(true);

		finishPrompt();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("rejects fork while cancel cleanup is pending", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;
		let releaseAbort!: () => void;
		const abortBlocked = Promise.withResolvers<void>();
		const releaseAbortPromise = new Promise<void>(resolve => {
			releaseAbort = resolve;
		});
		session.abort = async () => {
			session.isStreaming = false;
			abortBlocked.resolve();
			await releaseAbortPromise;
		};
		const finishPrompt = holdPromptStreaming(session);

		const firstPrompt = harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000046",
			prompt: [{ type: "text", text: "cancel before fork" }],
		} as PromptRequest);
		await Bun.sleep(0);

		const cancelPrompt = harness.agent.cancel({ sessionId: created.sessionId });
		await abortBlocked.promise;
		await firstPrompt;

		await expect(
			harness.agent.unstable_forkSession({
				sessionId: created.sessionId,
				cwd: harness.cwdA,
				mcpServers: [],
			}),
		).rejects.toThrow("ACP session fork is unavailable while a prompt is in progress");

		releaseAbort();
		await cancelPrompt;
		finishPrompt();
		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("executes consumed ACP builtins without prompting the agent", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		await harness.agent.prompt({
			sessionId: created.sessionId,
			prompt: [{ type: "text", text: "/fast status" }],
		});

		const chunks = harness.updates.filter(
			update => update.sessionId === created.sessionId && update.update.sessionUpdate === "agent_message_chunk",
		);
		expect(session.promptCalls).toEqual([]);
		expect(
			chunks.some(
				update =>
					update.update.sessionUpdate === "agent_message_chunk" &&
					update.update.content.type === "text" &&
					update.update.content.text === "Fast mode is off.",
			),
		).toBe(true);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("executes force builtins and forwards remaining prompt text", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000003",
			prompt: [{ type: "text", text: "/force read inspect package.json" }],
		} as PromptRequest);

		expect(session.forcedToolChoice).toBe("read");
		expect(session.promptCalls).toEqual(["inspect package.json"]);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("settles the prompt turn when a force residual prompt resolves locally (#9206)", async () => {
		const harness = await createHarness();
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId)!;

		// The residual prompt (e.g. an extension/custom-TS command) is handled
		// locally: no agent turn starts, so `prompt()` returns false and no
		// `agent_end` ever fires. The ACP turn must be settled by the trailing
		// `#finishPrompt`, or the `session/prompt` request never resolves.
		session.prompt = async (text: string): Promise<boolean> => {
			session.promptCalls.push(text);
			return false;
		};

		const response = await harness.agent.prompt({
			sessionId: created.sessionId,
			messageId: "00000000-0000-4000-8000-000000000009",
			prompt: [{ type: "text", text: "/force bash /local-command" }],
		} as PromptRequest);

		expectAcpStructure(zPromptResponse, response);
		expect(response.stopReason).toBe("end_turn");
		expect(session.forcedToolChoice).toBe("bash");
		expect(session.promptCalls).toEqual(["/local-command"]);

		harness.abortController.abort();
		await Bun.sleep(0);
	});

	it("installs the tool UI context when form elicitation is available", async () => {
		const harness = await createHarness({ clientCapabilities: { elicitation: { form: {} } } });
		const session = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		await harness.agent.prompt({
			sessionId: session.sessionId,
			prompt: [{ type: "text", text: "ping" }],
		} as PromptRequest);

		expect(harness.sessionFactoryOptions).toEqual([{ interactivePrompts: true }]);
		expect(harness.setToolUIContextSpies).toHaveLength(1);
		expect(harness.setToolUIContextSpies[0]).toHaveBeenCalledTimes(1);
		expect(harness.setToolUIContextSpies[0]).toHaveBeenCalledWith(
			expect.objectContaining({ askDialog: expect.any(Function) }),
			true,
		);

		await harness.agent.dispose();
	});

	it("does not install the tool UI context without form elicitation", async () => {
		const harness = await createHarness({ clientCapabilities: {} });
		const session = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		await harness.agent.prompt({
			sessionId: session.sessionId,
			prompt: [{ type: "text", text: "ping" }],
		} as PromptRequest);

		expect(harness.sessionFactoryOptions).toEqual([{ interactivePrompts: false }]);
		expect(harness.setToolUIContextSpies).toHaveLength(1);
		expect(harness.setToolUIContextSpies[0]).not.toHaveBeenCalled();

		await harness.agent.dispose();
	});

	it("keeps the extension UI context without form elicitation, with prompts that answer nothing", async () => {
		const messages: string[] = [];
		const harness = await createHarness({
			clientCapabilities: {},
			extensionRunners: true,
			elicitationHandler: async request => {
				messages.push(request.message);
				return { action: "accept", content: { value: "Yes" } };
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const runner = harness.findSession(created.sessionId)?.extensionRunner;

		// Commands such as /review branch on hasUI and cancel when the selector answers nothing.
		// Saved-reset consent reads the session's `interactivePrompts: false` instead.
		expect(runner?.hasUI()).toBe(true);
		expect(await runner?.getUIContext().select("Spend a saved reset?", ["Yes", "No"])).toBeUndefined();
		expect(messages).toEqual([]);
		expect(harness.sessionFactoryOptions).toEqual([{ interactivePrompts: false }]);

		await harness.agent.dispose();
	});

	it("routes extension prompts to form elicitation when the client supports it", async () => {
		const messages: string[] = [];
		const harness = await createHarness({
			extensionRunners: true,
			elicitationHandler: async request => {
				messages.push(request.message);
				return { action: "accept", content: { value: "Yes" } };
			},
		});
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const runner = harness.findSession(created.sessionId)?.extensionRunner;

		expect(runner?.hasUI()).toBe(true);
		expect(await runner?.getUIContext().select("Spend a saved reset?", ["Yes", "No"])).toBe("Yes");
		expect(messages).toEqual(["Spend a saved reset?"]);

		await harness.agent.dispose();
	});

	describe("ACP elicitation bridge", () => {
		const FORM_CAPABILITIES: ClientCapabilities = { elicitation: { form: {} } };

		function createElicitConnection(handler: (req: CreateElicitationRequest) => Promise<CreateElicitationResponse>): {
			connection: AgentSideConnection;
			calls: CreateElicitationRequest[];
		} {
			const calls: CreateElicitationRequest[] = [];
			const connection = {
				unstable_createElicitation: async (req: CreateElicitationRequest) => {
					calls.push(req);
					return handler(req);
				},
			} as unknown as AgentSideConnection;
			return { connection, calls };
		}

		/** Narrows `CreateElicitationRequest` to the `mode: "form"` branch; the SDK's `mode: string` catch-all arm otherwise defeats literal narrowing on `mode !== "form"`. */
		function isFormElicitation(
			request: CreateElicitationRequest,
		): request is Extract<CreateElicitationRequest, { mode: "form" }> {
			return request.mode === "form";
		}
		it("translates a recommended single-choice ask into one form", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0: "Approach B" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-single", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{
					id: "approach",
					question: "Which approach?",
					header: "Choose one",
					options: [
						{ label: "Approach A", description: "Faster" },
						{ label: "Approach B", description: "Safer" },
					],
					recommended: 0,
				},
			]);

			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) throw new Error("expected form-mode elicitation");
			expect(request.message).toBe("Which approach?");
			expect(request.requestedSchema.required).toBeUndefined();
			expect(request.requestedSchema.properties.q0).toEqual({
				type: "string",
				title: "Which approach?",
				description: "Choose one",
				oneOf: [
					{ const: "Approach A", title: "Approach A (Recommended)", description: "Faster" },
					{ const: "Approach B", title: "Approach B", description: "Safer" },
				],
				default: "Approach A",
			});
			expect(request.requestedSchema.properties.q0__other).toEqual({
				type: "string",
				title: "Other (type your own)",
			});
			expect(result).toEqual({
				kind: "submit",
				results: [
					{
						id: "approach",
						question: "Which approach?",
						options: ["Approach A", "Approach B"],
						multi: false,
						selectedOptions: ["Approach B"],
						customInput: undefined,
					},
				],
			});
		});

		it("translates a multi-select ask into an array anyOf schema", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0: ["A", "C"] },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-multi", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{
					id: "features",
					question: "Which features?",
					options: [{ label: "A" }, { label: "B" }, { label: "C" }],
					multi: true,
					recommended: 1,
				},
			]);

			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) throw new Error("expected form-mode elicitation");
			expect(request.requestedSchema.properties.q0).toEqual({
				type: "array",
				title: "Which features?",
				items: {
					anyOf: [
						{ const: "A", title: "A" },
						{ const: "B", title: "B (Recommended)" },
						{ const: "C", title: "C" },
					],
				},
			});
			expect(result?.kind === "submit" ? result.results[0]?.selectedOptions : undefined).toEqual(["A", "C"]);
		});

		it("accepts a trimmed free-text-only ask response", async () => {
			const { connection } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0__other: "  widget " },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-other", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{ id: "widget", question: "Which widget?", options: [{ label: "Standard" }] },
			]);

			expect(result?.kind === "submit" ? result.results[0] : undefined).toMatchObject({
				selectedOptions: [],
				customInput: "widget",
			});
		});
		it("treats a single-choice custom answer as exclusive", async () => {
			const { connection } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0: "Standard", q0__other: "custom" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-exclusive-other", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{ id: "widget", question: "Which widget?", options: [{ label: "Standard" }] },
			]);

			expect(result?.kind === "submit" ? result.results[0] : undefined).toMatchObject({
				selectedOptions: [],
				customInput: "custom",
			});
		});

		it("uses only free-text fields for questions without options", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0__other: "single answer", q1__other: "multi answer" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-no-options", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{ id: "single", question: "Single?", options: [] },
				{ id: "multi", question: "Multi?", options: [], multi: true },
			]);

			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) throw new Error("expected form-mode elicitation");
			expect(Object.keys(request.requestedSchema.properties)).toEqual(["q0__other", "q1__other"]);
			expect(result?.kind === "submit" ? result.results : undefined).toMatchObject([
				{ id: "single", selectedOptions: [], customInput: "single answer" },
				{ id: "multi", selectedOptions: [], customInput: "multi answer" },
			]);
		});

		it("drops ask values the client was never offered", async () => {
			const { connection } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0: "Nonexistent" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-invalid", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([{ id: "choice", question: "Choose", options: [{ label: "Existing" }] }]);

			expect(result?.kind === "submit" ? result.results[0]?.selectedOptions : undefined).toEqual([]);
		});

		it("packs multiple ask questions into one ordered form", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { q0: "PostgreSQL", q1: ["auth", "search"] },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-many", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{
					id: "storage",
					question: "Storage?",
					options: [{ label: "SQLite" }, { label: "PostgreSQL" }],
				},
				{
					id: "features",
					question: "Features?",
					options: [{ label: "auth" }, { label: "billing" }, { label: "search" }],
					multi: true,
				},
			]);

			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) throw new Error("expected form-mode elicitation");
			expect(request.message).toBe("Answer 2 questions");
			expect(Object.keys(request.requestedSchema.properties)).toEqual(["q0", "q0__other", "q1", "q1__other"]);
			expect(result?.kind === "submit" ? result.results.map(item => item.id) : undefined).toEqual([
				"storage",
				"features",
			]);
			expect(result?.kind === "submit" ? result.results.map(item => item.selectedOptions) : undefined).toEqual([
				["PostgreSQL"],
				["auth", "search"],
			]);
		});

		it("returns undefined when an ask form is cancelled", async () => {
			const { connection } = createElicitConnection(async () => ({ action: "cancel" }));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ask-cancel", FORM_CAPABILITIES);

			const result = await ctx.askDialog!([
				{ id: "choice", question: "Choose", options: [{ label: "A" }, { label: "B" }] },
			]);

			expect(result).toBeUndefined();
		});
		it("returns ordered fallback answers when an ask form times out", async () => {
			vi.useFakeTimers();
			try {
				const { promise: never } = Promise.withResolvers<CreateElicitationResponse>();
				const { connection } = createElicitConnection(() => never);
				const ctx = createAcpExtensionUiContext(connection, () => "session-ask-timeout", FORM_CAPABILITIES);
				const onTimeout = vi.fn();

				const pending = ctx.askDialog!(
					[
						{
							id: "choice",
							question: "Choose",
							options: [{ label: "A" }, { label: "B" }],
							recommended: 1,
						},
						{ id: "free-text", question: "Explain", options: [] },
					],
					{ timeout: 10, onTimeout },
				);
				await Promise.resolve();
				vi.advanceTimersByTime(10);
				await Promise.resolve();

				expect(await pending).toEqual({
					kind: "submit",
					results: [
						{
							id: "choice",
							question: "Choose",
							options: ["A", "B"],
							multi: false,
							selectedOptions: ["B"],
							customInput: undefined,
							timedOut: true,
						},
						{
							id: "free-text",
							question: "Explain",
							options: [],
							multi: false,
							selectedOptions: [],
							customInput: undefined,
							timedOut: true,
						},
					],
				});
				expect(onTimeout).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});

		it("translates select to a single-property string-enum elicitation", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "second" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-select", FORM_CAPABILITIES);

			const result = await ctx.select("Pick one", ["first", "second", "third"]);

			expect(result).toBe("second");
			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			expect(request.mode).toBe("form");
			expect(request.message).toBe("Pick one");
			if (!isFormElicitation(request) || !("sessionId" in request)) {
				throw new Error("expected session-scoped form elicitation");
			}
			expect(request.sessionId).toBe("session-select");
			expect(request.requestedSchema).toEqual({
				type: "object",
				properties: { value: { type: "string", enum: ["first", "second", "third"] } },
				required: ["value"],
			});
		});

		it("translates confirm to a boolean elicitation and returns the accepted value", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: true },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-confirm", FORM_CAPABILITIES);

			const result = await ctx.confirm("Proceed?", "This will overwrite the file.");

			expect(result).toBe(true);
			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) {
				throw new Error("expected form-mode elicitation");
			}
			expect(request.message).toBe("Proceed?\n\nThis will overwrite the file.");
			expect(request.requestedSchema.properties?.value).toEqual({ type: "boolean" });
			expect(request.requestedSchema.required).toEqual(["value"]);
		});

		it("translates input to a string elicitation and surfaces the placeholder as description", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "claude" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-input", FORM_CAPABILITIES);

			const result = await ctx.input("Your name?", "e.g. claude");

			expect(result).toBe("claude");
			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) {
				throw new Error("expected form-mode elicitation");
			}
			expect(request.message).toBe("Your name?");
			expect(request.requestedSchema.properties?.value).toEqual({
				type: "string",
				description: "e.g. claude",
			});
		});

		it("translates editor to a string elicitation with the prefill as default", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "Reviewing auth changes" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-editor", FORM_CAPABILITIES);

			const result = await ctx.editor("Enter custom review instructions", "Review the following:\n\n");

			expect(result).toBe("Reviewing auth changes");
			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) {
				throw new Error("expected form-mode elicitation");
			}
			expect(request.message).toBe("Enter custom review instructions");
			expect(request.requestedSchema.properties?.value).toEqual({
				type: "string",
				default: "Review the following:\n\n",
			});
		});

		it("omits default on editor only when the prefill is empty, but preserves whitespace-only prefill", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "text" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-editor-empty", FORM_CAPABILITIES);

			await ctx.editor("Title", "");

			const emptyRequest = calls[0]!;
			if (!isFormElicitation(emptyRequest)) throw new Error("expected form-mode elicitation");
			expect(emptyRequest.requestedSchema.properties?.value).toEqual({ type: "string" });

			// Unlike `input`'s placeholder, `editor` prefill is the document being
			// edited: whitespace/blank lines are meaningful content, not absence,
			// so they must round-trip verbatim (matching the interactive/RPC
			// implementations, which set the editor's text to any truthy prefill).
			await ctx.editor("Title", "   ");

			const whitespaceRequest = calls[1]!;
			if (!isFormElicitation(whitespaceRequest)) throw new Error("expected form-mode elicitation");
			expect(whitespaceRequest.requestedSchema.properties?.value).toEqual({
				type: "string",
				default: "   ",
			});
		});

		it("returns undefined / false for decline and cancel actions", async () => {
			let nextAction: "decline" | "cancel" = "decline";
			const { connection } = createElicitConnection(async () => ({ action: nextAction }));
			const ctx = createAcpExtensionUiContext(connection, () => "session-cancel", FORM_CAPABILITIES);

			for (const action of ["decline", "cancel"] as const) {
				nextAction = action;
				expect(await ctx.select("X", ["a"])).toBeUndefined();
				expect(await ctx.confirm("X", "Y")).toBe(false);
				expect(await ctx.input("X")).toBeUndefined();
				expect(await ctx.editor("X")).toBeUndefined();
			}
		});

		it("falls back to the stubbed behaviour when the client does not advertise form elicitation", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "ignored" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-nocaps", {});

			expect(await ctx.select("X", ["a"])).toBeUndefined();
			expect(await ctx.confirm("X", "Y")).toBe(false);
			expect(await ctx.input("X")).toBeUndefined();
			expect(await ctx.editor("X")).toBeUndefined();
			expect(
				await ctx.askDialog!([{ id: "choice", question: "Choose", options: [{ label: "A" }] }]),
			).toBeUndefined();
			expect(calls).toHaveLength(0);
		});

		it("treats transport-level elicitation failures as undecided input", async () => {
			const { connection, calls } = createElicitConnection(async () => {
				throw new Error("connection closed");
			});
			const ctx = createAcpExtensionUiContext(connection, () => "session-throw", FORM_CAPABILITIES);

			expect(await ctx.select("X", ["a"])).toBeUndefined();
			expect(await ctx.confirm("X", "Y")).toBe(false);
			expect(await ctx.input("X")).toBeUndefined();
			expect(calls).toHaveLength(3);
		});

		it("skips the SDK call entirely when dialogOptions.signal is already aborted", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "ignored" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-preabort", FORM_CAPABILITIES);
			const controller = new AbortController();
			controller.abort();

			expect(await ctx.select("X", ["a"], { signal: controller.signal })).toBeUndefined();
			expect(await ctx.confirm("X", "Y", { signal: controller.signal })).toBe(false);
			expect(await ctx.input("X", undefined, { signal: controller.signal })).toBeUndefined();
			expect(calls).toHaveLength(0);
		});

		it("resolves to the stub fallback when dialogOptions.signal aborts mid-flight", async () => {
			const { resolve, promise: never } = Promise.withResolvers<CreateElicitationResponse>();
			const { connection, calls } = createElicitConnection(() => never);
			const ctx = createAcpExtensionUiContext(connection, () => "session-midabort", FORM_CAPABILITIES);
			const controller = new AbortController();

			const pending = ctx.select("X", ["a"], { signal: controller.signal });
			controller.abort();
			expect(await pending).toBeUndefined();
			expect(calls).toHaveLength(1);
			// Resolve the never-promise so the bridge's `.then(finish)` chain settles
			// and Bun's promise tracker doesn't flag a leaked pending promise.
			resolve({ action: "decline" });
		});

		it("returns the stub fallback when the client sends a wrong-typed accept payload", async () => {
			// confirm expects a boolean; a string `value` must narrow to `false`.
			const stringForBool = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "yes" },
			}));
			const boolCtx = createAcpExtensionUiContext(
				stringForBool.connection,
				() => "session-wrongtype-bool",
				FORM_CAPABILITIES,
			);
			expect(await boolCtx.confirm("Proceed?", "")).toBe(false);

			// select expects a string; a boolean `value` must narrow to `undefined`.
			const boolForString = createElicitConnection(async () => ({
				action: "accept",
				content: { value: true },
			}));
			const selectCtx = createAcpExtensionUiContext(
				boolForString.connection,
				() => "session-wrongtype-str",
				FORM_CAPABILITIES,
			);
			expect(await selectCtx.select("Pick", ["a"])).toBeUndefined();
		});

		it("returns the stub fallback when accept arrives without the expected `value` key", async () => {
			// content present but missing the `value` key — the bridge looks up
			// `response.content.value` which is `undefined`, so the typeof guard fires.
			const missingKey = createElicitConnection(async () => ({
				action: "accept",
				content: { other: "noise" } as never,
			}));
			const ctx = createAcpExtensionUiContext(missingKey.connection, () => "session-missingkey", FORM_CAPABILITIES);
			expect(await ctx.select("Pick", ["a"])).toBeUndefined();
			expect(await ctx.confirm("Proceed?", "")).toBe(false);
			expect(await ctx.input("Name?")).toBeUndefined();
		});

		it("returns the stub fallback when accept arrives with no content at all", async () => {
			// content omitted entirely — the `!response.content` guard short-circuits
			// before the per-method narrow has a chance to run.
			const noContent = createElicitConnection(async () => ({ action: "accept" }));
			const ctx = createAcpExtensionUiContext(noContent.connection, () => "session-nocontent", FORM_CAPABILITIES);
			expect(await ctx.select("Pick", ["a"])).toBeUndefined();
			expect(await ctx.confirm("Proceed?", "")).toBe(false);
			expect(await ctx.input("Name?")).toBeUndefined();
		});

		it("fires onTimeout and resolves to the stub fallback when dialogOptions.timeout expires", async () => {
			const { promise: never } = Promise.withResolvers<CreateElicitationResponse>();
			const { connection, calls } = createElicitConnection(() => never);
			const ctx = createAcpExtensionUiContext(connection, () => "session-timeout", FORM_CAPABILITIES);
			let timeoutFired = 0;
			const result = await ctx.select("Pick", ["a"], { timeout: 1, onTimeout: () => timeoutFired++ });
			expect(result).toBeUndefined();
			expect(timeoutFired).toBe(1);
			expect(calls).toHaveLength(1);
		});

		it("treats whitespace-only placeholder as absent on `input`", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "n" },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-ws-placeholder", FORM_CAPABILITIES);

			await ctx.input("Name?", "   ");

			expect(calls).toHaveLength(1);
			const request = calls[0]!;
			if (!isFormElicitation(request)) throw new Error("expected form-mode elicitation");
			expect(request.requestedSchema.properties?.value).toEqual({ type: "string" });
		});

		it("sends `message === title` on `confirm` when the message is empty (no join)", async () => {
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: true },
			}));
			const ctx = createAcpExtensionUiContext(connection, () => "session-confirm-empty", FORM_CAPABILITIES);

			await ctx.confirm("Proceed?", "");
			// Whitespace-only message must follow the same branch as empty —
			// CHANGELOG says join only when the message is non-empty.
			await ctx.confirm("Proceed?", "   ");

			expect(calls).toHaveLength(2);
			expect(calls[0]!.message).toBe("Proceed?");
			expect(calls[1]!.message).toBe("Proceed?");
		});

		it("still resolves to the stub fallback when dialogOptions.onTimeout throws", async () => {
			const { promise: never } = Promise.withResolvers<CreateElicitationResponse>();
			const { connection } = createElicitConnection(() => never);
			const ctx = createAcpExtensionUiContext(connection, () => "session-timeout-throw", FORM_CAPABILITIES);

			const result = await ctx.select("Pick", ["a"], {
				timeout: 1,
				onTimeout: () => {
					throw new Error("boom");
				},
			});

			expect(result).toBeUndefined();
		});

		it("reads the sessionId getter on every elicitation so mid-flight session changes are reflected", async () => {
			// `record.session.sessionId` mutates when an extension command calls
			// `ctx.switchSession` / `ctx.newSession`. Snapshotting it once at
			// factory time would route later elicitations to the pre-switch id.
			const { connection, calls } = createElicitConnection(async () => ({
				action: "accept",
				content: { value: "ok" },
			}));
			let currentSessionId = "session-before-switch";
			const ctx = createAcpExtensionUiContext(connection, () => currentSessionId, FORM_CAPABILITIES);

			await ctx.select("Pick", ["a"]);
			currentSessionId = "session-after-switch";
			await ctx.confirm("Continue?", "post-switch");
			await ctx.input("Name?");

			expect(calls).toHaveLength(3);
			// Each call must be a session-scoped form elicitation. Spelled as three
			// separate narrows because `mode === "form"` alone leaves both
			// `ElicitationRequestScope` and `ElicitationSessionScope` in the union —
			// only `"sessionId" in call` picks the session-scoped variant — and
			// loop-style narrows don't propagate to the assertions below.
			const [first, second, third] = calls;
			if (first?.mode !== "form" || !("sessionId" in first)) throw new Error("first call missing sessionId");
			if (second?.mode !== "form" || !("sessionId" in second)) throw new Error("second call missing sessionId");
			if (third?.mode !== "form" || !("sessionId" in third)) throw new Error("third call missing sessionId");
			expect(first.sessionId).toBe("session-before-switch");
			expect(second.sessionId).toBe("session-after-switch");
			expect(third.sessionId).toBe("session-after-switch");
		});
	});

	describe("ACP Goal mode", () => {
		function modeConfigValue(update: SessionNotification | undefined): unknown {
			if (update?.update.sessionUpdate !== "config_option_update") return undefined;
			return (update.update.configOptions.find(option => option.id === "mode") as { currentValue?: unknown })
				?.currentValue;
		}

		function lastModeNotification(harness: AgentHarness, sessionId: string): string | undefined {
			const update = harness.updates.findLast(
				notification =>
					notification.sessionId === sessionId && notification.update.sessionUpdate === "current_mode_update",
			);
			return update?.update.sessionUpdate === "current_mode_update" ? update.update.currentModeId : undefined;
		}

		function textChunks(harness: AgentHarness, sessionId: string): string[] {
			return harness.updates
				.filter(
					notification =>
						notification.sessionId === sessionId &&
						notification.update.sessionUpdate === "agent_message_chunk" &&
						notification.update.content.type === "text",
				)
				.map(notification => (notification.update as { content: { text: string } }).content.text);
		}

		/** A turn that streams `reply`, runs the given tool calls, and ends. Used for continuation turns. */
		function emitTurn(session: FakeAgentSession, reply: string, toolCall?: { name: string; args: unknown }): void {
			const assistant = makeAssistantMessage(reply);
			const messages: unknown[] = [assistant];
			if (toolCall) {
				messages.push(
					{
						role: "assistant",
						content: [
							{ type: "toolCall", id: crypto.randomUUID(), name: toolCall.name, arguments: toolCall.args },
						],
					},
					{ role: "toolResult", toolName: toolCall.name, content: [{ type: "text", text: "ok" }], isError: false },
				);
			}
			for (const listener of session.listeners()) {
				listener({
					type: "message_update",
					message: assistant,
					assistantMessageEvent: { type: "text_delta", delta: reply },
				} as AgentSessionEvent);
			}
			for (const listener of session.listeners()) {
				listener({ type: "agent_end", messages, isTerminal: true } as unknown as AgentSessionEvent);
			}
		}

		async function goalHarness(
			clientInfo?: InitializeRequest["clientInfo"],
			options: { pastBootstrap?: boolean } = {},
		) {
			const harness = await createHarness(clientInfo ? { clientInfo } : {});
			if (options.pastBootstrap) vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			if (options.pastBootstrap) {
				await advanceBootstrapGuard();
				vi.useRealTimers();
			}
			const session = harness.findSession(created.sessionId)!;
			return { harness, sessionId: created.sessionId, session };
		}

		function modeUpdatesSince(harness: AgentHarness, baseline: number): string[] {
			const ids: string[] = [];
			for (const notification of harness.updates.slice(baseline)) {
				if (notification.update.sessionUpdate === "current_mode_update") {
					ids.push(notification.update.currentModeId);
				}
			}
			return ids;
		}

		it("advertises goal mode only while goal.enabled is on", async () => {
			const harness = await createHarness();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			expect(created.modes?.availableModes.map(mode => mode.id)).toEqual(["default", "plan", "goal"]);
			expectAcpStructure(zNewSessionResponse, created);

			cfgGoalEnabled.set(Settings.instance, false);
			const disabled = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			expect(disabled.modes?.availableModes.map(mode => mode.id)).toEqual(["default", "plan"]);
			await expect(harness.agent.setSessionMode({ sessionId: disabled.sessionId, modeId: "goal" })).rejects.toThrow(
				"Unsupported ACP mode: goal",
			);
			harness.abortController.abort();
		});

		it("selecting goal mode starts no turn; the next prompt becomes the objective and the first user turn", async () => {
			const { harness, sessionId, session } = await goalHarness();

			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			expect(session.promptCalls).toEqual([]);
			expect(session.goalModeState).toBeUndefined();
			expect(lastModeNotification(harness, sessionId)).toBe("goal");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"goal",
			);

			const response = await harness.agent.prompt({
				sessionId,
				prompt: [{ type: "text", text: "Ship feature X" }],
			});

			expect(response.stopReason).toBe("end_turn");
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.enabled).toBe(true);
			expect(session.enabledTools).toEqual(["read", "goal"]);
			expect(session.promptCalls).toEqual(["Ship feature X"]);
			harness.abortController.abort();
		});

		it("registered commands keep the objective armed; unknown slash text becomes the objective", async () => {
			const { harness, sessionId, session } = await goalHarness();
			session.registeredPromptCommands = ["review"];
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });

			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "/fast status" }] });
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "/review task" }] });
			expect(session.goalModeState).toBeUndefined();
			expect(session.promptCalls).toEqual(["/review task"]);

			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "/unknown Ship feature X" }] });
			expect(session.goalModeState?.goal.objective).toBe("/unknown Ship feature X");
			harness.abortController.abort();
		});

		it("an empty armed prompt fails and leaves the objective armed", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });

			await expect(harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "   " }] })).rejects.toThrow(
				"objective is required when op=create",
			);
			expect(session.promptCalls).toEqual([]);

			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Real objective" }] });
			expect(session.goalModeState?.goal.objective).toBe("Real objective");
			harness.abortController.abort();
		});

		it("the first objective keeps its images out of the objective text and forwards them with the user turn", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });

			await harness.agent.prompt({
				sessionId,
				prompt: [
					{ type: "text", text: "Ship feature X" },
					{ type: "image", data: "aGVsbG8=", mimeType: "image/png" },
				],
			});

			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.promptCalls).toEqual(["Ship feature X"]);
			expect(session.promptImages).toEqual([[{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }]]);
			harness.abortController.abort();
		});

		it("an image-only armed prompt fails like an empty objective and keeps the objective armed", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });

			await expect(
				harness.agent.prompt({
					sessionId,
					prompt: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
				}),
			).rejects.toThrow("objective is required when op=create");
			expect(session.promptCalls).toEqual([]);
			expect(session.goalModeState).toBeUndefined();

			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Real objective" }] });
			expect(session.goalModeState?.goal.objective).toBe("Real objective");
			harness.abortController.abort();
		});

		it("keeps the prompt open across a goal continuation and ends after a no-progress continuation", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuations: string[] = [];
			const continuationGate = Promise.withResolvers<void>();
			session.promptCustomMessage = async message => {
				continuations.push(message.customType);
				session.isStreaming = true;
				if (continuations.length === 1) {
					await continuationGate.promise;
					emitTurn(session, "continued work", { name: "read", args: { path: "a" } });
				} else {
					emitTurn(session, "nothing left");
				}
				session.isStreaming = false;
				return true;
			};
			// Only the prompt's first idle wait returns at once. Later ones (the goal
			// continuation waiting to be admitted, the prompt's re-checks) take several
			// macrotasks, as `AgentSession.waitForIdle` does while advisor events drain:
			// a decided-but-unadmitted continuation must keep the prompt open meanwhile.
			let idleWaits = 0;
			session.waitForIdleBlocker = async () => {
				if (++idleWaits > 1) await eventLoopTurns(5);
			};

			let resolved = false;
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			void prompt.then(() => {
				resolved = true;
			});
			await eventLoopTurns(20);
			expect(continuations).toEqual(["goal-continuation"]);
			expect(resolved).toBe(false);

			continuationGate.resolve();
			const response = await prompt;
			expect(response.stopReason).toBe("end_turn");
			// One progress continuation, then a no-progress one that stops the loop.
			expect(continuations).toEqual(["goal-continuation", "goal-continuation"]);
			expect(textChunks(harness, sessionId)).toEqual(["pong", "continued work", "nothing left"]);
			harness.abortController.abort();
		});

		it("Stop pauses the goal, keeps goal mode, and the next prompt resumes it inside its own prompt", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			const continuations: string[] = [];
			session.promptCustomMessage = async message => {
				continuations.push(message.customType);
				session.isStreaming = true;
				continuationStarted.resolve();
				// Held until the client cancels; abort() ends the stream.
				return true;
			};
			// As in AgentSession: the aborted run still emits its terminal agent_end,
			// with the tool activity it made before the Stop.
			const abort = session.abort.bind(session);
			session.abort = async () => {
				await abort();
				emitTurn(session, "partial", { name: "read", args: { path: "b" } });
			};

			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await prompt).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(continuations).toEqual(["goal-continuation"]);
			expect(session.goalModeState?.goal.status).toBe("paused");
			const config = await harness.agent.setSessionConfigOption({
				sessionId,
				configId: "thinking",
				value: "off",
			});
			expect(
				(config.configOptions.find(option => option.id === "mode") as { currentValue?: unknown }).currentValue,
			).toBe("goal");

			// The next ordinary prompt resumes the stored objective; it is guidance, not a new objective.
			session.promptCustomMessage = async message => {
				continuations.push(message.customType);
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "go on" }] });
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.promptCalls).toEqual(["Ship feature X", "go on"]);
			harness.abortController.abort();
		});

		it("an in-process transcript switch that keeps the active goal keeps goal selected, so Stop pauses it and the next prompt resumes it", async () => {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			// `newSession` with a setup that journals the same active goal switches the transcript id,
			// so the host runs reconcile({ preserveActiveGoal: true }) and the goal stays active.
			const goal = session.goalModeState!.goal;
			const transcriptBefore = session.sessionManager.getSessionId();
			await session.extensionRunner!.createCommandContext().newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: { ...goal } });
				},
			});
			await eventLoopTurns(10);
			expect(session.sessionManager.getSessionId()).not.toBe(transcriptBefore);
			expect(session.goalModeState?.enabled).toBe(true);
			expect(session.goalModeState?.goal.status).toBe("active");

			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const abort = session.abort.bind(session);
			session.abort = async () => {
				await abort();
				emitTurn(session, "partial", { name: "read", args: { path: "b" } });
			};
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "keep going" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await prompt).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");
			const config = await harness.agent.setSessionConfigOption({ sessionId, configId: "thinking", value: "off" });
			expect(selectedMode(config.configOptions)).toBe("goal");
			expect(lastModeNotification(harness, session.sessionId)).not.toBe("default");

			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			session.promptCalls.length = 0;
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "go on" }] });
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.promptCalls).toEqual(["go on"]);
			harness.abortController.abort();
		});

		interface HeldToolSwap {
			entered: Promise<void>;
			release: () => void;
		}

		/** Hold the next `setActiveToolsByName` (the await inside goal create/resume) until released. */
		function holdNextToolSwap(session: FakeAgentSession): HeldToolSwap {
			const entered = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			const swap = session.setActiveToolsByName.bind(session);
			session.setActiveToolsByName = async names => {
				session.setActiveToolsByName = swap;
				entered.resolve();
				await release.promise;
				await swap(names);
			};
			return { entered: entered.promise, release: release.resolve };
		}

		function configModeValue(options: SessionConfigOption[]): unknown {
			const option = options.find(candidate => candidate.id === "mode");
			return option && "currentValue" in option ? option.currentValue : undefined;
		}

		async function expectCancelledDuringPreparation(
			harness: AgentHarness,
			sessionId: string,
			session: FakeAgentSession,
			prepared: Promise<{ stopReason: string }>,
			hold: HeldToolSwap,
			text: string,
			priorPromptCalls: string[],
		): Promise<void> {
			const continuations: string[] = [];
			session.promptCustomMessage = async message => {
				continuations.push(message.customType);
				return true;
			};
			await hold.entered;
			await harness.agent.cancel({ sessionId });
			expect((await prepared).stopReason).toBe("cancelled");
			hold.release();
			await eventLoopTurns(10);
			expect(session.promptCalls).toEqual(priorPromptCalls);
			expect(session.promptCalls).not.toContain(text);
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.goalModeState?.enabled).toBe(false);
			expect(session.enabledTools).toEqual(["read"]);
			expect(continuations).toEqual([]);
			const config = await harness.agent.setSessionConfigOption({ sessionId, configId: "thinking", value: "off" });
			expect(configModeValue(config.configOptions)).toBe("goal");

			// The next ordinary prompt resumes the same goal inside its own prompt.
			session.promptCustomMessage = async message => {
				continuations.push(message.customType);
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "go on" }] });
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.promptCalls).toEqual([...priorPromptCalls, "go on"]);
		}

		it("Stop during goal creation never submits the cancelled prompt and leaves the goal paused", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await expectCancelledDuringPreparation(harness, sessionId, session, prompt, hold, "Ship feature X", []);
			harness.abortController.abort();
		});

		it("Stop during goal resume never submits the cancelled prompt and leaves the goal paused", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const first = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await first).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");

			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "later guidance" }] });
			await expectCancelledDuringPreparation(harness, sessionId, session, prompt, hold, "later guidance", [
				"Ship feature X",
			]);
			harness.abortController.abort();
		});

		/** After an extension `newSession()` raced a goal entry holding its tool swap, the new transcript owns nothing of the old one. */
		async function expectNoGoalInNewTranscript(
			harness: AgentHarness,
			sessionId: string,
			session: FakeAgentSession,
			prompt: Promise<{ stopReason: string }>,
			change: Promise<unknown>,
			transcriptBefore: string,
			text: string,
		): Promise<void> {
			const [response] = await Promise.all([prompt, change]);
			await eventLoopTurns(10);
			// A prompt refused because its transcript changed finishes as a Stop's cancelled prompt does.
			expect(response.stopReason).toBe("cancelled");
			expect(session.sessionManager.getSessionId()).not.toBe(transcriptBefore);
			expect(session.goalModeState).toBeUndefined();
			expect(session.enabledTools).not.toContain("goal");
			expect(session.promptCalls).not.toContain(text);
			const submitted = session.sessionManager.getEntries().some(entry => {
				if (entry.type !== "message") return false;
				const message = entry.message;
				return "content" in message && message.content === text;
			});
			expect(submitted).toBe(false);
			expect(lastModeNotification(harness, session.sessionId)).toBe("default");
			const config = await harness.agent.setSessionConfigOption({ sessionId, configId: "thinking", value: "off" });
			expect(configModeValue(config.configOptions)).toBe("default");
		}

		it("a goal creation overlapping an extension transcript change leaves no goal and no submitted prompt in the new transcript", async () => {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			const ctx = session.extensionRunner!.createCommandContext();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const transcriptBefore = session.sessionManager.getSessionId();
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await hold.entered;
			const change = ctx.newSession();
			await eventLoopTurns(10);
			hold.release();
			await expectNoGoalInNewTranscript(
				harness,
				sessionId,
				session,
				prompt,
				change,
				transcriptBefore,
				"Ship feature X",
			);
			harness.abortController.abort();
		});

		it("a goal resume overlapping an extension transcript change leaves no goal and no submitted prompt in the new transcript", async () => {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			const ctx = session.extensionRunner!.createCommandContext();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const first = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await first).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");

			const transcriptBefore = session.sessionManager.getSessionId();
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "go on" }] });
			await hold.entered;
			const change = ctx.newSession();
			await eventLoopTurns(10);
			hold.release();
			await expectNoGoalInNewTranscript(harness, sessionId, session, prompt, change, transcriptBefore, "go on");
			harness.abortController.abort();
		});

		/** Stop during preparation, then a next prompt sent while the cancelled one still prepares. */
		async function expectNextPromptWaitsForCancelledPreparation(
			harness: AgentHarness,
			sessionId: string,
			session: FakeAgentSession,
			prepared: Promise<{ stopReason: string }>,
			hold: HeldToolSwap,
			priorPromptCalls: string[],
		): Promise<void> {
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await hold.entered;
			await harness.agent.cancel({ sessionId });
			expect((await prepared).stopReason).toBe("cancelled");
			const next = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "go on" }] });
			await eventLoopTurns(10);
			expect(session.promptCalls).toEqual(priorPromptCalls);
			hold.release();
			expect((await next).stopReason).toBe("end_turn");
			expect(session.promptCalls).toEqual([...priorPromptCalls, "go on"]);
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.enabledTools).toContain("goal");
		}

		it("a prompt after a Stop during goal creation waits for that preparation and resumes the goal", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await expectNextPromptWaitsForCancelledPreparation(harness, sessionId, session, prompt, hold, []);
			harness.abortController.abort();
		});

		it("a prompt after a Stop during goal resume waits for that preparation and is not paused by its compensation", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const first = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await first).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");

			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "later guidance" }] });
			await expectNextPromptWaitsForCancelledPreparation(harness, sessionId, session, prompt, hold, [
				"Ship feature X",
			]);
			harness.abortController.abort();
		});

		it("an explicit switch to default during goal creation is not undone by the entering goal", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await hold.entered;
			const exit = harness.agent.setSessionMode({ sessionId, modeId: "default" });
			await eventLoopTurns(10);
			hold.release();
			await Promise.all([exit, prompt]);
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.enabledTools).toEqual(["read"]);
			expect(lastModeNotification(harness, sessionId)).toBe("default");
			const config = await harness.agent.setSessionConfigOption({ sessionId, configId: "thinking", value: "off" });
			expect(configModeValue(config.configOptions)).toBe("default");
			harness.abortController.abort();
		});

		it("a Stop during goal creation is compensated before a queued explicit selection reports its mode", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await hold.entered;
			await harness.agent.cancel({ sessionId });
			expect((await prompt).stopReason).toBe("cancelled");
			// Queued behind the entry: when it reports, the goal must already be compensated to paused.
			const selection = harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			let statusAtReport: string | undefined;
			const pushUpdate = harness.updates.push.bind(harness.updates);
			harness.updates.push = (...items: SessionNotification[]) => {
				statusAtReport ??= session.goalModeState?.goal.status;
				return pushUpdate(...items);
			};
			hold.release();
			await selection;
			await eventLoopTurns(10);
			expect(statusAtReport).toBe("paused");
			expect(session.goalModeState?.goal.status).toBe("paused");
			harness.abortController.abort();
		});

		it("an explicit switch to plan during goal resume is not undone by the entering goal", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const first = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			await harness.agent.cancel({ sessionId });
			expect((await first).stopReason).toBe("cancelled");
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");

			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			const hold = holdNextToolSwap(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "later guidance" }] });
			await hold.entered;
			const exit = harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "plan" });
			await eventLoopTurns(10);
			hold.release();
			await Promise.all([exit, prompt]);
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.enabledTools).not.toContain("goal");
			expect(session.planModeState?.enabled).toBe(true);
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			harness.abortController.abort();
		});

		it("leaving goal mode pauses the goal and restores the pre-goal tools", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.enabledTools).toEqual(["read", "goal"]);

			await harness.agent.setSessionMode({ sessionId, modeId: "default" });
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.enabledTools).toEqual(["read"]);
			expect(lastModeNotification(harness, sessionId)).toBe("default");
			harness.abortController.abort();
		});

		it("an explicit goal to default switch sends one mode update and does not make IntelliJ ignore a later goal selection", async () => {
			const { harness, sessionId, session } = await goalHarness(INTELLIJ_CLIENT_INFO, { pastBootstrap: true });
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			const baseline = harness.updates.length;
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "default" });
			await eventLoopTurns(5);
			expect(modeUpdatesSince(harness, baseline)).toEqual(["default"]);
			expect(session.goalModeState?.goal.status).toBe("paused");

			const reselected = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			const modeOption = reselected.configOptions.find(option => option.id === "mode");
			expect(modeOption?.type === "select" ? modeOption.currentValue : undefined).toBe("goal");
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "keep going" }] });
			await eventLoopTurns(5);
			expect(session.goalModeState?.goal.status).toBe("active");
			harness.abortController.abort();
		});

		it("an explicit goal to plan switch sends one mode update, with no intermediate default", async () => {
			const { harness, sessionId, session } = await goalHarness(undefined, { pastBootstrap: true });
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });

			const baseline = harness.updates.length;
			await harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			await eventLoopTurns(5);
			expect(modeUpdatesSince(harness, baseline)).toEqual(["plan"]);
			harness.abortController.abort();
		});

		it("switching goal to plan pauses an active or already-paused goal, restores tools, and reports plan", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.enabledTools).toEqual(["read", "goal"]);

			await harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.enabledTools).toEqual(["read"]);
			expect(session.planModeState?.enabled).toBe(true);
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"plan",
			);

			// Already paused: re-select goal (retains the paused goal), then go to plan again.
			await harness.agent.setSessionMode({ sessionId, modeId: "default" });
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			expect(session.goalModeState?.goal.status).toBe("paused");
			await harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.enabledTools).toEqual(["read"]);
			expect(session.planModeState?.enabled).toBe(true);
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"plan",
			);
			harness.abortController.abort();
		});

		it("goal completion returns to default mode and a JetBrains re-send of goal does not arm a new objective", async () => {
			const { harness, sessionId, session } = await goalHarness(INTELLIJ_CLIENT_INFO);
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			let continuationsAdmitted = 0;
			session.promptCustomMessage = async () => {
				continuationsAdmitted++;
				session.isStreaming = true;
				await session.goalRuntime.completeGoalFromTool();
				emitTurn(session, "done", { name: "goal", args: { op: "complete" } });
				session.isStreaming = false;
				return true;
			};

			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await eventLoopTurns(5);
			expect(continuationsAdmitted).toBe(1);
			expect(session.goalModeState).toBeUndefined();
			expect(session.enabledTools).toEqual(["read"]);
			expect(lastModeNotification(harness, sessionId)).toBe("default");

			// IntelliJ re-sends its stored dropdown choice before the next prompt.
			const resent = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			expect(
				(resent.configOptions.find(option => option.id === "mode") as { currentValue?: unknown }).currentValue,
			).toBe("default");
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "ok?" }] });
			await eventLoopTurns(5);
			// `ok?` became no objective, so no goal turn followed it.
			expect(continuationsAdmitted).toBe(1);
			harness.abortController.abort();
		});

		it("reopens a persisted active goal paused in default mode and resumes it only after selection", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await session.goalRuntime.createGoal({ objective: "Persisted objective" });
			await session.sessionManager.flush();
			await harness.agent.closeSession({ sessionId });

			const resumed = await harness.agent.resumeSession({ sessionId, cwd: harness.cwdA, mcpServers: [] });
			const reopened = harness.sessions.at(-1)!;
			expect(
				(resumed.configOptions?.find(option => option.id === "mode") as { currentValue?: unknown })?.currentValue,
			).toBe("default");
			expect(reopened.goalModeState?.goal.status).toBe("paused");
			expect(reopened.enabledTools).toEqual(["read", "goal"]);

			reopened.promptCustomMessage = async () => {
				emitTurn(reopened, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "unrelated" }] });
			expect(reopened.goalModeState?.goal.status).toBe("paused");

			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			expect(reopened.promptCalls).toEqual(["unrelated"]);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "continue" }] });
			expect(reopened.goalModeState?.goal.objective).toBe("Persisted objective");
			expect(reopened.goalModeState?.goal.status).toBe("active");
			harness.abortController.abort();
		});

		it("a deferred reattach that clears an intermediate goal re-syncs the mode and records the stale goal for IntelliJ", async () => {
			const defaultReported = Promise.withResolvers<void>();
			const harness = await createHarness({
				extensionRunners: true,
				clientInfo: INTELLIJ_CLIENT_INFO,
				sessionUpdateHook: notification => {
					if (notification.update.sessionUpdate === "current_mode_update") {
						if (notification.update.currentModeId === "default") defaultReported.resolve();
					}
				},
			});
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			const runner = session.extensionRunner!;
			// Hold the first reattach inside onThreadResumed.
			const gate = Promise.withResolvers<void>();
			const entered = Promise.withResolvers<void>();
			const resumed = session.goalRuntime.onThreadResumed.bind(session.goalRuntime);
			let resumes = 0;
			session.goalRuntime.onThreadResumed = async options => {
				if (resumes++ === 0) {
					entered.resolve();
					await gate.promise;
				}
				return resumed(options);
			};
			const ctx = runner.createCommandContext();
			// Change A lands on a transcript with an active goal; its reattach stalls.
			const changeA = ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", {
						goal: {
							id: "g-mid",
							objective: "intermediate",
							status: "active",
							tokensUsed: 0,
							timeUsedSeconds: 0,
							createdAt: 0,
							updatedAt: 0,
						},
					});
				},
			});
			await entered.promise;
			expect(resumes).toBe(1);
			// Change B lands on a transcript with no goal while A's reattach runs: its reattach is deferred.
			await ctx.newSession();
			expect(resumes).toBe(1);
			expect(session.goalModeState?.goal.objective).toBe("intermediate");
			// The fake's session id follows the transcript; notifications carry the current one.
			expect(lastModeNotification(harness, session.sessionId)).toBe("goal");

			gate.resolve();
			await changeA;
			await defaultReported.promise;
			// The hook runs before the notification is recorded; let that microtask land.
			await eventLoopTurns(1);
			expect(session.goalModeState).toBeUndefined();
			expect(lastModeNotification(harness, session.sessionId)).toBe("default");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"default",
			);

			// IntelliJ replays its stored `goal`: ignored, so no objective is armed.
			const resent = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			expect(selectedMode(resent.configOptions)).toBe("default");
			harness.abortController.abort();
		});

		it("a goal selection accepted while a deferred reattach is pending survives it and arms the next prompt", async () => {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			const runner = session.extensionRunner!;
			// Hold the first reattach inside onThreadResumed; the second change's reconcile queues behind it.
			const gate = Promise.withResolvers<void>();
			const entered = Promise.withResolvers<void>();
			const resumed = session.goalRuntime.onThreadResumed.bind(session.goalRuntime);
			let resumes = 0;
			session.goalRuntime.onThreadResumed = async options => {
				if (resumes++ === 0) {
					entered.resolve();
					await gate.promise;
				}
				return resumed(options);
			};
			const ctx = runner.createCommandContext();
			const changeA = ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", {
						goal: {
							id: "g-mid",
							objective: "intermediate",
							status: "active",
							tokensUsed: 0,
							timeUsedSeconds: 0,
							createdAt: 0,
							updatedAt: 0,
						},
					});
				},
			});
			await entered.promise;
			// Change B returns with its reconcile still queued behind A's held one.
			await ctx.newSession();
			expect(resumes).toBe(1);
			expect(session.goalModeState?.goal.objective).toBe("intermediate");

			// The client selects goal after both session changes returned. Not awaited: the
			// selection waits for the pending reconcile, which is held until released below.
			const selection = harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			gate.resolve();
			await changeA;
			const selected = await selection;
			await eventLoopTurns(3);
			expect(session.goalModeState).toBeUndefined();
			expect(selectedMode(selected.configOptions)).toBe("goal");
			expect(lastModeNotification(harness, session.sessionId)).toBe("goal");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"goal",
			);

			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.objective).toBe("Ship feature X");
			expect(session.promptCalls).toEqual(["Ship feature X"]);
			harness.abortController.abort();
		});

		function selectedMode(options: SessionConfigOption[]): unknown {
			const option = options.find(candidate => candidate.id === "mode");
			return option?.type === "select" ? option.currentValue : undefined;
		}

		it("an agent-side goal completion landing inside an explicit transition is replayed after it and recorded stale", async () => {
			let onModeUpdate: (() => Promise<void>) | undefined;
			const harness = await createHarness({
				clientInfo: INTELLIJ_CLIENT_INFO,
				sessionUpdateHook: async notification => {
					if (notification.update.sessionUpdate !== "current_mode_update") return;
					const run = onModeUpdate;
					onModeUpdate = undefined;
					await run?.();
				},
			});
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			// Re-selecting goal is a no-op transition; the agent completes the goal while its update is in flight.
			onModeUpdate = async () => {
				session.isStreaming = true;
				await session.goalRuntime.completeGoalFromTool();
				emitTurn(session, "done", { name: "goal", args: { op: "complete" } });
				session.isStreaming = false;
			};
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			await eventLoopTurns(5);

			expect(session.goalModeState).toBeUndefined();
			expect(lastModeNotification(harness, sessionId)).toBe("default");
			expect(modeConfigValue(harness.updates.findLast(u => u.update.sessionUpdate === "config_option_update"))).toBe(
				"default",
			);
			// `goal` was recorded stale: a JetBrains re-send is ignored.
			const resent = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			expect(selectedMode(resent.configOptions)).toBe("default");
			// A deliberate different selection still works.
			const plan = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "plan" });
			expect(selectedMode(plan.configOptions)).toBe("plan");
			harness.abortController.abort();
		});

		async function reopenPausedGoal() {
			const { harness, sessionId, session } = await goalHarness();
			await session.goalRuntime.createGoal({ objective: "Persisted objective" });
			await session.sessionManager.flush();
			await harness.agent.closeSession({ sessionId });
			await harness.agent.resumeSession({ sessionId, cwd: harness.cwdA, mcpServers: [] });
			const reopened = harness.sessions.at(-1)!;
			expect(reopened.goalModeState?.goal.status).toBe("paused");
			expect(reopened.enabledTools).toEqual(["read", "goal"]);
			return { harness, sessionId, reopened };
		}

		it("selecting plan on a reopened, never-selected paused goal restores the pre-goal tools and keeps it paused", async () => {
			const { harness, sessionId, reopened } = await reopenPausedGoal();

			await harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			expect(reopened.enabledTools).toEqual(["read"]);
			expect(reopened.goalModeState?.goal.status).toBe("paused");
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			harness.abortController.abort();
		});

		it("selecting default twice on a reopened paused goal restores tools and journals nothing the second time", async () => {
			const { harness, sessionId, reopened } = await reopenPausedGoal();

			await harness.agent.setSessionMode({ sessionId, modeId: "default" });
			expect(reopened.enabledTools).toEqual(["read"]);
			expect(reopened.goalModeState?.goal.status).toBe("paused");
			const entriesBefore = reopened.sessionManager.getEntries().length;
			await harness.agent.setSessionMode({ sessionId, modeId: "default" });
			expect(reopened.sessionManager.getEntries().length).toBe(entriesBefore);
			expect(reopened.enabledTools).toEqual(["read"]);
			harness.abortController.abort();
		});

		/** Harness with an extension runner, JetBrains pinning, and the bootstrap guard already passed. */
		async function extensionGoalHarness() {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			vi.useFakeTimers();
			const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
			await advanceBootstrapGuard();
			vi.useRealTimers();
			const sessionId = created.sessionId;
			const session = harness.findSession(sessionId)!;
			return { harness, sessionId, session, ctx: session.extensionRunner!.createCommandContext() };
		}

		/** The next ordinary prompt ends its turn without progress, so no continuation follows. */
		function endTurnsWithoutProgress(session: FakeAgentSession): void {
			session.promptCustomMessage = async () => {
				emitTurn(session, "no progress");
				return true;
			};
		}

		it("(P×M) a Plan selection landing after a prompt's goal entry never submits the objective turn or leaves an active goal", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			// Goal selection is already reported, so the entry sends no mode notification to hold. The
			// entry's own `goal_updated` delivery is the last await before the prompt is confirmed.
			const hold = holdGoalEmit(session);
			const submitted: string[] = [];
			const planAtSubmit: boolean[] = [];
			const submit = session.prompt.bind(session);
			session.prompt = async (text, options) => {
				submitted.push(text);
				planAtSubmit.push(session.planModeState?.enabled === true);
				return await submit(text, options);
			};
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await hold.entered;
			// The entry committed; the prompt is not submitted yet. Plan lands now.
			const plan = harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			await eventLoopTurns(5);
			hold.release();
			await plan;
			const response = await prompt;
			await eventLoopTurns(10);

			expect(response.stopReason).toBe("cancelled");
			expect(submitted).toEqual([]);
			expect(planAtSubmit).toEqual([]);
			expect(session.planModeState?.enabled).toBe(true);
			expect(session.goalModeState?.enabled).not.toBe(true);
			expect(session.enabledTools).not.toContain("goal");
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			harness.abortController.abort();
		});

		it("(S×X/R) Stop's late interrupted abort never pauses the goal a new transcript adopted", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const abortReached = Promise.withResolvers<void>();
			const abortGate = Promise.withResolvers<void>();
			session.abort = async options => {
				session.abortCalls++;
				session.isStreaming = false;
				abortReached.resolve();
				await abortGate.promise;
				// As `AgentSession.abort`: the interrupted pause lands once the run has unwound.
				await session.goalRuntime.onTaskAborted({ reason: "interrupted", stamp: options?.goalStamp });
			};
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			const cancel = harness.agent.cancel({ sessionId });
			await abortReached.promise;
			expect((await prompt).stopReason).toBe("cancelled");

			// A new transcript adopts an active goal while the abort is still unwinding.
			const goal = session.goalModeState!.goal;
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: { ...goal, id: "g-adopted", objective: "adopted" } });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");

			abortGate.resolve();
			await cancel;
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		it("(S×X/R) a Stop whose cleanup timed out keeps its interrupted pause bound to its own transcript until the late abort settles", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			harness.agent.setCancelCleanupTimeoutForTesting(10);
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const abortGate = Promise.withResolvers<void>();
			const lateAbort = Promise.withResolvers<void>();
			session.abort = async options => {
				session.abortCalls++;
				session.isStreaming = false;
				await abortGate.promise;
				// As `AgentSession.abort`: the interrupted pause lands once the run has unwound.
				await session.goalRuntime.onTaskAborted({ reason: "interrupted", stamp: options?.goalStamp });
				lateAbort.resolve();
			};
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			// The cleanup timeout wins the race while the abort is still pending.
			await harness.agent.cancel({ sessionId });
			expect((await prompt).stopReason).toBe("cancelled");
			expect(session.abortCalls).toBe(1);

			// B is adopted after the timeout, before A's abort unwinds.
			const goal = session.goalModeState!.goal;
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: { ...goal, id: "g-adopted", objective: "adopted" } });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");

			abortGate.resolve();
			await lateAbort.promise;
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		it("(M×M) concurrent Plan to Goal and Goal to Plan never end with Plan enabled while Goal is selected", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const toPlan = harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			const toGoal = harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			await Promise.all([toPlan, toGoal]);
			await eventLoopTurns(10);

			const planEnabled = session.planModeState?.enabled === true;
			endTurnsWithoutProgress(session);
			// A selected Goal with Plan on would turn this prompt into an objective that cannot enter.
			const response = await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "next work" }] });
			expect(response.stopReason).toBe("end_turn");
			if (planEnabled) {
				expect(session.goalModeState).toBeUndefined();
			} else {
				expect(session.goalModeState?.goal.objective).toBe("next work");
			}
			harness.abortController.abort();
		});

		it("(M×T) the agent's goal tool resume after a Plan selection paused the goal leaves no active goal under Plan", async () => {
			const { harness, sessionId, session } = await goalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			await harness.agent.setSessionMode({ sessionId, modeId: "plan" });
			expect(session.goalModeState?.goal.status).toBe("paused");
			// The `goal` tool call was admitted before the selection and reaches the runtime after it.
			await session.goalRuntime.resumeGoal().catch(() => undefined);
			await eventLoopTurns(10);

			expect(session.planModeState?.enabled).toBe(true);
			expect(session.goalModeState?.enabled).not.toBe(true);
			expect(session.goalModeState?.goal.status).not.toBe("active");
			expect(session.enabledTools).not.toContain("goal");
			expect(lastModeNotification(harness, sessionId)).toBe("plan");
			harness.abortController.abort();
		});

		it("(X/R×T) a goal tool commit racing a reconcile resurrects neither the old transcript's goal nor its tools in the new transcript", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");
			const transcriptBefore = session.sessionManager.getSessionId();

			// The reconcile of the new transcript stalls while restoring the pre-goal tools.
			const hold = holdNextToolSwap(session);
			const change = ctx.newSession();
			await hold.entered;
			// The old turn's `goal` tool commits meanwhile, into the transcript that is now current.
			await session.goalRuntime.resumeGoal().catch(() => undefined);
			hold.release();
			await change;
			await eventLoopTurns(10);

			expect(session.sessionManager.getSessionId()).not.toBe(transcriptBefore);
			expect(session.goalModeState).toBeUndefined();
			expect(session.sessionManager.buildSessionContext().mode).not.toBe("goal");
			expect(session.enabledTools).not.toContain("goal");
			expect(lastModeNotification(harness, session.sessionId)).toBe("default");
			harness.abortController.abort();
		});

		/** Hold the next goal event delivery: the runtime's accounting chain stays busy until released. */
		function holdGoalEmit(session: FakeAgentSession): { entered: Promise<void>; release: () => void } {
			const entered = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			session.goalEmitBlocker = async () => {
				session.goalEmitBlocker = undefined;
				entered.resolve();
				await release.promise;
			};
			return { entered: entered.promise, release: release.resolve };
		}

		function adoptedGoal(status: "active" | "paused"): Goal {
			return {
				id: "g-adopted",
				objective: "adopted",
				status,
				tokensUsed: 0,
				timeUsedSeconds: 0,
				createdAt: 0,
				updatedAt: 0,
			};
		}

		it("(stamp) a goal tool resume admitted in transcript A, released after the switch to B and its reconcile, never activates B's paused goal", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			const hold = holdGoalEmit(session);
			const pausing = session.goalRuntime.pauseGoal();
			await hold.entered;
			// The tool call is admitted in A and queues behind the held chain.
			const staleResume = session.goalRuntime.resumeGoal().then(
				() => undefined,
				(error: unknown) => error,
			);
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal_paused", { goal: adoptedGoal("paused") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("paused");

			hold.release();
			await pausing;
			const error = await staleResume;
			await eventLoopTurns(10);

			expect(error).toBeInstanceOf(Error);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.goalModeState?.enabled).not.toBe(true);
			harness.abortController.abort();
		});

		it("(stamp) a goal tool drop admitted in transcript A, released after the switch to B and its reconcile, never drops B's adopted goal", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			const hold = holdGoalEmit(session);
			const pausing = session.goalRuntime.pauseGoal();
			await hold.entered;
			const staleDrop = session.goalRuntime.dropGoal({ origin: "tool" }).then(
				() => undefined,
				(error: unknown) => error,
			);
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: adoptedGoal("active") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");

			hold.release();
			await pausing;
			const error = await staleDrop;
			await eventLoopTurns(10);

			expect(error).toBeInstanceOf(Error);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		/** A goal active in transcript A, whose tool call is admitted and then held by `hold` before it commits. */
		async function staleToolMutation(
			op: "drop" | "complete",
			holdAt: "usage flush" | "drop event",
		): Promise<{ error: unknown; session: FakeAgentSession; harness: AgentHarness }> {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			const hold = holdGoalEmit(session);
			// A flush only emits when it has time to account for; the clock skew provides it.
			if (holdAt === "usage flush") session.goalClockSkewMs = 5_000;
			const call =
				op === "drop"
					? session.goalRuntime.dropGoal({ origin: "tool" })
					: session.goalRuntime.completeGoalFromTool();
			const outcome = call.then(
				() => undefined,
				(error: unknown) => error,
			);
			await hold.entered;
			session.goalClockSkewMs = 0;
			// Transcript B is adopted, and its reconcile begins, while the call is suspended past its first check.
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: adoptedGoal("active") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");

			hold.release();
			const error = await outcome;
			await eventLoopTurns(10);
			return { error, session, harness };
		}

		for (const op of ["drop", "complete"] as const) {
			it(`(stamp) a goal tool ${op} suspended in its usage flush while transcript B is adopted never ${op === "drop" ? "drops" : "completes"} B's goal`, async () => {
				const { error, session, harness } = await staleToolMutation(op, "usage flush");

				expect(error).toBeInstanceOf(Error);
				expect(session.goalModeState?.goal.id).toBe("g-adopted");
				expect(session.goalModeState?.goal.status).toBe("active");
				expect(session.goalModeState?.enabled).toBe(true);
				harness.abortController.abort();
			});
		}

		it("(stamp) a goal tool drop suspended in its dropped-event delivery while transcript B is adopted never clears B's goal", async () => {
			const { error, session, harness } = await staleToolMutation("drop", "drop event");

			expect(error).toBeInstanceOf(Error);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		for (const modeId of ["plan", "default"] as const) {
			it(`(commit fence) an explicit ${modeId} selection whose pause is suspended in its usage flush while transcript B is adopted leaves B's goal active and installs no plan on B`, async () => {
				const { harness, sessionId, session, ctx } = await extensionGoalHarness();
				await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
				endTurnsWithoutProgress(session);
				await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
				expect(session.goalModeState?.goal.status).toBe("active");

				const hold = holdGoalEmit(session);
				session.goalClockSkewMs = 5_000;
				const selecting = harness.agent.setSessionMode({ sessionId, modeId });
				await hold.entered;
				session.goalClockSkewMs = 0;
				await ctx.newSession({
					setup: async manager => {
						manager.appendModeChange("goal", { goal: adoptedGoal("active") });
					},
				});
				await eventLoopTurns(10);
				expect(session.goalModeState?.goal.id).toBe("g-adopted");

				hold.release();
				await selecting;
				await eventLoopTurns(10);

				expect(session.goalModeState?.goal.id).toBe("g-adopted");
				expect(session.goalModeState?.goal.status).toBe("active");
				expect(session.goalModeState?.enabled).toBe(true);
				expect(session.planModeState?.enabled).not.toBe(true);
				harness.abortController.abort();
			});
		}

		for (const goalInB of [true, false]) {
			it(`(commit fence) a Plan selection whose goal exit is suspended in its tool restore finishes it before transcript B is adopted, so B ${goalInB ? "with" : "without"} a goal keeps its own tools`, async () => {
				const { harness, sessionId, session, ctx } = await extensionGoalHarness();
				await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
				endTurnsWithoutProgress(session);
				await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
				expect(session.goalModeState?.goal.status).toBe("active");
				expect(session.enabledTools).toEqual(["read", "goal"]);

				// A's goal is paused; the restore of its pre-goal tools is what suspends.
				const hold = holdNextToolSwap(session);
				const selecting = harness.agent.setSessionMode({ sessionId, modeId: "plan" });
				await hold.entered;
				// The change waits for A's restore: nothing of B can be chosen before it has landed.
				const change = ctx.newSession({
					setup: async manager => {
						if (goalInB) manager.appendModeChange("goal", { goal: adoptedGoal("active") });
						// B's own selection, made as soon as it exists.
						await session.setActiveToolsByName(["read", "write"]);
					},
				});
				await eventLoopTurns(10);
				expect(session.enabledTools).toEqual(["read", "goal"]);

				hold.release();
				await selecting;
				await change;
				await eventLoopTurns(10);

				// A's restore landed before B chose; it did not overwrite B's selection afterwards.
				expect(session.enabledTools).toEqual(goalInB ? ["read", "write", "goal"] : ["read", "write"]);
				expect(session.goalModeState?.goal.id).toBe(goalInB ? "g-adopted" : undefined);
				harness.abortController.abort();
			});
		}

		it("(commit fence) a pause whose event delivery is suspended while transcript B is adopted restores none of B's tools", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			// The pause commits in A; delivering its event is what suspends.
			const hold = holdGoalEmit(session);
			const selecting = harness.agent.setSessionMode({ sessionId, modeId: "default" });
			await hold.entered;
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: adoptedGoal("active") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.enabledTools).toContain("goal");

			hold.release();
			await selecting;
			await eventLoopTurns(10);

			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.enabledTools).toContain("goal");
			harness.abortController.abort();
		});

		it("(commit fence) an interrupted abort bound to no Stop, suspended in its usage flush while transcript B is adopted, never pauses B's goal", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			endTurnsWithoutProgress(session);
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			expect(session.goalModeState?.goal.status).toBe("active");

			const hold = holdGoalEmit(session);
			session.goalClockSkewMs = 5_000;
			const aborting = session.goalRuntime.onTaskAborted({ reason: "interrupted" });
			await hold.entered;
			session.goalClockSkewMs = 0;
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: adoptedGoal("active") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");

			hold.release();
			await aborting;
			await eventLoopTurns(10);

			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		it("(commit fence) a Stop compensation whose pause is suspended in its usage flush while transcript B is adopted leaves B's goal active", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			// Only the compensation pause is under test, not the abort's own interrupted pause.
			session.abort = async () => {
				session.abortCalls++;
				session.isStreaming = false;
			};
			const entry = holdGoalEmit(session);
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await entry.entered;
			// The goal entry committed; Stop overtakes the prompt before it is submitted.
			await harness.agent.cancel({ sessionId });
			const compensation = holdGoalEmit(session);
			session.goalClockSkewMs = 5_000;
			entry.release();
			await compensation.entered;
			session.goalClockSkewMs = 0;
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: adoptedGoal("active") });
				},
			});
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");

			compensation.release();
			expect((await prompt).stopReason).toBe("cancelled");
			await eventLoopTurns(10);

			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");
			expect(session.goalModeState?.enabled).toBe(true);
			harness.abortController.abort();
		});

		it("(per-abort stamp) a Stop in transcript B pauses B's goal while transcript A's abort is still pending, and A's late abort then changes nothing", async () => {
			const harness = await createHarness({ extensionRunners: true, clientInfo: INTELLIJ_CLIENT_INFO });
			const session = new FakeAgentSession(harness.cwdA);
			const actor = new AcpGoalActor(session as unknown as GoalHostSession, {
				promptOpen: () => false,
				clientPinsConfig: () => false,
				selectValues: () => new Map(),
				announce: async () => {},
				onReconciled: async () => {},
			});
			await session.goalRuntime.createGoal({ objective: "A" }, { origin: "host" });
			expect(session.goalModeState?.goal.status).toBe("active");

			// Stop in A: its abort is still unwinding.
			const stopA = actor.stop();
			const abortGateA = Promise.withResolvers<void>();
			const abortA = abortGateA.promise.then(() =>
				session.goalRuntime.onTaskAborted({ reason: "interrupted", stamp: stopA.stamp }),
			);

			// B is adopted with an active goal.
			await actor.beginSessionChange();
			await session.sessionManager.newSession();
			session.sessionManager.appendModeChange("goal", { goal: adoptedGoal("active") });
			await actor.endSessionChange({ detachedRun: true });
			await eventLoopTurns(10);
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("active");

			// Stop in B settles while A's abort is still pending: B's goal is paused.
			const stopB = actor.stop();
			await session.goalRuntime.onTaskAborted({ reason: "interrupted", stamp: stopB.stamp });
			stopB.abortSettled();
			expect(session.goalModeState?.goal.id).toBe("g-adopted");
			expect(session.goalModeState?.goal.status).toBe("paused");
			expect(session.goalModeState?.enabled).toBe(false);

			// A's late abort neither pauses nor changes B's goal.
			const before = structuredClone(session.goalModeState);
			const journalBefore = session.sessionManager.getEntries().length;
			abortGateA.resolve();
			await abortA;
			stopA.abortSettled();
			expect(session.goalModeState).toEqual(before);
			expect(session.sessionManager.getEntries().length).toBe(journalBefore);
			actor.dispose();
			harness.abortController.abort();
		});

		it("(commit fence) a late abort of transcript A, released after B adopted an active goal with accounting in progress, changes none of B's usage, status, journal or turn snapshot", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			const continuationStarted = Promise.withResolvers<void>();
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				continuationStarted.resolve();
				return true;
			};
			const abortReached = Promise.withResolvers<void>();
			const abortGate = Promise.withResolvers<void>();
			session.abort = async options => {
				session.abortCalls++;
				session.isStreaming = false;
				abortReached.resolve();
				await abortGate.promise;
				await session.goalRuntime.onTaskAborted({ reason: "interrupted", stamp: options?.goalStamp });
			};
			const prompt = harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await continuationStarted.promise;
			const cancel = harness.agent.cancel({ sessionId });
			await abortReached.promise;
			expect((await prompt).stopReason).toBe("cancelled");

			// B adopts an active goal with a token budget, and its turn is mid-flight.
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: { ...adoptedGoal("active"), tokenBudget: 10 } });
				},
			});
			await eventLoopTurns(10);
			session.goalRuntime.onTurnStart("turn-b", { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
			// Accounting is owed: tokens beyond B's budget and wall-clock seconds, if anything flushes now.
			session.goalUsageTokens = 50;
			session.goalClockSkewMs = 5_000;
			const goalBefore = structuredClone(session.goalModeState);
			const snapshotBefore = structuredClone(session.goalRuntime.snapshot);
			const journalBefore = session.sessionManager.getEntries().length;
			expect(goalBefore?.goal.id).toBe("g-adopted");
			expect(goalBefore?.goal.status).toBe("active");

			abortGate.resolve();
			await cancel;
			await eventLoopTurns(10);

			expect(session.goalModeState).toEqual(goalBefore);
			expect(session.goalRuntime.snapshot).toEqual(snapshotBefore);
			expect(session.sessionManager.getEntries().length).toBe(journalBefore);
			harness.abortController.abort();
		});

		it("(abort at request) an extension abort in transcript A, released after B adopted an active goal, changes none of B's usage, status, journal or turn snapshot", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionMode({ sessionId, modeId: "goal" });
			await session.goalRuntime.createGoal({ objective: "A" }, { origin: "host" });
			expect(session.goalModeState?.goal.status).toBe("active");

			// The extension aborts in A, with no Stop and so no stamp supplied by ACP; the abort is held.
			const abortRelease = Promise.withResolvers<void>();
			session.abortHold = abortRelease.promise;
			session.extensionRunner!.createContext().abort();
			await session.abortEntered.promise;

			// B adopts an active goal with a token budget, and its turn is mid-flight.
			await ctx.newSession({
				setup: async manager => {
					manager.appendModeChange("goal", { goal: { ...adoptedGoal("active"), tokenBudget: 10 } });
				},
			});
			await eventLoopTurns(10);
			session.goalRuntime.onTurnStart("turn-b", { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
			session.goalUsageTokens = 50;
			session.goalClockSkewMs = 5_000;
			const goalBefore = structuredClone(session.goalModeState);
			const snapshotBefore = structuredClone(session.goalRuntime.snapshot);
			const journalBefore = session.sessionManager.getEntries().length;
			expect(goalBefore?.goal.id).toBe("g-adopted");
			expect(goalBefore?.goal.status).toBe("active");

			abortRelease.resolve();
			await eventLoopTurns(10);

			expect(session.goalModeState).toEqual(goalBefore);
			expect(session.goalRuntime.snapshot).toEqual(snapshotBefore);
			expect(session.sessionManager.getEntries().length).toBe(journalBefore);
			harness.abortController.abort();
		});

		it("(stale per transcript) a stale goal recorded in transcript A neither suppresses the mode in transcript B nor leaks back", async () => {
			const { harness, sessionId, session, ctx } = await extensionGoalHarness();
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			session.promptCustomMessage = async () => {
				session.isStreaming = true;
				await session.goalRuntime.completeGoalFromTool();
				emitTurn(session, "done", { name: "goal", args: { op: "complete" } });
				session.isStreaming = false;
				return true;
			};
			await harness.agent.prompt({ sessionId, prompt: [{ type: "text", text: "Ship feature X" }] });
			await eventLoopTurns(5);
			expect(session.goalModeState).toBeUndefined();
			// `goal` is now stale in transcript A: JetBrains' re-send is ignored there.
			const ignoredInA = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			expect(selectedMode(ignoredInA.configOptions)).toBe("default");
			await session.sessionManager.flush();
			const transcriptA = session.sessionManager.getSessionFile()!;

			await ctx.newSession();
			await eventLoopTurns(5);
			expect(session.sessionManager.getSessionFile()).not.toBe(transcriptA);
			// Transcript B recorded nothing stale: selecting goal there is a real choice.
			const appliedInB = await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "goal" });
			expect(selectedMode(appliedInB.configOptions)).toBe("goal");

			// Back in A the stale record is still A's own: the re-send stays ignored.
			await harness.agent.setSessionConfigOption({ sessionId, configId: "mode", value: "default" });
			await session.sessionManager.flush();
			await ctx.switchSession(transcriptA);
			await eventLoopTurns(5);
			expect(session.sessionManager.getSessionFile()).toBe(transcriptA);
			const ignoredBackInA = await harness.agent.setSessionConfigOption({
				sessionId,
				configId: "mode",
				value: "goal",
			});
			expect(selectedMode(ignoredBackInA.configOptions)).toBe("default");
			harness.abortController.abort();
		});
	});
});

describe("ACP agent MCP server configuration (late-connecting servers)", () => {
	const FIXTURE_PATH = path.join(import.meta.dir, "fixtures", "delayed-tool-mcp.ts");
	const BUN_EXEC = process.execPath;

	// Real polling, not fake timers: the fixture is a genuine child process
	// racing MCPManager's own `Bun.sleep`-based 250ms startup window, and a
	// subprocess's timers cannot be advanced from this test's fake-timer clock.
	async function pollUntil(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (!predicate()) {
			if (Date.now() >= deadline) throw new Error("pollUntil timed out");
			await Bun.sleep(5);
		}
	}

	/**
	 * Regression test: an MCP server that finishes connecting after
	 * `MCPManager`'s 250ms startup race window used to have its tools
	 * silently discarded — `#configureMcpServers` only called
	 * `session.refreshMCPTools` once, synchronously, with whatever
	 * `connectServers` returned inside the race window. The background
	 * `onToolsChanged` -> `refreshMCPTools` follow-up now runs through a
	 * `refreshChain` queue so late connections still land in the session.
	 */
	it("delivers a late-connecting server's tools via a queued refreshMCPTools call", async () => {
		const harness = await createHarness();
		const refreshSpy = spyOn(FakeAgentSession.prototype, "refreshMCPTools");
		const namesOf = (tools: unknown[]) => (tools as Array<{ name: string }>).map(tool => tool.name);

		try {
			const created = await harness.agent.newSession({
				cwd: harness.cwdA,
				mcpServers: [{ name: "delayed", command: BUN_EXEC, args: [FIXTURE_PATH], env: [] }],
			});
			expectAcpStructure(zNewSessionResponse, created);

			// The fixture delays its `initialize` response past the 250ms startup
			// race, so the first (synchronous) refresh inside `#configureMcpServers`
			// must see no tools yet.
			expect(refreshSpy.mock.calls).toHaveLength(1);
			expect(namesOf(refreshSpy.mock.calls[0]?.[0] ?? [])).toEqual([]);

			// Once the delayed `initialize` response lands, the background
			// `onToolsChanged` -> queued `refreshMCPTools` call must deliver the
			// server's tool. Before the fix, this late arrival was dropped.
			await pollUntil(() => refreshSpy.mock.calls.length > 1);
			expect(namesOf(refreshSpy.mock.calls.at(-1)?.[0] ?? [])).toEqual([`mcp__delayed_${DELAYED_MCP_TOOL_NAME}`]);
		} finally {
			refreshSpy.mockRestore();
		}
	}, 15_000);
});
