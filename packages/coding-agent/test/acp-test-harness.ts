import { expect, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AuthStorage, Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import type { ExtensionUIContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { type AcpSessionFactory, createAcpConnection } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-mode";
import { ACP_BOOTSTRAP_RACE_GUARD_MS, AcpAgent } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-agent";
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
import { closeSessionIndex } from "@oh-my-pi/pi-coding-agent/session/session-index";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import type { ClientBridge } from "@oh-my-pi/pi-coding-agent/session/client-bridge";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { getConfigRootDir, setAgentDir } from "@oh-my-pi/pi-utils";
import type {
	AgentSideConnection,
	ClientCapabilities,
	CreateElicitationRequest,
	CreateElicitationResponse,
	InitializeRequest,
	RequestPermissionRequest,
	RequestPermissionResponse,
	SessionNotification,
	Validator,
} from "@oh-my-pi/pi-utils/acp";
import { type Client, ClientSideConnection, ndJsonStream, zSessionNotification } from "@oh-my-pi/pi-utils/acp";

import { type GoalOwnerStamp, GoalRuntime } from "@oh-my-pi/pi-coding-agent/goals/runtime";
import type { GoalModeState, GoalRuntimeEvent } from "@oh-my-pi/pi-coding-agent/goals/state";
import { validateAcpV2Frame } from "./acp-v2-schema";
/** Option id of the first option in a `session/request_permission` request, narrowed at runtime. */
function firstPermissionOptionId(params: unknown): string | undefined {
	if (typeof params !== "object" || params === null || !("options" in params) || !Array.isArray(params.options)) {
		return undefined;
	}
	const first: unknown = params.options[0];
	if (typeof first === "object" && first !== null && "optionId" in first && typeof first.optionId === "string") {
		return first.optionId;
	}
	return undefined;
}

export function expectAcpStructure(schema: Validator<unknown>, value: unknown): void {
	const result = schema.safeParse(value);
	expect(result.success, result.success ? undefined : JSON.stringify(result.error.issues, null, 2)).toBe(true);
}

export const TEST_MODELS: Model[] = [
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

export function createTaskSession(cwd: string): ToolSession {
	return {
		cwd,
		hasUI: false,
		settings: Settings.isolated({}),
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
	} as unknown as ToolSession;
}

export function makeAssistantMessage(text: string, thinking?: string) {
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

export class FakeAgentSession {
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
	steerCalls: Array<{ text: string; images: unknown[] }> = [];
	followUpCalls: Array<{ text: string; images: unknown[] }> = [];
	joinActiveTurnCalls: Array<{ text: string; images: unknown[]; queue: "steering" | "followUp" }> = [];
	/** Extra refusal switch for the fake `joinActiveTurn`; `isStreaming` remains the busy gate. */
	joinActiveTurnAdmitted = true;
	/** Backs `modelRegistry.authStorage` for `/mcp reauth` credential round-trips. */
	authStorage?: AuthStorage;
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

	get modelRegistry(): { getApiKey: (model: Model) => Promise<string>; authStorage?: AuthStorage } {
		return {
			getApiKey: async (_model: Model) => "test-key",
			...(this.authStorage ? { authStorage: this.authStorage } : {}),
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

	/** The v1 open-prompt gate as the real session reads it: through the client bridge callback. */
	get acpPromptOpen(): boolean {
		return this.clientBridge?.allowAgentInitiatedTurns?.() ?? true;
	}

	/** Resolved when `abort()` has reserved its goal owner stamp and starts to unwind. */
	abortEntered = Promise.withResolvers<void>();
	/** Awaited inside `abort()` before the runtime's abort accounting, so a test can hold an abort open. */
	abortHold: Promise<void> | undefined;
	async abort(options?: { reason?: string; goalStamp?: GoalOwnerStamp }): Promise<void> {
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
		this.steerCalls.push({ text, images: images ?? [] });
	}
	async followUp(text: string, images?: unknown[]): Promise<void> {
		this.followUpCalls.push({ text, images: images ?? [] });
	}
	async joinActiveTurn(
		text: string,
		images?: unknown[],
		options?: { queue?: "steering" | "followUp" },
	): Promise<boolean> {
		const queue = options?.queue ?? "steering";
		this.joinActiveTurnCalls.push({ text, images: images ?? [], queue });
		const admitted = this.isStreaming && this.joinActiveTurnAdmitted;
		if (!admitted) {
			return false;
		}
		if (queue === "followUp") {
			await this.followUp(text, images);
		} else {
			await this.steer(text, images);
		}
		return true;
	}
	/** The fake never admits a user steer into an open approval, so no dialog is superseded. */
	watchApprovalSupersede(_loopSteeringSignal: AbortSignal | undefined): { signal: AbortSignal; dispose(): void } {
		return { signal: new AbortController().signal, dispose: () => {} };
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

	/** Bridge the ACP agent installed for this session, so a test can drive agent-initiated client requests. */
	clientBridge: ClientBridge | undefined;
	setClientBridge(bridge: ClientBridge | undefined): void {
		this.clientBridge = bridge;
	}

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
export async function proposePlan(
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
export function expectSupersededProposal(result: unknown): void {
	const details = (result as { details?: unknown }).details;
	expect(details).toEqual({ superseded: true, title: expect.any(String) });
	expect(isPlanApprovalDetails(details)).toBe(false);
}

export function holdPromptStreaming(session: FakeAgentSession): () => void {
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

export type SetToolUIContextSpy = (uiContext: ExtensionUIContext, hasUI: boolean) => void;

export interface AgentHarness {
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

export function getChunkMessageId(notification: SessionNotification): string | undefined {
	const update = notification.update as { messageId?: string | null };
	return typeof update.messageId === "string" ? update.messageId : undefined;
}

/** Yield `count` macrotasks so already-scheduled work runs; no wall-clock delay. */
export async function eventLoopTurns(count: number): Promise<void> {
	for (let turn = 0; turn < count; turn++) {
		const { promise, resolve } = Promise.withResolvers<void>();
		setImmediate(resolve);
		await promise;
	}
}

export function expectAcpNotifications(updates: SessionNotification[]): void {
	for (const update of updates) {
		expectAcpStructure(zSessionNotification, update);
	}
}

export const cleanupRoots: string[] = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const fallbackAgentDir = path.join(getConfigRootDir(), "agent");

/** Per-test teardown; every test file importing this harness registers it with `afterEach`. */
export async function cleanupHarnessState(): Promise<void> {
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
}

interface HarnessRoots {
	cwdA: string;
	cwdB: string;
}

/** Creates the temp root, points the agent dir at it, and initialises in-memory settings. */
async function prepareHarnessRoots(): Promise<HarnessRoots> {
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
	return { cwdA, cwdB };
}

interface FakeSessionFactoryState {
	sessions: FakeAgentSession[];
	setToolUIContextSpies: SetToolUIContextSpy[];
	sessionFactoryOptions: Array<{ interactivePrompts?: boolean } | undefined>;
	initialSession: FakeAgentSession;
	factory: (
		cwd: string,
		factoryOptions?: { interactivePrompts?: boolean },
	) => Promise<{ session: AgentSession; setToolUIContext: SetToolUIContextSpy }>;
}

function createFakeSessionFactory(
	cwdA: string,
	extensionRunners: boolean | undefined,
	authStorage?: AuthStorage,
): FakeSessionFactoryState {
	const sessions: FakeAgentSession[] = [];
	const setToolUIContextSpies: SetToolUIContextSpy[] = [];
	const sessionFactoryOptions: Array<{ interactivePrompts?: boolean } | undefined> = [];
	const initialSession = new FakeAgentSession(cwdA);
	if (authStorage) initialSession.authStorage = authStorage;
	sessions.push(initialSession);
	const factory = async (cwd: string, factoryOptions?: { interactivePrompts?: boolean }) => {
		const session = new FakeAgentSession(cwd);
		if (authStorage) session.authStorage = authStorage;
		if (extensionRunners) {
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
	return { sessions, setToolUIContextSpies, sessionFactoryOptions, initialSession, factory };
}

export async function createHarness(
	options: {
		elicitationHandler?: (req: CreateElicitationRequest) => Promise<CreateElicitationResponse>;
		clientCapabilities?: ClientCapabilities;
		/** Runs before a notification is recorded, so a test can delay one delivery. */
		sessionUpdateHook?: (notification: SessionNotification) => Promise<void> | void;
		/** Gives each session the factory creates a real extension runner with no extensions. */
		extensionRunners?: boolean;
		/** Sent with `initialize`; `{ _meta: { platform: "intellij" } }` identifies a JetBrains client. */
		clientInfo?: InitializeRequest["clientInfo"];
		/** Protocol version sent with `initialize`; defaults to 1. */
		protocolVersion?: number;
		/** Answers v1 `session/request_permission` requests the agent sends. */
		requestPermission?: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
		/** Exposed to each created session's `modelRegistry` for MCP credential round-trips. */
		authStorage?: AuthStorage;
	} = {},
): Promise<AgentHarness> {
	const { cwdA, cwdB } = await prepareHarnessRoots();

	const updates: SessionNotification[] = [];
	const abortController = new AbortController();
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
		requestPermission: options.requestPermission,
		// The agent sends v1 permission requests through the cancellable form.
		requestPermissionWithCancel: options.requestPermission
			? (request: RequestPermissionRequest) => ({ promise: options.requestPermission!(request), cancel: () => {} })
			: undefined,
		signal: abortController.signal,
		closed: Promise.withResolvers<void>().promise,
	} as unknown as AgentSideConnection;

	const { sessions, setToolUIContextSpies, sessionFactoryOptions, initialSession, factory } = createFakeSessionFactory(
		cwdA,
		options.extensionRunners,
		options.authStorage,
	);

	const agent = new AcpAgent(connection, factory, initialSession as unknown as AgentSession);
	const clientCapabilities =
		options.clientCapabilities ?? (options.elicitationHandler ? { elicitation: { form: {} } } : undefined);
	if (clientCapabilities || options.clientInfo) {
		await agent.initialize({
			protocolVersion: options.protocolVersion ?? 1,
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

/**
 * Records every frame an agent writes to its client as raw NDJSON, in wire order. The tap sits on the
 * agent-to-client byte stream, below `ndJsonStream`, so it observes exactly what a real peer would read:
 * responses, notifications, and agent-initiated requests such as `session/request_permission`.
 */
export class OutboundFrameRecorder {
	/** Raw NDJSON lines (without the trailing newline), in the order the agent wrote them. */
	readonly lines: string[] = [];
	/** Pass-through byte stream; connect the agent's output to `writable` and the client's input to `readable`. */
	readonly stream: TransformStream<Uint8Array, Uint8Array>;
	#buffered = "";
	#decoder = new TextDecoder();
	#waiters = new Set<() => void>();

	constructor() {
		this.stream = new TransformStream<Uint8Array, Uint8Array>({
			transform: (chunk, controller) => {
				this.#record(chunk);
				controller.enqueue(chunk);
			},
		});
	}

	#record(chunk: Uint8Array): void {
		this.#buffered += this.#decoder.decode(chunk, { stream: true });
		let newline = this.#buffered.indexOf("\n");
		while (newline >= 0) {
			const line = this.#buffered.slice(0, newline);
			this.#buffered = this.#buffered.slice(newline + 1);
			if (line.length > 0) this.lines.push(line);
			newline = this.#buffered.indexOf("\n");
		}
		for (const waiter of this.#waiters) waiter();
	}

	/** Parsed frames recorded so far (a batch response is one array element). */
	frames(): unknown[] {
		return this.lines.map(line => JSON.parse(line) as unknown);
	}

	/** Resolves once a recorded frame satisfies `predicate`; rejects after `attempts` event-loop turns without one. */
	async waitForFrame(predicate: (frame: unknown) => boolean, attempts = 400): Promise<void> {
		for (let attempt = 0; attempt < attempts; attempt++) {
			if (this.frames().some(predicate)) return;
			const turn = Promise.withResolvers<void>();
			this.#waiters.add(turn.resolve);
			setTimeout(turn.resolve, 5);
			await turn.promise;
			this.#waiters.delete(turn.resolve);
		}
		throw new Error("expected outbound frame was never written");
	}
}

/** Client-side handlers a wire harness delegates to; every method is optional. */
export interface WireClientHandlers {
	requestPermission?: Client["requestPermission"];
}

export interface WireHarness {
	/** Client end of the in-memory transport; drive the agent through it. */
	client: ClientSideConnection;
	recorder: OutboundFrameRecorder;
	sessions: FakeAgentSession[];
	cwdA: string;
	cwdB: string;
	/** Temp root that holds both cwds and the agent dir; normalised out of recorded frames. */
	root: string;
	findSession(sessionId: string): FakeAgentSession | undefined;
	/** Protocol version the harness sends with `initialize`. */
	protocolVersion: number;
	/** Closes both transport directions and waits for the connections to settle. */
	close(): Promise<void>;
}

/**
 * Wires a real `AgentSideConnection` + `AcpAgent` to a `ClientSideConnection` over in-memory NDJSON byte
 * streams, with an {@link OutboundFrameRecorder} on the agent-to-client direction.
 */
export async function createWireHarness(
	options: { protocolVersion?: number; clientHandlers?: WireClientHandlers; extensionRunners?: boolean } = {},
): Promise<WireHarness> {
	const { cwdA, cwdB } = await prepareHarnessRoots();
	const { sessions, initialSession, factory } = createFakeSessionFactory(cwdA, options.extensionRunners);
	const clientToAgent = new TransformStream<Uint8Array, Uint8Array>();
	const recorder = new OutboundFrameRecorder();

	const handlers = options.clientHandlers ?? {};
	const client = new ClientSideConnection(
		() => ({
			sessionUpdate: async () => {},
			requestPermission:
				handlers.requestPermission ??
				(async request => ({ outcome: { outcome: "selected", optionId: request.options[0]!.optionId } })),
		}),
		ndJsonStream(clientToAgent.writable, recorder.stream.readable),
	);
	const serverConnection = createAcpConnection(
		ndJsonStream(recorder.stream.writable, clientToAgent.readable),
		factory,
		initialSession as unknown as AgentSession,
	);
	return {
		client,
		recorder,
		sessions,
		cwdA,
		cwdB,
		root: path.dirname(cwdA),
		findSession: (sessionId: string) => sessions.find(session => session.sessionId === sessionId),
		protocolVersion: options.protocolVersion ?? 1,
		async close() {
			// `ndJsonStream` takes a transient writer per frame; wait for the lock to clear before closing.
			for (const writable of [clientToAgent.writable, recorder.stream.writable]) {
				for (let attempt = 0; attempt < 100 && writable.locked; attempt++) await eventLoopTurns(1);
				await Promise.allSettled([writable.close()]);
			}
			await Promise.allSettled([client.closed, serverConnection.closed]);
		},
	};
}

/** Fire `#scheduleBootstrapUpdates`'s guard without paying wall-clock time. */
export async function advanceBootstrapGuard(): Promise<void> {
	vi.advanceTimersByTime(ACP_BOOTSTRAP_RACE_GUARD_MS);
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// ACP v2 raw wire client
// ---------------------------------------------------------------------------

/** A parsed JSON-RPC frame as the v2 client saw it. */
export type RawAcpFrame = Record<string, unknown>;

export interface RawAcpResponse {
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
	/** Position of the response frame in {@link RawAcpClient.frames}. */
	index: number;
}

/** Answers an agent-to-client request; a thrown error becomes a JSON-RPC error response. */
export type RawAcpRequestHandler = (method: string, params: unknown) => unknown | Promise<unknown>;

export interface RawAcpUpdate {
	/** Position of the notification in {@link RawAcpClient.frames}. */
	index: number;
	sessionId: string;
	update: Record<string, unknown>;
}

export interface RawAcpStateUpdate {
	index: number;
	state: string;
	stopReason?: string;
	error?: { message?: string };
}

/** Every v2 frame recorded across all schema-validating clients of the current test file. */
export const v2SuiteFrames: RawAcpFrame[] = [];
/** Schema issues found in {@link v2SuiteFrames}, each prefixed with the offending method. */
export const v2SuiteSchemaIssues: string[] = [];

function isRawFrame(value: unknown): value is RawAcpFrame {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A JSON-RPC client that speaks NDJSON to the agent without any SDK schema in between, so the agent's exact
 * bytes reach the test. It records every agent-to-client frame in order, validates each against the vendored v2
 * schema (when `validate`), and answers agent-to-client requests through `onRequest`.
 */
export class RawAcpClient {
	/** Agent-to-client frames in wire order. */
	readonly frames: RawAcpFrame[] = [];
	/** Schema issues for this client's frames. */
	readonly schemaIssues: string[] = [];
	/** Resolves when the agent closes its output. */
	readonly done: Promise<void>;
	readonly #writer: WritableStreamDefaultWriter<Uint8Array>;
	readonly #encoder = new TextEncoder();
	readonly #pending = new Map<number, (response: RawAcpResponse) => void>();
	readonly #methodsById = new Map<unknown, string>();
	readonly #validate: boolean;
	readonly #onRequest: RawAcpRequestHandler;
	#nextId = 0;
	#waiters = new Set<() => void>();

	constructor(
		input: WritableStream<Uint8Array>,
		output: ReadableStream<Uint8Array>,
		options: { validate: boolean; onRequest?: RawAcpRequestHandler },
	) {
		this.#writer = input.getWriter();
		this.#validate = options.validate;
		this.#onRequest =
			options.onRequest ??
			((method, params) => {
				if (method === "session/request_permission") {
					return { outcome: { outcome: "selected", optionId: firstPermissionOptionId(params) } };
				}
				throw new Error(`unexpected agent request ${method}`);
			});
		this.done = this.#read(output);
	}

	async #read(output: ReadableStream<Uint8Array>): Promise<void> {
		const reader = output.getReader();
		const decoder = new TextDecoder();
		let buffered = "";
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			buffered += decoder.decode(next.value, { stream: true });
			let newline = buffered.indexOf("\n");
			while (newline >= 0) {
				const line = buffered.slice(0, newline);
				buffered = buffered.slice(newline + 1);
				if (line.length > 0) this.#handle(JSON.parse(line) as unknown);
				newline = buffered.indexOf("\n");
			}
		}
	}

	#handle(value: unknown): void {
		if (Array.isArray(value)) {
			// A batch response is not a frame of `frames`; its `index` is the position the next frame will take.
			const index = this.frames.length;
			for (const entry of value) {
				if (!isRawFrame(entry)) continue;
				if (this.#validate) this.#validateFrame(entry);
				const resolve = this.#pending.get(entry.id as number);
				this.#pending.delete(entry.id as number);
				resolve?.({ result: entry.result, error: entry.error as RawAcpResponse["error"], index });
			}
			for (const waiter of this.#waiters) waiter();
			return;
		}
		if (!isRawFrame(value)) {
			this.schemaIssues.push("non-object frame from agent");
			return;
		}
		const index = this.frames.length;
		this.frames.push(value);
		if (this.#validate) this.#validateFrame(value);
		const method = typeof value.method === "string" ? value.method : undefined;
		if (method !== undefined && "id" in value) {
			void this.#answer(value.id, method, value.params);
		} else if (method === undefined && "id" in value) {
			const resolve = this.#pending.get(value.id as number);
			this.#pending.delete(value.id as number);
			const error = value.error as RawAcpResponse["error"];
			resolve?.({ result: value.result, error, index });
		}
		for (const waiter of this.#waiters) waiter();
	}

	#validateFrame(frame: RawAcpFrame): void {
		const issues: string[] = [];
		if (frame.jsonrpc !== "2.0") issues.push("jsonrpc: expected 2.0");
		let label: string | undefined;
		if (typeof frame.method === "string") {
			label = frame.method;
			issues.push(...validateAcpV2Frame("id" in frame ? "request" : "notification", frame.method, frame.params));
		} else if ("result" in frame) {
			label = this.#methodsById.get(frame.id);
			issues.push(
				...(label === undefined
					? [`response to unknown request id ${String(frame.id)}`]
					: validateAcpV2Frame("response", label, frame.result)),
			);
		}
		const record = issues.map(issue => `${label ?? "<frame>"}: ${issue}`);
		this.schemaIssues.push(...record);
		v2SuiteFrames.push(frame);
		v2SuiteSchemaIssues.push(...record);
	}

	async #answer(id: unknown, method: string, params: unknown): Promise<void> {
		let response: RawAcpFrame;
		try {
			response = { jsonrpc: "2.0", id, result: await this.#onRequest(method, params) };
		} catch (error) {
			response = {
				jsonrpc: "2.0",
				id,
				error: { code: -32601, message: error instanceof Error ? error.message : String(error) },
			};
		}
		await this.#write(response);
	}

	#write(message: unknown): Promise<void> {
		return this.#writer.write(this.#encoder.encode(`${JSON.stringify(message)}\n`));
	}

	/** Sends a request and resolves with the raw response (a JSON-RPC error is data, not a rejection). */
	request(method: string, params?: unknown): Promise<RawAcpResponse> {
		const id = this.#nextId++;
		this.#methodsById.set(id, method);
		const { promise, resolve, reject } = Promise.withResolvers<RawAcpResponse>();
		this.#pending.set(id, resolve);
		this.#write({ jsonrpc: "2.0", id, method, params }).catch(reject);
		return promise;
	}

	/** Sends one JSON-RPC batch array; resolves with every entry's response, all sharing the batch frame's `index`. */
	batch(entries: Array<{ method: string; params?: unknown }>): Promise<RawAcpResponse[]> {
		const requests = entries.map(entry => {
			const id = this.#nextId++;
			this.#methodsById.set(id, entry.method);
			const { promise, resolve } = Promise.withResolvers<RawAcpResponse>();
			this.#pending.set(id, resolve);
			return { promise, message: { jsonrpc: "2.0", id, method: entry.method, params: entry.params } };
		});
		const sent = this.#write(requests.map(request => request.message));
		return sent.then(() => Promise.all(requests.map(request => request.promise)));
	}

	/** Sends a request and returns its result; rejects when the agent answers with an error. */
	async call<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
		const response = await this.request(method, params);
		if (response.error) throw new Error(`${method} failed (${response.error.code}): ${response.error.message}`);
		return response.result as T;
	}

	notify(method: string, params?: unknown): Promise<void> {
		return this.#write({ jsonrpc: "2.0", method, params });
	}

	/** `session/update` notifications in wire order, optionally for one session. */
	updates(sessionId?: string): RawAcpUpdate[] {
		const out: RawAcpUpdate[] = [];
		this.frames.forEach((frame, index) => {
			if (frame.method !== "session/update" || !isRawFrame(frame.params)) return;
			const params = frame.params as { sessionId?: string; update?: Record<string, unknown> };
			if (!params.update || (sessionId !== undefined && params.sessionId !== sessionId)) return;
			out.push({ index, sessionId: params.sessionId ?? "", update: params.update });
		});
		return out;
	}

	/** `state_update` notifications in wire order. */
	states(sessionId?: string): RawAcpStateUpdate[] {
		return this.updates(sessionId)
			.filter(entry => entry.update.sessionUpdate === "state_update")
			.map(entry => {
				const update = entry.update as { state: string; stopReason?: string; error?: { message?: string } };
				return { index: entry.index, state: update.state, stopReason: update.stopReason, error: update.error };
			});
	}

	/** Agent-to-client requests (e.g. `session/request_permission`) in wire order. */
	agentRequests(): RawAcpFrame[] {
		return this.frames.filter(frame => typeof frame.method === "string" && "id" in frame);
	}

	/** Resolves once `predicate` holds over the recorded frames; rejects after `timeoutMs`. */
	async waitFor(predicate: (client: RawAcpClient) => boolean, description: string, timeoutMs = 5000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (!predicate(this)) {
			if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`);
			const turn = Promise.withResolvers<void>();
			this.#waiters.add(turn.resolve);
			setTimeout(turn.resolve, 5);
			await turn.promise;
			this.#waiters.delete(turn.resolve);
		}
	}

	/** Half-closes the connection: the agent sees end of input and shuts down. */
	async end(): Promise<void> {
		await Promise.allSettled([this.#writer.close()]);
	}
}

export interface V2Connection {
	client: RawAcpClient;
	agent: AcpAgent | undefined;
}

export interface V2WireHarness {
	/** Client of the current connection; replaced by {@link V2WireHarness.reconnect}. */
	client: RawAcpClient;
	root: string;
	cwd: string;
	agentDir: string;
	/** Sessions the default fake factory created (empty with a custom factory). */
	sessions: FakeAgentSession[];
	/** The agent behind the current connection. */
	agent(): AcpAgent | undefined;
	/** Tears the current connection down and opens a fresh one on the same roots and factory. */
	reconnect(): Promise<RawAcpClient>;
	close(): Promise<void>;
}

/**
 * Wires `createAcpConnection(..., { maxVersion })` to a {@link RawAcpClient} over in-memory NDJSON streams.
 * Without `factory`, sessions are {@link FakeAgentSession}s; pass a factory to drive a real `AgentSession`.
 */
export async function createV2WireHarness(
	options: {
		maxVersion?: 1 | 2;
		factory?: AcpSessionFactory;
		onRequest?: RawAcpRequestHandler;
		/** Validate frames against the v2 schema and record them for the suite-wide assertion; default true. */
		validate?: boolean;
	} = {},
): Promise<V2WireHarness> {
	const { cwdA } = await prepareHarnessRoots();
	const fake = options.factory ? undefined : createFakeSessionFactory(cwdA, false);
	const factory = options.factory ?? fake!.factory;
	const connections: Array<{ client: RawAcpClient; agent: () => AcpAgent | undefined; closed: Promise<void> }> = [];

	const harness: V2WireHarness = {
		client: undefined as unknown as RawAcpClient,
		root: path.dirname(cwdA),
		cwd: cwdA,
		agentDir: path.join(path.dirname(cwdA), "agent"),
		sessions: fake?.sessions ?? [],
		agent: () => connections.at(-1)?.agent(),
		reconnect: async () => {
			await closeCurrent();
			return connect(false);
		},
		close: async () => {
			await closeCurrent();
		},
	};

	async function closeCurrent(): Promise<void> {
		for (const connection of connections.splice(0)) {
			await connection.client.end();
			// Dispose below; nothing else holds the client.
			await Promise.allSettled([connection.agent()?.dispose(), connection.closed]);
		}
	}

	function connect(first: boolean): RawAcpClient {
		const clientToAgent = new TransformStream<Uint8Array, Uint8Array>();
		const agentToClient = new TransformStream<Uint8Array, Uint8Array>();
		let agent: AcpAgent | undefined;
		const serverConnection = createAcpConnection(
			ndJsonStream(agentToClient.writable, clientToAgent.readable),
			factory,
			first ? (fake?.initialSession as unknown as AgentSession | undefined) : undefined,
			created => {
				agent = created;
			},
			{ maxVersion: () => options.maxVersion ?? 2 },
		);
		const client = new RawAcpClient(clientToAgent.writable, agentToClient.readable, {
			validate: options.validate ?? true,
			onRequest: options.onRequest,
		});
		const closed = (async () => {
			await serverConnection.closed;
			// `ndJsonStream` takes a transient writer per frame; wait for the lock to clear before closing.
			for (let attempt = 0; attempt < 100 && agentToClient.writable.locked; attempt++) await eventLoopTurns(1);
			await Promise.allSettled([agentToClient.writable.close(), client.done]);
		})();
		connections.push({ client, agent: () => agent, closed });
		harness.client = client;
		return client;
	}

	connect(true);
	return harness;
}
