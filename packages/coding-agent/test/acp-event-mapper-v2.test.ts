import { describe, expect, it } from "bun:test";
import type { v2 } from "@oh-my-pi/pi-utils/acp";
import {
	type AcpV2MapperOptions,
	buildV2PermissionRequest,
	convertV1UpdateToV2,
	interpretV2PermissionOutcome,
	mapAgentSessionEventToAcpV2Updates,
} from "../src/modes/acp/acp-event-mapper-v2";
import type { AgentSessionEvent } from "../src/session/agent-session";
import { validateAcpV2Frame } from "./acp-v2-schema";

const CWD = "/work/project";
const SESSION_ID = "session-1";

const options: AcpV2MapperOptions = {
	cwd: CWD,
	messageIdFor: (_message, role) => `msg-${role}`,
};

function expectValid(updates: v2.SessionUpdate[]): void {
	for (const update of updates) {
		expect(validateAcpV2Frame("notification", "session/update", { sessionId: SESSION_ID, update })).toEqual([]);
	}
}

function map(event: unknown, overrides: Partial<AcpV2MapperOptions> = {}): v2.SessionUpdate[] {
	const updates = mapAgentSessionEventToAcpV2Updates(event as AgentSessionEvent, { ...options, ...overrides });
	expectValid(updates);
	return updates;
}

function editEnd(details: unknown): v2.SessionUpdate[] {
	return map({
		type: "tool_execution_end",
		toolCallId: "tc-edit",
		toolName: "edit",
		isError: false,
		result: { content: [{ type: "text", text: "ok" }], details },
	});
}

function onlyDiff(updates: v2.SessionUpdate[]): v2.ToolCallDiff[] {
	const update = updates[0];
	if (update?.sessionUpdate !== "tool_call_update") throw new Error("expected tool_call_update");
	return (update.content ?? []).filter((item): item is v2.ToolCallDiff => item.type === "diff");
}

function patchOf(diff: v2.ToolCallDiff): { format: string; text: string; diff: string } {
	return diff.patch as { format: string; text: string; diff: string };
}

describe("v2 event mapping", () => {
	it("maps a tool start to tool_call_update, never tool_call", () => {
		const updates = map({
			type: "tool_execution_start",
			toolCallId: "tc-1",
			toolName: "edit",
			args: { path: "src/a.ts" },
		});
		expect(updates).toHaveLength(1);
		const [update] = updates;
		expect(update.sessionUpdate).toBe("tool_call_update");
		expect(update).toMatchObject({ toolCallId: "tc-1", status: "pending", kind: "edit" });
		expect(update).toMatchObject({ locations: [{ path: `${CWD}/src/a.ts` }] });
	});

	it("maps todo reminders and todo results to plan_update with the todo plan id", () => {
		const [reminder] = map({ type: "todo_reminder", todos: [{ content: "write", status: "in_progress" }] });
		expect(reminder).toEqual({
			sessionUpdate: "plan_update",
			plan: {
				type: "items",
				planId: "todo",
				entries: [{ content: "write", priority: "medium", status: "in_progress" }],
			},
		});
		const ended = map({
			type: "tool_execution_end",
			toolCallId: "tc-todo",
			toolName: "todo",
			isError: false,
			result: { content: [], details: { phases: [{ tasks: [{ content: "a", status: "completed" }] }] } },
		});
		expect(ended.map(update => update.sessionUpdate)).toEqual(["tool_call_update", "plan_update"]);
		expect(map({ type: "todo_auto_clear" })).toEqual([
			{ sessionUpdate: "plan_update", plan: { type: "items", planId: "todo", entries: [] } },
		]);
	});

	it("drops current_mode_update", () => {
		expect(
			convertV1UpdateToV2({ sessionUpdate: "current_mode_update", currentModeId: "plan" }, options),
		).toBeUndefined();
	});

	it("adds the text input type to available commands", () => {
		const converted = convertV1UpdateToV2(
			{
				sessionUpdate: "available_commands_update",
				availableCommands: [
					{ name: "compact", description: "Compact", input: { hint: "focus" } },
					{ name: "help", description: "Help" },
				],
			},
			options,
		);
		expect(converted).toEqual({
			sessionUpdate: "available_commands_update",
			availableCommands: [
				{ name: "compact", description: "Compact", input: { type: "text", hint: "focus" } },
				{ name: "help", description: "Help" },
			],
		});
		expectValid([converted as v2.SessionUpdate]);
	});

	it("converts config options to the v2 shape", () => {
		const converted = convertV1UpdateToV2(
			{
				sessionUpdate: "config_option_update",
				configOptions: [
					{
						id: "mode",
						name: "Mode",
						category: "mode",
						type: "select",
						currentValue: "a",
						options: [{ value: "a", name: "A", description: "first" }],
					},
					{ id: "flag", name: "Flag", type: "boolean", currentValue: true },
				],
			},
			options,
		);
		expectValid([converted as v2.SessionUpdate]);
		expect(converted).toMatchObject({ configOptions: [{ configId: "mode" }, { configId: "flag" }] });
	});

	it("drops terminal tool content and keeps the rest", () => {
		const converted = convertV1UpdateToV2(
			{
				sessionUpdate: "tool_call_update",
				toolCallId: "tc-term",
				status: "in_progress",
				content: [
					{ type: "terminal", terminalId: "term-1" },
					{ type: "content", content: { type: "text", text: "out" } },
				],
			},
			options,
		);
		expect(converted).toEqual({
			sessionUpdate: "tool_call_update",
			toolCallId: "tc-term",
			status: "in_progress",
			content: [{ type: "content", content: { type: "text", text: "out" } }],
		});
		const onlyTerminal = convertV1UpdateToV2(
			{ sessionUpdate: "tool_call_update", toolCallId: "tc-term", content: [{ type: "terminal", terminalId: "t" }] },
			options,
		);
		expect(onlyTerminal).toEqual({ sessionUpdate: "tool_call_update", toolCallId: "tc-term" });
		expectValid([converted as v2.SessionUpdate, onlyTerminal as v2.SessionUpdate]);
	});

	it("gives every message chunk a messageId from messageIdFor", () => {
		const message = { role: "assistant", content: [] };
		const seen: Array<[unknown, string]> = [];
		const recording: Partial<AcpV2MapperOptions> = {
			messageIdFor: (value, role) => {
				seen.push([value, role]);
				return `id-${role}`;
			},
		};
		const text = map(
			{
				type: "message_update",
				message,
				assistantMessageEvent: { type: "text_delta", delta: "hi", contentIndex: 0 },
			},
			recording,
		);
		expect(text).toEqual([
			{ sessionUpdate: "agent_message_chunk", messageId: "id-assistant", content: { type: "text", text: "hi" } },
		]);
		const thought = map(
			{
				type: "message_update",
				message,
				assistantMessageEvent: {
					type: "thinking_delta",
					delta: "hmm",
					contentIndex: 0,
					partial: { content: [{ type: "thinking", thinking: "hmm" }] },
				},
			},
			recording,
		);
		expect(thought).toMatchObject([{ sessionUpdate: "agent_thought_chunk", messageId: "id-thought" }]);
		expect(seen.map(([value]) => value)).toEqual([message, message]);
		const user = convertV1UpdateToV2(
			{ sessionUpdate: "user_message_chunk", content: { type: "text", text: "q" } },
			options,
			{ message: { role: "user" } },
		);
		expect(user).toMatchObject({ messageId: "msg-user" });
		expectValid([user as v2.SessionUpdate]);
	});
});

describe("v2 edit diffs", () => {
	it("maps update to modify with an absolute git patch", () => {
		const [diff] = onlyDiff(
			editEnd({ path: "a.txt", op: "update", oldText: "one\ntwo\n", newText: "one\n2\n", diff: "..." }),
		);
		expect(diff.changes).toEqual([{ operation: "modify", path: `${CWD}/a.txt` }]);
		const patch = patchOf(diff);
		expect(patch.format).toBe("git_patch");
		expect(patch.diff).toBe(patch.text);
		expect(patch.text).toContain(`diff --git ${CWD}/a.txt ${CWD}/a.txt`);
		expect(patch.text).toContain(`--- ${CWD}/a.txt\n+++ ${CWD}/a.txt\n`);
		expect(patch.text).not.toMatch(/ a\/| b\//);
	});

	it("maps create to add against /dev/null", () => {
		const [diff] = onlyDiff(editEnd({ path: "new.txt", op: "create", newText: "hi\n" }));
		expect(diff.changes).toEqual([{ operation: "add", path: `${CWD}/new.txt` }]);
		expect(patchOf(diff).text).toContain(`--- /dev/null\n+++ ${CWD}/new.txt\n`);
	});

	it("maps delete to delete against /dev/null", () => {
		const [diff] = onlyDiff(editEnd({ path: "gone.txt", op: "delete", oldText: "bye\n" }));
		expect(diff.changes).toEqual([{ operation: "delete", path: `${CWD}/gone.txt` }]);
		expect(patchOf(diff).text).toContain(`--- ${CWD}/gone.txt\n+++ /dev/null\n`);
	});

	it("maps move to move{oldPath,path} with rename lines", () => {
		const [diff] = onlyDiff(
			editEnd({
				path: "b.txt",
				op: "update",
				move: "b.txt",
				sourcePath: "a.txt",
				oldText: "x\ny\n",
				newText: "x\nz\n",
			}),
		);
		expect(diff.changes).toEqual([{ operation: "move", oldPath: `${CWD}/a.txt`, path: `${CWD}/b.txt` }]);
		const { text } = patchOf(diff);
		expect(text).toContain(`rename from ${CWD}/a.txt\nrename to ${CWD}/b.txt\n`);
	});

	it("sends changes only when snapshots were pruned", () => {
		const [diff] = onlyDiff(editEnd({ path: "big.txt", op: "update", snapshotsPruned: true }));
		expect(diff.changes).toEqual([{ operation: "modify", path: `${CWD}/big.txt` }]);
		expect(diff.patch).toBeUndefined();
		expect("patch" in diff).toBe(false);
	});

	it("maps multi-file results one diff per file", () => {
		const diffs = onlyDiff(
			editEnd({
				perFileResults: [
					{ path: "/abs/a.txt", op: "update", oldText: "a\n", newText: "b\n" },
					{ path: "n.txt", op: "create", newText: "n\n" },
					{ path: "p.txt", op: "update", snapshotsPruned: true },
				],
			}),
		);
		expect(diffs.map(diff => diff.changes[0])).toEqual([
			{ operation: "modify", path: "/abs/a.txt" },
			{ operation: "add", path: `${CWD}/n.txt` },
			{ operation: "modify", path: `${CWD}/p.txt` },
		]);
		expect(diffs.map(diff => diff.patch !== undefined)).toEqual([true, true, false]);
	});
});

describe("v2 permission", () => {
	const toolCall = {
		toolCallId: "tc-1",
		toolName: "bash",
		title: "ls -la",
		kind: "execute",
		status: "pending" as const,
	};
	const choices = [
		{ optionId: "allow_once", name: "Allow once", kind: "allow_once" as const },
		{ optionId: "reject_once", name: "Reject", kind: "reject_once" as const },
	];

	it("builds a schema-valid request with tool_call subject", () => {
		const request = buildV2PermissionRequest(SESSION_ID, { ...toolCall, rawInput: { command: "ls" } }, choices);
		expect(validateAcpV2Frame("request", "session/request_permission", request)).toEqual([]);
		expect(request.title).toBe("ls -la");
		expect(request.subject).toMatchObject({ type: "tool_call", toolCall: { toolCallId: "tc-1", title: "ls -la" } });
	});

	it("falls back to Allow <tool>? when the title is empty", () => {
		const request = buildV2PermissionRequest(SESSION_ID, { ...toolCall, title: "" }, choices);
		expect(request.title).toBe("Allow bash?");
		expect(validateAcpV2Frame("request", "session/request_permission", request)).toEqual([]);
	});

	it("accepts only a selected known option; everything else is a rejection", () => {
		const known = choices.map(choice => choice.optionId);
		expect(interpretV2PermissionOutcome({ outcome: { outcome: "selected", optionId: "allow_once" } }, known)).toEqual(
			{
				outcome: "selected",
				optionId: "allow_once",
			},
		);
		const rejected = { outcome: "selected", optionId: "reject_once", kind: "reject_once" } as const;
		expect(interpretV2PermissionOutcome({ outcome: { outcome: "selected", optionId: "bogus" } }, known)).toEqual(
			rejected,
		);
		expect(interpretV2PermissionOutcome({ outcome: { outcome: "cancelled" } }, known)).toEqual(rejected);
		expect(interpretV2PermissionOutcome({ outcome: { outcome: "mystery" } } as never, known)).toEqual(rejected);
		expect(interpretV2PermissionOutcome({} as never, known)).toEqual(rejected);
	});
});

describe("validateAcpV2Frame", () => {
	it("rejects a v1 tool_call update", () => {
		const issues = validateAcpV2Frame("notification", "session/update", {
			sessionId: SESSION_ID,
			update: { sessionUpdate: "tool_call", toolCallId: "tc", title: "t" },
		});
		expect(issues.length).toBeGreaterThan(0);
	});
});
