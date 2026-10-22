/**
 * Protocol-version seam of the ACP adapter. {@link AcpAgent} owns the session
 * core (records, goal actor, cancel cleanup, quiescence); an {@link AcpSurface}
 * owns everything that differs between ACP versions: when work is admitted and
 * how it is announced, what a foreground start/end/interaction means on the
 * wire, the update mapping, and the initialize/setup/permission/replay shapes.
 *
 * A surface never reaches into `AcpAgent` privates: it receives the session
 * record and an {@link AcpSurfaceHost} of explicit core operations.
 */
import type { AgentSideConnection } from "@oh-my-pi/pi-utils/acp";
import type {
	AuthMethod,
	ClientCapabilities,
	InitializeRequest,
	InitializeResponse,
	PromptRequest,
	PromptResponse,
	SessionConfigOption,
	SessionModeState,
	SessionNotification,
	v2,
} from "@oh-my-pi/pi-utils/acp";
import type { ExtensionUIContext } from "../../extensibility/extensions";
import type { MCPManager } from "../../mcp/manager";
import type { AgentSession, AgentSessionEvent } from "../../session/agent-session";
import type { BlobStore } from "../../session/blob-store";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import type { AcpEventMapperOptions } from "./acp-event-mapper";
import type { AcpGoalActor } from "./acp-goal";
import type { ForegroundWork, PromptTurnState } from "./acp-foreground";

export type AgentImageContent = {
	type: "image";
	data: string;
	mimeType: string;
};

export type PromptQueueState = {
	promise: Promise<void>;
	release: (() => void) | undefined;
};

export type PromptLifecycleError = Error & { readonly code: "ACP_SESSION_CLOSED" };

export type ManagedSessionRecord = {
	session: AgentSession;
	setToolUIContext: ((uiContext: ExtensionUIContext, hasUI: boolean) => void) | undefined;
	mcpManager: MCPManager | undefined;
	// Ordered queue of MCP tool refreshes for this record. Rebuilt per
	// `#configureMcpServers` call; drained on reconfigure so a stale in-flight
	// refresh can never land after a newer configuration's tools.
	mcpRefreshChain: Promise<void> | undefined;
	/** v1 pending-request half of the open prompt; `promptTurn.work` is the foreground work itself. */
	promptTurn: PromptTurnState | undefined;
	promptQueue: PromptQueueState;
	liveMessageId: string | undefined;
	liveMessageProgress: { textEmitted: boolean; thoughtEmitted: boolean } | undefined;
	toolArgsById: Map<string, unknown>;
	extensionsConfigured: boolean;
	// Installed inside `#scheduleBootstrapUpdates` (post-race-guard); released
	// in `#disposeSessionRecord`. Lives independent of any prompt turn.
	lifetimeUnsubscribe: (() => void) | undefined;
	closedError: PromptLifecycleError | undefined;
	/**
	 * In-flight prompt-event handlers and lifetime deliveries, keyed by a token
	 * per handler so the finishing `agent_end` handler can wait on every other
	 * handler without waiting on itself.
	 */
	promptEventHandlers: Map<symbol, Promise<void>>;
	extensionUserMessageTasks: Set<Promise<void>>;
	/** `_session/steering` calls still being admitted into the open prompt (image prep can await). */
	pendingSteers: number;
	/** Sole owner of goal and mode ownership state: generations, selection, reported mode, stale config. */
	goal: AcpGoalActor;
	/** Drops the goal observer subscribed before any prompt subscriber. */
	goalUnsubscribe: (() => void) | undefined;
	/**
	 * Builtin slash-command handlers running in this session right now, with
	 * the prompt each runs for and whether it was steered in. Handlers mutate
	 * shared session state (compaction, model, settings) and may ignore their
	 * prompt's abort; see #runBuiltin for who may start beside whom.
	 */
	runningBuiltins: Set<{ name: string; turn: PromptTurnState | undefined; steered: boolean; done: Promise<void> }>;
};

/** Why a foreground ended: the response it resolves with, or the failure it rejects with. */
export type ForegroundEnd = { response: PromptResponse } | { error: unknown };

export const INTELLIJ_CLIENT_PLATFORM = "intellij";

export type SessionSetupKind = "new" | "load" | "resume" | "fork";

/** Wire types a surface speaks. */
export interface AcpWire {
	clientCapabilities: object | undefined;
	initializeRequest: object;
	initializeResponse: object;
	authMethod: object;
	promptRequest: object;
	promptResponse: object;
	notification: object;
	/** Session-setup payload common to new/load/resume/fork; the core adds `sessionId` where the method returns one. */
	sessionSetup: object;
}

export interface AcpWireV1 extends AcpWire {
	clientCapabilities: ClientCapabilities | undefined;
	initializeRequest: InitializeRequest;
	initializeResponse: InitializeResponse;
	authMethod: AuthMethod;
	promptRequest: PromptRequest;
	promptResponse: PromptResponse;
	notification: SessionNotification;
	sessionSetup: { configOptions: SessionConfigOption[]; modes: SessionModeState };
}

export interface AcpWireV2 extends AcpWire {
	clientCapabilities: v2.ClientCapabilities | undefined;
	initializeRequest: v2.InitializeRequest;
	initializeResponse: v2.InitializeResponse;
	authMethod: v2.AuthMethod;
	promptRequest: v2.PromptRequest;
	promptResponse: v2.PromptResponse;
	notification: v2.SessionNotification;
	sessionSetup: { configOptions: v2.SessionConfigOption[]; availableCommands: v2.AvailableCommand[] };
}

/** Core operations a surface may call; implemented by `AcpAgent` over its private state. */
export interface AcpSurfaceHost {
	readonly connection: AgentSideConnection;
	readonly blobs: BlobStore;
	throwIfRecordClosed(record: ManagedSessionRecord): void;
	convertPromptBlocks(blocks: PromptRequest["prompt"]): { text: string; images: AgentImageContent[] };
	/** Hand a session event to the core's event pipeline (mapping, flush fallbacks, quiescence waiter). */
	trackForegroundEvent(record: ManagedSessionRecord, event: AgentSessionEvent): void;
	/** Run the prompt's own command or forward it to the session; resolves once the prompt is handed over. */
	runPromptOrCommand(record: ManagedSessionRecord, text: string, images: AgentImageContent[]): Promise<void>;
	/** Wait until every builtin steered into `turn` ran; see `AcpAgent##awaitSteeredBuiltins`. */
	awaitSteeredBuiltins(
		record: ManagedSessionRecord,
		turn: PromptTurnState | undefined,
		deferToWaiter: boolean,
	): Promise<boolean>;
	/** Idempotent cancel of `work`; the returned barrier is its cleanup. */
	beginCancelCleanup(record: ManagedSessionRecord, work: ForegroundWork): Promise<void>;
	closeSession(sessionId: string, record: ManagedSessionRecord): Promise<void>;
	buildConfigOptions(record: ManagedSessionRecord): SessionConfigOption[];
	buildModeState(record: ManagedSessionRecord): SessionModeState;
}

/** Per-version behaviour of the ACP adapter; one instance serves a connection. */
export interface AcpSurface<W extends AcpWire = AcpWire> {
	readonly version: 1 | 2;
	/** Builds the initialize response; the negotiated version's capabilities, info and auth methods. */
	initializeResponse(params: W["initializeRequest"]): W["initializeResponse"];
	/** Auth methods advertised for a client's capabilities; also the set `authenticate`/`auth/login` validate against. */
	authMethods(capabilities: W["clientCapabilities"]): W["authMethod"][];
	/** Version-shaped part of the new/load/resume/fork response (v2: no `modes`, plus `availableCommands`). */
	sessionSetupResponse(record: ManagedSessionRecord, kind: SessionSetupKind): W["sessionSetup"];
	/**
	 * Admits a client prompt: serialises it, creates its foreground work, and settles with the version's
	 * response (v1: at foreground end; v2: at insertion, only serialised until the previous outcome).
	 */
	admitPrompt(record: ManagedSessionRecord, request: W["promptRequest"]): Promise<W["promptResponse"]>;
	/** `work` begins. v1: installs the prompt-scoped subscription; v2: emits `running`. */
	onForegroundStart(record: ManagedSessionRecord, work: ForegroundWork): void;
	/** `work.pendingInteractions` went 0 → 1. v1: nothing; v2: `requires_action` when nothing else progresses. */
	onForegroundBlocked(record: ManagedSessionRecord, work: ForegroundWork): void;
	/** `work.pendingInteractions` went 1 → 0. v1: nothing; v2: `running` again. */
	onForegroundResumed(record: ManagedSessionRecord, work: ForegroundWork): void;
	/** `work` ended at the quiescence point, by failure, or by cancel. v1: settles the prompt; v2: `idle` with the stop reason. */
	onForegroundEnd(record: ManagedSessionRecord, work: ForegroundWork, end: ForegroundEnd): void;
	/** Gate read by `AgentSession`: may an agent-initiated turn start now? v1: an open prompt exists; v2: cancel latch clear. */
	allowsAgentInitiatedWork(record: ManagedSessionRecord): boolean;
	/** Maps one session event to client notifications. v2: renames tool/plan updates, drops mode updates, defines message ids. */
	mapUpdate(event: AgentSessionEvent, sessionId: string, options: AcpEventMapperOptions): W["notification"][];
	/** Asks the client to permit a tool call. v2: `title`/`subject` shape and strict `selected` handling. */
	permissionRequest(
		record: ManagedSessionRecord,
		sessionId: string,
		toolCall: ClientBridgePermissionToolCall,
		options: ClientBridgePermissionOption[],
		signal: AbortSignal | undefined,
	): Promise<ClientBridgePermissionOutcome>;
	/** Replays the transcript to the client. v2: `replayFrom` cursor handling, then the resume `state_update`. */
	replay(record: ManagedSessionRecord): Promise<void>;
}
