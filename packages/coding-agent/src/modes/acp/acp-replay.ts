/**
 * Transcript replay: turns stored session messages into v1 `SessionNotification`s.
 * Version-neutral builder shared by every ACP surface; v2 converts each
 * notification through the v2 mapper.
 */
import { canonicalizeMessage } from "@oh-my-pi/pi-tui/chat/thinking-display";
import type { PromptRequest, SessionNotification } from "@oh-my-pi/pi-utils/acp";
import type { AgentSession, AgentSessionEvent } from "../../session/agent-session";
import { type BlobStore, resolveImageDataSync } from "../../session/blob-store";
import { isSilentAbort } from "../../session/messages";
import { mapAgentSessionEventToAcpSessionUpdates, normalizeReplayToolArguments } from "./acp-event-mapper";

export type ReplayableMessage = {
	role: string;
	content?: unknown;
	errorMessage?: string;
	toolCallId?: string;
	toolName?: string;
	details?: unknown;
	isError?: boolean;
};

type ReplayableToolItem = {
	type?: unknown;
	id?: unknown;
	name?: unknown;
	arguments?: unknown;
	input?: unknown;
};

export function messageToReplayNotifications(
	blobs: BlobStore,
	sessionId: string,
	message: ReplayableMessage,
	cwd: string,
	replayedToolCallIds: Set<string>,
	replayedToolCallArgs: Map<string, unknown>,
): SessionNotification[] {
	if (message.role === "assistant") {
		return replayAssistantMessage(sessionId, message, cwd, replayedToolCallIds, replayedToolCallArgs);
	}
	if (
		message.role === "user" ||
		message.role === "developer" ||
		message.role === "custom" ||
		message.role === "hookMessage"
	) {
		return wrapReplayContent(
			sessionId,
			extractReplayContent(message.content, undefined),
			"user_message_chunk",
			crypto.randomUUID(),
		);
	}
	if (
		message.role === "toolResult" &&
		typeof message.toolCallId === "string" &&
		typeof message.toolName === "string"
	) {
		return replayToolResult(
			blobs,
			sessionId,
			cwd,
			{
				...message,
				toolCallId: message.toolCallId,
				toolName: message.toolName,
			},
			{
				includeStart: !replayedToolCallIds.has(message.toolCallId),
				toolArgs: replayedToolCallArgs.get(message.toolCallId),
			},
		);
	}
	if (message.role === "bashExecution" || message.role === "pythonExecution" || message.role === "compactionSummary") {
		return wrapReplayContent(
			sessionId,
			extractReplayContent(message.content, undefined),
			"user_message_chunk",
			crypto.randomUUID(),
		);
	}
	return [];
}

function replayAssistantMessage(
	sessionId: string,
	message: ReplayableMessage,
	cwd: string,
	replayedToolCallIds: Set<string>,
	replayedToolCallArgs: Map<string, unknown>,
): SessionNotification[] {
	const notifications: SessionNotification[] = [];
	const messageId = crypto.randomUUID();
	if (Array.isArray(message.content)) {
		for (const item of message.content) {
			if (typeof item !== "object" || item === null || !("type" in item)) {
				continue;
			}
			if (item.type === "text" && "text" in item && typeof item.text === "string" && item.text.length > 0) {
				notifications.push({
					sessionId,
					update: {
						sessionUpdate: "agent_message_chunk",
						content: { type: "text", text: item.text },
						messageId,
					},
				});
				continue;
			}
			if (
				item.type === "image" &&
				"data" in item &&
				typeof item.data === "string" &&
				"mimeType" in item &&
				typeof item.mimeType === "string"
			) {
				notifications.push({
					sessionId,
					update: {
						sessionUpdate: "agent_message_chunk",
						content: { type: "image", data: item.data, mimeType: item.mimeType },
						messageId,
					},
				});
				continue;
			}
			if (item.type === "thinking" && "thinking" in item && typeof item.thinking === "string") {
				const thinking = canonicalizeMessage(item.thinking);
				if (thinking.length === 0) continue;
				notifications.push({
					sessionId,
					update: {
						sessionUpdate: item.narration ? "agent_message_chunk" : "agent_thought_chunk",
						content: { type: "text", text: thinking },
						messageId,
					},
				});
				continue;
			}
			const toolItem = item as ReplayableToolItem;
			if (
				(toolItem.type === "toolCall" || toolItem.type === "tool_use") &&
				typeof toolItem.id === "string" &&
				typeof toolItem.name === "string"
			) {
				const args = buildReplayAssistantToolArgs(toolItem);
				notifications.push(
					...mapAgentSessionEventToAcpSessionUpdates(
						{
							type: "tool_execution_start",
							toolCallId: toolItem.id,
							toolName: toolItem.name,
							args,
						},
						sessionId,
						{ cwd },
					),
				);
				replayedToolCallIds.add(toolItem.id);
				replayedToolCallArgs.set(toolItem.id, args);
			}
		}
	}
	if (notifications.length === 0 && message.errorMessage && !isSilentAbort(message)) {
		notifications.push({
			sessionId,
			update: {
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: message.errorMessage },
				messageId,
			},
		});
	}
	return notifications;
}

function buildReplayAssistantToolArgs(item: ReplayableToolItem): unknown {
	if ("arguments" in item) {
		return normalizeReplayToolArguments(item.arguments).args;
	}
	if (item.type === "tool_use" && "input" in item) {
		return item.input;
	}
	return {};
}

function replayToolResult(
	blobs: BlobStore,
	sessionId: string,
	cwd: string,
	message: Required<Pick<ReplayableMessage, "toolCallId" | "toolName">> & ReplayableMessage,
	options: { includeStart?: boolean; toolArgs?: unknown } = {},
): SessionNotification[] {
	const args = buildReplayToolArgs(message.details);
	const startEvent: AgentSessionEvent = {
		type: "tool_execution_start",
		toolCallId: message.toolCallId,
		toolName: message.toolName,
		args,
	};
	const endEvent: AgentSessionEvent = {
		type: "tool_execution_end",
		toolCallId: message.toolCallId,
		toolName: message.toolName,
		isError: message.isError === true,
		result: {
			content: message.content,
			details: message.details,
			errorMessage: message.errorMessage,
		},
	};
	const notifications = mapAgentSessionEventToAcpSessionUpdates(endEvent, sessionId, {
		cwd,
		getToolArgs: toolCallId => (toolCallId === message.toolCallId ? options.toolArgs : undefined),
		resolveImageData: (data, _mimeType) => resolveImageDataSync(blobs, data),
	});
	if (options.includeStart === false) {
		return notifications;
	}
	return [...mapAgentSessionEventToAcpSessionUpdates(startEvent, sessionId, { cwd }), ...notifications];
}

function buildReplayToolArgs(details: unknown): { path?: string } {
	if (typeof details !== "object" || details === null || !("path" in details)) {
		return {};
	}
	const value = (details as { path?: unknown }).path;
	return typeof value === "string" && value.length > 0 ? { path: value } : {};
}

function wrapReplayContent(
	sessionId: string,
	content: PromptRequest["prompt"],
	kind: "agent_message_chunk" | "user_message_chunk",
	messageId: string,
): SessionNotification[] {
	return content.map(block => ({
		sessionId,
		update: {
			sessionUpdate: kind,
			content: block,
			messageId,
		},
	}));
}

function extractReplayContent(content: unknown, errorMessage: string | undefined): PromptRequest["prompt"] {
	const replay: PromptRequest["prompt"] = [];
	if (Array.isArray(content)) {
		for (const item of content) {
			if (typeof item !== "object" || item === null || !("type" in item)) {
				continue;
			}
			if (item.type === "text" && "text" in item && typeof item.text === "string" && item.text.length > 0) {
				replay.push({ type: "text", text: item.text });
				continue;
			}
			if (
				item.type === "image" &&
				"data" in item &&
				"mimeType" in item &&
				typeof item.data === "string" &&
				typeof item.mimeType === "string"
			) {
				replay.push({ type: "image", data: item.data, mimeType: item.mimeType });
			}
		}
	}
	if (replay.length === 0 && errorMessage) {
		replay.push({ type: "text", text: errorMessage });
	}
	return replay;
}

/** One stored message with the v1 notifications that replay it. */
export interface ReplayedMessage {
	message: ReplayableMessage;
	notifications: SessionNotification[];
}

/** Walks the session transcript in order, yielding each message's v1 replay notifications. */
export function* iterateSessionReplay(session: AgentSession, blobs: BlobStore): Generator<ReplayedMessage> {
	const cwd = session.sessionManager.getCwd();
	const replayedToolCallIds = new Set<string>();
	const replayedToolCallArgs = new Map<string, unknown>();
	for (const message of session.sessionManager.buildSessionContext().messages as ReplayableMessage[]) {
		yield {
			message,
			notifications: messageToReplayNotifications(
				blobs,
				session.sessionId,
				message,
				cwd,
				replayedToolCallIds,
				replayedToolCallArgs,
			),
		};
	}
}
