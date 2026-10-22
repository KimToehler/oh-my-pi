import { type OutboundFrame, UNPARSEABLE_FRAME } from "./transport";

/**
 * Bidirectional JSON-RPC frame transport. Inbound frames are parsed JSON values (a message, a
 * batch array, or anything else a peer sent) or {@link UNPARSEABLE_FRAME}; the connection
 * validates and answers them per JSON-RPC 2.0.
 */
export interface Stream {
	writable: WritableStream<OutboundFrame>;
	readable: ReadableStream<unknown>;
}

/** Converts byte-oriented newline-delimited JSON streams to an ACP message transport. */
export function ndJsonStream(output: WritableStream<Uint8Array>, input: ReadableStream<Uint8Array>): Stream {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	const writable = new WritableStream<OutboundFrame>({
		async write(message) {
			const writer = output.getWriter();
			try {
				await writer.write(encoder.encode(`${JSON.stringify(message)}\n`));
			} finally {
				writer.releaseLock();
			}
		},
		async close() {
			const writer = output.getWriter();
			try {
				await writer.close();
			} finally {
				writer.releaseLock();
			}
		},
		async abort(reason) {
			const writer = output.getWriter();
			try {
				await writer.abort(reason);
			} finally {
				writer.releaseLock();
			}
		},
	});
	let buffered = "";
	const readable = new ReadableStream<unknown>({
		async start(controller) {
			const reader = input.getReader();
			try {
				while (true) {
					const next = await reader.read();
					if (next.done) break;
					buffered += decoder.decode(next.value, { stream: true });
					let newline = buffered.indexOf("\n");
					while (newline >= 0) {
						const line = buffered.slice(0, newline).trimEnd();
						buffered = buffered.slice(newline + 1);
						if (line.length > 0) controller.enqueue(parseFrame(line));
						newline = buffered.indexOf("\n");
					}
				}
				buffered += decoder.decode();
				const finalLine = buffered.trim();
				if (finalLine.length > 0) controller.enqueue(parseFrame(finalLine));
				controller.close();
			} catch (error) {
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
	});
	return { writable, readable };
}

function parseFrame(line: string): unknown {
	try {
		return JSON.parse(line);
	} catch {
		return UNPARSEABLE_FRAME;
	}
}
