import type {
	Agent,
	AuthenticateRequest,
	AuthenticateResponse,
	CloseSessionRequest,
	CloseSessionResponse,
	CompleteElicitationNotification,
	CreateElicitationRequest,
	CreateElicitationResponse,
	CreateTerminalRequest,
	ForkSessionRequest,
	ForkSessionResponse,
	InitializeRequest,
	InitializeResponse,
	ListSessionsRequest,
	ListSessionsResponse,
	LoadSessionRequest,
	LoadSessionResponse,
	MaybePromise,
	NewSessionRequest,
	NewSessionResponse,
	PromptRequest,
	PromptResponse,
	ReadTextFileRequest,
	ReadTextFileResponse,
	RequestPermissionRequest,
	RequestPermissionResponse,
	ResumeSessionRequest,
	ResumeSessionResponse,
	SessionNotification,
	SetSessionConfigOptionRequest,
	SetSessionConfigOptionResponse,
	SetSessionModeRequest,
	SetSessionModeResponse,
	TerminalActionResponse,
	TerminalOutputResponse,
	WaitForTerminalExitResponse,
	WriteTextFileRequest,
	WriteTextFileResponse,
} from "./protocol";
import type { Stream } from "./stream";
import { RequestError, RpcConnection } from "./transport";
import type {
	AgentV2,
	CancelSessionNotification,
	CloseSessionRequest as V2CloseSessionRequest,
	CompleteElicitationNotification as V2CompleteElicitationNotification,
	CreateElicitationRequest as V2CreateElicitationRequest,
	CreateElicitationResponse as V2CreateElicitationResponse,
	DeleteSessionRequest,
	InitializeRequest as V2InitializeRequest,
	ListSessionsRequest as V2ListSessionsRequest,
	LoginAuthRequest,
	LogoutAuthRequest,
	NewSessionRequest as V2NewSessionRequest,
	PromptRequest as V2PromptRequest,
	RequestPermissionRequest as V2RequestPermissionRequest,
	RequestPermissionResponse as V2RequestPermissionResponse,
	ResumeSessionRequest as V2ResumeSessionRequest,
	SessionNotification as V2SessionNotification,
	SetSessionConfigOptionRequest as V2SetSessionConfigOptionRequest,
} from "./v2/protocol";

/** Terminal creation response returned by a client. */
export interface CreateTerminalResponse {
	terminalId: string;
}
/** Client callbacks handled by a client-side connection. */
export interface Client {
	/**
	 * Serve a permission elicit. `options.signal` aborts when the agent
	 * cancels the request (`$/cancel_request`) — e.g. user steering superseded
	 * the dialog — so a held handler can end instead of stranding the
	 * connection's clean-EOF drain.
	 */
	requestPermission(
		params: RequestPermissionRequest,
		options?: { signal?: AbortSignal },
	): MaybePromise<RequestPermissionResponse>;
	sessionUpdate(params: SessionNotification): MaybePromise<void>;
	readTextFile?(params: ReadTextFileRequest): MaybePromise<ReadTextFileResponse>;
	writeTextFile?(params: WriteTextFileRequest): MaybePromise<WriteTextFileResponse | void>;
	createTerminal?(params: CreateTerminalRequest): MaybePromise<CreateTerminalResponse>;
	terminalOutput?(params: { sessionId: string; terminalId: string }): MaybePromise<TerminalOutputResponse>;
	waitForTerminalExit?(params: { sessionId: string; terminalId: string }): MaybePromise<WaitForTerminalExitResponse>;
	killTerminal?(params: { sessionId: string; terminalId: string }): MaybePromise<TerminalActionResponse | void>;
	releaseTerminal?(params: { sessionId: string; terminalId: string }): MaybePromise<TerminalActionResponse | void>;
	unstable_createElicitation?(params: CreateElicitationRequest): MaybePromise<CreateElicitationResponse>;
	unstable_completeElicitation?(params: CompleteElicitationNotification): MaybePromise<void>;
	extMethod?(method: string, params: Record<string, unknown>): MaybePromise<Record<string, unknown>>;
	extNotification?(method: string, params: Record<string, unknown>): MaybePromise<void>;
}

/** Agent implementations offered to a negotiated {@link AgentSideConnection}. */
export interface AgentSurfaces {
	/** Protocol v1 handler; also serves every frame received before `initialize`. */
	v1: Agent;
	/** Protocol v2 handler; absent means the connection always negotiates v1. */
	v2?: AgentV2;
	/** Highest protocol version this process is willing to negotiate right now. */
	maxVersion(): 1 | 2;
}

/** Agent-side ACP connection. */
export class AgentSideConnection {
	#connection: RpcConnection;
	#v2: AgentSideConnectionV2;
	#surfaces: AgentSurfaces | undefined;
	#initialized = false;
	#selected: 1 | 2 | undefined;

	constructor(toAgent: (connection: AgentSideConnection) => AgentSurfaces, stream: Stream) {
		this.#connection = new RpcConnection(stream, (method, params, notification) =>
			this.#dispatch(method, params, notification),
		);
		this.#v2 = new AgentSideConnectionV2(this.#connection);
		this.#surfaces = toAgent(this);
	}

	async #dispatch(method: string, params: unknown, notification: boolean): Promise<unknown> {
		const surfaces = this.#surfaces;
		if (!surfaces) throw RequestError.internalError(undefined, "Agent is not initialized");
		if (method === "initialize" && !notification) return this.#initialize(surfaces, params);
		if (this.#selected === 2 && surfaces.v2) return dispatchAgentV2(surfaces.v2, method, params, notification);
		return dispatchAgentV1(surfaces.v1, method, params, notification);
	}

	async #initialize(surfaces: AgentSurfaces, params: unknown): Promise<unknown> {
		const requested = (params as { protocolVersion?: unknown } | null | undefined)?.protocolVersion;
		if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 1) {
			throw RequestError.invalidParams(undefined, "initialize requires an integer protocolVersion >= 1");
		}
		if (this.#initialized) throw RequestError.invalidRequest(undefined, "Connection is already initialized");
		const selected: 1 | 2 = surfaces.v2 && Math.min(requested, surfaces.maxVersion()) >= 2 ? 2 : 1;
		this.#initialized = true;
		this.#selected = selected;
		try {
			if (selected === 2 && surfaces.v2) return await surfaces.v2.initialize(params as V2InitializeRequest);
			return await surfaces.v1.initialize(params as InitializeRequest);
		} catch (error) {
			// A failed handshake leaves the connection uninitialized so the client may retry.
			this.#initialized = false;
			this.#selected = undefined;
			throw error;
		}
	}

	/** Protocol v2 client-direction view of this connection. */
	get v2(): AgentSideConnectionV2 {
		return this.#v2;
	}

	/** Signal aborted when the transport closes. */
	get signal(): AbortSignal {
		return this.#connection.signal;
	}
	/** Promise resolved when the transport closes. */
	get closed(): Promise<void> {
		return this.#connection.closed;
	}
	/** Sends a session update notification. */
	sessionUpdate(params: SessionNotification): Promise<void> {
		return this.#connection.notify("session/update", params);
	}
	/** Requests permission from the client. */
	requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
		return this.#connection.request("session/request_permission", params);
	}
	/**
	 * Requests permission from the client, returning a handle that cancels the
	 * pending wire request (`$/cancel_request`) — used when user steering
	 * supersedes an open permission dialog instead of waiting behind it.
	 */
	requestPermissionWithCancel(params: RequestPermissionRequest): {
		promise: Promise<RequestPermissionResponse>;
		cancel(): void;
	} {
		return this.#connection.requestCancellable<RequestPermissionResponse>("session/request_permission", params);
	}
	/** Reads a client-side text file. */
	readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
		return this.#connection.request("fs/read_text_file", params);
	}
	/** Writes a client-side text file. */
	writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
		return this.#connection.request("fs/write_text_file", params);
	}
	/** Creates a client terminal and returns its control handle. */
	async createTerminal(params: CreateTerminalRequest): Promise<TerminalHandle> {
		const response = await this.#connection.request<CreateTerminalResponse>("terminal/create", params);
		return new TerminalHandle(response.terminalId, params.sessionId, this.#connection);
	}
	/** Creates an interactive elicitation on the client. */
	unstable_createElicitation(params: CreateElicitationRequest): Promise<CreateElicitationResponse> {
		return this.#connection.request("elicitation/create", params);
	}
	/** Notifies a client that URL elicitation completed. */
	unstable_completeElicitation(params: CompleteElicitationNotification): Promise<void> {
		return this.#connection.notify("elicitation/complete", params);
	}
	/** Sends a custom request. */
	request<Response = unknown, Params = unknown>(method: string, params?: Params): Promise<Response> {
		return this.#connection.request(method, params);
	}
	/** Sends a custom notification. */
	notify<Params = unknown>(method: string, params?: Params): Promise<void> {
		return this.#connection.notify(method, params);
	}
	/** Sends a legacy extension request. */
	extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.request(method, params);
	}
	/** Sends a legacy extension notification. */
	extNotification(method: string, params: Record<string, unknown>): Promise<void> {
		return this.notify(method, params);
	}
}

/** Protocol v2 client-direction view of an agent-side connection. */
export class AgentSideConnectionV2 {
	#connection: RpcConnection;

	constructor(connection: RpcConnection) {
		this.#connection = connection;
	}

	/** Signal aborted when the transport closes. */
	get signal(): AbortSignal {
		return this.#connection.signal;
	}
	/** Promise resolved when the transport closes. */
	get closed(): Promise<void> {
		return this.#connection.closed;
	}
	/** Sends a v2 session update notification. */
	sessionUpdate(params: V2SessionNotification): Promise<void> {
		return this.#connection.notify("session/update", params);
	}
	/** Requests permission from the client. */
	requestPermission(params: V2RequestPermissionRequest): Promise<V2RequestPermissionResponse> {
		return this.#connection.request("session/request_permission", params);
	}
	/** Creates an interactive elicitation on the client. */
	createElicitation(params: V2CreateElicitationRequest): Promise<V2CreateElicitationResponse> {
		return this.#connection.request("elicitation/create", params);
	}
	/** Notifies the client that URL elicitation completed. */
	completeElicitation(params: V2CompleteElicitationNotification): Promise<void> {
		return this.#connection.notify("elicitation/complete", params);
	}
	/** Sends a custom request. */
	request<Response = unknown, Params = unknown>(method: string, params?: Params): Promise<Response> {
		return this.#connection.request(method, params);
	}
	/** Sends a custom notification. */
	notify<Params = unknown>(method: string, params?: Params): Promise<void> {
		return this.#connection.notify(method, params);
	}
}

/** Handle for controlling a client-owned terminal. */
export class TerminalHandle {
	/** Client terminal identifier. */
	readonly id: string;
	#sessionId: string;
	#connection: RpcConnection;

	constructor(id: string, sessionId: string, connection: RpcConnection) {
		this.id = id;
		this.#sessionId = sessionId;
		this.#connection = connection;
	}
	/** Gets current terminal output. */
	currentOutput(): Promise<TerminalOutputResponse> {
		return this.#connection.request("terminal/output", { sessionId: this.#sessionId, terminalId: this.id });
	}
	/** Waits for terminal exit. */
	waitForExit(): Promise<WaitForTerminalExitResponse> {
		return this.#connection.request("terminal/wait_for_exit", { sessionId: this.#sessionId, terminalId: this.id });
	}
	/** Kills the terminal. */
	kill(): Promise<TerminalActionResponse> {
		return this.#connection.request("terminal/kill", { sessionId: this.#sessionId, terminalId: this.id });
	}
	/** Releases the terminal. */
	release(): Promise<TerminalActionResponse | void> {
		return this.#connection.request("terminal/release", { sessionId: this.#sessionId, terminalId: this.id });
	}
	/** Releases the terminal during async disposal. */
	async [Symbol.asyncDispose](): Promise<void> {
		await this.release();
	}
}

/** Client-side ACP connection used to call an agent. */
export class ClientSideConnection {
	#connection: RpcConnection;

	constructor(toClient: (connection: ClientSideConnection) => Client, stream: Stream) {
		// Client handlers receive the cancel signal (`requestPermission`'s
		// `options.signal`), so a peer `$/cancel_request` may answer `-32800`
		// at once. The agent side keeps the default: its handlers ignore the
		// signal, and `session/cancel` is ACP's cancellation path for prompts.
		this.#connection = new RpcConnection(
			stream,
			async (method, params, notification, signal) => {
				if (!client) throw RequestError.internalError(undefined, "Client is not initialized");
				return dispatchClient(client, method, params, notification, signal);
			},
			{ honorsInboundCancellation: true },
		);
		const client = toClient(this);
	}
	/** Signal aborted when the transport closes. */
	get signal(): AbortSignal {
		return this.#connection.signal;
	}
	/** Promise resolved when the transport closes. */
	get closed(): Promise<void> {
		return this.#connection.closed;
	}
	/** Initializes protocol capabilities. */
	initialize(params: InitializeRequest): Promise<InitializeResponse> {
		return this.#connection.request("initialize", params);
	}
	/** Authenticates with an agent. */
	authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse> {
		return this.#connection.request("authenticate", params);
	}
	/** Creates a session. */
	newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
		return this.#connection.request("session/new", params);
	}
	/** Loads a session. */
	loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
		return this.#connection.request("session/load", params);
	}
	/** Lists sessions. */
	listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
		return this.#connection.request("session/list", params);
	}
	/** Resumes a session. */
	resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse> {
		return this.#connection.request("session/resume", params);
	}
	/** Forks a session. */
	unstable_forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse> {
		return this.#connection.request("session/fork", params);
	}
	/** Closes a session. */
	closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse> {
		return this.#connection.request("session/close", params);
	}
	/** Sets a session mode. */
	setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
		return this.#connection.request("session/set_mode", params);
	}
	/** Sets a session config option. */
	setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse> {
		return this.#connection.request("session/set_config_option", params);
	}
	/** Sends a prompt. */
	prompt(params: PromptRequest): Promise<PromptResponse> {
		return this.#connection.request("session/prompt", params);
	}
	/** Cancels an active prompt. */
	cancel(params: { sessionId: string }): Promise<void> {
		return this.#connection.notify("session/cancel", params);
	}
}

async function dispatchAgentV1(agent: Agent, method: string, params: unknown, notification: boolean): Promise<unknown> {
	switch (method) {
		case "initialize":
			return agent.initialize(params as InitializeRequest);
		case "authenticate":
			return invokeRequired(agent, agent.authenticate, method, params as AuthenticateRequest);
		case "session/new":
			return agent.newSession(params as NewSessionRequest);
		case "session/load":
			return invokeRequired(agent, agent.loadSession, method, params as LoadSessionRequest);
		case "session/list":
			return invokeRequired(agent, agent.listSessions, method, params as ListSessionsRequest);
		case "session/resume":
			return invokeRequired(agent, agent.resumeSession, method, params as ResumeSessionRequest);
		case "session/fork":
			return invokeRequired(agent, agent.unstable_forkSession, method, params as ForkSessionRequest);
		case "session/close":
			return invokeRequired(agent, agent.closeSession, method, params as CloseSessionRequest);
		case "session/set_mode":
			return invokeRequired(agent, agent.setSessionMode, method, params as SetSessionModeRequest);
		case "session/set_config_option":
			return invokeRequired(agent, agent.setSessionConfigOption, method, params as SetSessionConfigOptionRequest);
		case "session/prompt":
			return agent.prompt(params as PromptRequest);
		case "session/cancel":
			return agent.cancel(params as { sessionId: string });
		default:
			if (method === "$/cancel_request") return;
			if (notification && agent.extNotification)
				return agent.extNotification(method, params as Record<string, unknown>);
			if (!notification && agent.extMethod) return agent.extMethod(method, params as Record<string, unknown>);
			throw RequestError.methodNotFound(method);
	}
}

async function dispatchAgentV2(
	agent: AgentV2,
	method: string,
	params: unknown,
	notification: boolean,
): Promise<unknown> {
	switch (method) {
		case "auth/login":
			return invokeRequired(agent, agent.login, method, params as LoginAuthRequest);
		case "auth/logout":
			return invokeRequired(agent, agent.logout, method, params as LogoutAuthRequest);
		case "session/new":
			return agent.newSession(params as V2NewSessionRequest);
		case "session/list":
			return invokeRequired(agent, agent.listSessions, method, params as V2ListSessionsRequest);
		case "session/delete":
			return invokeRequired(agent, agent.deleteSession, method, params as DeleteSessionRequest);
		case "session/resume":
			return invokeRequired(agent, agent.resumeSession, method, params as V2ResumeSessionRequest);
		case "session/close":
			return invokeRequired(agent, agent.closeSession, method, params as V2CloseSessionRequest);
		case "session/set_config_option":
			return invokeRequired(agent, agent.setSessionConfigOption, method, params as V2SetSessionConfigOptionRequest);
		case "session/prompt":
			return agent.prompt(params as V2PromptRequest);
		case "session/cancel":
			return agent.cancel(params as CancelSessionNotification);
		default:
			if (method === "$/cancel_request") return;
			if (notification && agent.extNotification)
				return agent.extNotification(method, params as Record<string, unknown>);
			if (!notification && agent.extMethod) return agent.extMethod(method, params as Record<string, unknown>);
			throw RequestError.methodNotFound(method);
	}
}

async function dispatchClient(
	client: Client,
	method: string,
	params: unknown,
	notification: boolean,
	signal?: AbortSignal,
): Promise<unknown> {
	switch (method) {
		case "session/request_permission":
			return client.requestPermission(params as RequestPermissionRequest, { signal });
		case "session/update":
			return client.sessionUpdate(params as SessionNotification);
		case "fs/read_text_file":
			return invokeRequired(client, client.readTextFile, method, params as ReadTextFileRequest);
		case "fs/write_text_file":
			return invokeRequired(client, client.writeTextFile, method, params as WriteTextFileRequest);
		case "terminal/create":
			return invokeRequired(client, client.createTerminal, method, params as CreateTerminalRequest);
		case "terminal/output":
			return invokeRequired(
				client,
				client.terminalOutput,
				method,
				params as { sessionId: string; terminalId: string },
			);
		case "terminal/wait_for_exit":
			return invokeRequired(
				client,
				client.waitForTerminalExit,
				method,
				params as { sessionId: string; terminalId: string },
			);
		case "terminal/kill":
			return invokeRequired(
				client,
				client.killTerminal,
				method,
				params as { sessionId: string; terminalId: string },
			);
		case "terminal/release":
			return invokeRequired(
				client,
				client.releaseTerminal,
				method,
				params as { sessionId: string; terminalId: string },
			);
		case "elicitation/create":
			return invokeRequired(client, client.unstable_createElicitation, method, params as CreateElicitationRequest);
		case "elicitation/complete":
			return invokeRequired(
				client,
				client.unstable_completeElicitation,
				method,
				params as CompleteElicitationNotification,
			);
		default:
			// The transport already aborted the matching inbound handler;
			// like the agent side, the notification itself carries no work.
			if (method === "$/cancel_request") return;
			if (notification && client.extNotification)
				return client.extNotification(method, params as Record<string, unknown>);
			if (!notification && client.extMethod) return client.extMethod(method, params as Record<string, unknown>);
			throw RequestError.methodNotFound(method);
	}
}

function invokeRequired<Params, Response>(
	receiver: Agent | AgentV2 | Client,
	handler: ((params: Params) => MaybePromise<Response>) | undefined,
	method: string,
	params: Params,
): MaybePromise<Response> {
	if (!handler) throw RequestError.methodNotFound(method);
	return handler.call(receiver, params);
}
