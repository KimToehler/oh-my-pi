import { describe, expect, it } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { parseInternalUrl } from "@oh-my-pi/pi-coding-agent/internal-urls/parse";
import { XdProtocolHandler } from "@oh-my-pi/pi-coding-agent/internal-urls/xd-protocol";
import { getThemeByName } from "@oh-my-pi/pi-tui/theme";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import {
	dispatchResolutionDevice,
	isPreviewResolutionToolCall,
	isProposeToolCall,
	type PlanProposalCall,
	type PlanProposalHandler,
	PROPOSE_DEVICE_PATH,
	REJECT_DEVICE_PATH,
	RESOLVE_DEVICE_PATH,
	writeDeviceDispatch,
} from "@oh-my-pi/pi-coding-agent/tools/resolve";
import {
	PROPOSE_DEVICE_NAME,
	REJECT_DEVICE_NAME,
	RESOLVE_DEVICE_NAME,
	resolveRenderer,
} from "@oh-my-pi/pi-tui/tools/resolve";
import { sanitizeText } from "@oh-my-pi/pi-utils";

function createSession(
	options: {
		handler?: (input: unknown) => Promise<unknown>;
		proposalHandler?: PlanProposalHandler;
		submitPlanProposal?: ToolSession["submitPlanProposal"];
		clearPendingInvokers?: () => void;
	} = {},
): ToolSession {
	return {
		cwd: "/tmp",
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: Settings.isolated(),
		peekQueueInvoker: options.handler ? () => options.handler : () => undefined,
		peekPlanProposalHandler: options.proposalHandler ? () => options.proposalHandler : () => undefined,
		submitPlanProposal: options.submitPlanProposal,
		clearPendingInvokers: options.clearPendingInvokers,
	};
}

function getText(result: { content: Array<{ type: string; text?: string }> }): string {
	return result.content.find(part => part.type === "text")?.text ?? "";
}

describe("dispatchResolutionDevice", () => {
	it("errors and clears stale pending markers when resolve has no invoker", async () => {
		let clearRuns = 0;
		const session = createSession({
			clearPendingInvokers: () => {
				clearRuns++;
			},
		});
		await expect(dispatchResolutionDevice(session, RESOLVE_DEVICE_NAME, "looks correct")).rejects.toThrow(
			`No pending action to apply — ${RESOLVE_DEVICE_PATH} is only valid while a staged preview is pending.`,
		);
		expect(clearRuns).toBe(1);
	});

	it("treats reject with no pending action as a successful cancellation and clears stale markers", async () => {
		let clearRuns = 0;
		const session = createSession({
			clearPendingInvokers: () => {
				clearRuns++;
			},
		});
		const { result, xdev } = await dispatchResolutionDevice(
			session,
			REJECT_DEVICE_NAME,
			"Abandoning the staged edit.",
		);
		expect(result.isError ?? false).toBe(false);
		expect(getText(result)).toContain("Nothing to reject");
		expect(result.details).toMatchObject({ action: "discard", reason: "Abandoning the staged edit." });
		expect(xdev.inner).toMatchObject({ action: "discard" });
		expect(clearRuns).toBe(1);
	});

	it("rejects through the pending invoker", async () => {
		let rejectedReason: string | undefined;
		const handler = async (input: unknown) => {
			if (!input || typeof input !== "object" || !("action" in input) || !("reason" in input)) {
				throw new Error("invalid test input");
			}
			const action = input.action;
			const reason = input.reason;
			if (action === "discard" && typeof reason === "string") {
				rejectedReason = reason;
			}
			return {
				content: [{ type: "text", text: "Rejected pending preview." }],
				details: {
					action,
					reason,
					sourceToolName: "ast_edit",
					label: "AST Edit: 2 replacements in 1 file",
				},
			};
		};
		const { result, xdev } = await dispatchResolutionDevice(
			createSession({ handler }),
			REJECT_DEVICE_NAME,
			"Preview changed wrong callsites",
		);

		expect(getText(result)).toContain("Rejected pending preview.");
		expect(rejectedReason).toBe("Preview changed wrong callsites");
		expect(result.details).toEqual({
			action: "discard",
			reason: "Preview changed wrong callsites",
			sourceToolName: "ast_edit",
			label: "AST Edit: 2 replacements in 1 file",
		});
		expect(xdev.tool).toBe(REJECT_DEVICE_NAME);
	});

	it("applies through the pending invoker and carries dispatch metadata", async () => {
		let appliedReason: string | undefined;
		const handler = async (input: unknown) => {
			if (!input || typeof input !== "object" || !("action" in input) || !("reason" in input)) {
				throw new Error("invalid test input");
			}
			const action = input.action;
			const reason = input.reason;
			if (action === "apply" && typeof reason === "string") {
				appliedReason = reason;
			}
			return {
				content: [{ type: "text", text: "Applied 1 replacement in 1 file." }],
				details: {
					action,
					reason,
					sourceToolName: "ast_edit",
					label: "AST Edit: 1 replacement in 1 file",
				},
			};
		};
		const { result, xdev } = await dispatchResolutionDevice(
			createSession({ handler }),
			RESOLVE_DEVICE_NAME,
			"Preview is correct",
		);

		expect(appliedReason).toBe("Preview is correct");
		expect(getText(result)).toContain("Applied 1 replacement in 1 file.");
		expect(result.details).toEqual({
			action: "apply",
			reason: "Preview is correct",
			sourceToolName: "ast_edit",
			label: "AST Edit: 1 replacement in 1 file",
		});
		expect(writeDeviceDispatch("write", { details: { xdev } })?.tool).toBe(RESOLVE_DEVICE_NAME);
	});

	it("routes propose through submitPlanProposal with the call identity and the dispatching session", async () => {
		const submissions: Array<{ title: string; call: PlanProposalCall }> = [];
		const session = createSession({
			submitPlanProposal: async (title, call) => {
				submissions.push({ title, call });
				return {
					content: [{ type: "text", text: "Plan ready for approval." }],
					details: { planFilePath: "local://demo-plan.md", title, planExists: true },
				};
			},
		});
		const controller = new AbortController();

		const { result, xdev } = await dispatchResolutionDevice(session, PROPOSE_DEVICE_NAME, "  demo\n", {
			toolCallId: "call-propose-1",
			signal: controller.signal,
		});

		expect(submissions).toHaveLength(1);
		expect(submissions[0]?.title).toBe("demo");
		expect(submissions[0]?.call.toolCallId).toBe("call-propose-1");
		expect(submissions[0]?.call.signal).toBe(controller.signal);
		expect(submissions[0]?.call.toolSession).toBe(session);
		expect(getText(result)).toContain("Plan ready for approval.");
		expect(xdev).toEqual({
			tool: PROPOSE_DEVICE_NAME,
			mode: "execute",
			args: { title: "demo" },
			inner: { planFilePath: "local://demo-plan.md", title: "demo", planExists: true },
		});
	});

	it("errors on propose when the session cannot submit a plan, even with a handler installed", async () => {
		const proposalHandler: PlanProposalHandler = async () => ({ content: [] });
		for (const session of [createSession(), createSession({ proposalHandler })]) {
			await expect(dispatchResolutionDevice(session, PROPOSE_DEVICE_NAME, "demo")).rejects.toThrow(
				`No plan is awaiting approval — ${PROPOSE_DEVICE_PATH} only accepts a plan title while plan mode is active.`,
			);
		}
	});
});

describe("XdProtocolHandler propose write", () => {
	it("forwards the write tool call id and abort signal to submitPlanProposal", async () => {
		const calls: PlanProposalCall[] = [];
		const session = createSession({
			submitPlanProposal: async (_title, call) => {
				calls.push(call);
				return { content: [{ type: "text", text: "ok" }] };
			},
		});
		const controller = new AbortController();

		await new XdProtocolHandler().write(parseInternalUrl(PROPOSE_DEVICE_PATH), "demo", {
			session,
			signal: controller.signal,
			toolCall: { id: "write-call-7" },
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]?.toolCallId).toBe("write-call-7");
		expect(calls[0]?.signal).toBe(controller.signal);
		expect(calls[0]?.toolSession).toBe(session);
	});
});

describe("device tool-call predicates", () => {
	it("matches only writes targeting the preview-resolution devices", () => {
		expect(isPreviewResolutionToolCall({ name: "write", arguments: { path: RESOLVE_DEVICE_PATH } })).toBe(true);
		expect(isPreviewResolutionToolCall({ name: "write", arguments: { path: REJECT_DEVICE_PATH } })).toBe(true);
		expect(isPreviewResolutionToolCall({ name: "write", arguments: { path: PROPOSE_DEVICE_PATH } })).toBe(false);
		expect(isPreviewResolutionToolCall({ name: "write", arguments: { path: "/tmp/notes.md" } })).toBe(false);
		expect(isPreviewResolutionToolCall({ name: "edit", arguments: { path: RESOLVE_DEVICE_PATH } })).toBe(false);
	});

	it("matches only writes targeting xd://propose for plan decisions", () => {
		expect(isProposeToolCall({ name: "write", arguments: { path: PROPOSE_DEVICE_PATH } })).toBe(true);
		expect(isProposeToolCall({ name: "write", arguments: { path: RESOLVE_DEVICE_PATH } })).toBe(false);
		expect(isProposeToolCall({ name: "ask", arguments: {} })).toBe(false);
	});
});

it("renders a highlighted apply summary", async () => {
	const theme = await getThemeByName("dark");
	expect(theme).toBeDefined();
	const uiTheme = theme!;

	const component = resolveRenderer.renderResult(
		{
			content: [{ type: "text", text: "Applied 2 replacements in 1 file." }],
			details: {
				action: "apply",
				reason: "All replacements are correct",
				sourceToolName: "ast_edit",
				label: "AST Edit: 2 replacements in 1 file",
			},
		},
		{ expanded: false, isPartial: false },
		uiTheme,
	);

	const rendered = sanitizeText(component.render(90).join("\n"));
	expect(rendered).toContain("Accept: 2 replacements in 1 file");
	expect(rendered).toContain("AST Edit");
	expect(rendered).toContain("All replacements are correct");
	expect(rendered).not.toContain("Applied 2 replacements in 1 file.");
	expect(rendered).not.toContain("Decision");
	expect(rendered).not.toContain(uiTheme.boxRound.topLeft);
});

it("keeps the inverse block color across the full line (no mid-line fg reset)", async () => {
	const theme = await getThemeByName("dark");
	expect(theme).toBeDefined();
	const uiTheme = theme!;

	const component = resolveRenderer.renderResult(
		{
			content: [{ type: "text", text: "Applied 2 replacements in 1 file." }],
			details: {
				action: "apply",
				reason: "All replacements are correct",
				sourceToolName: "ast_edit",
				label: "AST Edit: 2 replacements in 1 file",
			},
		},
		{ expanded: false, isPartial: false },
		uiTheme,
	);

	for (const line of component.render(90)) {
		expect(line.split("\x1b[39m")).toHaveLength(2);
	}
});
