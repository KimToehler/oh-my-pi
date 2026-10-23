/**
 * ACP protocol v1 surface: today's adapter behaviour. Prompt-scoped event
 * subscription, `session/prompt` serialised behind the previous turn and
 * answered at foreground end, the open-prompt gate for agent-initiated work,
 * and the v1 wire mapping via `acp-event-mapper.ts`.
 */
import { AgentBusyError } from "@oh-my-pi/pi-agent-core";
import { logger, VERSION } from "@oh-my-pi/pi-utils";
import {
	type AuthMethod,
	type ClientCapabilities,
	type InitializeRequest,
	type InitializeResponse,
	PROTOCOL_VERSION,
	type PromptRequest,
	type PromptResponse,
	RequestError,
	type SessionNotification,
} from "@oh-my-pi/pi-utils/acp";
import type { AgentSessionEvent } from "../../session/agent-session";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import { requestAcpPermission } from "./acp-client-bridge";
import { type AcpEventMapperOptions, mapAgentSessionEventToAcpSessionUpdates } from "./acp-event-mapper";
import {
	cloneUsageStatistics,
	createForegroundWork,
	type ForegroundWork,
	type PromptTurnState,
} from "./acp-foreground";
import { iterateSessionReplay } from "./acp-replay";
import {
	type AcpSurface,
	type AcpSurfaceHost,
	type AcpWireV1,
	type ForegroundEnd,
	INTELLIJ_CLIENT_PLATFORM,
	type ManagedSessionRecord,
} from "./acp-surface";
import { ACP_TERMINAL_AUTH_FLAG } from "./terminal-auth";

export class AcpSurfaceV1 implements AcpSurface<AcpWireV1> {
	readonly version = 1;
	#host: AcpSurfaceHost;

	constructor(host: AcpSurfaceHost) {
		this.#host = host;
	}

	authMethods(capabilities: ClientCapabilities | undefined): AuthMethod[] {
		const authMethods: AuthMethod[] = [
			{
				id: "agent",
				name: "Use existing local credentials",
				description: "Authenticate via the provider keys/OAuth state already configured under ~/.omp.",
			},
		];
		if (capabilities?.auth?.terminal === true) {
			authMethods.push({
				type: "terminal",
				id: "terminal",
				name: "Set up omp in terminal",
				description: "Launch the omp TUI to add provider keys and select models.",
				args: [ACP_TERMINAL_AUTH_FLAG],
			});
		}
		return authMethods;
	}

	initializeResponse(params: InitializeRequest): InitializeResponse {
		const isIntelliJClient = params.clientInfo?._meta?.platform === INTELLIJ_CLIENT_PLATFORM;
		return {
			protocolVersion: PROTOCOL_VERSION,
			agentInfo: {
				name: "omp",
				title: "omp",
				version: VERSION,
			},
			authMethods: this.authMethods(params.clientCapabilities),
			agentCapabilities: {
				loadSession: !isIntelliJClient,
				mcpCapabilities: {
					http: true,
					sse: true,
				},
				promptCapabilities: {
					embeddedContext: true,
					image: true,
				},
				sessionCapabilities: {
					list: {},
					fork: {},
					resume: {},
					close: {},
				},
			},
			_meta: {
				steering: { supported: true },
			},
		};
	}

	sessionSetupResponse(record: ManagedSessionRecord): AcpWireV1["sessionSetup"] {
		return {
			configOptions: this.#host.buildConfigOptions(record),
			modes: this.#host.buildModeState(record),
		};
	}

	async admitPrompt(record: ManagedSessionRecord, params: PromptRequest): Promise<PromptResponse> {
		const activeTurn = record.promptTurn;
		if (activeTurn && !activeTurn.settled && record.session.isStreaming) {
			// New prompt arrived while the previous turn is still in-flight (e.g. the
			// client sent a message immediately after pressing stop, before or without
			// a preceding session/cancel notification). Implicitly cancel the running
			// turn so the new prompt can queue behind the abort cleanup — identical to
			// what cancel() does when called explicitly. beginCancelCleanup is
			// idempotent, so a concurrent session/cancel notification is harmless.
			// Mirror cancel()'s timeout handling: if abort() hangs past the cleanup
			// timeout, close the managed session instead of leaving it registered
			// with a still-streaming AgentSession. The queued prompt below observes
			// the same cleanup rejection and fails accordingly.
			this.#host.beginCancelCleanup(record, activeTurn.work).catch(async (error: unknown) => {
				logger.warn("ACP cancel cleanup timed out; closing session", {
					sessionId: record.session.sessionId,
					error,
				});
				await this.#host.closeSession(params.sessionId, record);
			});
		}
		return await this.#queuePrompt(record, async () => {
			const previousTurn = record.promptTurn;
			if (previousTurn) {
				// Wait for any prompt that's still settling or whose cancel cleanup is
				// still in flight. We deliberately swallow the prompt rejection (the
				// owning caller already received it) but let cleanup rejections
				// propagate — a timed-out cancel must fail this queued prompt instead
				// of letting it run on a session that is about to be closed.
				await previousTurn.promise.catch(() => undefined);
				await previousTurn.work.cleanup;
			}
			// A cancelled prompt resolves (and is evicted) before its goal admission finishes; this
			// prompt's own admission queues behind it on the actor's lane, so nothing waits here.
			this.#host.throwIfRecordClosed(record);

			const converted = this.#host.convertPromptBlocks(params.prompt);
			const pendingPrompt = Promise.withResolvers<PromptResponse>();
			const work = createForegroundWork(
				"prompt",
				cloneUsageStatistics(record.session.sessionManager.getUsageStatistics()),
			);
			const promptTurn: PromptTurnState = {
				work,
				settled: false,
				resolve: pendingPrompt.resolve,
				reject: pendingPrompt.reject,
				promise: pendingPrompt.promise,
			};
			record.promptTurn = promptTurn;
			this.onForegroundStart(record, work);

			// A prompt landing on a busy session is queued as steer below; AgentBusyError
			// can still escape builtin commands. Type it for the wire instead of letting
			// transport.ts wrap it as a generic -32603 internal error.
			this.#host.runPromptOrCommand(record, converted.text, converted.images).catch(async (error: unknown) => {
				const failure =
					error instanceof AgentBusyError
						? RequestError.sessionBusy(error.message, {
								reason: "session_busy",
								hint: "steer|followUp|wait",
							})
						: error;
				// Recorded first: a steered command may already have armed the
				// quiescence waiter, which then finishes the prompt with this failure.
				work.deferredError ??= failure;
				if (!(await this.#host.awaitSteeredBuiltins(record, promptTurn.work, true))) return;
				this.onForegroundEnd(record, work, { error: failure });
			});

			return await pendingPrompt.promise;
		});
	}

	async #queuePrompt(record: ManagedSessionRecord, run: () => Promise<PromptResponse>): Promise<PromptResponse> {
		const nextQueue = Promise.withResolvers<void>();
		const releaseQueue = nextQueue.resolve;
		const previousQueue = record.promptQueue;
		record.promptQueue = {
			promise: nextQueue.promise,
			release: releaseQueue,
		};
		await previousQueue.promise;
		this.#host.throwIfRecordClosed(record);
		try {
			return await run();
		} finally {
			releaseQueue();
			if (record.promptQueue.release === releaseQueue) {
				record.promptQueue.release = undefined;
			}
		}
	}

	/** The open prompt owns every turn: its subscription streams them to the client. */
	onForegroundStart(record: ManagedSessionRecord, work: ForegroundWork): void {
		work.unsubscribe = record.session.subscribe(event => {
			this.#host.trackForegroundEvent(record, event);
		});
	}

	readonly holdsForegroundForBackgroundWork = true;

	onForegroundBlocked(): void {}

	onForegroundResumed(): void {}

	onForegroundEnd(record: ManagedSessionRecord, work: ForegroundWork, end: ForegroundEnd): void {
		const promptTurn = record.promptTurn;
		if (!promptTurn || promptTurn.work !== work || promptTurn.settled) {
			return;
		}
		promptTurn.settled = true;
		work.unsubscribe?.();
		// Keep the slot occupied until cancel cleanup finishes — the cancel cleanup
		// evicts the slot in its finally block once both flags say it's safe.
		if (!work.cleanup && record.promptTurn === promptTurn) {
			record.promptTurn = undefined;
		}
		if ("error" in end) {
			promptTurn.reject(end.error);
			return;
		}
		promptTurn.resolve(end.response);
	}

	/**
	 * Background-job wakes may start turns only while a prompt is open: they stream
	 * into that prompt instead of running unseen by the client.
	 */
	allowsAgentInitiatedWork(record: ManagedSessionRecord): boolean {
		return record.promptTurn !== undefined && !record.promptTurn.settled;
	}

	mapUpdate(event: AgentSessionEvent, sessionId: string, options: AcpEventMapperOptions): SessionNotification[] {
		return mapAgentSessionEventToAcpSessionUpdates(event, sessionId, options);
	}

	permissionRequest(
		_record: ManagedSessionRecord,
		sessionId: string,
		toolCall: ClientBridgePermissionToolCall,
		options: ClientBridgePermissionOption[],
		signal: AbortSignal | undefined,
	): Promise<ClientBridgePermissionOutcome> {
		return requestAcpPermission(this.#host.connection, sessionId, toolCall, options, signal);
	}

	emit(_sessionId: string, notification: SessionNotification): Promise<void> {
		return this.#host.connection.sessionUpdate(notification);
	}

	sendMapped(notification: SessionNotification): Promise<void> {
		return this.#host.connection.sessionUpdate(notification);
	}

	validAuthMethodIds(capabilities: ClientCapabilities | undefined): string[] {
		return this.authMethods(capabilities).map(method => method.id);
	}

	beforeCancel(): void {}

	inFlightWork(record: ManagedSessionRecord): ForegroundWork | undefined {
		return this.activeWork(record);
	}

	subscribe(): undefined {
		return undefined;
	}

	activeWork(record: ManagedSessionRecord): ForegroundWork | undefined {
		const turn = record.promptTurn;
		return turn && !turn.settled ? turn.work : undefined;
	}

	beginForeground(): ForegroundWork | undefined {
		return undefined;
	}

	async replay(record: ManagedSessionRecord): Promise<void> {
		for (const { notifications } of iterateSessionReplay(record.session, this.#host.blobs)) {
			for (const notification of notifications) {
				await this.emit(record.session.sessionId, notification);
			}
		}
	}
}
