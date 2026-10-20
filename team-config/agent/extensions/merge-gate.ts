/**
 * Merge-gate enforcement for omp (review-work / final verification wave F2 gate).
 *
 * On session stop, if the final assistant message claims the work is done or asks for a
 * merge, the claim must be backed by a gate record that `validate-gate-record.mjs` accepts
 * at the current HEAD. Otherwise the stop is refused with the validator's own message, so the
 * agent has to run review-work (or retract the claim) instead of the owner having to ask.
 *
 * Deterministic and stateless: no idle nudges, no continuation counters. A refusal stays in
 * force until the claim is backed or withdrawn; the operator can always interrupt.
 *
 * Plan time: a plan-mode proposal (`write xd://propose`) is refused until the plan passes
 * `validate-gate-record.mjs --plan-only`. The validator owns every plan decision: the opt-out
 * declaration (`- Merge gate: not applicable (<reason>)` as a top-level bullet outside code fences),
 * the `## Merge gate` criteria, and the abort-rule fields `Accepted residual risks` and
 * `Out of scope for blocking`. This hook never reads the plan text itself.
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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

// The validator ships in the same agent dir as this extension (skills/review-work), so resolve it
// from here: that stays correct under profiles and PI_CODING_AGENT_DIR, where ~/.omp/agent is wrong.
const VALIDATOR =
	process.env.OMP_GATE_VALIDATOR ??
	path.join(import.meta.dir, "..", "skills", "review-work", "scripts", "validate-gate-record.mjs");

const RECORD_DIRS = [".omo/evidence/gate", "docs/evidence"];
const SCHEMA = '"omo.merge-gate/v2"';

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

// The merge-gate-proof rule makes the agent print a `Gate proof` block with NOT RUN lines when the
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
		.filter((block): block is { type: "text"; text: string } => block?.type === "text" && typeof block.text === "string")
		.map(block => block.text)
		.join("\n");
}

type GateRecord = { record: string; plan: string; reviewedSha?: string; mtime: number };

function recordsNewestFirst(repo: string): GateRecord[] {
	const found: GateRecord[] = [];
	const visit = (dir: string, depth: number) => {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const name of entries) {
			const full = path.join(dir, name);
			let stat;
			try {
				stat = statSync(full);
			} catch {
				continue;
			}
			if (stat.isDirectory()) {
				if (depth < 3) visit(full, depth + 1);
				continue;
			}
			if (!name.endsWith(".json")) continue;
			let text: string;
			try {
				text = readFileSync(full, "utf8");
			} catch {
				continue;
			}
			if (!text.includes(SCHEMA)) continue;
			const plan = /"plan"\s*:\s*"([^"]+)"/.exec(text)?.[1];
			const reviewedSha = /"reviewed_sha"\s*:\s*"([0-9a-f]{40})"/.exec(text)?.[1];
			if (plan) found.push({ record: path.relative(repo, full), plan, reviewedSha, mtime: stat.mtimeMs });
		}
	};
	for (const dir of RECORD_DIRS) visit(path.join(repo, dir), 0);
	return found.sort((a, b) => b.mtime - a.mtime);
}

const PROPOSE_ALONE: ToolCallEventResult = {
	block: true,
	reason: "Propose the plan alone: send xd://propose in its own message, after the plan file has been written.",
};
const AFTER_PROPOSE: ToolCallEventResult = {
	block: true,
	reason: "The plan was proposed earlier in this same message and nothing may change after its check. Send this call in a later message.",
};

// The host approves the propose text's slug file when it exists, and otherwise falls back to its plan-mode state
// path or the newest plan, which this hook cannot pin down. So only a proposal whose slug file exists is checked.
const NO_SLUG_PLAN: ToolCallEventResult = {
	block: true,
	reason: "Write the plan to local://<slug>-plan.md, then write exactly that <slug> to xd://propose.",
};
const UNCLEAR_SLUG: ToolCallEventResult = {
	block: true,
	reason: "Write only the plan slug to xd://propose, without line-number or [path#tag] prefixes copied from read output.",
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
	pi.on("turn_end", (_event: TurnEndEvent, ctx: ExtensionContext) => void messages.delete(ctx.sessionManager.getSessionId()));

	async function checkPlan(body: string, ctx: ExtensionContext): Promise<ToolCallEventResult | undefined> {
		const local = ctx.localProtocolOptions;
		if (!local) return undefined;
		const plan = await proposedPlan(body, { local, cwd: ctx.cwd });
		if (!plan) return NO_SLUG_PLAN;
		if (!existsSync(VALIDATOR)) {
			return { block: true, reason: `Merge gate: validator not found at ${VALIDATOR}; cannot check the plan's ## Merge gate section.` };
		}
		let result: ExecResult;
		try {
			result = await pi.exec("node", [VALIDATOR, "--plan-only", "--plan", plan.path], { cwd: ctx.cwd, timeout: 30_000 });
		} catch (error) {
			return { block: true, reason: `Merge gate: could not run validate-gate-record.mjs --plan-only (${String(error)}).` };
		}
		if (result.code !== 0) {
			const slug = path.basename(plan.path).replace(/-plan\.md$/i, "");
			const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 4).join("\n");
			return {
				block: true,
				reason:
					`Plan local://${slug}-plan.md is not ready for approval: validate-gate-record.mjs --plan-only says\n${detail}\n` +
					"Add or fix the `## Merge gate` section and the `## Final verification wave` (F3, F1, F2) per the plan-merge-gate rule, " +
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

		// Records whose reviewed_sha is already on the pushed default branch gate shipped work; their
		// plans get archived, so validating them again can only fail. Pick the newest open record.
		const remoteHead = await pi.exec("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: repo, timeout: 10_000 });
		const shipped = remoteHead.code === 0 ? remoteHead.stdout.trim() : undefined;
		let found: GateRecord | undefined;
		for (const candidate of recordsNewestFirst(repo)) {
			if (shipped && candidate.reviewedSha) {
				const merged = await pi.exec("git", ["merge-base", "--is-ancestor", candidate.reviewedSha, shipped], { cwd: repo, timeout: 10_000 });
				if (merged.code === 0) continue;
			}
			found = candidate;
			break;
		}
		if (!found) {
			return {
				decision: "block",
				reason:
					"Merge gate: your reply claims completion or asks for a merge, but this repository has no omo.merge-gate/v2 record " +
					`for unshipped work (searched ${RECORD_DIRS.join(", ")}; records already on ${shipped ?? "the default branch"} are skipped). ` +
					"Run the review-work skill (verbatim briefs, trailers stored, record written and staged) and its validator, " +
					"or state plainly that the gate has NOT run and do not ask for merge approval.",
			};
		}

		const result = await pi.exec(
			"node",
			[VALIDATOR, "--repo", repo, "--record", found.record, "--plan", found.plan],
			{ cwd: repo, timeout: 60_000 },
		);
		if (result.code === 0) return;

		const detail = (result.stderr || result.stdout).trim().split("\n").slice(0, 6).join("\n");
		return {
			decision: "block",
			reason:
				`Merge gate: validate-gate-record.mjs rejected ${found.record} (plan ${found.plan}) at the current HEAD:\n${detail}\n` +
				"Fix the cause (re-review after code commits, store trailers verbatim, stage the artifacts), or state plainly that the gate is " +
				"not passed and do not ask for merge approval.",
		};
	});
}
