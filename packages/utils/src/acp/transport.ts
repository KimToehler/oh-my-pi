import { AsyncLocalStorage } from "node:async_hooks";
import type { MaybePromise } from "./protocol";
import type { Stream } from "./stream";

/** JSON-RPC request identifier. */
export type JsonRpcId = string | number | null;
/** JSON-RPC request. */
export interface AnyRequest {
	jsonrpc: "2.0";
	id: JsonRpcId;
	method: string;
	params?: unknown;
}
/** JSON-RPC notification. */
export interface AnyNotification {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
}
/** JSON-RPC error payload. */
export interface ErrorResponse {
	code: number;
	message: string;
	data?: unknown;
}
/** JSON-RPC response. */
export type AnyResponse = { jsonrpc: "2.0"; id: JsonRpcId } & ({ result: unknown } | { error: ErrorResponse });
/** Any JSON-RPC wire message. */
export type AnyMessage = AnyRequest | AnyNotification | AnyResponse;
/** Any frame written to the wire: one message, or the array answering a JSON-RPC batch. */
export type OutboundFrame = AnyMessage | AnyResponse[];
/** Inbound frame marker for a line that is not valid JSON; answered with a parse error. */
export const UNPARSEABLE_FRAME: unique symbol = Symbol("acp.unparseableFrame");

/** An inbound value that is not a JSON-RPC 2.0 message, with the id to answer it under. */
interface InvalidFrame {
	invalid: true;
	id: JsonRpcId;
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
	return value === null || typeof value === "string" || typeof value === "number";
}

/** Validates one inbound value as a JSON-RPC 2.0 request, notification, or response. */
function classifyFrame(value: unknown): AnyMessage | InvalidFrame {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return { invalid: true, id: null };
	const record = value as Record<string, unknown>;
	const id = "id" in record && isJsonRpcId(record.id) ? record.id : null;
	if (record.jsonrpc !== "2.0") return { invalid: true, id };
	if (typeof record.method === "string") {
		if ("id" in record && !isJsonRpcId(record.id)) return { invalid: true, id: null };
		return record as unknown as AnyRequest | AnyNotification;
	}
	if ("id" in record && isJsonRpcId(record.id) && ("result" in record || "error" in record)) {
		return record as unknown as AnyResponse;
	}
	return { invalid: true, id };
}

/** Error returned by a JSON-RPC peer or handler. */
export class RequestError extends Error {
	/** JSON-RPC error code. */
	readonly code: number;
	/** Optional protocol error data. */
	readonly data?: unknown;

	constructor(code: number, message: string, data?: unknown) {
		super(message);
		this.name = "RequestError";
		this.code = code;
		this.data = data;
	}

	/** Creates a JSON parse error. */
	static parseError(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32700, "Parse error", data, additionalMessage);
	}
	/** Creates an invalid-request error. */
	static invalidRequest(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32600, "Invalid request", data, additionalMessage);
	}
	/** Creates a method-not-found error. */
	static methodNotFound(method: string): RequestError {
		return new RequestError(-32601, `"Method not found": ${method}`, { method });
	}
	/** Creates an invalid-parameters error. */
	static invalidParams(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32602, "Invalid params", data, additionalMessage);
	}
	/** Creates an internal error. */
	static internalError(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32603, "Internal error", data, additionalMessage);
	}
	/** Creates a cancellation error. */
	static requestCancelled(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32800, "Request cancelled", data, additionalMessage);
	}
	/** Creates an authentication-required error. */
	static authRequired(data?: unknown, additionalMessage?: string): RequestError {
		return createStandardError(-32000, "Authentication required", data, additionalMessage);
	}
	/** Creates a resource-not-found error. */
	static resourceNotFound(uri?: string): RequestError {
		return new RequestError(
			-32002,
			uri === undefined ? "Resource not found" : `Resource not found: ${uri}`,
			uri === undefined ? undefined : { uri },
		);
	}
	/**
	 * Creates a session-busy error: the agent/session is already processing, so the
	 * request can be retried once idle (steer/follow-up/wait) instead of treating it
	 * as a fault. `message` carries the caller's user-facing wording; `data` should
	 * keep the stable discriminator shape (`reason: "session_busy"`).
	 */
	static sessionBusy(message: string, data?: unknown): RequestError {
		return new RequestError(-32003, message, data);
	}
	/** Converts this error into a JSON-RPC result. */
	toResult(): { error: ErrorResponse } {
		return { error: this.toErrorResponse() };
	}
	/** Converts this error into a JSON-RPC error payload. */
	toErrorResponse(): ErrorResponse {
		return { code: this.code, message: this.message, ...(this.data === undefined ? {} : { data: this.data }) };
	}
}

function createStandardError(
	code: number,
	message: string,
	data: unknown,
	additionalMessage: string | undefined,
): RequestError {
	return new RequestError(code, additionalMessage ? `${message}: ${additionalMessage}` : message, data);
}

type Dispatcher = (method: string, params: unknown, notification: boolean) => MaybePromise<unknown>;
type Pending = { resolve(value: unknown): void; reject(reason: unknown): void };

/** Per-inbound-frame signal: resolved once the write carrying the frame's response has settled. */
interface ResponseContext {
	written: PromiseWithResolvers<void>;
	/** True when the frame is a JSON-RPC batch, whose responses share one array write. */
	inBatch: boolean;
}

const responseContext = new AsyncLocalStorage<ResponseContext>();

/**
 * Resolves once the response frame of the inbound request currently being handled (single request or the
 * batch array carrying it, including error and drain-timeout answers) has been written to the stream. Call it
 * synchronously from the handler; outside a request handler it resolves immediately.
 */
export function responseWritten(): Promise<void> {
	return responseContext.getStore()?.written.promise ?? Promise.resolve();
}

/**
 * Whether the handler currently running answers an entry of a JSON-RPC batch, whose responses are written together
 * once every entry settled. False for a single message or outside a handler.
 */
export function inBatch(): boolean {
	return responseContext.getStore()?.inBatch ?? false;
}

/** Bound on clean-EOF inbound drain so `closed` cannot hang if a handler never settles. */
const INBOUND_DRAIN_TIMEOUT_MS = 30_000;

/** Correlated bidirectional JSON-RPC connection. */
export class RpcConnection {
	#nextId = 0;
	#pending = new Map<JsonRpcId, Pending>();
	#inbound = new Set<Promise<void>>();
	#openInboundIds = new Map<JsonRpcId, ResponseContext>();
	#writable: WritableStream<OutboundFrame>;
	#writeTail: Promise<void> = Promise.resolve();
	#abort = new AbortController();
	#closed = Promise.withResolvers<void>();
	#dispatcher: Dispatcher;

	constructor(stream: Stream, dispatcher: Dispatcher) {
		this.#writable = stream.writable;
		this.#dispatcher = dispatcher;
		void this.#read(stream.readable);
	}

	/** Signal aborted when the stream closes. */
	get signal(): AbortSignal {
		return this.#abort.signal;
	}
	/** Promise resolved when the stream closes. */
	get closed(): Promise<void> {
		return this.#closed.promise;
	}

	/** Sends a correlated JSON-RPC request. */
	request<Response>(method: string, params?: unknown): Promise<Response> {
		if (this.signal.aborted) return Promise.reject(new Error("Connection closed"));
		const id = this.#nextId++;
		const deferred = Promise.withResolvers<unknown>();
		this.#pending.set(id, deferred);
		void this.#write({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }).catch(error => {
			this.#pending.delete(id);
			deferred.reject(error);
		});
		return deferred.promise as Promise<Response>;
	}

	/** Sends a JSON-RPC notification. */
	async notify(method: string, params?: unknown): Promise<void> {
		await this.#write({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
	}

	/** Closes the connection and rejects outstanding requests. */
	close(error?: unknown): void {
		if (this.signal.aborted) return;
		this.#abort.abort(error);
		for (const pending of this.#pending.values()) pending.reject(error ?? new Error("Connection closed"));
		this.#pending.clear();
		this.#closed.resolve();
	}

	#write(message: OutboundFrame): Promise<void> {
		const write = this.#writeTail.then(async () => {
			const writer = this.#writable.getWriter();
			try {
				await writer.write(message);
			} finally {
				writer.releaseLock();
			}
		});
		this.#writeTail = write.catch(() => {});
		return write;
	}

	async #read(readable: ReadableStream<unknown>): Promise<void> {
		const reader = readable.getReader();
		try {
			while (true) {
				const next = await reader.read();
				if (next.done) break;
				this.#dispatch(next.value);
			}
			await this.#drainInbound();
			this.close();
		} catch (error) {
			this.close(error);
		} finally {
			reader.releaseLock();
		}
	}

	/** Starts answering one inbound frame: a single message, a batch array, or an unusable value. */
	#dispatch(frame: unknown): void {
		const task = this.#handleFrame(frame).catch(error => this.close(error));
		this.#inbound.add(task);
		void task.finally(() => this.#inbound.delete(task));
	}

	async #handleFrame(frame: unknown): Promise<void> {
		const context: ResponseContext = { written: Promise.withResolvers<void>(), inBatch: false };
		try {
			await responseContext.run(context, () => this.#answerFrame(frame, context));
		} finally {
			context.written.resolve();
		}
	}

	async #answerFrame(frame: unknown, context: ResponseContext): Promise<void> {
		if (frame === UNPARSEABLE_FRAME) {
			await this.#write({ jsonrpc: "2.0", id: null, error: RequestError.parseError().toErrorResponse() });
			return;
		}
		if (!Array.isArray(frame)) {
			const response = await this.#answer(this.#admit(frame, context));
			if (response) await this.#write(response);
			return;
		}
		if (frame.length === 0) {
			await this.#write({ jsonrpc: "2.0", id: null, error: RequestError.invalidRequest().toErrorResponse() });
			return;
		}
		// Admit every entry before running any, so a drain timeout sees the whole batch as open.
		const entries = frame.map(entry => this.#admit(entry, context));
		context.inBatch = true;
		const responses = await Promise.all(entries.map(entry => this.#answer(entry)));
		const answered = responses.filter(response => response !== undefined);
		if (answered.length > 0) await this.#write(answered);
	}

	/** Validates one inbound value and registers its id when it is a request awaiting an answer. */
	#admit(value: unknown, context: ResponseContext): AnyMessage | InvalidFrame {
		const message = classifyFrame(value);
		if (!("invalid" in message) && "method" in message && "id" in message)
			this.#openInboundIds.set(message.id, context);
		return message;
	}

	async #drainInbound(): Promise<void> {
		if (this.#inbound.size === 0) return;
		const drained = Promise.allSettled(this.#inbound).then(() => {});
		let timer: Timer | undefined;
		const timedOut = await Promise.race([
			drained.then(() => false),
			new Promise<boolean>(resolve => {
				timer = setTimeout(() => resolve(true), INBOUND_DRAIN_TIMEOUT_MS);
			}),
		]);
		if (timer !== undefined) clearTimeout(timer);
		if (!timedOut) return;
		const error = RequestError.internalError(undefined, "Inbound request drain timed out").toErrorResponse();
		await Promise.allSettled([...this.#openInboundIds.keys()].map(id => this.#respond(id, { error })));
	}

	/** Builds the response for an open inbound request, unless the drain timeout already answered it. */
	#claim(id: JsonRpcId, body: { result: unknown } | { error: ErrorResponse }): AnyResponse | undefined {
		if (!this.#openInboundIds.delete(id)) return undefined;
		return { jsonrpc: "2.0", id, ...body };
	}

	async #respond(id: JsonRpcId, body: { result: unknown } | { error: ErrorResponse }): Promise<void> {
		const context = this.#openInboundIds.get(id);
		const response = this.#claim(id, body);
		if (!response) return;
		try {
			await this.#write(response);
		} finally {
			context?.written.resolve();
		}
	}

	/** Settles an inbound response or runs an inbound request/notification; returns the response to send. */
	async #answer(message: AnyMessage | InvalidFrame): Promise<AnyResponse | undefined> {
		if ("invalid" in message) {
			return { jsonrpc: "2.0", id: message.id, error: RequestError.invalidRequest().toErrorResponse() };
		}
		if (!("method" in message)) {
			const pending = this.#pending.get(message.id);
			if (!pending) return undefined;
			this.#pending.delete(message.id);
			if ("error" in message)
				pending.reject(new RequestError(message.error.code, message.error.message, message.error.data));
			else pending.resolve(message.result);
			return undefined;
		}
		if (!("id" in message)) {
			try {
				await this.#dispatcher(message.method, message.params, true);
			} catch {
				/* Notifications have no error channel. */
			}
			return undefined;
		}
		try {
			const result = await this.#dispatcher(message.method, message.params, false);
			return this.#claim(message.id, { result: result ?? {} });
		} catch (error) {
			const protocolError =
				error instanceof RequestError
					? error
					: RequestError.internalError({ details: error instanceof Error ? error.message : String(error) });
			return this.#claim(message.id, { error: protocolError.toErrorResponse() });
		}
	}
}
