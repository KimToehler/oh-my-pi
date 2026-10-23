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
import type {
	AgentSideConnection,
	AuthMethod,
	AvailableCommand,
	ClientCapabilities,
	InitializeRequest,
	InitializeResponse,
	MaybePromise,
	PromptRequest,
	PromptResponse,
	SessionConfigOption,
	SessionModeState,
	SessionNotification,
	v2,
	CreateElicitationResponse,
	ElicitationPropertySchema,
} from "@oh-my-pi/pi-utils/acp";
import type { ExtensionUIContext } from "../../extensibility/extensions";
import type { MCPManager } from "../../mcp/manager";
import type { AgentSession, AgentSessionEvent } from "../../session/agent-session";
import type { SubmissionOutcome } from "../../session/agent-session-types";
import type { BlobStore } from "../../session/blob-store";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import type { AcpEventMapperOptions } from "./acp-event-mapper";
import type { AcpGoalActor } from "./acp-goal";
import type { ForegroundOrigin, ForegroundWork, PromptTurnState } from "./acp-foreground";

/** One form-mode elicitation: a property schema the client renders and answers. */
export type FormElicitation = {
	sessionId: string;
	message: string;
	properties: Record<string, ElicitationPropertySchema>;
	required: string[] | undefined;
};

/** Sends a form elicitation over the connection's protocol version. */
export type FormElicitationTransport = (request: FormElicitation) => Promise<CreateElicitationResponse>;

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
	/** v2 foreground work (a prompt's or an autonomous turn's); v1 leaves it unset and uses `promptTurn.work`. */
	foreground: ForegroundWork | undefined;
	/** v2: a client cancel is latched until the next prompt insertion; agent-initiated work is refused meanwhile. */
	cancelLatched: boolean;
	/** v2: last `state_update` sent, so identical consecutive states are suppressed. Unused by v1. */
	lastEmittedState: v2.StateUpdate["state"] | undefined;
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
	/** Subscription the surface installed at registration (v2: session-lifetime foreground tracking); dropped at dispose. */
	surfaceUnsubscribe: (() => void) | undefined;
	/**
	 * Builtin slash-command handlers running in this session right now, with
	 * the prompt each runs for and whether it was steered in. Handlers mutate
	 * shared session state (compaction, model, settings) and may ignore their
	 * prompt's abort; see #runBuiltin for who may start beside whom.
	 */
	runningBuiltins: Set<{ name: string; work: ForegroundWork | undefined; steered: boolean; done: Promise<void> }>;
};

/** Why a foreground ended: the response it resolves with, or the failure it rejects with. */
export type ForegroundEnd = { response: PromptResponse } | { error: unknown };

export const INTELLIJ_CLIENT_PLATFORM = "intellij";

export type SessionSetupKind = "new" | "load" | "resume" | "fork";

/** What a notification was derived from; lets a surface give chunks stable message identities. */
export type AcpEmitSource = { message?: unknown };

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
	/**
	 * Run the prompt's own command or forward it to the session; resolves once the prompt is handed over.
	 * `ownsForeground` false: the prompt was steered into foreground work that is not its own, so a locally
	 * handled prompt must not end that work. `onSubmissionOutcome` reports exactly one outcome (a skill or
	 * ACP builtin reports `command` before it runs).
	 */
	runPromptOrCommand(
		record: ManagedSessionRecord,
		text: string,
		images: AgentImageContent[],
		options?: { ownsForeground?: boolean; onSubmissionOutcome?: (outcome: SubmissionOutcome) => void },
	): Promise<void>;
	/** Wait until every builtin steered into `work` ran; see `AcpAgent##awaitSteeredBuiltins`. */
	awaitSteeredBuiltins(
		record: ManagedSessionRecord,
		work: ForegroundWork | undefined,
		deferToWaiter: boolean,
	): Promise<boolean>;
	/** The session record for `sessionId`, if it is registered. */
	recordFor(sessionId: string): ManagedSessionRecord | undefined;
	/** Slash-command palette in the v1 spelling. */
	buildAvailableCommands(record: ManagedSessionRecord): Promise<AvailableCommand[]>;
	/** Resolves once the update handlers in flight right now have delivered. */
	waitForUpdateDeliveries(record: ManagedSessionRecord): Promise<void>;
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
	sessionSetupResponse(record: ManagedSessionRecord, kind: SessionSetupKind): MaybePromise<W["sessionSetup"]>;
	/** Ids `authenticate`/`auth/login` validate a method id against. */
	validAuthMethodIds(capabilities: W["clientCapabilities"]): string[];
	/** A client cancel is about to abort `activeWork`. v2: latch the cancel and withdraw queued steers. */
	beforeCancel(record: ManagedSessionRecord): void;
	/** Asks the client a form elicitation for `request.sessionId`. v1: `elicitation/create` (unstable); v2: the v2-shaped request. */
	elicitForm: FormElicitationTransport;
	/**
	 * Whether owner-scoped background jobs hold a foreground open. v1: yes, their wake turns stream into the open
	 * prompt; v2: no, the foreground ends and a later wake is its own agent-initiated foreground.
	 */
	readonly holdsForegroundForBackgroundWork: boolean;
	/** The work a close or fork must wait out, if any. */
	inFlightWork(record: ManagedSessionRecord): ForegroundWork | undefined;
	/** Installs the subscription that lives as long as the record; returns its unsubscribe. */
	subscribe(record: ManagedSessionRecord): (() => void) | undefined;
	/**
	 * Admits a client prompt: serialises it, creates its foreground work, and settles with the version's
	 * response (v1: at foreground end; v2: at insertion, only serialised until the previous outcome).
	 */
	admitPrompt(record: ManagedSessionRecord, request: W["promptRequest"]): Promise<W["promptResponse"]>;
	/** `work` begins. v1: installs the prompt-scoped subscription; v2: emits `running`. */
	onForegroundStart(record: ManagedSessionRecord, work: ForegroundWork): void;
	/** `work.pendingInteractions` changed (one interaction opened or closed). v1: nothing; v2: re-evaluates the aggregate state. */
	onInteractionChanged(record: ManagedSessionRecord, work: ForegroundWork): void;
	/** `work` ended at the quiescence point, by failure, or by cancel. v1: settles the prompt; v2: `idle` with the stop reason. */
	onForegroundEnd(record: ManagedSessionRecord, work: ForegroundWork, end: ForegroundEnd): void;
	/** Gate read by `AgentSession`: may an agent-initiated turn start now? v1: an open prompt exists; v2: cancel latch clear. */
	allowsAgentInitiatedWork(record: ManagedSessionRecord): boolean;
	/**
	 * May a handler still running for `work` send foreground content? v1: always (the prompt response, not a frame,
	 * ends a v1 turn); v2: only while `work` is the foreground, so its terminal `idle` stays its last content frame.
	 * Callers check right before each send: the check and the enqueue must not be separated by an await.
	 */
	acceptsUpdates(record: ManagedSessionRecord, work: ForegroundWork): boolean;
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
	replay(record: ManagedSessionRecord, replayFrom?: unknown): Promise<void>;
	/**
	 * The one funnel for core-built notifications. The core always builds the v1 shape; v1 sends it verbatim,
	 * v2 converts it (`source.message` identifies the transcript message behind a chunk) and drops what has no v2 equivalent.
	 */
	emit(sessionId: string, notification: SessionNotification, source?: AcpEmitSource): Promise<void>;
	/** Sends a notification `mapUpdate` returned, already in this surface's wire type. */
	sendMapped(notification: W["notification"]): Promise<void>;
	/** The foreground work currently owning `record`'s turns, if any. v1: the unsettled prompt's work; v2: `record.foreground`. */
	activeWork(record: ManagedSessionRecord): ForegroundWork | undefined;
	/**
	 * An `agent_start` arrived with no active work. v2: creates the work, sets `record.foreground` and announces `running`;
	 * v1: `undefined` (turns outside an open prompt are not streamed).
	 */
	beginForeground(record: ManagedSessionRecord, origin: ForegroundOrigin): ForegroundWork | undefined;
}
