/**
 * Plan-file identity for the propose-alone rule in ../merge-gate.ts: which tool calls can change files before
 * or after a proposal applies, which call is a `propose`, and the plan the host then approves, read from disk.
 * Host functions decide each of these; nothing is re-implemented. Nothing here throws: a throwing `tool_call`
 * handler blocks the call.
 */
import type { LocalProtocolOptions } from "@oh-my-pi/pi-coding-agent/internal-urls/local-protocol";
import { resolveApprovedPlan } from "@oh-my-pi/pi-coding-agent/plan-mode/approved-plan";
import { readPlanFile, resolvePlanFilePath } from "@oh-my-pi/pi-coding-agent/plan-mode/plan-files";
import { isProposeToolCall } from "@oh-my-pi/pi-coding-agent/tools/resolve";

/** The plan a proposal approves: its absolute path and the text on disk. */
export interface ProposedPlan {
	path: string;
	text: string;
}

/**
 * Tools that change files in plan mode. Their targets are never analysed: every `write` and `edit` counts,
 * `ast_edit` stages a preview, and `resolve` applies a staged preview. Each one fires its own `tool_call`,
 * also when it runs as a command inside `bash`. Not covered: plain shell commands, eval, subagents.
 */
const MUTATING_TOOLS: ReadonlySet<string> = new Set(["edit", "write", "ast_edit", "resolve"]);

/** A proposal (`body` is the plan title it passes to `propose`) or any other file-changing call. */
export type PlanCall = { kind: "propose"; body: string } | { kind: "mutation" };

const MUTATION: PlanCall = { kind: "mutation" };

/** What a plan path is resolved against: the session's local:// root and the working directory. */
export interface PathScope {
	local: LocalProtocolOptions;
	cwd: string;
}

/**
 * Classifies a `tool_call` for the propose-alone rule; undefined for calls that change no file.
 * A `propose` fires its own `tool_call` whether it runs top-level or as a command inside `bash`, so only
 * that event is a proposal: the enclosing `bash` call (no arguments passed here) is never one.
 */
export function classifyCall(toolName: string, input: Record<string, unknown>): PlanCall | undefined {
	if (isProposeToolCall({ name: toolName })) {
		return { kind: "propose", body: typeof input.title === "string" ? input.title : "" };
	}
	return MUTATING_TOOLS.has(toolName) ? MUTATION : undefined;
}

/**
 * The plan a propose approves, when the host's slug step decides it. The host lookup (plan-mode/approved-plan.ts
 * resolveApprovedPlan) tries the propose title's slug file `local://<slug>-plan.md` first, then its plan-mode state
 * path (default `local://PLAN.md`, which this hook cannot see), then the local root's `*plan.md` files newest
 * first. Only the first step is the same for the gate and the host, so the lookup runs with that step alone (no
 * state path, no listing): a result is then the existing slug file, which the host returns too. Undefined
 * otherwise, and the caller refuses the propose. Read from disk only: the propose-alone rule guarantees that no
 * change of the same message runs before or after it.
 */
export async function proposedPlan(body: string, scope: PathScope): Promise<ProposedPlan | undefined> {
	const options = { localProtocolOptions: scope.local, cwd: scope.cwd };
	try {
		const plan = await resolveApprovedPlan({
			suppliedTitle: body,
			statePlanFilePath: "",
			readPlan: url => readPlanFile(url, options),
		});
		return { path: resolvePlanFilePath(plan.planFilePath, options), text: plan.planContent };
	} catch {
		// No slug or no slug file: the host would fall back to a plan this hook cannot pin.
		return undefined;
	}
}
