import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentTool, AgentToolContext } from "@oh-my-pi/pi-agent-core";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { EditTool } from "@oh-my-pi/pi-coding-agent/edit";
import { type EvalPreludeDefinition, invokeEvalPrelude } from "@oh-my-pi/pi-coding-agent/eval/preludes";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import type {
	ExtensionApprovalAnswer,
	ExtensionApprovalPrompt,
	ExtensionUIContext,
} from "@oh-my-pi/pi-coding-agent/extensibility/extensions/types";
import { ExtensionToolWrapper } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/wrapper";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { BashTool } from "@oh-my-pi/pi-coding-agent/tools/bash";
import { removeSyncWithRetries, Snowflake, TempDir } from "@oh-my-pi/pi-utils";

const BASE_SETTINGS = {
	"async.enabled": false,
	"bash.autoBackground.enabled": false,
	"bashInterceptor.enabled": false,
	"bash.patterns": [{ match: "rm -rf *", approval: "deny" }],
} as const;

function emptyWorkspaceTree(cwd: string) {
	return { rootPath: cwd, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] };
}

function textOf(result: { content?: ReadonlyArray<{ type: string; text?: string }> }): string {
	const blocks = result.content ?? [];
	for (const block of blocks) {
		if (block.type === "text" && typeof block.text === "string") return block.text;
	}
	return "";
}

describe("tools.approvalMode setting", () => {
	// The per-tool approval gate (ExtensionToolWrapper) reads approvalMode / tools.approval /
	// autoApprove exclusively from the execute-time AgentToolContext, never from the session's
	// own settings. So a single shared session exercises every mode — we only vary the context
	// settings per assertion. This avoids paying createAgentSession's cost (model registry,
	// auth-storage discovery, settings init) nine times over.
	let tempDir: string;
	let session: AgentSession;

	beforeAll(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `pi-approval-mode-${Snowflake.next()}-`));
		const cwd = path.join(tempDir, "cwd");
		fs.mkdirSync(cwd, { recursive: true });
		const sessionManager = SessionManager.create(cwd, path.join(tempDir, "sessions"));
		const created = await createAgentSession({
			cwd,
			agentDir: tempDir,
			sessionManager,
			settings: Settings.isolated(BASE_SETTINGS),
			model: getBundledModel("openai", "gpt-4o-mini"),
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			workspaceTree: emptyWorkspaceTree(cwd),
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			toolNames: ["bash"],
		});
		session = created.session;
	});

	afterAll(async () => {
		await session.dispose();
		// Windows can briefly hold tempdir handles after session.dispose(); retry a few times.
		for (let attempt = 0; attempt < 5; attempt++) {
			try {
				removeSyncWithRetries(tempDir);
				break;
			} catch (err) {
				const code = (err as NodeJS.ErrnoException).code;
				if (code !== "EBUSY" && code !== "ENOTEMPTY" && code !== "EPERM") throw err;
				if (attempt === 4) break; // best-effort: OS will reclaim
				await Bun.sleep(50 * (attempt + 1));
			}
		}
	});

	function approvalSettings(extraSettings: Record<string, unknown> = {}): Settings {
		return Settings.isolated({ ...BASE_SETTINGS, ...extraSettings });
	}

	function bashTool() {
		const bash = session.getToolByName("bash");
		if (!bash) throw new Error("Expected bash tool");
		return bash;
	}

	it("yolo mode (default) bypasses approval for non-overriding tool calls", async () => {
		const settings = approvalSettings();
		const result = await bashTool().execute("yolo", { command: "echo ok" }, undefined, undefined, {
			settings,
		} as AgentToolContext);
		expect(textOf(result)).toContain("ok");
	});

	it("omitted execute-time context inherits the session runner settings", async () => {
		const result = await bashTool().execute("inherit-session", { command: "echo inherited" });
		expect(textOf(result)).toContain("inherited");
	});

	it("missing execute-time context fails closed for an exec-tier tool", async () => {
		// Explicit empty context: no settings and no --auto-approve. Omitting the
		// argument inherits the session runner's settings (schema default yolo),
		// which is the live-session path used by direct execute() callers.
		await expect(
			bashTool().execute("no-context", { command: "echo leaked" }, undefined, undefined, {} as AgentToolContext),
		).rejects.toThrow(/requires approval but no interactive UI available/);
	});

	it("always-ask mode rejects exec tools when no UI is available", async () => {
		const settings = approvalSettings({ "tools.approvalMode": "always-ask" });
		await expect(
			bashTool().execute("always-ask", { command: "echo blocked" }, undefined, undefined, {
				settings,
			} as AgentToolContext),
		).rejects.toThrow(/requires approval but no interactive UI available/);
	});

	it("per-tool allow overrides are honored in every mode", async () => {
		const settings = approvalSettings({
			"tools.approvalMode": "always-ask",
			"tools.approval": { bash: "allow" },
		});
		const result = await bashTool().execute("always-ask-allow", { command: "echo allowed" }, undefined, undefined, {
			settings,
		} as AgentToolContext);
		expect(textOf(result)).toContain("allowed");
	});

	it("per-tool prompt overrides can tighten yolo mode", async () => {
		const settings = approvalSettings({
			"tools.approvalMode": "yolo",
			"tools.approval": { bash: "prompt" },
		});
		await expect(
			bashTool().execute("yolo-prompt", { command: "echo blocked" }, undefined, undefined, {
				settings,
			} as AgentToolContext),
		).rejects.toThrow(/requires approval but no interactive UI available/);
	});

	it("write mode still prompts exec-tier tools", async () => {
		const settings = approvalSettings({
			"tools.approvalMode": "write",
			"tools.approval": {},
		});
		await expect(
			bashTool().execute("write-mode", { command: "echo unconfigured" }, undefined, undefined, {
				settings,
			} as AgentToolContext),
		).rejects.toThrow(/requires approval but no interactive UI available/);
	});

	it("critical bash patterns do not prompt in yolo mode with bash allowed", async () => {
		const settings = approvalSettings({
			"tools.approvalMode": "yolo",
			"tools.approval": { bash: "allow" },
		});
		const result = await bashTool().execute(
			"critical",
			{ command: "rm -f /tmp/bun-fake-timer-probe.test.ts" },
			undefined,
			undefined,
			{
				settings,
			} as AgentToolContext,
		);
		expect(textOf(result)).toContain("(no output)");
	});

	it("attributes bash pattern denies to tool policy", async () => {
		const settings = approvalSettings({
			"tools.approvalMode": "yolo",
			"tools.approval": { bash: "allow" },
		});
		await expect(
			bashTool().execute("pattern-deny", { command: "rm -rf /tmp/never-run" }, undefined, undefined, {
				settings,
			} as AgentToolContext),
		).rejects.toThrow('Tool "bash" is blocked by tool policy.\nReason: Blocked by bash pattern: rm -rf *');
	});

	it("CLI --auto-approve forces yolo mode for non-overriding tool calls", async () => {
		const settings = approvalSettings({ "tools.approvalMode": "always-ask" });
		const result = await bashTool().execute("cli-override", { command: "echo override" }, undefined, undefined, {
			settings,
			autoApprove: true,
		} as AgentToolContext);
		expect(textOf(result)).toContain("override");
	});

	it("CLI --auto-approve also bypasses safety-override patterns", async () => {
		const settings = approvalSettings({ "tools.approvalMode": "always-ask" });
		const result = await bashTool().execute(
			"cli-critical",
			{ command: "rm -f /tmp/bun-fake-timer-probe.test.ts" },
			undefined,
			undefined,
			{
				settings,
				autoApprove: true,
			} as AgentToolContext,
		);
		expect(textOf(result)).toContain("(no output)");
	});

	it("xd:// dispatch approval (xdevPolicyKey) suppresses the tier-only re-prompt", async () => {
		// The write tool's outer gate already prompted at the device tool's tier;
		// without the flag this exact call rejects (see the always-ask test above).
		const settings = approvalSettings({ "tools.approvalMode": "always-ask" });
		const result = await bashTool().execute("xdev-tier", { command: "echo dispatched" }, undefined, undefined, {
			settings,
			xdevPolicyKey: "bash",
		} as AgentToolContext);
		expect(textOf(result)).toContain("dispatched");
	});

	it("xd:// dispatch approval does not cover explicit prompts under another key, or deny policies", async () => {
		// The outer gate resolved `tools.approval.<device>`; a policy keyed
		// elsewhere was never asked about, so it must still prompt.
		const promptSettings = approvalSettings({
			"tools.approvalMode": "always-ask",
			"tools.approval": { bash: "prompt" },
		});
		await expect(
			bashTool().execute("xdev-explicit-prompt", { command: "echo blocked" }, undefined, undefined, {
				settings: promptSettings,
				xdevPolicyKey: "other_device",
			} as AgentToolContext),
		).rejects.toThrow(/requires approval but no interactive UI available/);

		const denySettings = approvalSettings({
			"tools.approvalMode": "always-ask",
			"tools.approval": { bash: "deny" },
		});
		await expect(
			bashTool().execute("xdev-denied", { command: "echo blocked" }, undefined, undefined, {
				settings: denySettings,
				xdevPolicyKey: "bash",
			} as AgentToolContext),
		).rejects.toThrow(/blocked by user policy/);
	});
});

/**
 * The approval gate (`ExtensionToolWrapper`) with a host dialog that records every prompt and
 * answers from a script: destructive edits and session-long rejections.
 */
describe("approval prompts through a host dialog", () => {
	let root: TempDir;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;

	beforeAll(async () => {
		root = TempDir.createSync("@pi-approval-dialog-");
		authStorage = await AuthStorage.create(path.join(root.path(), "auth.db"));
		modelRegistry = new ModelRegistry(authStorage);
	});
	afterAll(() => {
		authStorage.close();
		root.removeSync();
	});

	/** A dialog answering from `answers` in order (then `deny`), recording each prompt. */
	function dialog(...answers: ExtensionApprovalAnswer[]) {
		const prompts: ExtensionApprovalPrompt[] = [];
		const approve = vi.fn(async (prompt: ExtensionApprovalPrompt): Promise<ExtensionApprovalAnswer> => {
			prompts.push(prompt);
			return answers.shift() ?? "deny";
		});
		return { prompts, approve };
	}

	function runnerWith(sessionManager: SessionManager, approve: ExtensionUIContext["approve"]): ExtensionRunner {
		const runner = new ExtensionRunner([], new ExtensionRuntime(), root.path(), sessionManager, modelRegistry);
		runner.initialize(
			{
				sendMessage: () => {},
				sendUserMessage: () => {},
				appendEntry: () => {},
				setLabel: () => {},
				getActiveTools: () => [],
				getAllTools: () => [],
				setActiveTools: async () => {},
				getCommands: () => [],
				setModel: async () => false,
				getThinkingLevel: () => undefined,
				setThinkingLevel: () => {},
				getSessionName: () => undefined,
				setSessionName: async () => {},
			},
			{
				getModel: () => undefined,
				isIdle: () => true,
				abort: () => {},
				hasPendingMessages: () => false,
				shutdown: () => {},
				getContextUsage: () => undefined,
				compact: async () => {},
				getSystemPrompt: () => [],
			},
			undefined,
			{
				select: async () => "Deny",
				approve,
				confirm: async () => false,
				input: async () => undefined,
				notify: () => {},
				onTerminalInput: () => () => {},
				setStatus: () => {},
				setWorkingMessage: () => {},
				setWidget: () => {},
				setFooter: () => {},
				setHeader: () => {},
				setTitle: () => {},
				custom: async <T>() => undefined as T,
				pasteToEditor: () => {},
				setEditorText: () => {},
				getEditorText: () => "",
				editor: async () => undefined,
				addAutocompleteProvider: () => {},
				setEditorComponent: () => {},
				getEditorComponent: () => undefined,
				get theme() {
					return {} as never;
				},
				getAllThemes: async () => [],
				getTheme: async () => undefined,
				setTheme: async () => ({ success: false, error: "not implemented" }),
				getToolsExpanded: () => false,
				setToolsExpanded: () => {},
			} satisfies ExtensionUIContext,
		);
		return runner;
	}

	function context(sessionManager: SessionManager, settings: Record<string, unknown>): AgentToolContext {
		return {
			sessionManager,
			modelRegistry,
			model: undefined,
			isIdle: () => true,
			hasQueuedMessages: () => false,
			abort: () => {},
			settings: Settings.isolated({ ...BASE_SETTINGS, ...settings }),
		} as AgentToolContext;
	}

	function toolSession(cwd: string): ToolSession {
		return {
			cwd,
			hasUI: false,
			getSessionFile: () => null,
			getSessionSpawns: () => "*",
			enableLsp: false,
			settings: Settings.isolated({ ...BASE_SETTINGS, "edit.mode": "apply_patch" }),
			getArtifactsDir: () => null,
			getSessionId: () => null,
			getPlanModeState: () => undefined,
		} as unknown as ToolSession;
	}

	function workspace(files: Record<string, string>): string {
		const cwd = fs.mkdtempSync(path.join(root.path(), "ws-"));
		for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(cwd, name), content);
		return cwd;
	}

	const patch = (...lines: string[]) => ({ input: ["*** Begin Patch", ...lines, "*** End Patch"].join("\n") });
	const deletion = (file: string) => patch(`*** Delete File: ${file}`);

	describe("destructive edit", () => {
		function editWrapper(cwd: string, approve: ExtensionUIContext["approve"]) {
			const sessionManager = SessionManager.inMemory(cwd);
			const runner = runnerWith(sessionManager, approve);
			const tool = new ExtensionToolWrapper(new EditTool(toolSession(cwd)) as AgentTool, runner);
			return { sessionManager, runner, tool };
		}

		it("destructive edit: a delete in write mode prompts and the file survives a deny", async () => {
			const cwd = workspace({ "doomed.txt": "keep\n" });
			const { prompts, approve } = dialog("deny");
			const { sessionManager, tool } = editWrapper(cwd, approve);
			await expect(
				tool.execute(
					"d1",
					deletion("doomed.txt"),
					undefined,
					undefined,
					context(sessionManager, { "tools.approvalMode": "write" }),
				),
			).rejects.toThrow("denied by user");
			expect(prompts).toHaveLength(1);
			expect(prompts[0]!.full).toContain("deletes doomed.txt");
			expect(fs.existsSync(path.join(cwd, "doomed.txt"))).toBe(true);
		});

		it("destructive edit: a move prompts in always-ask although tools.approval.edit allows it", async () => {
			const cwd = workspace({ "a.txt": "a\n" });
			const { prompts, approve } = dialog("deny");
			const { sessionManager, tool } = editWrapper(cwd, approve);
			await expect(
				tool.execute(
					"m1",
					patch("*** Update File: a.txt", "*** Move to: b.txt", "@@", "-a", "+a2"),
					undefined,
					undefined,
					context(sessionManager, { "tools.approvalMode": "always-ask", "tools.approval": { edit: "allow" } }),
				),
			).rejects.toThrow("denied by user");
			expect(prompts).toHaveLength(1);
			expect(fs.existsSync(path.join(cwd, "a.txt"))).toBe(true);
			expect(fs.existsSync(path.join(cwd, "b.txt"))).toBe(false);
		});

		it("destructive edit: a plain edit in write mode runs unprompted", async () => {
			const cwd = workspace({ "a.txt": "old\n" });
			const { approve } = dialog();
			const { sessionManager, tool } = editWrapper(cwd, approve);
			await tool.execute(
				"p1",
				patch("*** Update File: a.txt", "@@", "-old", "+new"),
				undefined,
				undefined,
				context(sessionManager, { "tools.approvalMode": "write" }),
			);
			expect(approve).not.toHaveBeenCalled();
			expect(fs.readFileSync(path.join(cwd, "a.txt"), "utf8")).toBe("new\n");
		});

		it("destructive edit: a delete in yolo runs unprompted", async () => {
			const cwd = workspace({ "doomed.txt": "x\n" });
			const { approve } = dialog();
			const { sessionManager, tool } = editWrapper(cwd, approve);
			await tool.execute(
				"y1",
				deletion("doomed.txt"),
				undefined,
				undefined,
				context(sessionManager, { "tools.approvalMode": "yolo" }),
			);
			expect(approve).not.toHaveBeenCalled();
			expect(fs.existsSync(path.join(cwd, "doomed.txt"))).toBe(false);
		});

		it("destructive edit: a held session approval for edit at write tier does not cover a delete", async () => {
			const cwd = workspace({ "a.txt": "old\n", "doomed.txt": "x\n" });
			const { prompts, approve } = dialog("session", "deny");
			const { sessionManager, tool } = editWrapper(cwd, approve);
			const always = context(sessionManager, { "tools.approvalMode": "always-ask" });
			await tool.execute("s1", patch("*** Update File: a.txt", "@@", "-old", "+new"), undefined, undefined, always);
			expect(prompts[0]!.session).toBeDefined();
			await expect(tool.execute("s2", deletion("doomed.txt"), undefined, undefined, always)).rejects.toThrow(
				"denied by user",
			);
			expect(prompts).toHaveLength(2);
			expect(fs.existsSync(path.join(cwd, "doomed.txt"))).toBe(true);
		});

		it("destructive edit: the prompt offers no session choice and a second delete prompts again", async () => {
			const cwd = workspace({ "one.txt": "1\n", "two.txt": "2\n" });
			// A host answering "session" anyway gets a deny: the prompt never offered it.
			const { prompts, approve } = dialog("session", "once", "once");
			const { sessionManager, tool } = editWrapper(cwd, approve);
			const write = context(sessionManager, { "tools.approvalMode": "write" });
			await expect(tool.execute("t0", deletion("one.txt"), undefined, undefined, write)).rejects.toThrow(
				"denied by user",
			);
			expect(fs.existsSync(path.join(cwd, "one.txt"))).toBe(true);
			await tool.execute("t1", deletion("one.txt"), undefined, undefined, write);
			await tool.execute("t2", deletion("two.txt"), undefined, undefined, write);
			expect(prompts).toHaveLength(3);
			expect(prompts.every(prompt => prompt.session === undefined && prompt.grants === undefined)).toBe(true);
			expect(fs.existsSync(path.join(cwd, "one.txt"))).toBe(false);
			expect(fs.existsSync(path.join(cwd, "two.txt"))).toBe(false);
		});
	});

	describe("session denial", () => {
		function gate(approve: ExtensionUIContext["approve"]) {
			const cwd = workspace({});
			const sessionManager = SessionManager.inMemory(cwd);
			const runner = runnerWith(sessionManager, approve);
			const bashInner = new BashTool(toolSession(cwd));
			// Only the gate is under test: the command never reaches a shell.
			const bashRuns = vi.spyOn(bashInner, "execute").mockImplementation(async () => ({ content: [] }));
			const bash = new ExtensionToolWrapper(bashInner as AgentTool, runner);
			const evalRuns = vi.fn();
			const evalTool = new ExtensionToolWrapper(
				{
					name: "eval",
					label: "eval",
					description: "eval",
					parameters: {} as never,
					approval: "exec",
					execute: async () => (evalRuns(), { content: [] }),
				} as AgentTool,
				runner,
			);
			return {
				sessionManager,
				bash,
				bashRuns,
				evalTool,
				evalRuns,
				write: context(sessionManager, { "tools.approvalMode": "write" }),
			};
		}

		it("session denial: a deny-session answer to bash denies a later bash without asking", async () => {
			const { prompts, approve } = dialog("deny-session");
			const { bash, bashRuns, write } = gate(approve);
			await expect(bash.execute("b1", { command: "echo one" }, undefined, undefined, write)).rejects.toThrow(
				"denied by user for this session: bash",
			);
			expect(prompts[0]!.session).toBeDefined();
			await expect(bash.execute("b2", { command: "echo two" }, undefined, undefined, write)).rejects.toThrow(
				"denied by user for this session: bash",
			);
			expect(approve).toHaveBeenCalledTimes(1);
			expect(bashRuns).not.toHaveBeenCalled();
		});

		it("session denial: deny-session on a prompt without a session choice denies only that call", async () => {
			const { prompts, approve } = dialog("deny-session", "deny");
			const { bash, bashRuns, write } = gate(approve);
			await expect(
				bash.execute("c1", { command: "rm -f /tmp/never-run-critical" }, undefined, undefined, write),
			).rejects.toThrow("Tool call denied by user: bash");
			expect(prompts[0]!.session).toBeUndefined();
			await expect(bash.execute("c2", { command: "echo ordinary" }, undefined, undefined, write)).rejects.toThrow(
				"Tool call denied by user: bash",
			);
			expect(approve).toHaveBeenCalledTimes(2);
			expect(bashRuns).not.toHaveBeenCalled();
		});

		it("session denial: other tools still prompt", async () => {
			const { approve } = dialog("deny-session", "once");
			const { bash, evalTool, evalRuns, write } = gate(approve);
			await expect(bash.execute("e0", { command: "echo one" }, undefined, undefined, write)).rejects.toThrow();
			await evalTool.execute("e1", {}, undefined, undefined, write);
			expect(approve).toHaveBeenCalledTimes(2);
			expect(evalRuns).toHaveBeenCalledTimes(1);
		});

		it("session denial: a critical command after the denial is denied without a prompt", async () => {
			const { approve } = dialog("deny-session", "once");
			const { bash, bashRuns, write } = gate(approve);
			await expect(bash.execute("k0", { command: "echo one" }, undefined, undefined, write)).rejects.toThrow();
			await expect(
				bash.execute("k1", { command: "rm -f /tmp/never-run-critical" }, undefined, undefined, write),
			).rejects.toThrow("denied by user for this session: bash");
			expect(approve).toHaveBeenCalledTimes(1);
			expect(bashRuns).not.toHaveBeenCalled();
		});

		it("session denial: a new session prompts for bash again", async () => {
			const { approve } = dialog("deny-session", "once");
			const { sessionManager, bash, bashRuns, write } = gate(approve);
			await expect(bash.execute("n0", { command: "echo one" }, undefined, undefined, write)).rejects.toThrow();
			await sessionManager.newSession();
			await bash.execute("n1", { command: "echo two" }, undefined, undefined, write);
			expect(approve).toHaveBeenCalledTimes(2);
			expect(bashRuns).toHaveBeenCalledTimes(1);
		});
	});
});

describe("prelude answer", () => {
	it.each(["deny-session", "session"] as const)("prelude answer: non-once denies (%s)", async answer => {
		const approve = vi.fn(async (_prompt: ExtensionApprovalPrompt): Promise<ExtensionApprovalAnswer> => answer);
		const invoke = vi.fn(async () => ({ content: [] }));
		const prelude: EvalPreludeDefinition = {
			name: "probe",
			documentation: "",
			javascript: "",
			python: "",
			exports: [],
			approval: "exec",
			invoke,
		};
		const session = {
			cwd: os.tmpdir(),
			settings: Settings.isolated({}),
			getEvalPreludes: () => [prelude],
		} as unknown as ToolSession;
		const context = {
			settings: Settings.isolated({ "tools.approvalMode": "write" }),
			ui: { approve } as unknown as ExtensionUIContext,
			hasUI: true,
		} as unknown as AgentToolContext;
		await expect(
			invokeEvalPrelude("probe", { target: "x" }, { session, toolCallId: "prelude-1", context }),
		).rejects.toThrow("Eval prelude call denied by user: probe");
		expect(approve).toHaveBeenCalledTimes(1);
		expect(invoke).not.toHaveBeenCalled();
	});
});
