/**
 * ACP protocol v2 update mapping.
 *
 * Pure translation layer over the v1 mapper: the v1 mapper decides *what* happened, this module decides how v2
 * spells it. No lifecycle, state or prompt handling lives here.
 */
import * as path from "node:path";
import type {
	ContentBlock,
	SessionUpdate,
	ToolCall,
	ToolCallContent,
	ToolCallUpdate,
	v2,
} from "@oh-my-pi/pi-utils/acp";
import { isRecord } from "@oh-my-pi/pi-utils";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import type { AgentSessionEvent } from "../../session/agent-session";
import { resolveToCwd } from "../../tools/path-utils";
import { type AcpEventMapperOptions, mapAgentSessionEventToAcpSessionUpdates } from "./acp-event-mapper";
import { buildGitPatch, type GitPatchFile } from "./acp-git-patch";

export type AcpV2MessageRole = "assistant" | "thought" | "user";

export interface AcpV2MapperOptions extends AcpEventMapperOptions {
	/** Session cwd; every path sent to a v2 client is absolute against it. */
	cwd: string;
	/** Stable message id for the message a chunk belongs to. */
	messageIdFor(message: unknown, role: AcpV2MessageRole): string;
}

/** Option id used when a v2 permission response is not a valid selection. Matches the gate's reject option. */
const V2_REJECT_OPTION_ID = "reject_once";

/** Map one session event to v2 updates (the v1 mapping, converted). */
export function mapAgentSessionEventToAcpV2Updates(
	event: AgentSessionEvent,
	options: AcpV2MapperOptions,
): v2.SessionUpdate[] {
	const source =
		event.type === "message_update" || event.type === "message_end" ? { message: event.message } : undefined;
	const updates: v2.SessionUpdate[] = [];
	for (const notification of mapAgentSessionEventToAcpSessionUpdates(event, "", options)) {
		const converted = convertV1UpdateToV2(notification.update, options, source);
		if (converted) updates.push(converted);
	}
	return updates;
}

/** Convert one v1 update to its v2 spelling; `undefined` means the update has no v2 equivalent and is dropped. */
export function convertV1UpdateToV2(
	update: SessionUpdate,
	options: AcpV2MapperOptions,
	source?: { message?: unknown },
): v2.SessionUpdate | undefined {
	switch (update.sessionUpdate) {
		case "agent_message_chunk":
		case "agent_thought_chunk":
		case "user_message_chunk": {
			const role: AcpV2MessageRole =
				update.sessionUpdate === "agent_message_chunk"
					? "assistant"
					: update.sessionUpdate === "agent_thought_chunk"
						? "thought"
						: "user";
			const messageId =
				source?.message !== undefined
					? options.messageIdFor(source.message, role)
					: (update.messageId ?? options.messageIdFor(undefined, role));
			return {
				sessionUpdate: update.sessionUpdate,
				messageId,
				content: convertContentBlock(update.content),
				...(update._meta !== undefined ? { _meta: update._meta } : {}),
			};
		}
		case "tool_call":
		case "tool_call_update":
			return { sessionUpdate: "tool_call_update", ...convertToolCallFields(update, options) };
		case "plan":
			return {
				sessionUpdate: "plan_update",
				plan: {
					type: "items",
					planId: "todo",
					entries: update.entries.map(entry => ({
						content: entry.content,
						priority: entry.priority,
						status: entry.status,
					})),
				},
			};
		case "current_mode_update":
			return undefined;
		case "available_commands_update":
			return {
				sessionUpdate: "available_commands_update",
				availableCommands: update.availableCommands.map(command => ({
					name: command.name,
					description: command.description,
					...(command.input ? { input: { type: "text" as const, hint: command.input.hint } } : {}),
				})),
			};
		case "config_option_update":
			return {
				sessionUpdate: "config_option_update",
				configOptions: update.configOptions.map(convertConfigOption),
			};
		case "session_info_update":
			return {
				sessionUpdate: "session_info_update",
				...(update.title !== undefined ? { title: update.title } : {}),
				...(update.updatedAt !== undefined ? { updatedAt: update.updatedAt } : {}),
			};
		case "usage_update":
			return {
				sessionUpdate: "usage_update",
				used: update.used,
				size: update.size,
				...(update.cost !== undefined ? { cost: update.cost } : {}),
			};
	}
}

/** Build the v2 `session/request_permission` request for a gated tool call. */
export function buildV2PermissionRequest(
	sessionId: string,
	toolCall: ClientBridgePermissionToolCall,
	options: ClientBridgePermissionOption[],
): v2.RequestPermissionRequest {
	const update: v2.ToolCallUpdate = {
		toolCallId: toolCall.toolCallId,
		name: toolCall.toolName,
		title: toolCall.title,
	};
	if (toolCall.kind) update.kind = toolCall.kind as v2.ToolKind;
	if (toolCall.status) update.status = toolCall.status;
	if (toolCall.rawInput !== undefined) update.rawInput = toolCall.rawInput;
	if (toolCall.content) {
		const content = convertToolContent(toolCall.content as ToolCallContent[], undefined, undefined);
		if (content.length > 0) update.content = content;
	}
	if (toolCall.locations) update.locations = toolCall.locations;
	return {
		sessionId,
		title: toolCall.title || `Allow ${toolCall.toolName}?`,
		subject: { type: "tool_call", toolCall: update },
		options: options.map(option => ({ optionId: option.optionId, name: option.name, kind: option.kind })),
	};
}

/**
 * Anything other than `selected` with a known option id is a rejection; it is reported as a selection of the
 * gate's reject option so the permission gate fails closed instead of running the tool.
 */
export function interpretV2PermissionOutcome(
	response: v2.RequestPermissionResponse,
	knownOptionIds: readonly string[],
): ClientBridgePermissionOutcome {
	const outcome: unknown = isRecord(response) ? response.outcome : undefined;
	if (isRecord(outcome) && outcome.outcome === "selected" && typeof outcome.optionId === "string") {
		if (knownOptionIds.includes(outcome.optionId)) return { outcome: "selected", optionId: outcome.optionId };
	}
	return { outcome: "selected", optionId: V2_REJECT_OPTION_ID, kind: "reject_once" };
}

function convertToolCallFields(update: ToolCall | ToolCallUpdate, options: AcpV2MapperOptions): v2.ToolCallUpdate {
	const out: v2.ToolCallUpdate = { toolCallId: update.toolCallId };
	if (update.title !== undefined) out.title = update.title;
	if (update.kind !== undefined) out.kind = update.kind;
	if (update.status !== undefined) out.status = update.status;
	if (update.rawInput !== undefined) out.rawInput = update.rawInput;
	if (update.rawOutput !== undefined) out.rawOutput = update.rawOutput;
	if (update.locations !== undefined) out.locations = update.locations;
	if (update._meta !== undefined) out._meta = update._meta;
	if (update.content) {
		const content = convertToolContent(update.content, update.rawOutput, options.cwd);
		if (content.length > 0) out.content = content;
	}
	return out;
}

function convertToolContent(
	content: ToolCallContent[],
	rawOutput: unknown,
	cwd: string | undefined,
): v2.ToolCallContent[] {
	const edits = cwd === undefined ? [] : extractEditDiffs(rawOutput, cwd);
	const result: v2.ToolCallContent[] = [];
	let editsInserted = false;
	const insertEdits = () => {
		if (editsInserted) return;
		editsInserted = true;
		result.push(...edits);
	};
	for (const item of content) {
		switch (item.type) {
			case "content":
				result.push({ type: "content", content: convertContentBlock(item.content) });
				break;
			case "diff":
				if (edits.length > 0) {
					insertEdits();
				} else {
					{
						const inferred = inferDiff(item, cwd);
						if (inferred) result.push(inferred);
					}
				}
				break;
			case "terminal":
				// Terminal content is dropped until the terminal surface exists.
				break;
		}
	}
	if (edits.length > 0 && !editsInserted) result.unshift(...edits);
	return result;
}

function convertContentBlock(block: ContentBlock): v2.ContentBlock {
	switch (block.type) {
		case "text":
			return { type: "text", text: block.text };
		case "image":
			return {
				type: "image",
				data: block.data,
				mimeType: block.mimeType,
			};
		case "audio":
			return { type: "audio", data: block.data, mimeType: block.mimeType };
		case "resource_link":
			return {
				type: "resource_link",
				uri: block.uri,
				name: block.name ?? block.title ?? block.uri,
				...(block.title !== undefined ? { title: block.title } : {}),
				...(block.description !== undefined ? { description: block.description } : {}),
				...(block.mimeType !== undefined ? { mimeType: block.mimeType } : {}),
				...(block.size !== undefined ? { size: block.size } : {}),
			};
		case "resource":
			return {
				type: "resource",
				resource:
					"text" in block.resource
						? {
								uri: block.resource.uri,
								text: block.resource.text,
								...(block.resource.mimeType !== undefined ? { mimeType: block.resource.mimeType } : {}),
							}
						: {
								uri: block.resource.uri,
								blob: block.resource.blob,
								...(block.resource.mimeType !== undefined ? { mimeType: block.resource.mimeType } : {}),
							},
			};
	}
}

function convertConfigOption(
	option: Extract<SessionUpdate, { sessionUpdate: "config_option_update" }>["configOptions"][number],
): v2.SessionConfigOption {
	const base = {
		configId: option.id,
		name: option.name,
		...(option.description !== undefined ? { description: option.description } : {}),
		...(option.category !== undefined ? { category: option.category } : {}),
		...(option._meta !== undefined ? { _meta: option._meta } : {}),
	};
	if (option.type === "boolean") return { ...base, type: "boolean", currentValue: option.currentValue };
	return {
		...base,
		type: "select",
		currentValue: option.currentValue,
		options: option.options.map(entry => ({
			value: entry.value,
			name: entry.name,
			...(entry.description !== undefined ? { description: entry.description } : {}),
		})),
	};
}

function absolutePath(value: string, cwd: string | undefined): string {
	if (!cwd) return value;
	try {
		return resolveToCwd(value, cwd);
	} catch {
		return path.resolve(cwd, value);
	}
}

/** A v1 diff item carries no operation; creation is the only one it can express besides modification. */
function inferDiff(
	item: Extract<ToolCallContent, { type: "diff" }>,
	cwd: string | undefined,
): v2.ToolCallDiff | undefined {
	const target = absolutePath(item.path, cwd);
	if (!path.isAbsolute(target)) return undefined;
	const oldText = item.oldText ?? null;
	const operation = oldText === null ? "add" : "modify";
	const diff: v2.ToolCallDiff = { type: "diff", changes: [{ operation, path: target }] };
	diff.patch = gitPatch([{ path: target, oldText, newText: item.newText }]);
	return diff;
}

/** `diff` mirrors `text` for clients still on the pre-release field name (accepted residual risk 1 in the plan). */
function gitPatch(files: GitPatchFile[]): v2.DiffPatch {
	const text = buildGitPatch(files);
	const patch: v2.DiffPatch & { diff: string } = { format: "git_patch", text, diff: text };
	return patch;
}

interface EditFileEntry {
	path: string;
	op?: "create" | "update" | "delete";
	move?: string;
	sourcePath?: string;
	oldText?: string;
	newText?: string;
	snapshotsPruned?: boolean;
}

function readEditEntry(value: unknown): EditFileEntry | undefined {
	if (!isRecord(value) || value.isError === true) return undefined;
	if (typeof value.path !== "string" || value.path.length === 0) return undefined;
	const op = value.op === "create" || value.op === "update" || value.op === "delete" ? value.op : undefined;
	const oldText = typeof value.oldText === "string" ? value.oldText : undefined;
	const newText = typeof value.newText === "string" ? value.newText : undefined;
	const snapshotsPruned = value.snapshotsPruned === true;
	if (op === undefined && oldText === undefined && newText === undefined && !snapshotsPruned) return undefined;
	return {
		path: value.path,
		op,
		move: typeof value.move === "string" ? value.move : undefined,
		sourcePath: typeof value.sourcePath === "string" ? value.sourcePath : undefined,
		oldText,
		newText,
		snapshotsPruned,
	};
}

/** One v2 diff per file the edit tool reported, with operations, absolute paths and (when snapshots survive) a patch. */
function extractEditDiffs(result: unknown, cwd: string): v2.ToolCallDiff[] {
	if (!isRecord(result) || !isRecord(result.details)) return [];
	const details = result.details;
	const entries = Array.isArray(details.perFileResults) ? details.perFileResults : [details];
	const diffs: v2.ToolCallDiff[] = [];
	for (const raw of entries) {
		const entry = readEditEntry(raw);
		if (entry) diffs.push(buildEditDiff(entry, cwd));
	}
	return diffs;
}

function buildEditDiff(entry: EditFileEntry, cwd: string): v2.ToolCallDiff {
	const target = absolutePath(entry.path, cwd);
	const isMove = entry.move !== undefined && entry.sourcePath !== undefined;
	const op = entry.op ?? (entry.oldText === undefined && entry.newText !== undefined ? "create" : "update");
	const oldPath = isMove ? absolutePath(entry.sourcePath as string, cwd) : undefined;

	let change: v2.DiffChange;
	if (oldPath !== undefined) change = { operation: "move", oldPath, path: target };
	else if (op === "create") change = { operation: "add", path: target };
	else if (op === "delete") change = { operation: "delete", path: target };
	else change = { operation: "modify", path: target };
	const diff: v2.ToolCallDiff = { type: "diff", changes: [change] };
	if (entry.snapshotsPruned) return diff;

	let patchFile: GitPatchFile | undefined;
	if (op === "create" && oldPath === undefined) {
		if (entry.newText !== undefined) patchFile = { path: target, oldText: null, newText: entry.newText };
	} else if (op === "delete") {
		if (entry.oldText !== undefined) patchFile = { path: target, oldText: entry.oldText, newText: null };
	} else if (entry.oldText !== undefined && entry.newText !== undefined) {
		patchFile = {
			path: target,
			...(oldPath !== undefined ? { oldPath } : {}),
			oldText: entry.oldText,
			newText: entry.newText,
		};
	}
	if (patchFile) diff.patch = gitPatch([patchFile]);
	return diff;
}
