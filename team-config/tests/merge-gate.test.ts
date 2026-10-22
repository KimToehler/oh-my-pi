/**
 * Hook-level tests for agent/extensions/merge-gate.ts: the real extension factory is registered against an
 * in-memory ExtensionAPI and its handlers are driven with real event shapes. The validator is the
 * fake `pi.exec`; its `--plan` argument shows which plan file the gate checked.
 *
 * Lives outside agent/ so the installer never ships it into ~/.omp/agent. Run: bun run test:team-config
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type {
	ExecOptions,
	ExecResult,
	ExtensionAPI,
	ExtensionContext,
	ToolCallEventResult,
} from "@oh-my-pi/pi-coding-agent";
import mergeGate from "../agent/extensions/merge-gate";

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

interface Harness {
	dir: string;
	localRoot: string;
	handlers: Map<string, Handler[]>;
	execCalls: { command: string; args: string[] }[];
	validator: ExecResult;
	pi: ExtensionAPI;
}

let h: Harness;

const VALID: ExecResult = { stdout: "", stderr: "", code: 0, killed: false };
const INVALID: ExecResult = { stdout: "", stderr: "plan has no ## Merge gate section\nline2", code: 1, killed: false };
const GOOD_PLAN =
	"# Plan\n## Merge gate\n- Mandatory class: none\n- Accepted residual risks: none (fixture)\n- Out of scope for blocking: none (fixture)\n";
const OPT_OUT_PLAN = "# Plan\n- Merge gate: not applicable (qa)\n";
const NEW_TEXT = "# x v2\n- Merge gate: not applicable (qa)\n";

const PROPOSE_ALONE = {
	block: true,
	reason: "Propose the plan alone: send xd://propose in its own message, after the plan file has been written.",
};
const AFTER_PROPOSE = {
	block: true,
	reason:
		"The plan was proposed earlier in this same message and nothing may change after its check. Send this call in a later message.",
};
const NO_SLUG_PLAN = {
	block: true,
	reason: "Write the plan to local://<slug>-plan.md, then write exactly that <slug> to xd://propose.",
};

function context(sessionId: string): ExtensionContext {
	const ctx = {
		cwd: h.dir,
		hasUI: false,
		sessionManager: { getSessionId: () => sessionId },
		localProtocolOptions: { getArtifactsDir: () => h.dir, getSessionId: () => sessionId },
	};
	return ctx as unknown as ExtensionContext;
}

async function emit(name: string, event: unknown, sessionId = "sess-A"): Promise<unknown> {
	let last: unknown;
	for (const handler of h.handlers.get(name) ?? []) {
		const result = await handler(event, context(sessionId));
		if ((result as ToolCallEventResult | undefined)?.block) return result;
		last = result ?? last;
	}
	return last;
}

const tool = (toolName: string, toolCallId: string, input: Record<string, unknown>, sessionId = "sess-A") =>
	emit("tool_call", { type: "tool_call", toolName, toolCallId, input }, sessionId) as Promise<
		ToolCallEventResult | undefined
	>;

const write = (target: string, content: string, sessionId = "sess-A", toolCallId = "t") =>
	tool("write", toolCallId, { path: target, content }, sessionId);

/** A hashline plan edit as the host delivers it to `tool_call` (path/paths from the `[PATH#TAG]` header). */
const editPlan = (toolCallId: string, target = "local://x-plan.md", sessionId = "sess-A") =>
	tool(
		"edit",
		toolCallId,
		{ input: `[${target}#AB12]\nPUT 2.=2:\n+## Merge gate`, path: target, paths: [target] },
		sessionId,
	);

const toolResult = (toolName: string, toolCallId: string, sessionId = "sess-A") =>
	emit(
		"tool_result",
		{ type: "tool_result", toolName, toolCallId, input: {}, content: [], isError: false },
		sessionId,
	);

const turnEnd = (sessionId = "sess-A") =>
	emit(
		"turn_end",
		{ type: "turn_end", turnIndex: 0, message: { role: "assistant", content: [] }, toolResults: [] },
		sessionId,
	);

/** A `write xd://propose` prepared inside the current message (no turn end). */
const proposeCall = (toolCallId: string, slug = "x", sessionId = "sess-A") =>
	write("xd://propose", slug, sessionId, toolCallId);

/** One whole message that only proposes: the propose's `tool_call`, then the turn ends. */
async function propose(sessionId = "sess-A", slug = "x"): Promise<ToolCallEventResult | undefined> {
	const result = await proposeCall("t", slug, sessionId);
	await turnEnd(sessionId);
	return result;
}

async function planOnDisk(text: string, slug = "x"): Promise<string> {
	const file = path.join(h.localRoot, `${slug}-plan.md`);
	await Bun.write(file, text);
	return file;
}

async function execProcess(command: string, args: readonly string[], cwd: string): Promise<ExecResult> {
	const child = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { stdout, stderr, code, killed: false };
}

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
	const result = await execProcess("git", args, cwd);
	if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	return result.stdout.trim();
}

function useRealGit(): void {
	h.pi.exec = async (command: string, args: string[], options?: ExecOptions): Promise<ExecResult> => {
		h.execCalls.push({ command, args });
		if (command === "node") return h.validator;
		return execProcess(command, args, options?.cwd ?? h.dir);
	};
}

interface WorktreeGateFixture {
	readonly main: string;
	readonly record: string;
	readonly reviewedSha: string;
	readonly worktree: string;
}

async function worktreeGateFixture(): Promise<WorktreeGateFixture> {
	await git(h.dir, "init", "-q", "-b", "main");
	await git(h.dir, "config", "user.email", "gate@test");
	await git(h.dir, "config", "user.name", "Gate Test");
	await Bun.write(path.join(h.dir, ".gitignore"), "worktrees/\n");
	await Bun.write(path.join(h.dir, "source.txt"), "base\n");
	await git(h.dir, "add", ".gitignore", "source.txt");
	await git(h.dir, "commit", "-q", "-m", "base");
	const worktreePath = path.join(h.dir, "worktrees", "feature");
	await git(h.dir, "worktree", "add", "-q", "-b", "feature", worktreePath);
	const main = await git(h.dir, "rev-parse", "--show-toplevel");
	const worktree = await git(worktreePath, "rev-parse", "--show-toplevel");
	await Bun.write(path.join(worktree, "source.txt"), "reviewed\n");
	await git(worktree, "add", "source.txt");
	await git(worktree, "commit", "-q", "-m", "reviewed change");
	const reviewedSha = await git(worktree, "rev-parse", "HEAD");
	const record = ".omo/evidence/gate/worktree.json";
	await Bun.write(
		path.join(worktree, record),
		JSON.stringify({
			schema: "omo.merge-gate/v2",
			plan: "openspec/changes/worktree-gate",
			reviewed_sha: reviewedSha,
		}),
	);
	await git(worktree, "add", record);
	await git(worktree, "commit", "-q", "-m", "gate record");
	return { main, record, reviewedSha, worktree };
}

function gateProof(reviewedSha: string, record = ".omo/evidence/gate/worktree.json"): string {
	return [
		"Gate proof",
		"- integration-review: not needed (one gate mechanism)",
		"- review-work: RAN",
		`  reviewed_sha ${reviewedSha} · plan_sha256 ${"b".repeat(64)}`,
		`  record ${record} · validate-gate-record.mjs exit 0 at ${reviewedSha}`,
		"- code committed after reviewed_sha: none",
	].join("\n");
}

const validatorRuns = (): number => h.execCalls.filter(call => call.args.includes("--plan-only")).length;

/** The plan files the validator was asked to check, in order. */
const checkedPlans = (): (string | undefined)[] =>
	h.execCalls
		.filter(call => call.args.includes("--plan-only"))
		.map(call => call.args[call.args.indexOf("--plan") + 1]);

beforeEach(async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mg-test-"));
	const handlers = new Map<string, Handler[]>();
	const pi = {
		setLabel: () => {},
		on: (name: string, handler: Handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
		exec: async (command: string, args: string[], _options?: ExecOptions): Promise<ExecResult> => {
			h.execCalls.push({ command, args });
			return command === "node" ? h.validator : { stdout: "", stderr: "not a repo", code: 128, killed: false };
		},
		logger: { warn: () => {}, debug: () => {}, error: () => {} },
	};
	h = {
		dir,
		localRoot: path.join(dir, "local"),
		handlers,
		execCalls: [],
		validator: VALID,
		pi: pi as unknown as ExtensionAPI,
	};
	mergeGate(h.pi);
});

afterEach(async () => {
	await fs.rm(h.dir, { recursive: true, force: true });
});

describe("plan-only validator", () => {
	it("allows a plan the --plan-only validator accepts, checking the slug's plan file", async () => {
		const file = await planOnDisk(GOOD_PLAN);
		expect(await propose()).toBeUndefined();
		expect(checkedPlans()).toEqual([file]);
	});

	it("blocks with the validator detail when the validator rejects", async () => {
		await planOnDisk(GOOD_PLAN);
		h.validator = INVALID;
		const result = await propose();
		expect(result?.block).toBe(true);
		expect(result?.reason).toStartWith(
			"Plan local://x-plan.md is not ready for approval: validate-gate-record.mjs --plan-only says\nplan has no ## Merge gate section\nline2\n",
		);
	});

	it("blocks an opt-out plan the validator refuses: the validator owns the opt-out decision", async () => {
		const file = await planOnDisk(OPT_OUT_PLAN);
		h.validator = INVALID;
		const result = await propose();
		expect(result?.block).toBe(true);
		expect(checkedPlans()).toEqual([file]);
	});

	it("blocks with a reason, not a throw, when the validator cannot be run", async () => {
		await planOnDisk(GOOD_PLAN);
		h.pi.exec = async () => {
			throw new Error("spawn node ENOENT");
		};
		const result = await proposeCall("p1");
		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("spawn node ENOENT");
	});

	it("never deletes or rewrites the plan file it checks", async () => {
		const file = await planOnDisk(GOOD_PLAN);
		h.validator = INVALID;
		await propose();
		expect(await Bun.file(file).text()).toBe(GOOD_PLAN);
	});
});

describe("propose-alone rule", () => {
	it("refuses a plan write prepared after an allowed propose in the same message", async () => {
		// Given: the plan on disk; one message proposes it, then rewrites it
		await planOnDisk(GOOD_PLAN);
		// When
		const proposed = await proposeCall("p1");
		const later = await write("local://x-plan.md", NEW_TEXT, "sess-A", "w1");
		// Then: the write that would land after the checked plan is refused
		expect(proposed).toBeUndefined();
		expect(later).toEqual(AFTER_PROPOSE);
	});

	it("refuses every file-changing kind after an allowed propose, but never a read", async () => {
		await planOnDisk(GOOD_PLAN);
		await proposeCall("p1");
		expect(await editPlan("e1")).toMatchObject({ block: true });
		expect(
			await tool("ast_edit", "a1", { ops: [{ pat: "a", out: "b" }], paths: ["local://x-plan.md"] }),
		).toMatchObject({ block: true });
		expect(await tool("write", "d1", { path: "xd://resolve", content: "apply" })).toMatchObject({ block: true });
		expect(await tool("read", "r1", { path: "local://x-plan.md" })).toBeUndefined();
	});

	it("keeps refusing after another call's tool_result; only the propose's own result ends the window", async () => {
		await planOnDisk(GOOD_PLAN);
		await tool("read", "r1", { path: "local://x-plan.md" });
		await proposeCall("p1");
		await toolResult("read", "r1");
		expect((await write("local://x-plan.md", NEW_TEXT, "sess-A", "w1"))?.block).toBe(true);
		await toolResult("write", "p1");
		expect(await write("local://x-plan.md", NEW_TEXT, "sess-A", "w2")).toBeUndefined();
	});

	it("refuses a second propose in the message after one the validator refused, checking nothing again", async () => {
		// Given: the first propose of the message was refused
		await planOnDisk(GOOD_PLAN);
		h.validator = INVALID;
		expect((await proposeCall("p1"))?.block).toBe(true);
		const validated = validatorRuns();
		// When
		const second = await proposeCall("p2");
		// Then: no second check in one message; the next message proposes normally
		expect(second).toEqual(AFTER_PROPOSE);
		expect(validatorRuns()).toBe(validated);
		await turnEnd();
		h.validator = VALID;
		expect(await proposeCall("p3")).toBeUndefined();
	});

	it("refuses a second propose in the message after an allowed one, checking once", async () => {
		await planOnDisk(GOOD_PLAN);
		expect(await proposeCall("p1")).toBeUndefined();
		expect(await proposeCall("p2")).toEqual(AFTER_PROPOSE);
		expect(validatorRuns()).toBe(1);
	});

	it("allows changes after a propose the validator refused: nothing was approved", async () => {
		await planOnDisk(GOOD_PLAN);
		h.validator = INVALID;
		expect((await proposeCall("p1"))?.block).toBe(true);
		expect(await write("local://x-plan.md", NEW_TEXT, "sess-A", "w1")).toBeUndefined();
	});

	it("refuses a propose sent with a plan write, checking nothing", async () => {
		await planOnDisk(GOOD_PLAN);
		await write("local://x-plan.md", NEW_TEXT, "sess-A", "w1");
		expect(await proposeCall("p1")).toEqual(PROPOSE_ALONE);
		expect(validatorRuns()).toBe(0);
	});

	it("refuses a propose sent with an edit", async () => {
		await planOnDisk(GOOD_PLAN);
		await editPlan("e1");
		expect(await proposeCall("p1")).toEqual(PROPOSE_ALONE);
		expect(validatorRuns()).toBe(0);
	});

	it("refuses a propose sent with a write of a file that is not a plan", async () => {
		await planOnDisk(GOOD_PLAN);
		await write("local://notes.md", "scratch", "sess-A", "w1");
		expect(await proposeCall("p1")).toEqual(PROPOSE_ALONE);
	});

	it("refuses a propose sent with an ast_edit, which a later xd://resolve could apply", async () => {
		await planOnDisk(GOOD_PLAN);
		await tool("ast_edit", "a1", { ops: [{ pat: "a", out: "b" }], paths: ["local://x-plan.md"] });
		expect(await proposeCall("p1")).toEqual(PROPOSE_ALONE);
	});

	for (const device of ["xd://write", "xd://edit", "xd://resolve"]) {
		it(`refuses a propose sent with a write to ${device}`, async () => {
			await planOnDisk(GOOD_PLAN);
			await write(device, JSON.stringify({ path: "local://x-plan.md", content: NEW_TEXT }), "sess-A", "d1");
			expect(await proposeCall("p1")).toEqual(PROPOSE_ALONE);
		});
	}

	it("refuses a propose nested in xd://write when the host dispatches it", async () => {
		// Given: the loop prepares the outer device write; executing it emits the inner write under the same id
		await planOnDisk(GOOD_PLAN);
		expect(
			await write("xd://write", JSON.stringify({ path: "xd://propose", content: "x" }), "sess-A", "d1"),
		).toBeUndefined();
		// When
		const inner = await write("xd://propose", "x", "sess-A", "d1");
		// Then
		expect(inner).toEqual(PROPOSE_ALONE);
		expect(validatorRuns()).toBe(0);
	});

	for (const target of ["[xd://propose#ABCD]", "XD://propose", "xd://pro\tpose"]) {
		it(`treats ${JSON.stringify(target)}, which the host dispatches as xd://propose, as a propose`, async () => {
			await planOnDisk(GOOD_PLAN);
			await editPlan("e1");
			expect(await write(target, "x", "sess-A", "p1")).toEqual(PROPOSE_ALONE);
		});
	}

	it("allows a propose sent with read-only calls and checks the plan on disk", async () => {
		const file = await planOnDisk(GOOD_PLAN);
		for (const [name, id] of [
			["read", "r1"],
			["grep", "g1"],
			["glob", "g2"],
			["lsp", "l1"],
			["web_search", "s1"],
		] as const) {
			expect(await tool(name, id, { path: "local://x-plan.md", pattern: "x", query: "x" })).toBeUndefined();
		}
		expect(await proposeCall("p1")).toBeUndefined();
		expect(checkedPlans()).toEqual([file]);
	});

	it("proposes normally in the next message once the edit's tool_result and the turn end arrived", async () => {
		await planOnDisk(GOOD_PLAN);
		await editPlan("e1");
		await toolResult("edit", "e1");
		await turnEnd();
		expect(await proposeCall("p1")).toBeUndefined();
	});

	it("forgets a change once its tool_result arrived", async () => {
		await planOnDisk(GOOD_PLAN);
		await editPlan("e1");
		await toolResult("edit", "e1");
		expect(await proposeCall("p1")).toBeUndefined();
	});

	it("proposes normally after the turn ended even when the change never reported a result", async () => {
		await planOnDisk(GOOD_PLAN);
		await editPlan("e1");
		await turnEnd();
		expect(await proposeCall("p1")).toBeUndefined();
	});

	it("allows changes in the next message after an allowed propose", async () => {
		await planOnDisk(GOOD_PLAN);
		await propose();
		expect(await write("local://x-plan.md", NEW_TEXT, "sess-A", "w1")).toBeUndefined();
	});

	it("stays per session: another session's change does not refuse this session's propose, nor its propose this change", async () => {
		await planOnDisk(GOOD_PLAN);
		await editPlan("e2", "local://x-plan.md", "sess-B");
		expect(await proposeCall("p1", "x", "sess-A")).toBeUndefined();
		expect(await write("local://x-plan.md", NEW_TEXT, "sess-B", "w1")).toBeUndefined();
	});
});

describe("plan slug resolution", () => {
	/** An older plan `old` and the newer plan `x` on disk. */
	async function twoPlans(): Promise<string> {
		const older = await planOnDisk(OPT_OUT_PLAN, "old");
		const past = new Date(Date.now() - 60_000);
		await fs.utimes(older, past, past);
		return planOnDisk(GOOD_PLAN, "x");
	}

	it("checks the slug's plan on disk over a newer plan", async () => {
		const older = await planOnDisk(GOOD_PLAN, "y");
		const past = new Date(Date.now() - 60_000);
		await fs.utimes(older, past, past);
		await planOnDisk(GOOD_PLAN, "x");
		expect(await propose("sess-A", "y")).toBeUndefined();
		expect(checkedPlans()).toEqual([older]);
	});

	it("refuses, checking nothing, when the title maps to no slug file while plan.md and a newer plan exist", async () => {
		// Given: a lowercase plan.md draft (the host's state plan PLAN.md on a case-insensitive volume) and a
		// newer feature-plan.md; the propose title "Feature rollout" names neither
		const draft = path.join(h.localRoot, "plan.md");
		await Bun.write(draft, "# OLD DRAFT\n## Merge gate\n");
		const past = new Date(Date.now() - 60_000);
		await fs.utimes(draft, past, past);
		await planOnDisk(GOOD_PLAN, "feature");
		// When
		const result = await proposeCall("p1", "Feature rollout");
		// Then: no plan the host might approve instead is checked
		expect(result).toEqual(NO_SLUG_PLAN);
		expect(validatorRuns()).toBe(0);
		// And: proposing the existing slug in the next message checks exactly that file
		await turnEnd();
		expect(await proposeCall("p2", "feature")).toBeUndefined();
		expect(checkedPlans()).toEqual([path.join(h.localRoot, "feature-plan.md")]);
	});

	it("checks the slug file, not a newer plan.md the host's state path could name", async () => {
		const slugFile = await planOnDisk(GOOD_PLAN, "feature");
		const past = new Date(Date.now() - 60_000);
		await fs.utimes(slugFile, past, past);
		await Bun.write(path.join(h.localRoot, "plan.md"), GOOD_PLAN);
		expect(await propose("sess-A", "feature-plan")).toBeUndefined();
		expect(checkedPlans()).toEqual([slugFile]);
	});

	it("refuses, checking nothing, when the slug names no plan file, even with plans on disk", async () => {
		await twoPlans();
		expect(await propose("sess-A", "Final rollout")).toEqual(NO_SLUG_PLAN);
		expect(validatorRuns()).toBe(0);
	});

	it("refuses, checking nothing, when the host derives no slug from the text", async () => {
		// Given: the host's title check rejects path separators, so it reads no slug from `old/x`
		await twoPlans();
		await planOnDisk(GOOD_PLAN, "oldx");
		// When
		const result = await propose("sess-A", "old/x");
		// Then
		expect(result).toEqual(NO_SLUG_PLAN);
		expect(validatorRuns()).toBe(0);
	});

	it("refuses a propose whose text the host strips in hashline mode, checking nothing", async () => {
		await twoPlans();
		expect((await propose("sess-A", "1:old"))?.block).toBe(true);
		expect(validatorRuns()).toBe(0);
	});

	it("refuses a propose with no plan file on disk, checking nothing", async () => {
		expect(await proposeCall("p1", "y")).toEqual(NO_SLUG_PLAN);
		expect(validatorRuns()).toBe(0);
	});
});

describe("session_stop", () => {
	it("ignores a reply that makes no merge claim", async () => {
		const result = await emit("session_stop", {
			type: "session_stop",
			messages: [],
			turn_id: 1,
			last_assistant_message: { role: "assistant", content: [{ type: "text", text: "Status: still working." }] },
		});
		expect(result).toBeUndefined();
		expect(h.execCalls).toHaveLength(0);
	});

	it("checks the repository for a merge claim", async () => {
		const result = await emit("session_stop", {
			type: "session_stop",
			messages: [],
			turn_id: 1,
			last_assistant_message: { role: "assistant", content: [{ type: "text", text: "Ready to merge." }] },
		});
		expect(h.execCalls[0]).toEqual({ command: "git", args: ["rev-parse", "--show-toplevel"] });
		expect(result).toBeUndefined();
	});
});

describe("merge-gate-proof rule contract", () => {
	const stop = (text: string) =>
		emit("session_stop", {
			type: "session_stop",
			messages: [],
			turn_id: 1,
			last_assistant_message: { role: "assistant", content: [{ type: "text", text }] },
		});
	const SHA = "a".repeat(40);
	const FILLED = [
		"Gate proof",
		"- integration-review: RAN",
		`  range ${SHA}...${SHA} · report docs/r.md · Must-fix: 0 open / 0 fixed in ${SHA}`,
		"- review-work: RAN",
		`  reviewed_sha ${SHA} · plan_sha256 ${"b".repeat(64)}`,
		`  record .omo/evidence/gate/r.json · validate-gate-record.mjs exit 0 at ${SHA}`,
		`- code committed after reviewed_sha: none`,
		"",
		"Work is done.",
	].join("\n");

	/** Exec stub: git answers like a repo at h.dir whose default branch does not contain the record's reviewed_sha. */
	beforeEach(async () => {
		const recordDir = path.join(h.dir, ".omo", "evidence", "gate");
		await fs.mkdir(recordDir, { recursive: true });
		await Bun.write(
			path.join(recordDir, "r.json"),
			JSON.stringify({ schema: "omo.merge-gate/v2", plan: ".omo/plans/x.md", reviewed_sha: SHA }),
		);
		const ok = (stdout: string): ExecResult => ({ stdout, stderr: "", code: 0, killed: false });
		(h.pi as unknown as { exec: unknown }).exec = async (command: string, args: string[]): Promise<ExecResult> => {
			h.execCalls.push({ command, args });
			if (command === "node") return h.validator;
			if (args[0] === "rev-parse") return ok(`${h.dir}\n`);
			if (args[0] === "symbolic-ref") return ok("origin/main\n");
			if (args[0] === "merge-base") return { stdout: "", stderr: "", code: 1, killed: false };
			return { stdout: "", stderr: "unexpected", code: 128, killed: false };
		};
	});

	const recordRuns = () => h.execCalls.filter(call => call.command === "node" && call.args.includes("--record"));

	it("sends a filled Gate proof block without a merge phrase to the record validator", async () => {
		expect(await stop(FILLED)).toBeUndefined();
		expect(recordRuns()).toEqual([
			{
				command: "node",
				args: [
					expect.any(String),
					"--repo",
					h.dir,
					"--record",
					".omo/evidence/gate/r.json",
					"--plan",
					".omo/plans/x.md",
				],
			},
		]);
	});

	it("treats legitimately skipped review lines as a claim, not as NOT RUN", async () => {
		const text = FILLED.replace(
			"- integration-review: RAN",
			"- integration-review: not needed (change spans 2 modules)\n- strategic-risk-review: not run (depth rule: mechanical change)",
		);
		expect(await stop(text)).toBeUndefined();
		expect(recordRuns()).toHaveLength(1);
	});

	it("blocks a filled Gate proof block when the record validator fails", async () => {
		h.validator = INVALID;
		const result = await stop(FILLED);
		expect(recordRuns()).toHaveLength(1);
		expect(result).toMatchObject({ decision: "block" });
		const reason = JSON.stringify(result);
		expect(reason).toContain("rejected .omo/evidence/gate/r.json");
		expect(reason).toContain("plan has no ## Merge gate section");
	});

	it("does not treat a Gate proof block with a NOT RUN line as a claim", async () => {
		h.validator = INVALID;
		const text = FILLED.replace("- integration-review: RAN", "- integration-review: NOT RUN (small diff)");
		expect(await stop(text)).toBeUndefined();
		expect(h.execCalls).toHaveLength(0);
	});

	it("leaves a plain completion report ungated; the rule makes the agent emit the block", async () => {
		h.validator = INVALID;
		expect(await stop("The requested work is complete.")).toBeUndefined();
		expect(h.execCalls).toHaveLength(0);
	});
});

describe("worktree gate binding", () => {
	const stop = (text: string) =>
		emit("session_stop", {
			type: "session_stop",
			messages: [],
			turn_id: 1,
			last_assistant_message: { role: "assistant", content: [{ type: "text", text }] },
		});
	const recordRuns = () => h.execCalls.filter(call => call.command === "node" && call.args.includes("--record"));

	it("validates only the reviewed_sha record in its linked worktree", async () => {
		// Given
		const fixture = await worktreeGateFixture();
		const unrelatedSha = await git(fixture.main, "rev-parse", "HEAD");
		await Bun.write(
			path.join(fixture.main, fixture.record),
			JSON.stringify({ schema: "omo.merge-gate/v2", plan: ".omo/plans/unrelated.md", reviewed_sha: unrelatedSha }),
		);
		await git(fixture.main, "add", fixture.record);
		await git(fixture.main, "commit", "-q", "-m", "unrelated gate record");
		useRealGit();

		// When
		const result = await stop(gateProof(fixture.reviewedSha, fixture.record));

		// Then
		expect(result).toBeUndefined();
		expect(recordRuns()).toEqual([
			{
				command: "node",
				args: [
					expect.any(String),
					"--repo",
					fixture.worktree,
					"--record",
					fixture.record,
					"--plan",
					"openspec/changes/worktree-gate",
				],
			},
		]);
	});

	it("refuses a merge claim without a Gate proof reviewed_sha", async () => {
		// Given
		const fixture = await worktreeGateFixture();
		await Bun.write(
			path.join(fixture.main, fixture.record),
			JSON.stringify({
				schema: "omo.merge-gate/v2",
				plan: ".omo/plans/unrelated.md",
				reviewed_sha: await git(fixture.main, "rev-parse", "HEAD"),
			}),
		);
		useRealGit();

		// When
		const result = await stop("Ready to merge.");

		// Then
		expect(result).toMatchObject({ decision: "block" });
		expect(JSON.stringify(result)).toContain("reviewed_sha");
		expect(recordRuns()).toHaveLength(0);
	});

	it("settles a matching record merged into local main without revalidating merged HEAD", async () => {
		// Given
		const fixture = await worktreeGateFixture();
		await git(fixture.main, "merge", "--no-ff", "-q", "-m", "merge feature", "feature");
		h.validator = INVALID;
		useRealGit();

		// When
		const result = await stop(gateProof(fixture.reviewedSha, fixture.record));

		// Then
		expect(result).toBeUndefined();
		expect(recordRuns()).toHaveLength(0);
	});

	it("refuses a claimed reviewed_sha with no matching record", async () => {
		// Given
		await git(h.dir, "init", "-q", "-b", "main");
		await git(h.dir, "config", "user.email", "gate@test");
		await git(h.dir, "config", "user.name", "Gate Test");
		await Bun.write(path.join(h.dir, "source.txt"), "base\n");
		await git(h.dir, "add", "source.txt");
		await git(h.dir, "commit", "-q", "-m", "base");
		useRealGit();
		const missingSha = "c".repeat(40);

		// When
		const result = await stop(gateProof(missingSha));

		// Then
		expect(result).toMatchObject({ decision: "block" });
		expect(JSON.stringify(result)).toContain(missingSha);
		expect(recordRuns()).toHaveLength(0);
	});
});
