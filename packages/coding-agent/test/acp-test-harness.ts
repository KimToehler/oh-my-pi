import { expect, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { resetSettingsForTest, Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import type { ExtensionUIContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { createAcpConnection } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-mode";
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
	SessionNotification,
	Validator,
} from "@oh-my-pi/pi-utils/acp";
import { type Client, ClientSideConnection, ndJsonStream, zSessionNotification } from "@oh-my-pi/pi-utils/acp";

import { type GoalOwnerStamp, GoalRuntime } from "@oh-my-pi/pi-coding-agent/goals/runtime";
import type { GoalModeState, GoalRuntimeEvent } from "@oh-my-pi/pi-coding-agent/goals/state";

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

	/** The v1 open-prompt gate as the real session reads it: through the client bridge callback. */
	get acpPromptOpen(): boolean {
		return this.clientBridge?.allowAgentInitiatedTurns?.() ?? true;
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

function createFakeSessionFactory(cwdA: string, extensionRunners: boolean | undefined): FakeSessionFactoryState {
	const sessions: FakeAgentSession[] = [];
	const setToolUIContextSpies: SetToolUIContextSpy[] = [];
	const sessionFactoryOptions: Array<{ interactivePrompts?: boolean } | undefined> = [];
	const initialSession = new FakeAgentSession(cwdA);
	sessions.push(initialSession);
	const factory = async (cwd: string, factoryOptions?: { interactivePrompts?: boolean }) => {
		const session = new FakeAgentSession(cwd);
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
		signal: abortController.signal,
		closed: Promise.withResolvers<void>().promise,
	} as unknown as AgentSideConnection;

	const { sessions, setToolUIContextSpies, sessionFactoryOptions, initialSession, factory } = createFakeSessionFactory(
		cwdA,
		options.extensionRunners,
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
