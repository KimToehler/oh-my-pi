/**
 * ACP protocol v2 surface. This file owns negotiation, auth, session-setup shape and the v2 wire mapping.
 * Prompt admission, run states, cancel semantics and replay land in later slices; until then the methods
 * that need them either fail loudly (`admitPrompt`, `replay`) or are inert (`onForeground*`, `beforeCancel`).
 */
import { VERSION } from "@oh-my-pi/pi-utils";
import { RequestError, type SessionNotification, type v2 } from "@oh-my-pi/pi-utils/acp";
import type { AgentSessionEvent } from "../../session/agent-session";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import type { AcpEventMapperOptions } from "./acp-event-mapper";
import {
	type AcpV2MapperOptions,
	type AcpV2MessageRole,
	buildV2PermissionRequest,
	convertConfigOptionsToV2,
	convertV1UpdateToV2,
	interpretV2PermissionOutcome,
	mapAgentSessionEventToAcpV2Updates,
} from "./acp-event-mapper-v2";
import type { ForegroundOrigin, ForegroundWork } from "./acp-foreground";
import type {
	AcpEmitSource,
	AcpSurface,
	AcpSurfaceHost,
	AcpWireV2,
	ForegroundEnd,
	ManagedSessionRecord,
	SessionSetupKind,
} from "./acp-surface";
import { ACP_TERMINAL_AUTH_FLAG } from "./terminal-auth";

export const ACP_V2_PROTOCOL_VERSION = 2;

export class AcpSurfaceV2 implements AcpSurface<AcpWireV2> {
	readonly version = 2;
	#host: AcpSurfaceHost;

	constructor(host: AcpSurfaceHost) {
		this.#host = host;
	}

	authMethods(capabilities: v2.ClientCapabilities | undefined): v2.AuthMethod[] {
		const authMethods: v2.AuthMethod[] = [
			{
				type: "agent",
				methodId: "agent",
				name: "Use existing local credentials",
				description: "Authenticate via the provider keys/OAuth state already configured under ~/.omp.",
			},
		];
		const terminal = capabilities?.auth?.terminal;
		if (typeof terminal === "object" && terminal !== null) {
			authMethods.push({
				type: "terminal",
				methodId: "terminal",
				name: "Set up omp in terminal",
				description: "Launch the omp TUI to add provider keys and select models.",
				args: [ACP_TERMINAL_AUTH_FLAG],
				env: [],
			});
		}
		return authMethods;
	}

	validAuthMethodIds(capabilities: v2.ClientCapabilities | undefined): string[] {
		return this.authMethods(capabilities).map(method => method.methodId);
	}

	initializeResponse(params: v2.InitializeRequest): v2.InitializeResponse {
		return {
			protocolVersion: ACP_V2_PROTOCOL_VERSION,
			info: { name: "omp", title: "omp", version: VERSION },
			authMethods: this.authMethods(params.capabilities),
			capabilities: {
				session: {
					prompt: { image: {}, embeddedContext: {} },
					mcp: { stdio: {}, http: {} },
				},
			},
		};
	}

	async sessionSetupResponse(
		record: ManagedSessionRecord,
		_kind: SessionSetupKind,
	): Promise<AcpWireV2["sessionSetup"]> {
		const commands = await this.#host.buildAvailableCommands(record);
		return {
			configOptions: convertConfigOptionsToV2(this.#host.buildConfigOptions(record)),
			availableCommands: commands.map(command => ({
				name: command.name,
				description: command.description,
				...(command.input ? { input: { type: "text" as const, hint: command.input.hint } } : {}),
			})),
		};
	}

	admitPrompt(): Promise<v2.PromptResponse> {
		return Promise.reject(RequestError.internalError(undefined, "ACP v2 session/prompt is not implemented yet"));
	}

	replay(): Promise<void> {
		return Promise.reject(RequestError.internalError(undefined, "ACP v2 replay is not implemented yet"));
	}

	// Run states and cancel semantics arrive with the foreground slices.
	onForegroundStart(): void {}

	onForegroundBlocked(): void {}

	onForegroundResumed(): void {}

	onForegroundEnd(_record: ManagedSessionRecord, _work: ForegroundWork, _end: ForegroundEnd): void {}

	beforeCancel(): void {}

	subscribe(): undefined {
		return undefined;
	}

	allowsAgentInitiatedWork(record: ManagedSessionRecord): boolean {
		return !record.cancelLatched;
	}

	activeWork(record: ManagedSessionRecord): ForegroundWork | undefined {
		return record.foreground;
	}

	inFlightWork(record: ManagedSessionRecord): ForegroundWork | undefined {
		return this.activeWork(record);
	}

	beginForeground(_record: ManagedSessionRecord, _origin: ForegroundOrigin): ForegroundWork | undefined {
		return undefined;
	}

	#mapperOptions(sessionId: string, options: AcpEventMapperOptions): AcpV2MapperOptions {
		const record = this.#host.recordFor(sessionId);
		return {
			...options,
			cwd: options.cwd ?? record?.session.sessionManager.getCwd() ?? "",
			messageIdFor: (message, _role: AcpV2MessageRole) => this.#messageId(record, message, options),
		};
	}

	#messageId(record: ManagedSessionRecord | undefined, message: unknown, options: AcpEventMapperOptions): string {
		const known = options.getMessageId?.(message);
		if (known !== undefined) return known;
		if (!record) return crypto.randomUUID();
		record.liveMessageId ??= crypto.randomUUID();
		return record.liveMessageId;
	}

	mapUpdate(event: AgentSessionEvent, sessionId: string, options: AcpEventMapperOptions): v2.SessionNotification[] {
		return mapAgentSessionEventToAcpV2Updates(event, this.#mapperOptions(sessionId, options)).map(update => ({
			sessionId,
			update,
		}));
	}

	async permissionRequest(
		_record: ManagedSessionRecord,
		sessionId: string,
		toolCall: ClientBridgePermissionToolCall,
		options: ClientBridgePermissionOption[],
		signal: AbortSignal | undefined,
	): Promise<ClientBridgePermissionOutcome> {
		if (signal?.aborted) return { outcome: "cancelled" };
		const response = await this.#host.connection.v2.requestPermission(
			buildV2PermissionRequest(sessionId, toolCall, options),
		);
		const outcome = interpretV2PermissionOutcome(
			response,
			options.map(option => option.optionId),
		);
		if (outcome.outcome === "selected") {
			const matched = options.find(option => option.optionId === outcome.optionId);
			if (matched) return { ...outcome, kind: matched.kind };
		}
		return outcome;
	}

	async emit(sessionId: string, notification: SessionNotification, source?: AcpEmitSource): Promise<void> {
		const record = this.#host.recordFor(sessionId);
		const update = convertV1UpdateToV2(
			notification.update,
			this.#mapperOptions(sessionId, { cwd: record?.session.sessionManager.getCwd() }),
			source,
		);
		if (update) await this.sendMapped({ sessionId, update });
	}

	sendMapped(notification: v2.SessionNotification): Promise<void> {
		return this.#host.connection.v2.sessionUpdate(notification);
	}
}
