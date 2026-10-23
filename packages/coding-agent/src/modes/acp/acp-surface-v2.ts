/**
 * ACP protocol v2 surface. This file owns negotiation, auth, session-setup shape and the v2 wire mapping.
 * Prompt admission, run states, cancel semantics and replay land in later slices; until then the methods
 * that need them either fail loudly (`admitPrompt`, `replay`) or are inert (`onForeground*`, `beforeCancel`).
 */
import { type AgentMessage, AgentBusyError } from "@oh-my-pi/pi-agent-core";
import { logger, VERSION } from "@oh-my-pi/pi-utils";
import { RequestError, type SessionNotification, type v2 } from "@oh-my-pi/pi-utils/acp";
import type { AgentSessionEvent } from "../../session/agent-session";
import type { SubmissionOutcome } from "../../session/agent-session-types";
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
import {
	cloneUsageStatistics,
	createForegroundWork,
	type ForegroundOrigin,
	type ForegroundWork,
	resolveTurnFailure,
} from "./acp-foreground";
import type {
	AcpEmitSource,
	AcpSurface,
	AcpSurfaceHost,
	AcpWireV2,
	ForegroundEnd,
	ManagedSessionRecord,
	SessionSetupKind,
} from "./acp-surface";
import { sessionEntryIdOf } from "../../session/session-entry-id";
import { iterateSessionReplay } from "./acp-replay";
import { ACP_TERMINAL_AUTH_FLAG } from "./terminal-auth";

export const ACP_V2_PROTOCOL_VERSION = 2;

export class AcpSurfaceV2 implements AcpSurface<AcpWireV2> {
	readonly version = 2;
	#host: AcpSurfaceHost;
	/** Pending `user_message` echo per record: the idle frame waits behind it. */
	#echoes = new WeakMap<ManagedSessionRecord, Promise<void>>();

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

	async admitPrompt(record: ManagedSessionRecord, params: v2.PromptRequest): Promise<v2.PromptResponse> {
		// Serialised only until the previous prompt's outcome (insertion or rejection), never its foreground end.
		const slot = Promise.withResolvers<void>();
		const previous = record.promptQueue.promise;
		record.promptQueue = { promise: slot.promise, release: slot.resolve };
		try {
			await previous;
			this.#host.throwIfRecordClosed(record);
			return await this.#submit(record, params, slot.resolve);
		} finally {
			slot.resolve();
		}
	}

	async #submit(
		record: ManagedSessionRecord,
		params: v2.PromptRequest,
		releaseQueue: () => void,
	): Promise<v2.PromptResponse> {
		const converted = this.#host.convertPromptBlocks(
			params.prompt as Parameters<AcpSurfaceHost["convertPromptBlocks"]>[0],
		);
		let ownWork: ForegroundWork | undefined;
		if (!record.foreground) {
			ownWork = createForegroundWork(
				"prompt",
				cloneUsageStatistics(record.session.sessionManager.getUsageStatistics()),
			);
			record.foreground = ownWork;
			this.onForegroundStart(record, ownWork);
		}
		const targetWork = record.foreground;
		const outcome = Promise.withResolvers<SubmissionOutcome>();
		let outcomeSeen = false;
		const run = this.#host.runPromptOrCommand(record, converted.text, converted.images, {
			ownsForeground: ownWork !== undefined,
			onSubmissionOutcome: submission => {
				if (outcomeSeen) return;
				outcomeSeen = true;
				outcome.resolve(submission);
			},
		});
		run.then(
			// A resolved run without an outcome is a steer still queued: insertion or the foreground end reports it.
			() => {},
			async (error: unknown) => {
				const wire =
					error instanceof AgentBusyError
						? RequestError.sessionBusy(error.message, { reason: "session_busy", hint: "steer|followUp|wait" })
						: error;
				if (!outcomeSeen) {
					outcomeSeen = true;
					outcome.reject(wire);
					return;
				}
				// Response already sent: the failure ends the foreground this prompt owns.
				if (ownWork) {
					ownWork.deferredError ??= wire;
					if (!(await this.#host.awaitSteeredBuiltins(record, ownWork, true))) return;
					this.onForegroundEnd(record, ownWork, { error: wire });
				} else {
					logger.warn("ACP v2 steered prompt failed after insertion", { error: wire });
				}
			},
		);

		let submission: SubmissionOutcome;
		try {
			submission = await outcome.promise;
		} catch (error) {
			releaseQueue();
			if (ownWork) this.onForegroundEnd(record, ownWork, { error });
			throw error;
		}
		releaseQueue();
		if (submission.kind === "dropped") {
			const cancelled = targetWork?.cancelRequested === true;
			const error = cancelled
				? RequestError.requestCancelled()
				: RequestError.internalError(undefined, "Prompt dropped before insertion");
			if (ownWork && !cancelled) this.onForegroundEnd(record, ownWork, { error });
			throw error;
		}
		let messageId: string;
		if (submission.kind === "inserted") {
			record.cancelLatched = false;
			messageId = submission.entryId;
		} else {
			messageId = crypto.randomUUID();
		}
		this.#echoAfterResponse(record, params, messageId);
		return { messageId };
	}

	/** Emit the `user_message` once the prompt response frame is queued on the wire; idle waits for it. */
	#echoAfterResponse(record: ManagedSessionRecord, params: v2.PromptRequest, messageId: string): void {
		const tick = Promise.withResolvers<void>();
		setTimeout(tick.resolve, 0);
		const tail: Promise<void> = tick.promise
			.then(() =>
				this.sendMapped({
					sessionId: params.sessionId,
					update: { sessionUpdate: "user_message", messageId, content: params.prompt },
				}),
			)
			.catch((error: unknown) => {
				logger.warn("ACP v2 user_message delivery failed", { error });
			})
			.finally(() => {
				if (this.#echoes.get(record) === tail) this.#echoes.delete(record);
			});
		this.#echoes.set(record, tail);
	}

	#afterEcho(record: ManagedSessionRecord, send: () => void): void {
		const pending = this.#echoes.get(record);
		if (pending) void pending.then(send);
		else send();
	}

	/** `idle` without foreground work; `requires_action` while an interaction is open; else `running`. */
	currentState(record: ManagedSessionRecord): v2.StateUpdate {
		const work = record.foreground;
		if (!work) return { state: "idle" };
		return { state: work.pendingInteractions > 0 ? "requires_action" : "running" };
	}

	#emitState(record: ManagedSessionRecord, state: v2.StateUpdate): void {
		if (state.state !== "idle" && record.lastEmittedState === state.state) return;
		record.lastEmittedState = state.state;
		this.sendMapped({
			sessionId: record.session.sessionId,
			update: { sessionUpdate: "state_update", ...state },
		}).catch((error: unknown) => {
			logger.warn("ACP v2 state_update delivery failed", { error });
		});
	}

	/**
	 * Resume replay: `replayFrom: {type:"start"}` streams the transcript through the v2 mapping (user messages keep
	 * their persisted entry id, other roles get one fresh id per message); no cursor replays nothing. Either way the
	 * `state_update` snapshot follows, bypassing dedup because snapshots are idempotent.
	 */
	async replay(record: ManagedSessionRecord, replayFrom?: unknown): Promise<void> {
		const replayStart =
			typeof replayFrom === "object" && replayFrom !== null && "type" in replayFrom && replayFrom.type === "start";
		if (replayFrom !== undefined && replayFrom !== null && !replayStart) {
			throw RequestError.invalidParams(undefined, "Unsupported replayFrom cursor");
		}
		const sessionId = record.session.sessionId;
		if (replayStart) {
			const cwd = record.session.sessionManager.getCwd();
			for (const { message, notifications } of iterateSessionReplay(record.session, this.#host.blobs)) {
				const messageId =
					(message.role === "user" ? sessionEntryIdOf(message as AgentMessage) : undefined) ?? crypto.randomUUID();
				const options: AcpV2MapperOptions = { cwd, messageIdFor: () => messageId };
				for (const notification of notifications) {
					const update = convertV1UpdateToV2(notification.update, options, { message });
					if (update) await this.sendMapped({ sessionId, update });
				}
			}
		}
		const state = this.currentState(record);
		record.lastEmittedState = state.state;
		await this.sendMapped({ sessionId, update: { sessionUpdate: "state_update", ...state } });
	}

	onForegroundStart(record: ManagedSessionRecord, _work: ForegroundWork): void {
		this.#emitState(record, { state: "running" });
	}

	onForegroundBlocked(record: ManagedSessionRecord, work: ForegroundWork): void {
		if (record.foreground === work) this.#emitState(record, { state: "requires_action" });
	}

	onForegroundResumed(record: ManagedSessionRecord, work: ForegroundWork): void {
		if (record.foreground === work) this.#emitState(record, { state: "running" });
	}

	onForegroundEnd(record: ManagedSessionRecord, work: ForegroundWork, end: ForegroundEnd): void {
		if (record.foreground !== work) return;
		record.session.settlePendingSubmissions();
		record.foreground = undefined;
		// A provider failure ends the run with an assistant `error` reply rather than a thrown error.
		const turnFailure = "error" in end ? undefined : resolveTurnFailure(work);
		const state: v2.StateUpdate =
			"error" in end
				? {
						state: "idle",
						stopReason: "error",
						error: {
							code: end.error instanceof RequestError ? end.error.code : -32603,
							message: end.error instanceof Error ? end.error.message : String(end.error),
						},
					}
				: turnFailure !== undefined
					? { state: "idle", stopReason: "error", error: { code: -32603, message: turnFailure } }
					: { state: "idle", stopReason: end.response.stopReason };
		this.#afterEcho(record, () => this.#emitState(record, state));
	}

	beforeCancel(record: ManagedSessionRecord): void {
		const work = record.foreground;
		if (!work) return;
		record.cancelLatched = true;
		work.cancelRequested = true;
		record.session.clearQueue({ forInterrupt: true });
	}

	subscribe(record: ManagedSessionRecord): () => void {
		return record.session.subscribe(event => {
			this.#host.trackForegroundEvent(record, event);
		});
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

	beginForeground(record: ManagedSessionRecord, origin: ForegroundOrigin): ForegroundWork | undefined {
		if (!this.allowsAgentInitiatedWork(record)) return undefined;
		const work = createForegroundWork(
			origin,
			cloneUsageStatistics(record.session.sessionManager.getUsageStatistics()),
		);
		record.foreground = work;
		this.onForegroundStart(record, work);
		return work;
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
