/**
 * Plan-file identity for the propose-alone rule in ../merge-gate.ts: which tool calls can change files before
 * or after a proposal applies, which `write` the host dispatches as `xd://propose`, and the plan the host then
 * approves, read from disk. Host functions decide each of these; nothing is re-implemented. Nothing here
 * throws: a throwing `tool_call` handler blocks the call.
 */
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { LocalProtocolOptions } from "@oh-my-pi/pi-coding-agent/internal-urls/local-protocol";
import { InternalUrlRouter } from "@oh-my-pi/pi-coding-agent/internal-urls/router";
import { resolveApprovedPlan } from "@oh-my-pi/pi-coding-agent/plan-mode/approved-plan";
import { readPlanFile, resolvePlanFilePath } from "@oh-my-pi/pi-coding-agent/plan-mode/plan-files";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools/index";
import { unwrapHashlineHeaderPath } from "@oh-my-pi/pi-coding-agent/tools/plan-mode-guard";
import { stripWriteContent } from "@oh-my-pi/pi-coding-agent/tools/write-content";

/** The plan a proposal approves: its absolute path and the text on disk. */
export interface ProposedPlan {
	path: string;
	text: string;
}

/**
 * Tools that change files in plan mode. Their targets are never analysed: every `write` counts (devices
 * included, so `xd://edit` / `xd://write` / `xd://resolve` too), and `ast_edit` stages a preview that a
 * `write xd://resolve` of the same message may apply. Not covered: bash, eval, subagents.
 */
const MUTATING_TOOLS: ReadonlySet<string> = new Set(["edit", "write", "ast_edit"]);

/**
 * A proposal or any other file-changing call. `body` is the text written to `xd://propose`; undefined when
 * the plan slug the host reads from it depends on the session's edit mode (see `contentDependsOnEditMode`).
 */
export type PlanCall = { kind: "propose"; body: string | undefined } | { kind: "mutation" };

const MUTATION: PlanCall = { kind: "mutation" };

/** What a plan path is resolved against: the session's local:// root and the working directory. */
export interface PathScope {
	local: LocalProtocolOptions;
	cwd: string;
}

/**
 * Whether the host write tool dispatches `target` to `xd://propose`, decided by the host's own functions:
 * tools/write.ts unwraps a hashline header and routes the target, xd-protocol reads the device name from
 * the routed URL. So `[xd://propose#ABCD]`, `XD://propose` or `xd://pro<TAB>pose` cannot skip the check.
 * (write.ts also peels a read selector and a `<file>:conflict://` prefix first: `xd:` declares no
 * selectors, and a conflict prefix turns the target into `conflict://`, never into `xd://propose`.)
 */
function isProposeTarget(target: string): boolean {
	try {
		const routed = InternalUrlRouter.instance().writeTarget(unwrapHashlineHeaderPath(target));
		if (routed?.spec.write?.scope !== "device") return false;
		return routed.url.href.slice(`${routed.url.protocol}//`.length) === "propose";
	} catch {
		// Not a routable URL: the write lands on a file, so it is a plain mutation.
		return false;
	}
}

// In hashline edit mode the write tool strips copied `[PATH#TAG]` / `LINE:` prefixes from the content before
// the device sees it (`1:old` proposes `old`). The hook cannot see the session's edit mode, so a body that
// stripping would change names an undecidable plan.
let hashlineSession: ToolSession | undefined;
function contentDependsOnEditMode(content: string): boolean {
	try {
		hashlineSession ??= {
			cwd: process.cwd(),
			hasUI: false,
			getSessionFile: () => null,
			getSessionSpawns: () => null,
			settings: Settings.isolated({ "edit.mode": "hashline" }),
		};
		return stripWriteContent(hashlineSession, content).stripped;
	} catch {
		return true;
	}
}

/** Classifies a `tool_call` for the propose-alone rule; undefined for calls that change no file. */
export function classifyCall(toolName: string, input: Record<string, unknown>): PlanCall | undefined {
	if (!MUTATING_TOOLS.has(toolName)) return undefined;
	if (toolName !== "write" || typeof input.path !== "string" || !isProposeTarget(input.path)) return MUTATION;
	const body = typeof input.content === "string" ? input.content : "";
	return { kind: "propose", body: contentDependsOnEditMode(body) ? undefined : body };
}

/**
 * The plan a propose approves, when the host's slug step decides it. The host lookup (plan-mode/approved-plan.ts
 * resolveApprovedPlan) tries the propose text's slug file `local://<slug>-plan.md` first, then its plan-mode state
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
