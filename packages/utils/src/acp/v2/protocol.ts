/**
 * Hand-written ACP protocol v2 (baseline surface) types, derived from the vendored
 * v2 JSON schema (`packages/coding-agent/test/fixtures/acp-v2-schema.json`).
 *
 * Open unions in the schema (unknown discriminators are tolerated on the wire) are
 * modelled here as the known variants only; receivers must ignore unknown variants.
 */
import type { MaybePromise, Meta } from "../protocol";

/** ACP protocol version implemented by this module. */
export const PROTOCOL_VERSION_V2 = 2;

export type SessionId = string;
export type MessageId = string;
export type ToolCallId = string;
export type TerminalId = string;
export type AuthMethodId = string;
export type PermissionOptionId = string;
export type SessionConfigId = string;
export type SessionConfigValueId = string;
export type ElicitationId = string;
export type PlanId = string;
export type CompactionId = string;
export type SessionListCursor = string;
/** Absolute filesystem path. */
export type AbsolutePath = string;
/** JSON-RPC request identifier. */
export type RequestId = string | number | null;

export type ToolKind =
	| "read"
	| "edit"
	| "delete"
	| "move"
	| "search"
	| "execute"
	| "think"
	| "fetch"
	| "switch_mode"
	| "other";
export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
export type PermissionOptionKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";
export type PlanEntryPriority = "high" | "medium" | "low";
export type PlanEntryStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type CompactionStatus = "in_progress" | "completed" | "failed" | "cancelled";
export type NoticeSeverity = "info" | "warning" | "error";

export interface Annotations extends Meta {
	audience?: string[] | null;
	lastModified?: string | null;
	priority?: number | null;
}
export interface TextContent extends Meta {
	type: "text";
	text: string;
	annotations?: Annotations | null;
}
export interface ImageContent extends Meta {
	type: "image";
	data: string;
	mimeType: string;
	uri?: string | null;
	annotations?: Annotations | null;
}
export interface AudioContent extends Meta {
	type: "audio";
	data: string;
	mimeType: string;
	annotations?: Annotations | null;
}
export interface Icon {
	src: string;
	mimeType?: string | null;
	sizes?: string[] | null;
	theme?: "light" | "dark" | null;
}
export interface ResourceLink extends Meta {
	type: "resource_link";
	name: string;
	uri: string;
	title?: string | null;
	description?: string | null;
	icons?: Icon[] | null;
	mimeType?: string | null;
	size?: number | null;
	annotations?: Annotations | null;
}
export interface TextResourceContents extends Meta {
	text: string;
	uri: string;
	mimeType?: string | null;
}
export interface BlobResourceContents extends Meta {
	blob: string;
	uri: string;
	mimeType?: string | null;
}
export interface EmbeddedResource extends Meta {
	type: "resource";
	resource: TextResourceContents | BlobResourceContents;
	annotations?: Annotations | null;
}
export type ContentBlock = TextContent | ImageContent | AudioContent | ResourceLink | EmbeddedResource;

export interface Implementation extends Meta {
	name: string;
	title?: string | null;
	version: string;
}
export interface EnvVariable extends Meta {
	name: string;
	value: string;
}
export interface HttpHeader extends Meta {
	name: string;
	value: string;
}
export interface McpServerHttp extends Meta {
	type: "http";
	name: string;
	url: string;
	headers?: HttpHeader[];
}
export interface McpServerStdio extends Meta {
	name: string;
	command: AbsolutePath;
	args?: string[];
	env?: EnvVariable[];
}
export type McpServer = McpServerHttp | McpServerStdio;

// Capabilities
export interface TerminalAuthCapabilities extends Meta {}
export interface AuthCapabilities extends Meta {
	terminal?: TerminalAuthCapabilities | null;
}
export interface ElicitationFormCapabilities extends Meta {}
export interface ElicitationUrlCapabilities extends Meta {}
export interface ElicitationCapabilities extends Meta {
	form?: ElicitationFormCapabilities | null;
	url?: ElicitationUrlCapabilities | null;
}
export interface ClientCapabilities extends Meta {
	auth?: AuthCapabilities | null;
	elicitation?: ElicitationCapabilities | null;
}
export interface AgentAuthCapabilities extends Meta {}
export interface PromptCapabilities extends Meta {
	image?: Meta | null;
	audio?: Meta | null;
	embeddedContext?: Meta | null;
}
export interface McpCapabilities extends Meta {
	stdio?: Meta | null;
	http?: Meta | null;
}
export interface SessionCapabilities extends Meta {
	prompt?: PromptCapabilities | null;
	mcp?: McpCapabilities | null;
	delete?: Meta | null;
	additionalDirectories?: Meta | null;
}
export interface AgentCapabilities extends Meta {
	session?: SessionCapabilities | null;
	auth?: AgentAuthCapabilities | null;
}

export interface AuthMethodAgent extends Meta {
	type: "agent";
	methodId: AuthMethodId;
	name: string;
	description?: string | null;
}
export interface AuthMethodTerminal extends Meta {
	type: "terminal";
	methodId: AuthMethodId;
	name: string;
	description?: string | null;
	args?: string[];
	env?: EnvVariable[];
}
export type AuthMethod = AuthMethodAgent | AuthMethodTerminal;

// Session config
export interface SessionConfigSelectOption extends Meta {
	value: SessionConfigValueId;
	name: string;
	description?: string | null;
}
export interface SessionConfigSelectGroup extends Meta {
	groupId: string;
	name: string;
	options: SessionConfigSelectOption[];
}
export type SessionConfigOptionCategory = "mode" | "model" | "model_config" | "thought_level" | (string & {});
interface SessionConfigOptionBase extends Meta {
	configId: SessionConfigId;
	name: string;
	category?: SessionConfigOptionCategory | null;
}
export interface SessionConfigSelect extends SessionConfigOptionBase {
	type: "select";
	currentValue: SessionConfigValueId;
	options: SessionConfigSelectOption[] | SessionConfigSelectGroup[];
}
export interface SessionConfigBoolean extends SessionConfigOptionBase {
	type: "boolean";
	currentValue: boolean;
}
export type SessionConfigOption = SessionConfigSelect | SessionConfigBoolean;

export interface TextCommandInput extends Meta {
	type: "text";
	hint: string;
}
export interface AvailableCommand extends Meta {
	name: string;
	description: string;
	input?: TextCommandInput | null;
}

// Agent methods: requests and responses
export interface InitializeRequest extends Meta {
	protocolVersion: number;
	info: Implementation;
	capabilities?: ClientCapabilities;
}
export interface InitializeResponse extends Meta {
	protocolVersion: number;
	info: Implementation;
	capabilities?: AgentCapabilities;
	authMethods?: AuthMethod[];
}
export interface LoginAuthRequest extends Meta {
	methodId: AuthMethodId;
}
export interface LoginAuthResponse extends Meta {}
export interface LogoutAuthRequest extends Meta {}
export interface LogoutAuthResponse extends Meta {}
export interface NewSessionRequest extends Meta {
	cwd: AbsolutePath;
	additionalDirectories?: AbsolutePath[];
	mcpServers?: McpServer[];
}
export interface NewSessionResponse extends Meta {
	sessionId: SessionId;
	configOptions?: SessionConfigOption[];
	availableCommands?: AvailableCommand[];
}
export interface SessionInfo extends Meta {
	sessionId: SessionId;
	cwd: AbsolutePath;
	additionalDirectories?: AbsolutePath[];
	title?: string | null;
	updatedAt?: string | null;
}
export interface ListSessionsRequest extends Meta {
	cwd?: AbsolutePath | null;
	cursor?: SessionListCursor | null;
}
export interface ListSessionsResponse extends Meta {
	sessions: SessionInfo[];
	nextCursor?: SessionListCursor | null;
}
export interface DeleteSessionRequest extends Meta {
	sessionId: SessionId;
}
export interface DeleteSessionResponse extends Meta {}
/** Replay the full history from the start of the session. */
export interface ReplayFromStart extends Meta {
	type: "start";
}
/** Custom (non-`start`) replay position; its shape is defined by the agent. */
export interface ReplayFromCustom extends Meta {
	type: string;
	[key: string]: unknown;
}
export type ReplayFrom = ReplayFromStart | ReplayFromCustom;
export interface ResumeSessionRequest extends Meta {
	sessionId: SessionId;
	cwd: AbsolutePath;
	additionalDirectories?: AbsolutePath[];
	mcpServers?: McpServer[];
	replayFrom?: ReplayFrom | null;
}
export interface ResumeSessionResponse extends Meta {
	configOptions?: SessionConfigOption[];
	availableCommands?: AvailableCommand[];
}
export interface CloseSessionRequest extends Meta {
	sessionId: SessionId;
}
export interface CloseSessionResponse extends Meta {}
export type SetSessionConfigOptionRequest = Meta & {
	sessionId: SessionId;
	configId: SessionConfigId;
} & ({ type: "id"; value: SessionConfigValueId } | { type: "boolean"; value: boolean });
export interface SetSessionConfigOptionResponse extends Meta {
	configOptions: SessionConfigOption[];
}
export interface PromptRequest extends Meta {
	sessionId: SessionId;
	prompt: ContentBlock[];
}
export interface PromptResponse extends Meta {
	messageId: MessageId;
}
/** `session/cancel` notification. */
export interface CancelSessionNotification extends Meta {
	sessionId: SessionId;
}
/** `$/cancel_request` notification. */
export interface CancelRequestNotification extends Meta {
	requestId: RequestId;
}

// Session updates
export interface ContentChunk extends Meta {
	messageId: MessageId;
	content: ContentBlock;
}
export interface UserMessage extends Meta {
	messageId: MessageId;
	content?: ContentBlock[] | null;
}
export interface AgentMessage extends Meta {
	messageId: MessageId;
	content?: ContentBlock[] | null;
}
export interface AgentThought extends Meta {
	messageId: MessageId;
	content?: ContentBlock[] | null;
}
export interface ToolCallContentContent extends Meta {
	type: "content";
	content: ContentBlock;
}
interface DiffPathChange {
	path: AbsolutePath;
}
interface DiffPathPairChange {
	oldPath: AbsolutePath;
	path: AbsolutePath;
}
export type DiffFileType = "text" | "binary" | "directory" | "symlink";
export type DiffChange = (
	| ({ operation: "add" | "delete" | "modify" } & DiffPathChange)
	| ({ operation: "move" | "copy" } & DiffPathPairChange)
) & {
	fileType?: DiffFileType | null;
	mimeType?: string | null;
	_meta?: Record<string, unknown> | null;
};
export interface DiffPatch {
	format: "git_patch" | (string & {});
	text: string;
}
export interface ToolCallDiff extends Meta {
	type: "diff";
	changes: DiffChange[];
	patch?: DiffPatch | null;
}
export interface ToolCallTerminal extends Meta {
	type: "terminal";
	terminalId: TerminalId;
}
export type ToolCallContent = ToolCallContentContent | ToolCallDiff | ToolCallTerminal;
export interface ToolCallLocation extends Meta {
	path: AbsolutePath;
	line?: number | null;
}
export interface ToolCallUpdate extends Meta {
	toolCallId: ToolCallId;
	name?: string | null;
	title?: string | null;
	kind?: ToolKind | null;
	status?: ToolCallStatus | null;
	content?: ToolCallContent[] | null;
	locations?: ToolCallLocation[] | null;
	rawInput?: unknown;
	rawOutput?: unknown;
}
export interface ToolCallContentChunk extends Meta {
	toolCallId: ToolCallId;
	content: ToolCallContent;
}
export interface TerminalUpdate extends Meta {
	terminalId: TerminalId;
	command?: string | null;
	cwd?: AbsolutePath | null;
	output?: ({ data: string } & Meta) | null;
	exitStatus?: ({ exitCode?: number | null; signal?: string | null } & Meta) | null;
}
export interface TerminalOutputChunk extends Meta {
	terminalId: TerminalId;
	data: string;
}
export interface PlanEntry extends Meta {
	content: string;
	priority: PlanEntryPriority;
	status: PlanEntryStatus;
}
export interface PlanItems extends Meta {
	type: "items";
	planId: PlanId;
	entries: PlanEntry[];
}
export interface PlanUpdate extends Meta {
	plan: PlanItems;
}
export interface AvailableCommandsUpdate extends Meta {
	availableCommands: AvailableCommand[];
}
export interface ConfigOptionUpdate extends Meta {
	configOptions: SessionConfigOption[];
}
export interface SessionInfoUpdate extends Meta {
	title?: string | null;
	updatedAt?: string | null;
}
export interface Cost extends Meta {
	amount: number;
	currency: string;
}
export interface UsageUpdate extends Meta {
	used: number;
	size: number;
	cost?: Cost | null;
}
export interface Notice extends Meta {
	severity: NoticeSeverity;
	title: string;
	description?: string | null;
}
export interface CompactionUpdate extends Meta {
	compactionId: CompactionId;
	status: CompactionStatus;
	summary?: ContentBlock[] | null;
	error?: string | null;
}
export interface CompactionSummaryChunk extends Meta {
	compactionId: CompactionId;
	content: ContentBlock;
}
/** Turn state; `idle` carries the stop reason (or an error) that ended the turn. */
export type StateUpdate =
	| ({ state: "running" } & Meta)
	| ({ state: "requires_action" } & Meta)
	| ({ state: "idle"; stopReason?: StopReason | null; error?: ErrorObject | null } & Meta);
export interface ErrorObject {
	code: number;
	message: string;
	data?: unknown;
}
export type SessionUpdate =
	| ({ sessionUpdate: "user_message_chunk" } & ContentChunk)
	| ({ sessionUpdate: "user_message" } & UserMessage)
	| ({ sessionUpdate: "agent_message_chunk" } & ContentChunk)
	| ({ sessionUpdate: "agent_message" } & AgentMessage)
	| ({ sessionUpdate: "agent_thought_chunk" } & ContentChunk)
	| ({ sessionUpdate: "agent_thought" } & AgentThought)
	| ({ sessionUpdate: "state_update" } & StateUpdate)
	| ({ sessionUpdate: "tool_call_content_chunk" } & ToolCallContentChunk)
	| ({ sessionUpdate: "tool_call_update" } & ToolCallUpdate)
	| ({ sessionUpdate: "terminal_update" } & TerminalUpdate)
	| ({ sessionUpdate: "terminal_output_chunk" } & TerminalOutputChunk)
	| ({ sessionUpdate: "plan_update" } & PlanUpdate)
	| ({ sessionUpdate: "available_commands_update" } & AvailableCommandsUpdate)
	| ({ sessionUpdate: "config_option_update" } & ConfigOptionUpdate)
	| ({ sessionUpdate: "session_info_update" } & SessionInfoUpdate)
	| ({ sessionUpdate: "usage_update" } & UsageUpdate)
	| ({ sessionUpdate: "notice" } & Notice)
	| ({ sessionUpdate: "compaction_update" } & CompactionUpdate)
	| ({ sessionUpdate: "compaction_summary_chunk" } & CompactionSummaryChunk);
/** `session/update` notification. */
export interface SessionNotification extends Meta {
	sessionId: SessionId;
	update: SessionUpdate;
}

// Client methods
export interface PermissionOption extends Meta {
	optionId: PermissionOptionId;
	name: string;
	kind: PermissionOptionKind;
}
export interface ToolCallPermissionSubject {
	type: "tool_call";
	toolCall: ToolCallUpdate;
}
export interface CommandPermissionSubject extends Meta {
	type: "command";
	command: string;
	cwd: AbsolutePath;
	toolCallId?: ToolCallId | null;
	terminalId?: TerminalId | null;
}
export type RequestPermissionSubject = ToolCallPermissionSubject | CommandPermissionSubject;
export interface RequestPermissionRequest extends Meta {
	sessionId: SessionId;
	title: string;
	description?: string | null;
	subject?: RequestPermissionSubject | null;
	options: PermissionOption[];
}
export type RequestPermissionOutcome =
	| { outcome: "cancelled" }
	| ({ outcome: "selected"; optionId: PermissionOptionId } & Meta);
export interface RequestPermissionResponse extends Meta {
	outcome: RequestPermissionOutcome;
}

export interface ElicitationSessionScope {
	sessionId: SessionId;
	toolCallId?: ToolCallId | null;
}
export interface ElicitationRequestScope {
	requestId: RequestId;
}
export type ElicitationScope = ElicitationSessionScope | ElicitationRequestScope;
export interface ElicitationPropertyBase extends Meta {
	title?: string | null;
	description?: string | null;
}
export type ElicitationPropertySchema =
	| (ElicitationPropertyBase & {
			type: "string";
			minLength?: number | null;
			maxLength?: number | null;
			pattern?: string | null;
			format?: "email" | "uri" | "date" | "date-time" | (string & {}) | null;
			default?: string | null;
			enum?: string[] | null;
			oneOf?: { const: string; title: string }[] | null;
	  })
	| (ElicitationPropertyBase & {
			type: "number";
			minimum?: number | null;
			maximum?: number | null;
			default?: number | null;
	  })
	| (ElicitationPropertyBase & {
			type: "integer";
			minimum?: number | null;
			maximum?: number | null;
			default?: number | null;
	  })
	| (ElicitationPropertyBase & { type: "boolean"; default?: boolean | null })
	| (ElicitationPropertyBase & {
			type: "array";
			minItems?: number | null;
			maxItems?: number | null;
			items:
				| { type: "string"; enum: string[] }
				| { anyOf: { const: string; title: string; description?: string | null }[] };
			default?: string[] | null;
	  });
export interface ElicitationSchema extends Meta {
	type?: "object";
	title?: string | null;
	properties?: Record<string, ElicitationPropertySchema>;
	required?: string[] | null;
	description?: string | null;
}
export type CreateElicitationRequest = Meta & { message: string } & (
		| ({ mode: "form"; requestedSchema: ElicitationSchema } & ElicitationScope)
		| ({ mode: "url"; elicitationId: ElicitationId; url: string } & ElicitationScope)
	);
export type ElicitationContentValue = string | number | boolean | string[];
export type CreateElicitationResponse = Meta &
	(
		| { action: "accept"; content?: Record<string, ElicitationContentValue> | null }
		| { action: "decline" }
		| { action: "cancel" }
	);
/** `elicitation/complete` notification. */
export interface CompleteElicitationNotification extends Meta {
	elicitationId: ElicitationId;
}

/** Handler surface an agent implements to serve ACP v2. */
export interface AgentV2 {
	initialize(params: InitializeRequest): MaybePromise<InitializeResponse>;
	login?(params: LoginAuthRequest): MaybePromise<LoginAuthResponse | void>;
	logout?(params: LogoutAuthRequest): MaybePromise<LogoutAuthResponse | void>;
	newSession(params: NewSessionRequest): MaybePromise<NewSessionResponse>;
	listSessions?(params: ListSessionsRequest): MaybePromise<ListSessionsResponse>;
	deleteSession?(params: DeleteSessionRequest): MaybePromise<DeleteSessionResponse | void>;
	resumeSession?(params: ResumeSessionRequest): MaybePromise<ResumeSessionResponse>;
	closeSession?(params: CloseSessionRequest): MaybePromise<CloseSessionResponse | void>;
	setSessionConfigOption?(params: SetSessionConfigOptionRequest): MaybePromise<SetSessionConfigOptionResponse>;
	prompt(params: PromptRequest): MaybePromise<PromptResponse>;
	cancel(params: CancelSessionNotification): MaybePromise<void>;
	extMethod?(method: string, params: Record<string, unknown>): MaybePromise<Record<string, unknown>>;
	extNotification?(method: string, params: Record<string, unknown>): MaybePromise<void>;
}
