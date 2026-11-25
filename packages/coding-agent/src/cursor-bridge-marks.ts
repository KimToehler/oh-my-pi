/**
 * Marks the Cursor exec bridge (`./cursor`) puts on the objects it hands out.
 * Kept in this leaf module so the session and stream wrappers can read them
 * without pulling the bridge into the startup import graph.
 */
import type { AgentEvent } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage, CursorExecHandlers } from "@oh-my-pi/pi-ai";

/** Brands the session's Cursor exec bridge (`CursorExecHandlers` in `./cursor`). */
export const kCursorExecBridge = Symbol("omp.cursorExecBridge");

interface SignalBindableCursorExecHandlers extends CursorExecHandlers {
	readonly [kCursorExecBridge]: true;
	withSignal(signal: AbortSignal | undefined): CursorExecHandlers;
}

function isSignalBindable(handlers: CursorExecHandlers): handlers is SignalBindableCursorExecHandlers {
	return kCursorExecBridge in handlers;
}

/**
 * Hand a request's bridge to the provider bound to that request's signal.
 *
 * The bridge is built once per session, while each provider request carries
 * its own signal. Stream wrappers call this with the options they forward, so
 * the handlers the provider dispatches into stop with the request they serve
 * and share that request's proposal barrier. Handlers that are not this bridge
 * pass through unchanged.
 */
export function bindCursorExecSignal(
	handlers: CursorExecHandlers | undefined,
	signal: AbortSignal | undefined,
): CursorExecHandlers | undefined {
	return handlers && isSignalBindable(handlers) ? handlers.withSignal(signal) : handlers;
}

/**
 * Carries the provider's live assistant message on the bridge's own
 * `tool_execution_start`. Bridged calls bypass the agent loop's
 * `beforeToolCall`, so this is how the session learns which message made one.
 */
export const kCursorBridgeMessage = Symbol("cursor.bridge.message");

type ToolExecutionStartEvent = Extract<AgentEvent, { type: "tool_execution_start" }>;
export type BridgedToolExecutionStart = ToolExecutionStartEvent & { [kCursorBridgeMessage]?: AssistantMessage };

/** The provider message a bridged `tool_execution_start` executes under, when the provider proved it. */
export function cursorBridgeMessage(event: ToolExecutionStartEvent): AssistantMessage | undefined {
	return (event as BridgedToolExecutionStart)[kCursorBridgeMessage];
}
