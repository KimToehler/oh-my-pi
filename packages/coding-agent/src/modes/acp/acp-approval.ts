/**
 * ACP's tool-approval dialog. The approval gate (`ExtensionToolWrapper`) decides whether a call
 * needs consent exactly as in the TUI; when it does, `approve` sends one
 * `session/request_permission` for the pending call and maps the selected option back to the
 * gate's answer.
 */
import { type EditInspection, editInspect } from "@oh-my-pi/pi-natives";
import { isRecord, Snowflake, stringProperty } from "@oh-my-pi/pi-utils";
import { ToolError } from "@oh-my-pi/pi-tui/tools/tool-errors";
import type {
	ExtensionApprovalAnswer,
	ExtensionApprovalPrompt,
	ExtensionUIDialogOptions,
} from "../../extensibility/extensions/types";
import type { ApprovalSupersedeWatch } from "../../session/agent-session-types";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "../../session/client-bridge";
import { approvalOnceLabel } from "../../tools/approval";
import { resolveToCwd } from "../../tools/path-utils";
import { ToolAbortError } from "../../tools/tool-errors";
import type { AcpPermissionRequester } from "./acp-client-bridge";
import type { InteractionTracker } from "./acp-foreground";

/** Converts tool path arguments into absolute ACP editor locations. */
export function extractPermissionLocations(args: unknown, cwd: string): { path: string; line?: number }[] {
	if (!isRecord(args)) return [];
	const out: { path: string; line?: number }[] = [];
	const push = locationPusher(out, cwd);
	push(args.path);
	push(args.file);
	if (Array.isArray(args.paths)) {
		for (const filePath of args.paths) push(filePath);
	}
	push(args.oldPath);
	push(args.newPath);
	push(args.from);
	push(args.to);
	push(args.source);
	push(args.destination);
	return out;
}

/**
 * Locations an `edit` payload touches: every file it edits, deletes or moves, and each move's
 * target. Hashline and apply_patch payloads carry only `input`, so the generic extractor finds no
 * path in them; the payload is parsed with each edit syntax until one names a file.
 */
export function editPermissionLocations(args: unknown, cwd: string): { path: string; line?: number }[] {
	if (!isRecord(args)) return [];
	const argsJson = JSON.stringify(args);
	const modes = Array.isArray(args.edits) ? ["patch"] : ["hashline", "apply_patch"];
	for (const mode of modes) {
		let inspection: EditInspection;
		try {
			inspection = editInspect(mode, argsJson);
		} catch {
			continue; // The payload does not use this edit mode's syntax.
		}
		const out: { path: string; line?: number }[] = [];
		const push = locationPusher(out, cwd);
		for (const target of inspection.paths) push(target);
		for (const op of inspection.fileOps) {
			push(op.path);
			push(op.to);
		}
		if (out.length > 0) return out;
	}
	return extractPermissionLocations(args, cwd);
}

/** Adds a raw path argument to `out` as an absolute, de-duplicated location; non-paths are skipped. */
function locationPusher(out: { path: string; line?: number }[], cwd: string): (value: unknown) => void {
	return value => {
		if (typeof value !== "string" || value.length === 0) return;
		// The editor host opens or focuses these, so they must be absolute: tool args are often
		// cwd-relative.
		let resolved: string;
		try {
			resolved = resolveToCwd(value, cwd);
		} catch {
			return;
		}
		if (!out.some(location => location.path === resolved)) out.push({ path: resolved });
	};
}

const ALLOW_ONCE = "allow_once";
const ALLOW_SESSION = "allow_always";
const REJECT_ONCE = "reject_once";
const REJECT_SESSION = "reject_always";

/**
 * The options a prompt offers, mirroring the TUI choices: each `always-ask-cached` grant for this
 * session and across sessions, this call, the session approval and the session rejection when the
 * prompt offers a session scope, and reject. The four choices ACP clients already knew keep their
 * ids, each equal to its kind.
 */
export function acpPermissionOptions(prompt: ExtensionApprovalPrompt): ClientBridgePermissionOption[] {
	const grants = prompt.grants ?? [];
	return [
		...grants.map(grant => ({ optionId: `grant:${grant.scope}`, name: grant.label, kind: "allow_always" as const })),
		...grants.map(grant => ({
			optionId: `grant:${grant.scope}:always`,
			name: grant.alwaysLabel,
			kind: "allow_always" as const,
		})),
		{ optionId: ALLOW_ONCE, name: approvalOnceLabel(prompt), kind: "allow_once" },
		...(prompt.session ? [{ optionId: ALLOW_SESSION, name: prompt.session, kind: "allow_always" as const }] : []),
		{ optionId: REJECT_ONCE, name: "Reject", kind: "reject_once" },
		...(prompt.session
			? [{ optionId: REJECT_SESSION, name: "Reject for this session", kind: "reject_always" as const }]
			: []),
	];
}

/** The gate's answer for an offered option id; `undefined` for an id the request did not offer. */
function answerForOption(
	options: readonly ClientBridgePermissionOption[],
	optionId: string,
): ExtensionApprovalAnswer | undefined {
	if (!options.some(option => option.optionId === optionId)) return undefined;
	switch (optionId) {
		case ALLOW_ONCE:
			return "once";
		case ALLOW_SESSION:
			return "session";
		case REJECT_ONCE:
			return "deny";
		case REJECT_SESSION:
			return "deny-session";
	}
	const [, scope, always] = optionId.split(":");
	if (scope !== "folder" && scope !== "target") return undefined;
	return { grant: scope, always: always === "always" };
}

/** The `toolCall` of the permission request: the pending call, or a fresh id for a prompt outside one. */
function permissionToolCall(prompt: ExtensionApprovalPrompt, cwd: string): ClientBridgePermissionToolCall {
	const title = prompt.compact.split("\n", 1)[0] ?? "";
	const call = prompt.call;
	if (!call) {
		return { toolCallId: `approval-${Snowflake.next()}`, toolName: "approval", title, status: "pending" };
	}
	const command = call.toolName === "bash" && isRecord(call.args) ? stringProperty(call.args, "command") : undefined;
	return {
		toolCallId: call.toolCallId,
		toolName: call.toolName,
		title,
		...(call.tier === "exec" ? { kind: "execute" } : {}),
		status: "pending",
		rawInput: call.args,
		...(command ? { content: [{ type: "content", content: { type: "text", text: `$ ${command}` } }] } : {}),
		locations:
			call.toolName === "edit"
				? editPermissionLocations(call.args, cwd)
				: extractPermissionLocations(call.args, cwd),
	};
}

/** Opens a supersede watch for one approval dialog; see `AgentSession.watchApprovalSupersede`. */
export type WatchApprovalSupersede = (loopSteeringSignal: AbortSignal | undefined) => ApprovalSupersedeWatch;

/**
 * `ExtensionUIContext.approve` for an ACP session: one `session/request_permission` per prompt,
 * independent of form elicitation. A `cancelled` outcome or an aborted turn is a cancellation, an
 * option the request never offered fails the call, and a transport error propagates. With
 * `watchSupersede`, a user steer sent while the request is open supersedes it: the client's dialog
 * is withdrawn (v1 `$/cancel_request`) and the call fails as superseded, so the steer reaches the
 * agent at the next batch boundary instead of waiting behind the dialog.
 */
export function createAcpApprove(
	request: AcpPermissionRequester,
	getCwd: () => string,
	track: InteractionTracker,
	watchSupersede?: WatchApprovalSupersede,
): (prompt: ExtensionApprovalPrompt, dialogOptions?: ExtensionUIDialogOptions) => Promise<ExtensionApprovalAnswer> {
	return async (prompt, dialogOptions) => {
		const signal = dialogOptions?.signal;
		if (signal?.aborted) throw new ToolAbortError("Permission request cancelled");
		const options = acpPermissionOptions(prompt);
		const toolCall = permissionToolCall(prompt, getCwd());
		const watch = watchSupersede?.(dialogOptions?.steeringSignal);
		const superseded = watch?.signal;
		if (superseded?.aborted) {
			watch!.dispose();
			throw new ToolAbortError("Permission request superseded by user steering");
		}
		const { promise: interrupted, resolve: interrupt } = Promise.withResolvers<"aborted" | "superseded">();
		const abort = () => interrupt("aborted");
		const supersede = () => interrupt("superseded");
		// Registered before the request so a supersede settles the race ahead of the request's own
		// `cancelled` answer to the withdrawn dialog.
		signal?.addEventListener("abort", abort, { once: true });
		superseded?.addEventListener("abort", supersede, { once: true });
		let outcome: ClientBridgePermissionOutcome | "aborted" | "superseded";
		try {
			outcome = await track(() => Promise.race([request(toolCall, options, signal, superseded), interrupted]));
		} finally {
			signal?.removeEventListener("abort", abort);
			superseded?.removeEventListener("abort", supersede);
			watch?.dispose();
		}
		if (outcome === "superseded") throw new ToolAbortError("Permission request superseded by user steering");
		if (outcome === "aborted" || signal?.aborted || outcome.outcome === "cancelled") {
			throw new ToolAbortError("Permission request cancelled");
		}
		const answer = answerForOption(options, outcome.optionId);
		if (answer === undefined) {
			throw new ToolError(`Tool permission response used unknown option ID: ${outcome.optionId}`);
		}
		return answer;
	};
}
