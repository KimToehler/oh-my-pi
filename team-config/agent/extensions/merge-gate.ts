/**
 * Merge-gate enforcement for omp (review-work / final verification wave F2 gate).
 *
 * On session stop, a merge/completion claim must name one full reviewed_sha and its record. The
 * extension resolves that exact pair across the repository's linked worktrees. Unmerged work runs
 * the validator in the checkout that owns the record; a tracked record already merged into the
 * local or pushed default branch is settled. Only `team-config.merge-gate/v3` records count; a file at the
 * claimed path with another record id is refused before the settled shortcut. Missing, ambiguous, or
 * rejected bindings refuse stop.
 *
 * Deterministic and stateless: no idle nudges, no continuation counters. A refusal stays in
 * force until the claim is backed or withdrawn; the operator can always interrupt.
 *
 * Plan time: a plan-mode proposal (`write xd://propose`) is refused until the plan passes
 * `validate-gate-record.mjs --plan-only`. The validator owns every plan decision: the opt-out
 * declaration (`- Merge gate: not applicable (<reason>)` as a top-level bullet outside code fences),
 * the `## Merge gate` criteria, the abort-rule fields, the optional Risk tier field, and file-or-directory plan interpretation.
 * This hook treats the plan path as opaque and never reads plan content.
 *
 * Cross-family plan review is native in omp (`plan.review.enabled`); this extension does not review.
 *
 * omp prepares every call of a message before running any, so this check reads the plan before a
 * same-message write lands. Hence: a message gets at most one proposal checked; a second one in the
 * same message is refused. A proposal must stand alone in its message: one sent
 * with any file-changing call is refused before either check, and file-changing calls after an allowed
 * proposal in the same message are refused, and a proposal whose text names no existing `local://<slug>-plan.md` is
 * refused, so the checked plan is the plan on disk that is approved.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type {
	ExecResult,
	ExtensionAPI,
	ExtensionContext,
	SessionStopEvent,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
	TurnEndEvent,
} from "@oh-my-pi/pi-coding-agent";
import { classifyCall, proposedPlan } from "./lib/plan-file";
import { gateBinding, RECORD_SCHEMA, recordIsSettled, recordsForBinding } from "./lib/gate-record";

// The validator ships in the same agent dir as this extension (skills/review-work), so resolve it
// from here: that stays correct under profiles and PI_CODING_AGENT_DIR, where ~/.omp/agent is wrong.
const VALIDATOR =
	process.env.OMP_GATE_VALIDATOR ??
	path.join(import.meta.dir, "..", "skills", "review-work", "scripts", "validate-gate-record.mjs");

// Phrases that turn a reply into a merge or completion claim. Kept narrow on purpose:
// a status update or a question must not trigger the gate.
const CLAIM_PATTERNS: RegExp[] = [
	/^\s*Gate proof\b/im,
	/\bready to merge\b/i,
	/\bbereit (?:zum|für den) merge\b/i,
	/\bmerge[- ]?(?:approval|freigabe|okay|ok)\b/i,
	/\b(?:shall|should|may|can) i merge\b/i,
	/\bsoll ich (?:\S+ )?mergen\b/i,
	/\bORCHESTRATION COMPLETE\b/,
	/\bF2\b[^\n]{0,40}\[x\]/i,
];

// The shipped merge-gate-proof rule (rules/merge-gate-proof.md) makes the agent print a `Gate proof` block with NOT RUN lines when the
// gate has not passed. Such an honest report is not a claim; treating it as one looped the stop
// check on every retraction.
const GATE_NOT_PASSED: RegExp[] = [
	/:\s*NOT RUN\b/,
	/\b(?:gate|review-work)\b[^\n]{0,40}\b(?:has not|hasn't|did not|didn't|not) (?:passed|run)\b/i,
	/\bnot asking for (?:a )?merge\b/i,
	/\bnicht (?:bestanden|gelaufen)\b/i,
];

function isMergeClaim(text: string): boolean {
	return CLAIM_PATTERNS.some(pattern => pattern.test(text)) && !GATE_NOT_PASSED.some(pattern => pattern.test(text));
}

function lastAssistantText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: "text"; text: string } => block?.type === "text" && typeof block.text === "string",
		)
		.map(block => block.text)
		.join("\n");
}

const PROPOSE_ALONE: ToolCallEventResult = {
	block: true,
	reason: "Propose the plan alone: send xd://propose in its own message, after the plan file has been written.",
};
const AFTER_PROPOSE: ToolCallEventResult = {
	block: true,
	reason:
		"The plan was proposed earlier in this same message and nothing may change after its check. Send this call in a later message.",
};

// The host approves the propose text's slug file when it exists, and otherwise falls back to its plan-mode state
// path or the newest plan, which this hook cannot pin down. So only a proposal whose slug file exists is checked.
const NO_SLUG_PLAN: ToolCallEventResult = {
	block: true,
	reason: "Write the plan to local://<slug>-plan.md, then write exactly that <slug> to xd://propose.",
};
const UNCLEAR_SLUG: ToolCallEventResult = {
	block: true,
	reason:
		"Write only the plan slug to xd://propose, without line-number or [path#tag] prefixes copied from read output.",
};

/** One assistant message's file-changing calls, whether it proposed already, and the proposal this hook allowed in it. */
interface MessageCalls {
	mutations: Set<string>;
	proposed: boolean;
	allowedPropose?: string;
}

export default function mergeGate(pi: ExtensionAPI) {
	pi.setLabel("Merge gate (review-work record)");

	// omp prepares every tool call of a message (firing `tool_call`) before executing any of them
	// (agent-loop prepareToolCallDispatch, then executeToolCalls), and `xd://propose` dispatches inside
	// the write tool with no later hook. So the gate cannot know which same-message changes apply before or
	// after the approval: a proposal must be the only file-changing call of its message. Calls leave on
	// their `tool_result`, everything at `turn_end` (one message and its results); per session id.
	const messages = new Map<string, MessageCalls>();
	const messageOf = (sid: string): MessageCalls => {
		const calls = messages.get(sid) ?? { mutations: new Set<string>(), proposed: false };
		messages.set(sid, calls);
		return calls;
	};
	pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext) => {
		const calls = messages.get(ctx.sessionManager.getSessionId());
		if (!calls) return;
		calls.mutations.delete(event.toolCallId);
		if (calls.allowedPropose === event.toolCallId) calls.allowedPropose = undefined;
	});
	pi.on(
		"turn_end",
		(_event: TurnEndEvent, ctx: ExtensionContext) => void messages.delete(ctx.sessionManager.getSessionId()),
	);

	async function checkPlan(body: string, ctx: ExtensionContext): Promise<ToolCallEventResult | undefined> {
		const local = ctx.localProtocolOptions;
		if (!local) return undefined;
		const plan = await proposedPlan(body, { local, cwd: ctx.cwd });
		if (!plan) return NO_SLUG_PLAN;
		if (!existsSync(VALIDATOR)) {
			return {
				block: true,
				reason: `Merge gate: validator not found at ${VALIDATOR}; cannot check the plan's ## Merge gate section.`,
			};
		}
		let result: ExecResult;
		try {
			result = await pi.exec("node", [VALIDATOR, "--plan-only", "--plan", plan.path], {
				cwd: ctx.cwd,
				timeout: 30_000,
			});
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			return {
				block: true,
				reason: `Merge gate: could not run validate-gate-record.mjs --plan-only (${error.message}).`,
			};
		}
		if (result.code !== 0) {
			const slug = path.basename(plan.path).replace(/-plan\.md$/i, "");
			const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join("\n");
			return {
				block: true,
				reason:
					`Plan local://${slug}-plan.md is not ready for approval: validate-gate-record.mjs --plan-only says\n${detail}\n` +
					"Add or fix the `## Merge gate` section and the `## Final verification wave` (F3, F1, F2) per rule://plan-merge-gate, " +
					"then propose again. If this work will not go through a merge gate, add the line `- Merge gate: not applicable (<reason>)`.",
			};
		}
		return undefined;
	}

	pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
		const call = classifyCall(event.toolName, event.input as Record<string, unknown>);
		if (!call) return;
		const calls = messageOf(ctx.sessionManager.getSessionId());
		if (calls.allowedPropose !== undefined) return AFTER_PROPOSE;
		if (call.kind === "mutation") {
			calls.mutations.add(event.toolCallId);
			return;
		}
		// One proposal per message, allowed or refused: a second one would be a second check of the same message.
		if (calls.proposed) return AFTER_PROPOSE;
		calls.proposed = true;
		if (calls.mutations.size > 0) return PROPOSE_ALONE;
		if (call.body === undefined) return UNCLEAR_SLUG;
		const result = await checkPlan(call.body, ctx);
		if (!result?.block) calls.allowedPropose = event.toolCallId;
		return result;
	});

	pi.on("session_stop", async (event: SessionStopEvent, ctx: ExtensionContext) => {
		const text = lastAssistantText(event.last_assistant_message);
		if (!isMergeClaim(text)) return;

		const top = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd, timeout: 10_000 });
		if (top.code !== 0) return;
		const repo = top.stdout.trim();

		if (!existsSync(VALIDATOR)) {
			return {
				decision: "block",
				reason: `Merge gate: validator not found at ${VALIDATOR}. Set OMP_GATE_VALIDATOR or restore the review-work skill's scripts/validate-gate-record.mjs before claiming completion.`,
			};
		}

		const binding = gateBinding(text);
		if (binding === undefined) {
			return {
				decision: "block",
				reason:
					"Merge gate: the claim has no single Gate proof binding. Include one full reviewed_sha and its record line (block format: rule://merge-gate-proof), " +
					"or state plainly that the gate has NOT run and do not ask for merge approval.",
			};
		}
		const found = await recordsForBinding(pi, repo, binding);
		if (found === undefined) {
			return {
				decision: "block",
				reason:
					"Merge gate: could not enumerate this repository's linked worktrees; refusing an incomplete record search.",
			};
		}
		const { records, retired } = found;
		// Any checkout holding a retired id at the cited path refuses the claim before settlement or validation,
		// even when another checkout holds a matching current record.
		if (retired.length > 0) {
			return {
				decision: "block",
				reason:
					`Merge gate: record ${binding.record} carries a retired record id; only ${RECORD_SCHEMA} records are accepted, ` +
					"so it is neither settled nor validated. Re-run review-work to write a team-config.merge-gate/v3 record.",
			};
		}
		if (records.length === 0) {
			return {
				decision: "block",
				reason:
					`Merge gate: no ${RECORD_SCHEMA} record ${binding.record} with reviewed_sha ${binding.reviewedSha} exists in this repository or its linked worktrees. ` +
					"Run review-work, or state plainly that the gate has NOT run and do not ask for merge approval.",
			};
		}
		if (new Set(records.map(record => record.content)).size !== 1) {
			return {
				decision: "block",
				reason:
					`Merge gate: record ${binding.record} with reviewed_sha ${binding.reviewedSha} is ambiguous across linked worktrees because its bytes differ. ` +
					"Keep one exact record version before claiming completion.",
			};
		}
		for (const record of records) {
			if (await recordIsSettled(pi, repo, record)) return;
		}
		let firstFailure:
			| { readonly detail: string; readonly plan: string; readonly record: string; readonly repo: string }
			| undefined;
		for (const record of records) {
			const result = await pi.exec(
				"node",
				[VALIDATOR, "--repo", record.repo, "--record", record.record, "--plan", record.plan],
				{ cwd: record.repo, timeout: 60_000 },
			);
			if (result.code === 0) return;
			if (firstFailure === undefined) {
				firstFailure = {
					detail: (result.stderr || result.stdout).trim().split("\n").slice(0, 6).join("\n"),
					plan: record.plan,
					record: record.record,
					repo: record.repo,
				};
			}
		}
		if (firstFailure === undefined) {
			return { decision: "block", reason: "Merge gate: no matching checkout produced a validator result." };
		}
		return {
			decision: "block",
			reason:
				`Merge gate: validate-gate-record.mjs rejected ${firstFailure.record} (plan ${firstFailure.plan}) in ${firstFailure.repo}:\n${firstFailure.detail}\n` +
				"Fix the cause (re-review after code commits, store trailers verbatim, stage the artifacts), or state plainly that the gate is " +
				"not passed and do not ask for merge approval.",
		};
	});
}
