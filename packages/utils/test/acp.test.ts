import { describe, expect, it, vi } from "bun:test";
import {
	AgentSideConnection,
	type AnyMessage,
	type Agent,
	type AgentSurfaces,
	type AgentV2,
	type Client,
	type OutboundFrame,
	ClientSideConnection,
	ndJsonStream,
	RequestError,
	inBatch,
	RpcConnection,
	responseWritten,
	schema,
} from "../src/acp";

function transportPair() {
	const leftToRight = new TransformStream<Uint8Array, Uint8Array>();
	const rightToLeft = new TransformStream<Uint8Array, Uint8Array>();
	return {
		left: ndJsonStream(leftToRight.writable, rightToLeft.readable),
		right: ndJsonStream(rightToLeft.writable, leftToRight.readable),
	};
}

/** Raw NDJSON peer around an {@link RpcConnection}: send literal lines, collect every outbound frame. */
function wirePeer(dispatcher: (method: string, params: unknown, notification: boolean) => unknown) {
	const toAgent = new TransformStream<Uint8Array, Uint8Array>();
	const fromAgent = new TransformStream<Uint8Array, Uint8Array>();
	const stream = ndJsonStream(fromAgent.writable, toAgent.readable);
	const connection = new RpcConnection(stream, dispatcher);
	const frames: unknown[] = [];
	const collected = (async () => {
		const decoder = new TextDecoder();
		let buffered = "";
		for await (const chunk of fromAgent.readable) {
			buffered += decoder.decode(chunk, { stream: true });
			let newline = buffered.indexOf("\n");
			while (newline >= 0) {
				frames.push(JSON.parse(buffered.slice(0, newline)));
				buffered = buffered.slice(newline + 1);
				newline = buffered.indexOf("\n");
			}
		}
	})();
	const writer = toAgent.writable.getWriter();
	const encoder = new TextEncoder();
	return {
		connection,
		send: (line: string) => writer.write(encoder.encode(`${line}\n`)),
		/** Ends input, waits until every inbound frame is answered, and returns all outbound frames. */
		async finish(): Promise<unknown[]> {
			await writer.close();
			await connection.closed;
			await stream.writable.close();
			await collected;
			return frames;
		},
	};
}

describe("ACP JSON-RPC batches", () => {
	const ping = '{"jsonrpc":"2.0","id":9,"method":"ping"}';
	const pong = { jsonrpc: "2.0", id: 9, result: { method: "ping" } };

	it("answers a batch of requests with one array and runs its notifications", async () => {
		const notified: string[] = [];
		const peer = wirePeer((method, _params, notification) => {
			if (notification) notified.push(method);
			return { method };
		});
		await peer.send(
			'[{"jsonrpc":"2.0","id":1,"method":"a"},{"jsonrpc":"2.0","method":"n"},{"jsonrpc":"2.0","id":2,"method":"b"}]',
		);
		expect(await peer.finish()).toEqual([
			[
				{ jsonrpc: "2.0", id: 1, result: { method: "a" } },
				{ jsonrpc: "2.0", id: 2, result: { method: "b" } },
			],
		]);
		expect(notified).toEqual(["n"]);
	});

	it("answers invalid batch entries with per-entry invalid-request errors", async () => {
		const peer = wirePeer(method => ({ method }));
		await peer.send('[{"jsonrpc":"2.0","id":1,"method":"a"},{"id":2,"method":"b"},5]');
		const [batch] = await peer.finish();
		expect(batch).toEqual([
			{ jsonrpc: "2.0", id: 1, result: { method: "a" } },
			{ jsonrpc: "2.0", id: 2, error: expect.objectContaining({ code: -32600 }) },
			{ jsonrpc: "2.0", id: null, error: expect.objectContaining({ code: -32600 }) },
		]);
	});

	it("writes nothing for a notification-only batch and keeps the stream usable", async () => {
		const notified: string[] = [];
		const peer = wirePeer((method, _params, notification) => {
			if (notification) notified.push(method);
			return { method };
		});
		await peer.send('[{"jsonrpc":"2.0","method":"x"},{"jsonrpc":"2.0","method":"y"}]');
		await peer.send(ping);
		expect(await peer.finish()).toEqual([pong]);
		expect(notified).toEqual(["x", "y"]);
	});

	it("rejects an empty batch with one invalid-request error", async () => {
		const peer = wirePeer(method => ({ method }));
		await peer.send("[]");
		await peer.send(ping);
		expect(await peer.finish()).toEqual([
			{ jsonrpc: "2.0", id: null, error: expect.objectContaining({ code: -32600 }) },
			pong,
		]);
	});

	it("settles outbound requests from a batched success and error response", async () => {
		const peer = wirePeer(() => undefined);
		const granted = peer.connection.request("session/request_permission", { n: 0 });
		const denied = peer.connection.request("session/request_permission", { n: 1 });
		await peer.send(
			'[{"jsonrpc":"2.0","id":0,"result":{"ok":true}},{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"denied"}}]',
		);
		await peer.finish();
		const [first, second] = await Promise.allSettled([granted, denied]);
		expect(first).toEqual({ status: "fulfilled", value: { ok: true } });
		expect(second).toMatchObject({ status: "rejected", reason: { code: -32001, message: "denied" } });
	});

	it("answers malformed JSON with a parse error and keeps the stream usable", async () => {
		const peer = wirePeer(method => ({ method }));
		await peer.send("{not json");
		await peer.send(ping);
		expect(await peer.finish()).toEqual([
			{ jsonrpc: "2.0", id: null, error: expect.objectContaining({ code: -32700 }) },
			pong,
		]);
	});
});

/** Frame-level peer: records each outbound frame at the moment the sink accepts it. */
function framePeer(dispatcher: (method: string, params: unknown, notification: boolean) => unknown) {
	const sunk: unknown[] = [];
	let inbound!: ReadableStreamDefaultController<unknown>;
	const readable = new ReadableStream<unknown>({
		start(controller) {
			inbound = controller;
		},
	});
	const writable = new WritableStream<OutboundFrame>({
		write(frame) {
			sunk.push(frame);
		},
	});
	const connection = new RpcConnection({ readable, writable }, dispatcher);
	return {
		sunk,
		connection,
		send: (frame: unknown) => inbound.enqueue(frame),
		end: () => inbound.close(),
	};
}

describe("ACP inBatch", () => {
	it("is true only for handlers answering a batch entry", async () => {
		expect(inBatch()).toBe(false);
		const seen: boolean[] = [];
		const peer = framePeer(() => {
			seen.push(inBatch());
			return {};
		});
		peer.send({ jsonrpc: "2.0", id: 1, method: "single" });
		peer.send([
			{ jsonrpc: "2.0", id: 2, method: "a" },
			{ jsonrpc: "2.0", method: "n" },
		]);
		peer.end();
		await peer.connection.closed;
		expect(seen).toEqual([false, true, true]);
	});
});

describe("ACP responseWritten", () => {
	it("resolves immediately outside a request handler", async () => {
		await responseWritten();
	});

	it("resolves only after the single response frame is written", async () => {
		const gate = Promise.withResolvers<void>();
		const sunkWhenSignalled: number[] = [];
		let signalled = false;
		const peer = framePeer(async () => {
			void responseWritten().then(() => {
				signalled = true;
				sunkWhenSignalled.push(peer.sunk.length);
			});
			await gate.promise;
			return {};
		});
		peer.send({ jsonrpc: "2.0", id: 1, method: "a" });
		await Bun.sleep(20);
		expect(signalled).toBe(false);
		gate.resolve();
		peer.end();
		await peer.connection.closed;
		expect(peer.sunk).toHaveLength(1);
		expect(sunkWhenSignalled).toEqual([1]);
	});

	it("resolves every batch entry's signal only after the batch array is written", async () => {
		const gate = Promise.withResolvers<void>();
		const sunkWhenSignalled: number[] = [];
		let signalled = false;
		const peer = framePeer(async method => {
			if (method === "a") {
				void responseWritten().then(() => {
					signalled = true;
					sunkWhenSignalled.push(peer.sunk.length);
				});
				return {};
			}
			await gate.promise;
			return {};
		});
		peer.send([
			{ jsonrpc: "2.0", id: 1, method: "a" },
			{ jsonrpc: "2.0", id: 2, method: "b" },
		]);
		await Bun.sleep(20);
		expect(signalled).toBe(false);
		gate.resolve();
		peer.end();
		await peer.connection.closed;
		expect(peer.sunk).toHaveLength(1);
		expect(sunkWhenSignalled).toEqual([1]);
	});

	it("resolves when the drain timeout answers a handler that never settles", async () => {
		vi.useFakeTimers();
		try {
			let signalled = false;
			const peer = framePeer(() => {
				void responseWritten().then(() => {
					signalled = true;
				});
				return new Promise(() => {});
			});
			peer.send({ jsonrpc: "2.0", id: 1, method: "a" });
			peer.end();
			for (let turn = 0; turn < 50; turn++) await Promise.resolve();
			expect(signalled).toBe(false);
			vi.advanceTimersByTime(30_000);
			await peer.connection.closed;
			expect(signalled).toBe(true);
			expect(peer.sunk).toEqual([{ jsonrpc: "2.0", id: 1, error: expect.objectContaining({ code: -32603 }) }]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("ACP JSON-RPC transport", () => {
	it("round-trips requests, notifications, and errors", async () => {
		const pair = transportPair();
		const updates: unknown[] = [];
		const updateReceived = Promise.withResolvers<void>();
		const client: Client = {
			requestPermission: async () => ({ outcome: { outcome: "cancelled" } }),
			sessionUpdate: async update => {
				updates.push(update);
				updateReceived.resolve();
			},
		};
		const clientConnection = new ClientSideConnection(() => client, pair.left);
		const agentConnection = new AgentSideConnection(
			connection => ({
				maxVersion: () => 1,
				v1: {
					initialize: params => ({ protocolVersion: params.protocolVersion }),
					newSession: async () => ({ sessionId: "session-1" }),
					prompt: async params => {
						if (params.prompt.length === 0) throw RequestError.invalidParams({ field: "prompt" });
						await connection.requestPermission({
							sessionId: params.sessionId,
							toolCall: { toolCallId: "tool-1" },
							options: [],
						});
						return { stopReason: "end_turn" };
					},
					cancel: async () => {},
				},
			}),
			pair.right,
		);

		await expect(clientConnection.initialize({ protocolVersion: 1, clientCapabilities: {} })).resolves.toEqual({
			protocolVersion: 1,
		});
		await agentConnection.sessionUpdate({ sessionId: "session-1", update: { sessionUpdate: "plan", entries: [] } });
		await updateReceived.promise;
		expect(updates).toHaveLength(1);
		await expect(
			clientConnection.prompt({
				sessionId: "session-1",
				prompt: [{ type: "text", text: "nested request" }],
			}),
		).resolves.toEqual({ stopReason: "end_turn" });
		await expect(clientConnection.prompt({ sessionId: "session-1", prompt: [] })).rejects.toMatchObject({
			code: -32602,
			data: { field: "prompt" },
		});
	});

	it("correlates out-of-order responses", async () => {
		const requests = new TransformStream<AnyMessage, AnyMessage>();
		const responses = new TransformStream<AnyMessage, AnyMessage>();
		const connection = new RpcConnection(
			{ writable: requests.writable, readable: responses.readable },
			() => undefined,
		);
		const reader = requests.readable.getReader();
		const writer = responses.writable.getWriter();
		const first = connection.request<string>("first");
		const second = connection.request<string>("second");
		const firstMessage = await reader.read();
		const secondMessage = await reader.read();
		if (firstMessage.done || secondMessage.done || !("id" in firstMessage.value) || !("id" in secondMessage.value))
			throw new Error("Expected requests");
		await writer.write({ jsonrpc: "2.0", id: secondMessage.value.id, result: "two" });
		await writer.write({ jsonrpc: "2.0", id: firstMessage.value.id, result: "one" });
		await expect(Promise.all([first, second])).resolves.toEqual(["one", "two"]);
		reader.releaseLock();
		writer.releaseLock();
	});

	it("decodes split and batched NDJSON frames", async () => {
		const bytes = new TransformStream<Uint8Array, Uint8Array>();
		const output = new TransformStream<Uint8Array, Uint8Array>();
		const stream = ndJsonStream(output.writable, bytes.readable);
		const writer = bytes.writable.getWriter();
		const reader = stream.readable.getReader();
		await writer.write(new TextEncoder().encode('{"jsonrpc":"2.0","method":"a","par'));
		await writer.write(new TextEncoder().encode('ams":{}}\n{"jsonrpc":"2.0","method":"b"}\n'));
		expect(await reader.read()).toMatchObject({ value: { method: "a", params: {} } });
		expect(await reader.read()).toMatchObject({ value: { method: "b" } });
		writer.releaseLock();
		reader.releaseLock();
	});
	it("drains accepted inbound requests before resolving closed on clean EOF", async () => {
		const inbound = new TransformStream<AnyMessage, AnyMessage>();
		const outbound = new TransformStream<AnyMessage, AnyMessage>();
		const sessionStarted = Promise.withResolvers<void>();
		const releaseSession = Promise.withResolvers<void>();
		const connection = new RpcConnection(
			{ writable: outbound.writable, readable: inbound.readable },
			async method => {
				if (method === "initialize") return { protocolVersion: 1 };
				if (method === "session/new") {
					sessionStarted.resolve();
					await releaseSession.promise;
					return { sessionId: "session-1" };
				}
				throw RequestError.methodNotFound(method);
			},
		);
		const writer = inbound.writable.getWriter();
		const reader = outbound.readable.getReader();
		await writer.write({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
		await writer.write({ jsonrpc: "2.0", id: 2, method: "session/new", params: {} });
		await sessionStarted.promise;
		await writer.close();

		const initialize = await reader.read();
		expect(initialize.done).toBe(false);
		expect(initialize.value).toEqual({ jsonrpc: "2.0", id: 1, result: { protocolVersion: 1 } });

		const closedBeforeDrain = await Promise.race([
			connection.closed.then(() => true),
			new Promise<boolean>(resolve => setTimeout(() => resolve(false), 25)),
		]);
		expect(closedBeforeDrain).toBe(false);

		releaseSession.resolve();
		const created = await reader.read();
		expect(created.done).toBe(false);
		expect(created.value).toEqual({ jsonrpc: "2.0", id: 2, result: { sessionId: "session-1" } });
		await connection.closed;
		reader.releaseLock();
	});

	it("still fail-fast closes on read errors without waiting for inbound handlers", async () => {
		const inbound = new TransformStream<AnyMessage, AnyMessage>();
		const outbound = new TransformStream<AnyMessage, AnyMessage>();
		const started = Promise.withResolvers<void>();
		const hold = Promise.withResolvers<void>();
		const connection = new RpcConnection({ writable: outbound.writable, readable: inbound.readable }, async () => {
			started.resolve();
			await hold.promise;
			return {};
		});
		const writer = inbound.writable.getWriter();
		await writer.write({ jsonrpc: "2.0", id: 1, method: "slow" });
		await started.promise;
		await writer.abort(new Error("broken pipe"));
		await connection.closed;
		hold.resolve();
	});

	it("matches the SDK error-code fixtures", () => {
		expect([
			RequestError.parseError().toErrorResponse(),
			RequestError.invalidRequest().toErrorResponse(),
			RequestError.methodNotFound("missing").toErrorResponse(),
			RequestError.invalidParams().toErrorResponse(),
			RequestError.internalError().toErrorResponse(),
			RequestError.requestCancelled().toErrorResponse(),
			RequestError.authRequired().toErrorResponse(),
			RequestError.resourceNotFound("file:///missing").toErrorResponse(),
			RequestError.sessionBusy("Agent is already processing.", { reason: "session_busy" }).toErrorResponse(),
		]).toEqual([
			{ code: -32700, message: "Parse error" },
			{ code: -32600, message: "Invalid request" },
			{ code: -32601, message: '"Method not found": missing', data: { method: "missing" } },
			{ code: -32602, message: "Invalid params" },
			{ code: -32603, message: "Internal error" },
			{ code: -32800, message: "Request cancelled" },
			{ code: -32000, message: "Authentication required" },
			{ code: -32002, message: "Resource not found: file:///missing", data: { uri: "file:///missing" } },
			{ code: -32003, message: "Agent is already processing.", data: { reason: "session_busy" } },
		]);
	});

	it("requestCancellable rejects the pending entry, notifies $/cancel_request, and ignores late responses", async () => {
		const inbound = new TransformStream<AnyMessage, AnyMessage>();
		const outbound = new TransformStream<AnyMessage, AnyMessage>();
		const connection = new RpcConnection({ writable: outbound.writable, readable: inbound.readable }, async () => {
			throw RequestError.methodNotFound("unused");
		});
		const reader = outbound.readable.getReader();
		const writer = inbound.writable.getWriter();

		const { promise, cancel } = connection.requestCancellable<{ outcome: unknown }>("session/request_permission", {
			sessionId: "session-1",
		});

		// The request frame goes out with a fresh id.
		const requestFrame = await reader.read();
		expect(requestFrame.value).toMatchObject({ jsonrpc: "2.0", method: "session/request_permission" });
		const requestId = (requestFrame.value as { id: number }).id;

		cancel();

		// The promise rejects as request-cancelled …
		const error = await promise.then(
			() => undefined,
			(rejection: unknown) => rejection,
		);
		expect(error).toBeInstanceOf(RequestError);
		expect((error as RequestError).code).toBe(-32800);

		// … the peer is told via $/cancel_request …
		const cancelFrame = await reader.read();
		expect(cancelFrame.value).toEqual({
			jsonrpc: "2.0",
			method: "$/cancel_request",
			params: { requestId },
		});

		// … and a late response for the dropped entry is ignored rather than
		// rejecting anything or throwing on an unknown id.
		await writer.write({
			jsonrpc: "2.0",
			id: requestId,
			result: { outcome: { outcome: "selected", optionId: "x" } },
		});
		await Bun.sleep(0);
		expect(connection.signal.aborted).toBe(false);

		// A second cancel is a no-op — the entry is already gone.
		cancel();
		await Bun.sleep(0);
		await connection.close();
		reader.releaseLock();
		writer.releaseLock();
	});

	it("requestPermissionWithCancel ends the client's inbound handler via its abort signal", async () => {
		// The receiving half of a cancelled elicit: `cancel()` used to only
		// drop the sender's pending entry and send `$/cancel_request` — the
		// client-side handler (a dialog) never learned about it and held the
		// clean-EOF drain until the 30 s timeout. The handler now receives the
		// request's abort signal, ends on it, and its late response is
		// suppressed on the agent side.
		const pair = transportPair();
		const handlerStarted = Promise.withResolvers<void>();
		const handlerEnded = Promise.withResolvers<void>();
		let handlerSignal: AbortSignal | undefined;
		const client: Client = {
			requestPermission(_params, options) {
				handlerSignal = options?.signal;
				handlerStarted.resolve();
				const gate = Promise.withResolvers<void>();
				if (options?.signal?.aborted) gate.resolve();
				else options?.signal?.addEventListener("abort", () => gate.resolve(), { once: true });
				return gate.promise.then(() => {
					handlerEnded.resolve();
					return { outcome: { outcome: "cancelled" as const } };
				});
			},
			sessionUpdate: async () => {},
		};
		const _clientConnection = new ClientSideConnection(() => client, pair.left);
		const agentConnection = new AgentSideConnection(
			connection => ({
				maxVersion: () => 1,
				v1: {
					initialize: params => ({ protocolVersion: params.protocolVersion }),
					newSession: async () => ({ sessionId: "session-1" }),
					prompt: async () => {
						void connection;
						return { stopReason: "end_turn" };
					},
					cancel: async () => {},
				},
			}),
			pair.right,
		);

		const { promise, cancel } = agentConnection.requestPermissionWithCancel({
			sessionId: "session-1",
			toolCall: { toolCallId: "tool-1" },
			options: [],
		});
		await handlerStarted.promise;
		expect(handlerSignal).toBeDefined();

		// Agent-side cancellation must reach the handler through its signal…
		cancel();
		await handlerEnded.promise;

		// …and reject the elicit as request-cancelled; the handler's late
		// response for the dropped id is ignored (covered by the sender-side
		// test above), so nothing throws on either side.
		const error = await promise.then(
			() => undefined,
			(rejection: unknown) => rejection,
		);
		expect(error).toBeInstanceOf(RequestError);
		expect((error as RequestError).code).toBe(-32800);
	});

	it("answers a peer $/cancel_request with -32800 on the wire when the dispatcher honors cancellation", async () => {
		// ACP v1 spec: a cancelled inbound request must still receive a
		// response. The transport aborts the handler and writes the
		// `-32800` error itself, so a client that cancels its elicit is
		// never left waiting on a handler that may never settle.
		const inbound = new TransformStream<AnyMessage, AnyMessage>();
		const outbound = new TransformStream<AnyMessage, AnyMessage>();
		const handlerAborted = Promise.withResolvers<void>();
		const connection = new RpcConnection(
			{ writable: outbound.writable, readable: inbound.readable },
			async (_method: string, _params: unknown, _notification: boolean, signal?: AbortSignal) => {
				// A handler that parks until its abort signal fires: only the
				// transport's own response can settle the exchange.
				signal?.addEventListener("abort", () => handlerAborted.resolve(), { once: true });
				await handlerAborted.promise;
				return {};
			},
			{ honorsInboundCancellation: true },
		);
		const writer = inbound.writable.getWriter();
		const reader = outbound.readable.getReader();
		await writer.write({ jsonrpc: "2.0", id: 41, method: "session/request_permission" });
		await writer.write({
			jsonrpc: "2.0",
			method: "$/cancel_request",
			params: { requestId: 41 },
		});
		const response = (await reader.read()).value as { id: number; error?: { code: number } };
		expect(response.id).toBe(41);
		expect(response.error?.code).toBe(-32800);
		// The handler was aborted by the cancellation, not just answered around.
		await handlerAborted.promise;
		await connection.close();
		writer.releaseLock();
		reader.releaseLock();
	});

	it("keeps an agent request running and answers with its real result after a peer $/cancel_request", async () => {
		// The agent side's handlers never observe a cancel signal (prompts
		// are cancelled through `session/cancel`). Answering `-32800` there
		// would tell the client its prompt was cancelled while the turn kept
		// streaming, and drop the real stop reason.
		const inbound = new TransformStream<AnyMessage, AnyMessage>();
		const outbound = new TransformStream<AnyMessage, AnyMessage>();
		const finishPrompt = Promise.withResolvers<void>();
		const promptStarted = Promise.withResolvers<void>();
		const _agentConnection = new AgentSideConnection(
			() => ({
				maxVersion: () => 1,
				v1: {
					initialize: params => ({ protocolVersion: params.protocolVersion }),
					newSession: async () => ({ sessionId: "session-1" }),
					prompt: async () => {
						promptStarted.resolve();
						await finishPrompt.promise;
						return { stopReason: "end_turn" };
					},
					cancel: async () => {},
				},
			}),
			{ writable: outbound.writable, readable: inbound.readable },
		);
		const writer = inbound.writable.getWriter();
		const reader = outbound.readable.getReader();
		await writer.write({
			jsonrpc: "2.0",
			id: 7,
			method: "session/prompt",
			params: { sessionId: "session-1", prompt: [{ type: "text", text: "hi" }] },
		});
		await promptStarted.promise;
		await writer.write({ jsonrpc: "2.0", method: "$/cancel_request", params: { requestId: 7 } });
		finishPrompt.resolve();
		const response = (await reader.read()).value;
		expect(response).toEqual({ jsonrpc: "2.0", id: 7, result: { stopReason: "end_turn" } });
		writer.releaseLock();
		reader.releaseLock();
	});
});

describe("ACP runtime schemas", () => {
	it("accepts valid protocol vectors", () => {
		expect(schema.zNewSessionResponse.safeParse({ sessionId: "s" }).success).toBe(true);
		expect(schema.zPromptResponse.safeParse({ stopReason: "end_turn" }).success).toBe(true);
		expect(
			schema.zSessionNotification.safeParse({
				sessionId: "s",
				update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ok" } },
			}).success,
		).toBe(true);
	});

	it("rejects malformed protocol vectors", () => {
		expect(schema.zNewSessionResponse.safeParse({ sessionId: 4 }).success).toBe(false);
		expect(schema.zPromptResponse.safeParse({ stopReason: "done" }).success).toBe(false);
		expect(
			schema.zSessionNotification.safeParse({
				sessionId: "s",
				update: { sessionUpdate: "agent_message_chunk", content: { type: "text" } },
			}).success,
		).toBe(false);
	});
});

describe("ACP versioned dispatch", () => {
	/** Wires an {@link AgentSideConnection} to a raw client; records which surface handled each call. */
	function versioned(options: { v2: boolean; maxVersion: 1 | 2 }) {
		const calls: string[] = [];
		const v1 = {
			initialize: async () => {
				calls.push("v1.initialize");
				return { protocolVersion: 1 };
			},
			newSession: async () => {
				calls.push("v1.newSession");
				return { sessionId: "s1" };
			},
		} as unknown as Agent;
		const v2 = {
			initialize: async () => {
				calls.push("v2.initialize");
				return { protocolVersion: 2, info: { name: "a", version: "1" } };
			},
			logout: async () => {
				calls.push("v2.logout");
				return {};
			},
		} as unknown as AgentV2;
		const { left, right } = transportPair();
		new AgentSideConnection(
			(): AgentSurfaces => ({ v1, v2: options.v2 ? v2 : undefined, maxVersion: () => options.maxVersion }),
			left,
		);
		const client = new RpcConnection(right, () => {
			throw RequestError.methodNotFound("client");
		});
		return { calls, client };
	}
	const info = { name: "c", version: "1" };

	async function errorCode(promise: Promise<unknown>): Promise<number | undefined> {
		try {
			await promise;
			return undefined;
		} catch (error) {
			return error instanceof RequestError ? error.code : undefined;
		}
	}

	it("runs the v2 initialize when both sides support v2", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 2 });
		const result = await client.request<{ protocolVersion: number }>("initialize", { protocolVersion: 2, info });
		expect(result.protocolVersion).toBe(2);
		expect(calls).toEqual(["v2.initialize"]);
	});

	it("clamps a higher requested version down to 2", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 2 });
		const result = await client.request<{ protocolVersion: number }>("initialize", { protocolVersion: 3, info });
		expect(result.protocolVersion).toBe(2);
		expect(calls).toEqual(["v2.initialize"]);
	});

	it("selects v1 when maxVersion is 1 even if v2 is requested", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 1 });
		const result = await client.request<{ protocolVersion: number }>("initialize", { protocolVersion: 2 });
		expect(result.protocolVersion).toBe(1);
		expect(calls).toEqual(["v1.initialize"]);
	});

	it("selects v1 when no v2 surface exists", async () => {
		const { calls, client } = versioned({ v2: false, maxVersion: 2 });
		await client.request("initialize", { protocolVersion: 2 });
		expect(calls).toEqual(["v1.initialize"]);
	});

	it("rejects missing, non-integer and sub-1 protocolVersion with invalid params", async () => {
		for (const params of [{}, { protocolVersion: 0 }, { protocolVersion: "2" }, { protocolVersion: 1.5 }]) {
			const { calls, client } = versioned({ v2: true, maxVersion: 2 });
			expect(await errorCode(client.request("initialize", params))).toBe(-32602);
			expect(calls).toEqual([]);
		}
	});

	it("rejects a second initialize with invalid request", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 2 });
		await client.request("initialize", { protocolVersion: 2, info });
		expect(await errorCode(client.request("initialize", { protocolVersion: 2, info }))).toBe(-32600);
		expect(calls).toEqual(["v2.initialize"]);
	});

	it("routes v2-only methods to the v2 handler after v2 selection", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 2 });
		await client.request("initialize", { protocolVersion: 2, info });
		await client.request("auth/logout", {});
		expect(calls).toEqual(["v2.initialize", "v2.logout"]);
	});

	it("answers v2-only methods with method-not-found under v1", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 1 });
		await client.request("initialize", { protocolVersion: 2 });
		expect(await errorCode(client.request("auth/logout", {}))).toBe(-32601);
		expect(calls).toEqual(["v1.initialize"]);
	});

	it("keeps dispatching to v1 for frames before initialize", async () => {
		const { calls, client } = versioned({ v2: true, maxVersion: 2 });
		await client.request("session/new", {});
		expect(calls).toEqual(["v1.newSession"]);
	});
});
