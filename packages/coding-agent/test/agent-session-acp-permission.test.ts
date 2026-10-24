/**
 * ACP tool permissions: the approval gate (`ExtensionToolWrapper`) decides whether a call needs
 * consent exactly as in the TUI, and the ACP UI context's `approve` turns each prompt into one
 * `session/request_permission` whose selected option maps back to the gate's answer.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type Mock, vi } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentTool, type AgentToolContext, type ToolTier } from "@oh-my-pi/pi-agent-core";
import { createMockModel, type MockModelOptions } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { EditTool } from "@oh-my-pi/pi-coding-agent/edit";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { ExtensionToolWrapper } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/wrapper";
import type { EvalPreludeDefinition } from "@oh-my-pi/pi-coding-agent/eval/preludes";
import { invokeEvalPrelude } from "@oh-my-pi/pi-coding-agent/eval/preludes";
import { createAcpExtensionUiContext } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-agent";
import type { WatchApprovalSupersede } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-approval";
import type { AcpPermissionRequester } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-client-bridge";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import type {
	ClientBridgePermissionOption,
	ClientBridgePermissionOutcome,
	ClientBridgePermissionToolCall,
} from "@oh-my-pi/pi-coding-agent/session/client-bridge";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { approvalTargetKey } from "@oh-my-pi/pi-coding-agent/tools/approval-targets";
import { AskTool } from "@oh-my-pi/pi-coding-agent/tools/ask";
import { BashTool } from "@oh-my-pi/pi-coding-agent/tools/bash";
import { getAgentDir, isRecord, setAgentDir, TempDir, withTimeout } from "@oh-my-pi/pi-utils";
import type { RequestPermissionRequest } from "@oh-my-pi/pi-utils/acp";
import { cleanupHarnessState, createHarness, type SetToolUIContextSpy } from "./acp-test-harness";

const BASE_SETTINGS = {
	"async.enabled": false,
	"bash.autoBackground.enabled": false,
	"bashInterceptor.enabled": false,
} as const;

/** One scripted client answer: an outcome, a transport failure, or no answer until the turn aborts. */
type ClientAnswer = ClientBridgePermissionOutcome | Error | "hang";

const pick = (optionId: string): ClientBridgePermissionOutcome => ({ outcome: "selected", optionId });

interface PermissionRequest {
	toolCall: ClientBridgePermissionToolCall;
	options: ClientBridgePermissionOption[];
	/** Aborts when a user steer supersedes the request: the client should withdraw its dialog. */
	steeringSignal?: AbortSignal;
}

/** An ACP client answering permission requests from `answers` in order (then reject), recording each. */
function acpClient(...answers: ClientAnswer[]) {
	const requests: PermissionRequest[] = [];
	const asked = Promise.withResolvers<void>();
	const request: AcpPermissionRequester = async (toolCall, options, _signal, steeringSignal) => {
		requests.push({ toolCall, options, steeringSignal });
		asked.resolve();
		const answer = answers.shift() ?? pick("reject_once");
		if (answer === "hang") return Promise.withResolvers<never>().promise;
		if (answer instanceof Error) throw answer;
		return answer;
	};
	return { requests, request, asked: asked.promise };
}

const optionIds = (request: PermissionRequest | undefined) => request?.options.map(option => option.optionId);

let root: TempDir;
let authStorage: AuthStorage;
let modelRegistry: ModelRegistry;
let originalAgentDir: string;

beforeAll(async () => {
	root = TempDir.createSync("@pi-acp-permission-");
	authStorage = await AuthStorage.create(path.join(root.path(), "auth.db"));
	modelRegistry = new ModelRegistry(authStorage);
});
afterAll(() => {
	authStorage.close();
	root.removeSync();
});
beforeEach(() => {
	// `always-ask-cached` grants persist under the agent dir; a fresh one per case keeps them apart.
	originalAgentDir = getAgentDir();
	setAgentDir(fs.mkdtempSync(path.join(root.path(), "agent-")));
});
afterEach(() => {
	setAgentDir(originalAgentDir);
	vi.restoreAllMocks();
});

function workspace(files: Record<string, string> = {}): string {
	const cwd = fs.mkdtempSync(path.join(root.path(), "ws-"));
	for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(cwd, name), content);
	return cwd;
}

function toolSession(cwd: string, editMode = "apply_patch"): ToolSession {
	return {
		cwd,
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		enableLsp: false,
		settings: Settings.isolated({ ...BASE_SETTINGS, "edit.mode": editMode }),
		getArtifactsDir: () => null,
		getSessionId: () => null,
		getPlanModeState: () => undefined,
	} as unknown as ToolSession;
}

/** Gives `runner` the ACP extension UI context of a client without form elicitation, as the ACP agent does. */
function initializeAcpUi(
	runner: ExtensionRunner,
	cwd: string,
	request: AcpPermissionRequester,
	watchSupersede?: WatchApprovalSupersede,
): void {
	const ui = createAcpExtensionUiContext({} as never, () => "acp-session", {}, undefined, undefined, {
		request,
		getCwd: () => cwd,
		watchSupersede,
	});
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
		ui,
	);
}

function acpRunner(sessionManager: SessionManager, cwd: string, request: AcpPermissionRequester): ExtensionRunner {
	const runner = new ExtensionRunner([], new ExtensionRuntime(), cwd, sessionManager, modelRegistry);
	initializeAcpUi(runner, cwd, request);
	return runner;
}

function toolContext(sessionManager: SessionManager, settings: Record<string, unknown>): AgentToolContext {
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

/** The gate over `bash` (spied, so no shell runs unless `realBash`) and `edit` for one ACP session. */
function acpGate(
	client: ReturnType<typeof acpClient>,
	options: { files?: Record<string, string>; editMode?: string; realBash?: boolean } = {},
) {
	const cwd = workspace(options.files);
	const sessionManager = SessionManager.inMemory(cwd);
	const runner = acpRunner(sessionManager, cwd, client.request);
	const bashInner = new BashTool(toolSession(cwd));
	const bashRuns = options.realBash
		? vi.spyOn(bashInner, "execute")
		: vi.spyOn(bashInner, "execute").mockImplementation(async () => ({ content: [] }));
	return {
		cwd,
		sessionManager,
		runner,
		bash: new ExtensionToolWrapper(bashInner as AgentTool, runner),
		bashRuns,
		edit: new ExtensionToolWrapper(new EditTool(toolSession(cwd, options.editMode)) as AgentTool, runner),
		mode: (approvalMode: string, extra: Record<string, unknown> = {}) =>
			toolContext(sessionManager, { "tools.approvalMode": approvalMode, ...extra }),
	};
}

/** A tool keying `args.path` like read does, so `always-ask-cached` offers grants for it. */
function pathTool(name: string, tier: ToolTier, cwd: string, runs: () => void): AgentTool {
	return {
		name,
		label: name,
		description: `${name} test tool`,
		parameters: {} as never,
		approval: tier,
		approvalCacheTargets: (args: unknown) =>
			isRecord(args) && typeof args.path === "string" ? [approvalTargetKey(cwd, args.path)!] : undefined,
		execute: async () => (runs(), { content: [{ type: "text" as const, text: "executed" }] }),
	};
}

const patch = (...lines: string[]) => ({ input: ["*** Begin Patch", ...lines, "*** End Patch"].join("\n") });

describe("acp approve", () => {
	it("acp approve: a client without form elicitation gets one request and allow runs bash", async () => {
		const client = acpClient(pick("allow_once"));
		const { bash, mode } = acpGate(client, { realBash: true });
		const result = await bash.execute("b1", { command: "echo acp-ran" }, undefined, undefined, mode("always-ask"));
		expect(JSON.stringify(result.content)).toContain("acp-ran");
		expect(client.requests).toHaveLength(1);
		expect(client.requests[0]!.toolCall).toMatchObject({
			toolCallId: "b1",
			toolName: "bash",
			kind: "execute",
			status: "pending",
			rawInput: { command: "echo acp-ran" },
			content: [{ type: "content", content: { type: "text", text: "$ echo acp-ran" } }],
		});
	});

	it("acp approve: always-ask sends exactly one request per call", async () => {
		const client = acpClient(pick("allow_once"), pick("allow_once"));
		const { bash, bashRuns, edit, cwd, mode } = acpGate(client, { files: { "a.txt": "old\n" } });
		const always = mode("always-ask");
		await bash.execute("one", { command: "echo one" }, undefined, undefined, always);
		await edit.execute("two", patch("*** Update File: a.txt", "@@", "-old", "+new"), undefined, undefined, always);
		expect(client.requests.map(request => request.toolCall.toolCallId)).toEqual(["one", "two"]);
		expect(bashRuns).toHaveBeenCalledTimes(1);
		expect(fs.readFileSync(path.join(cwd, "a.txt"), "utf8")).toBe("new\n");
	});

	it("acp approve: ordinary bash offers allow once, allow session, reject and always reject", async () => {
		const client = acpClient(pick("reject_once"));
		const { bash, bashRuns, mode } = acpGate(client);
		await expect(bash.execute("o1", { command: "echo hi" }, undefined, undefined, mode("write"))).rejects.toThrow(
			"Tool call denied by user: bash",
		);
		expect(client.requests[0]!.options.map(option => [option.optionId, option.kind])).toEqual([
			["allow_once", "allow_once"],
			["allow_always", "allow_always"],
			["reject_once", "reject_once"],
			["reject_always", "reject_always"],
		]);
		expect(bashRuns).not.toHaveBeenCalled();
	});

	it("acp approve: critical bash and a destructive edit offer only allow once and reject", async () => {
		const client = acpClient(pick("reject_once"), pick("reject_once"));
		const { bash, bashRuns, edit, cwd, mode } = acpGate(client, { files: { "doomed.txt": "keep\n" } });
		const write = mode("write");
		await expect(
			bash.execute("c1", { command: "rm -f /tmp/never-run-critical" }, undefined, undefined, write),
		).rejects.toThrow("denied by user");
		await expect(
			edit.execute("c2", patch("*** Delete File: doomed.txt"), undefined, undefined, write),
		).rejects.toThrow("denied by user");
		expect(client.requests.map(optionIds)).toEqual([
			["allow_once", "reject_once"],
			["allow_once", "reject_once"],
		]);
		expect(bashRuns).not.toHaveBeenCalled();
		expect(fs.existsSync(path.join(cwd, "doomed.txt"))).toBe(true);
	});

	it("acp approve: allow session lets a second ordinary bash run without a request", async () => {
		const client = acpClient(pick("allow_always"));
		const { bash, bashRuns, mode } = acpGate(client);
		const write = mode("write");
		await bash.execute("s1", { command: "echo one" }, undefined, undefined, write);
		await bash.execute("s2", { command: "echo two" }, undefined, undefined, write);
		expect(client.requests).toHaveLength(1);
		expect(bashRuns).toHaveBeenCalledTimes(2);
	});

	it("acp approve: always-ask-cached offers folder and file grants, and the chosen grant covers a later read", async () => {
		const client = acpClient(pick("grant:folder"));
		const { cwd, runner, sessionManager } = acpGate(client);
		const runs = vi.fn();
		const read = new ExtensionToolWrapper(pathTool("read", "read", cwd, runs), runner);
		const cached = toolContext(sessionManager, { "tools.approvalMode": "always-ask-cached" });
		await read.execute("r1", { path: "a.txt" }, undefined, undefined, cached);
		await read.execute("r2", { path: "b.txt" }, undefined, undefined, cached);
		expect(client.requests.map(optionIds)).toEqual([
			["grant:folder", "grant:target", "grant:folder:always", "grant:target:always", "allow_once", "reject_once"],
		]);
		expect(client.requests[0]!.options.slice(0, 4).every(option => option.kind === "allow_always")).toBe(true);
		expect(runs).toHaveBeenCalledTimes(2);
	});

	it("acp approve: always reject records a session denial", async () => {
		const client = acpClient(pick("reject_always"));
		const { bash, bashRuns, mode } = acpGate(client);
		const write = mode("write");
		await expect(bash.execute("d1", { command: "echo one" }, undefined, undefined, write)).rejects.toThrow(
			"denied by user for this session: bash",
		);
		await expect(bash.execute("d2", { command: "echo two" }, undefined, undefined, write)).rejects.toThrow(
			"denied by user for this session: bash",
		);
		expect(client.requests).toHaveLength(1);
		expect(bashRuns).not.toHaveBeenCalled();
	});

	it("acp approve: an unknown option id fails the call", async () => {
		const client = acpClient(pick("allow_forever"));
		const { bash, bashRuns, mode } = acpGate(client);
		await expect(bash.execute("u1", { command: "echo hi" }, undefined, undefined, mode("write"))).rejects.toThrow(
			"unknown option ID: allow_forever",
		);
		expect(bashRuns).not.toHaveBeenCalled();
	});

	it("acp approve: a cancelled outcome and an aborted turn report cancellation without running", async () => {
		const cancelled = acpClient({ outcome: "cancelled" });
		const first = acpGate(cancelled);
		await expect(
			first.bash.execute("x1", { command: "echo hi" }, undefined, undefined, first.mode("write")),
		).rejects.toThrow("Permission request cancelled");
		expect(first.bashRuns).not.toHaveBeenCalled();

		const hanging = acpClient("hang");
		const second = acpGate(hanging);
		const controller = new AbortController();
		const run = second.bash.execute("x2", { command: "echo hi" }, controller.signal, undefined, second.mode("write"));
		await hanging.asked;
		controller.abort();
		await expect(run).rejects.toThrow("Permission request cancelled");
		expect(second.bashRuns).not.toHaveBeenCalled();
	});

	it("acp approve: a rejected permission request fails the call without running", async () => {
		const client = acpClient(new Error("ACP connection closed"));
		const { bash, bashRuns, mode } = acpGate(client);
		await expect(bash.execute("e1", { command: "echo hi" }, undefined, undefined, mode("write"))).rejects.toThrow(
			"ACP connection closed",
		);
		expect(bashRuns).not.toHaveBeenCalled();
	});

	it("acp approve: hashline edits and deletes send the absolute paths they touch", async () => {
		const client = acpClient(pick("reject_once"), pick("reject_once"));
		const { edit, cwd, mode } = acpGate(client, {
			files: { "a.txt": "a\n", "b.txt": "b\n" },
			editMode: "hashline",
		});
		const always = mode("always-ask");
		await expect(
			edit.execute("h1", { input: "[a.txt#ABCD]\nPUT 1.=1:\n+x" }, undefined, undefined, always),
		).rejects.toThrow("denied by user");
		await expect(edit.execute("h2", { input: "[b.txt#ABCD]\nREM" }, undefined, undefined, always)).rejects.toThrow(
			"denied by user",
		);
		expect(client.requests.map(request => request.toolCall.locations)).toEqual([
			[{ path: path.join(cwd, "a.txt") }],
			[{ path: path.join(cwd, "b.txt") }],
		]);
		expect(fs.existsSync(path.join(cwd, "b.txt"))).toBe(true);
	});
});

/**
 * The real session tools (each wrapped by the gate at construction) with the ACP UI on the
 * session's own runner, in the effective mode `write` an unconfigured ACP session gets.
 */
describe("acp parity", () => {
	let cwd: string;
	let session: AgentSession;
	let client: ReturnType<typeof acpClient>;

	beforeAll(async () => {
		cwd = workspace();
		const created = await createAgentSession({
			cwd,
			agentDir: fs.mkdtempSync(path.join(root.path(), "parity-agent-")),
			sessionManager: SessionManager.inMemory(cwd),
			// `bash` reads `bash.patterns` from its session's settings, as in the TUI.
			settings: Settings.isolated({
				...BASE_SETTINGS,
				"tools.approvalMode": "write",
				"bash.patterns": [
					{ match: "echo pattern-allowed", approval: "allow" },
					{ match: "rm *", approval: "allow" },
				],
			}),
			model: getBundledModel("openai", "gpt-4o-mini"),
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			workspaceTree: { rootPath: cwd, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] },
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			toolNames: ["read", "bash", "write", "eval", "task"],
		});
		session = created.session;
		initializeAcpUi(session.extensionRunner!, cwd, (...args) => client.request(...args));
		await session.activateVibeTools(session.getActiveToolNames());
	});
	afterAll(async () => {
		await session.dispose();
	});
	beforeEach(() => {
		client = acpClient();
	});

	function tool(name: string): AgentTool {
		const found = session.getToolByName(name);
		if (!found) throw new Error(`Expected ${name} tool`);
		return found;
	}

	const write = (extra: Record<string, unknown> = {}) =>
		toolContext(session.sessionManager, { "tools.approvalMode": "write", ...extra });

	it.each([
		["task", { agent: "task", task: "inspect the repo" }],
		["eval", { language: "py", code: "print(1)" }],
		["vibe_spawn", { cli: "fast", task: "inspect the repo" }],
	] as const)("acp parity: %s raises a request before running", async (name, args) => {
		await expect(tool(name).execute(`${name}-1`, args, undefined, undefined, write())).rejects.toThrow(
			`Tool call denied by user: ${name}`,
		);
		expect(client.requests.map(request => [request.toolCall.toolCallId, request.toolCall.toolName])).toEqual([
			[`${name}-1`, name],
		]);
	});

	it("acp parity: write of a new file runs without a request", async () => {
		await tool("write").execute("w1", { path: "fresh.txt", content: "hi\n" }, undefined, undefined, write());
		expect(fs.readFileSync(path.join(cwd, "fresh.txt"), "utf8")).toBe("hi\n");
		expect(client.requests).toHaveLength(0);
	});

	it("acp parity: tools.approval.write prompt raises a request", async () => {
		await expect(
			tool("write").execute(
				"w2",
				{ path: "guarded.txt", content: "hi\n" },
				undefined,
				undefined,
				write({ "tools.approval": { write: "prompt" } }),
			),
		).rejects.toThrow("Tool call denied by user: write");
		expect(client.requests).toHaveLength(1);
		expect(fs.existsSync(path.join(cwd, "guarded.txt"))).toBe(false);
	});

	it("acp parity: a bash.patterns allow runs without a request", async () => {
		const result = await tool("bash").execute(
			"b1",
			{ command: "echo pattern-allowed" },
			undefined,
			undefined,
			write(),
		);
		expect(JSON.stringify(result.content)).toContain("pattern-allowed");
		expect(client.requests).toHaveLength(0);
	});

	it("acp parity: tools.approval.bash deny blocks without a request", async () => {
		await expect(
			tool("bash").execute(
				"b2",
				{ command: "echo never" },
				undefined,
				undefined,
				write({ "tools.approval": { bash: "deny" } }),
			),
		).rejects.toThrow("blocked by user policy");
		expect(client.requests).toHaveLength(0);
	});

	it("acp parity: a critical bash command raises a request although a pattern allows it", async () => {
		await expect(tool("bash").execute("b3", { command: "rm -rf /" }, undefined, undefined, write())).rejects.toThrow(
			"Tool call denied by user: bash",
		);
		expect(client.requests.map(optionIds)).toEqual([["allow_once", "reject_once"]]);
	});
});

/** The tool UI context the ACP agent installs for a client without form elicitation, and what consumes it. */
describe("acp ui context", () => {
	afterEach(cleanupHarnessState);

	async function acpToolUi(optionId: string) {
		const requests: RequestPermissionRequest[] = [];
		const harness = await createHarness({
			clientCapabilities: {},
			requestPermission: async request => {
				requests.push(request);
				return { outcome: { outcome: "selected", optionId } };
			},
		});
		await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const install = harness.setToolUIContextSpies[0] as Mock<SetToolUIContextSpy>;
		expect(install).toHaveBeenCalledTimes(1);
		const [ui, hasUI] = install.mock.calls[0]!;
		let runs = 0;
		const prelude: EvalPreludeDefinition = {
			name: "probe",
			documentation: "",
			javascript: "",
			python: "",
			exports: [],
			approval: "exec",
			invoke: async () => (runs++, { content: [] }),
		};
		const session = {
			cwd: harness.cwdA,
			settings: Settings.isolated({}),
			getEvalPreludes: () => [prelude],
		} as unknown as ToolSession;
		const context = {
			settings: Settings.isolated({ "tools.approvalMode": "write" }),
			ui,
			hasUI,
			abort: () => {},
		} as unknown as AgentToolContext;
		return {
			harness,
			requests,
			session,
			context,
			hasUI,
			runs: () => runs,
			callPrelude: () => invokeEvalPrelude("probe", { target: "x" }, { session, toolCallId: "prelude-1", context }),
		};
	}

	it("acp ui context: an eval prelude prompt sends one permission request and runs after allow", async () => {
		const { harness, requests, hasUI, runs, callPrelude } = await acpToolUi("allow_once");
		expect(hasUI).toBe(false);
		await callPrelude();
		expect(runs()).toBe(1);
		expect(requests.map(request => request.options.map(option => option.kind))).toEqual([
			["allow_once", "reject_once"],
		]);
		await harness.agent.dispose();
	});

	it("acp ui context: a reject answer fails the prelude call without running it", async () => {
		const { harness, requests, runs, callPrelude } = await acpToolUi("reject_once");
		await expect(callPrelude()).rejects.toThrow("Eval prelude call denied by user: probe");
		expect(requests).toHaveLength(1);
		expect(runs()).toBe(0);
		await harness.agent.dispose();
	});

	it("acp ui context: ask still requires interactive mode", async () => {
		const { harness, requests, session, context } = await acpToolUi("allow_once");
		await expect(
			new AskTool(session).execute(
				"ask-1",
				{ questions: [{ id: "q", question: "Pick one?", options: [{ label: "a" }, { label: "b" }] }] } as never,
				undefined,
				undefined,
				context,
			),
		).rejects.toThrow("Ask tool requires interactive mode");
		expect(requests).toHaveLength(0);
		await harness.agent.dispose();
	});
});

// ---------------------------------------------------------------------------
// Steering: a user steer supersedes an open permission request (ACP `_session/steering`)
// ---------------------------------------------------------------------------

let liveSession: AgentSession | undefined;
afterEach(async () => {
	await liveSession?.dispose();
	liveSession = undefined;
});

/** A write-tier tool counting its runs: under `always-ask` every call asks first. */
function countingTool(name: string): AgentTool & { runs: number } {
	const tool = {
		name,
		label: name,
		description: `${name} test tool`,
		parameters: type({ "path?": "string" }),
		approval: "write" as const,
		runs: 0,
		execute: async () => {
			tool.runs++;
			return { content: [{ type: "text" as const, text: "executed" }] };
		},
	};
	return tool;
}

/**
 * A session on a scripted model. With `client`, every tool passes the ACP approval gate whose
 * `approve` watches this session for a superseding steer, as `acp-agent` wires it.
 * `loopSteeringSignal` stands in for the loop's per-call steer signal (`ctx.toolCall.steeringSignal`),
 * aborted on command the way the loop's any-source steering poll does.
 */
async function createSessionWithMockModel(
	tools: AgentTool[],
	responses: NonNullable<MockModelOptions["responses"]>,
	options: {
		client?: ReturnType<typeof acpClient>;
		getApiKey?: () => Promise<string> | string;
		loopSteeringSignal?: AbortSignal;
	} = {},
): Promise<AgentSession> {
	const mock = createMockModel({ responses });
	const cwd = workspace();
	const sessionManager = SessionManager.inMemory(cwd);
	const getApiKey = options.getApiKey ?? (() => "test-key");
	const client = options.client;
	let gated = tools;
	if (client) {
		const runner = new ExtensionRunner([], new ExtensionRuntime(), cwd, sessionManager, modelRegistry);
		initializeAcpUi(runner, cwd, client.request, loop => liveSession!.watchApprovalSupersede(loop));
		gated = tools.map(tool => new ExtensionToolWrapper(tool, runner) as AgentTool);
	}
	const loopSteeringSignal = options.loopSteeringSignal;
	const agent = new Agent({
		getApiKey,
		...(loopSteeringSignal
			? {
					getToolContext: (() =>
						({ toolCall: { steeringSignal: loopSteeringSignal, toolCalls: [], index: 0 } }) as never) as never,
				}
			: {}),
		initialState: { model: mock.model, systemPrompt: ["Test"], tools: gated, messages: [] },
		convertToLlm,
		streamFn: mock.stream,
	});
	const session = new AgentSession({
		agent,
		sessionManager,
		settings: Settings.isolated({ "compaction.enabled": false, "tools.approvalMode": "always-ask" }),
		modelRegistry: { getApiKey } as never,
		toolRegistry: new Map(gated.map(tool => [tool.name, tool])),
	});
	session.setClientBridge({ capabilities: {} });
	liveSession = session;
	return session;
}

const deleteCall = (id: string) => ({
	content: [{ type: "toolCall" as const, id, name: "delete", arguments: { path: "/tmp/gone.ts" } }],
});

function userTextIndex(session: AgentSession, needle: string): number {
	return session.agent.state.messages.findIndex(
		message => message.role === "user" && JSON.stringify(message.content).includes(needle),
	);
}

describe("acp steering", () => {
	it("acp steering: a user steer supersedes an open permission request and withdraws the client's dialog", async () => {
		const client = acpClient("hang");
		const deleteTool = countingTool("delete");
		const session = await createSessionWithMockModel(
			[deleteTool],
			[deleteCall("call-delete-1"), { content: ["done after steer"] }],
			{ client },
		);
		const promptDone = session.prompt("delete something");
		await client.asked;

		expect(await session.joinActiveTurn("wait — use the other parser instead")).toBe(true);
		await promptDone;

		expect(deleteTool.runs).toBe(0);
		expect(client.requests).toHaveLength(1);
		expect(client.requests[0]!.steeringSignal?.aborted).toBe(true);
		const result = session.agent.state.messages.find(message => message.role === "toolResult");
		expect(JSON.stringify(result)).toContain("Permission request superseded by user steering");
		expect(userTextIndex(session, "use the other parser")).toBeGreaterThanOrEqual(0);
	});

	it("acp steering: an agent-authored steer leaves the request open until a user steer arrives", async () => {
		const client = acpClient("hang");
		const deleteTool = countingTool("delete");
		const loopSteering = new AbortController();
		const session = await createSessionWithMockModel(
			[deleteTool],
			[deleteCall("call-delete-9"), { content: ["done after steer"] }],
			{ client, loopSteeringSignal: loopSteering.signal },
		);
		const promptDone = session.prompt("delete something else");
		await client.asked;

		// The loop's steer signal aborts for any queued source, but no user steering arrived. The
		// watch decides synchronously on the abort, so the client's dialog must still be live.
		session.agent.steer({
			role: "user",
			content: [{ type: "text", text: "agent-authored aside while the dialog is open" }],
			timestamp: Date.now(),
		});
		loopSteering.abort();
		expect(client.requests[0]!.steeringSignal?.aborted).toBe(false);

		expect(await session.joinActiveTurn("wait — the user changed their mind")).toBe(true);
		await promptDone;
		expect(deleteTool.runs).toBe(0);
		expect(userTextIndex(session, "the user changed their mind")).toBeGreaterThanOrEqual(0);
	});

	it("acp steering: the superseding steer is delivered ahead of an older queued steer", async () => {
		const client = acpClient("hang");
		const deleteTool = countingTool("delete");
		const turnStreamStarted = Promise.withResolvers<void>();
		const releaseTurnStream = Promise.withResolvers<void>();
		const session = await createSessionWithMockModel(
			[deleteTool],
			[
				async () => {
					turnStreamStarted.resolve();
					await releaseTurnStream.promise;
					return deleteCall("call-delete-1");
				},
				{ content: ["answered superseding steer"] },
				{ content: ["answered older steer"] },
			],
			{ client },
		);
		const promptDone = session.prompt("delete something");
		await withTimeout(turnStreamStarted.promise, 5_000, "Held turn stream never started");
		// Queued while the turn streams, before any dialog exists.
		expect(await session.joinActiveTurn("older question about the batch")).toBe(true);
		releaseTurnStream.resolve();
		await client.asked;

		expect(await session.joinActiveTurn("why this deletion?")).toBe(true);
		await promptDone;
		await session.waitForIdle();

		expect(deleteTool.runs).toBe(0);
		const supersedeIndex = userTextIndex(session, "why this deletion?");
		expect(supersedeIndex).toBeGreaterThanOrEqual(0);
		expect(userTextIndex(session, "older question about the batch")).toBeGreaterThan(supersedeIndex);
	});

	it("acp steering: the user steer is delivered ahead of an agent-authored steer queued in the same window", async () => {
		const client = acpClient("hang");
		const deleteTool = countingTool("delete");
		const session = await createSessionWithMockModel(
			[deleteTool],
			[deleteCall("call-delete-1"), { content: ["answered user steer"] }, { content: ["answered agent steer"] }],
			{ client },
		);
		const promptDone = session.prompt("delete something");
		await client.asked;

		// Agent-authored: fires no steering arrival, so it must not ride the promotion.
		session.agent.steer({
			role: "user",
			content: [{ type: "text", text: "agent-authored steer" }],
			timestamp: Date.now(),
		});
		expect(await session.joinActiveTurn("user steer superseding the dialog")).toBe(true);
		await promptDone;
		await session.waitForIdle();

		expect(deleteTool.runs).toBe(0);
		const userSteerIndex = userTextIndex(session, "user steer superseding the dialog");
		expect(userSteerIndex).toBeGreaterThanOrEqual(0);
		expect(userTextIndex(session, "agent-authored steer")).toBeGreaterThan(userSteerIndex);
	});

	it("acp steering: two steers admitted in one dialog window are delivered first-arrival-first", async () => {
		const client = acpClient("hang");
		const deleteTool = countingTool("delete");
		const session = await createSessionWithMockModel(
			[deleteTool],
			[deleteCall("call-delete-1"), { content: ["answered first steer"] }, { content: ["answered second steer"] }],
			{ client },
		);
		const promptDone = session.prompt("delete something");
		await client.asked;

		// No await between the calls: both enqueue before the watch's abort wake runs.
		const first = session.joinActiveTurn("first steering question");
		const second = session.joinActiveTurn("second steering question");
		expect(await first).toBe(true);
		expect(await second).toBe(true);
		await promptDone;
		await session.waitForIdle();

		expect(deleteTool.runs).toBe(0);
		expect(userTextIndex(session, "first steering question")).toBeLessThan(
			userTextIndex(session, "second steering question"),
		);
	});

	it("parks a steer that lands mid-dispatch until the owning prompt goes live, then injects it", async () => {
		// Park-until-live: a steer arriving while the owning prompt is reserved but still
		// dispatching (in flight, the agent not yet streaming) must neither be refused back to the
		// host nor injected mid-dispatch; it parks, then admits when the run goes live.
		const keyGate = Promise.withResolvers<void>();
		const dispatched = Promise.withResolvers<void>();
		let keyCalls = 0;
		const gatedApiKey = (): Promise<string> | string => {
			keyCalls++;
			if (keyCalls === 1) {
				dispatched.resolve();
				return keyGate.promise.then(() => "test-key");
			}
			return "test-key";
		};
		const session = await createSessionWithMockModel(
			[],
			[{ content: ["first answer"] }, { content: ["steer answer"] }],
			{ getApiKey: gatedApiKey },
		);

		const promptDone = session.prompt("first");
		await dispatched.promise;
		expect(session.isStreaming).toBe(true);
		expect(session.agent.state.isStreaming).toBe(false);

		const admitted = session.joinActiveTurn("steer the dispatching turn");
		let settled = false;
		void admitted.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		// Negative control: no event marks "still parked", so give the admission a few turns to
		// settle wrongly while the dispatch is held.
		await Bun.sleep(40);
		expect(settled).toBe(false);

		keyGate.resolve();
		expect(await admitted).toBe(true);
		await promptDone;
		await session.waitForIdle();

		const messages = session.agent.state.messages;
		const steerIndex = userTextIndex(session, "steer the dispatching turn");
		const answerIndex = messages.findIndex(
			message => message.role === "assistant" && JSON.stringify(message.content).includes("steer answer"),
		);
		expect(steerIndex).toBeGreaterThanOrEqual(0);
		expect(answerIndex).toBeGreaterThan(steerIndex);
	});

	it("refuses a steer into an agent-initiated turn whose output has no client forwarder", async () => {
		const turnStarted = Promise.withResolvers<void>();
		const releaseTurn = Promise.withResolvers<void>();
		const session = await createSessionWithMockModel(
			[],
			[
				async () => {
					turnStarted.resolve();
					await releaseTurn.promise;
					return { content: ["agent-initiated done"] };
				},
			],
		);
		const sent = session.sendCustomMessage(
			{ customType: "background", content: "do work", display: false },
			{ deliverAs: "nextTurn", triggerTurn: true },
		);
		await turnStarted.promise;
		expect(session.agent.state.isStreaming).toBe(true);
		expect(session.isStreaming).toBe(true);

		expect(await session.joinActiveTurn("steer the agent-initiated turn")).toBe(false);
		expect(session.getQueuedMessages().steering).toEqual([]);

		releaseTurn.resolve();
		await sent;
		await session.waitForIdle();
		expect(userTextIndex(session, "steer the agent-initiated turn")).toBe(-1);
	});

	it("parks a steer submitted before the owning prompt's dispatch preprocessing", async () => {
		// The submission's synchronous prefix reserves the client claim before any dispatch
		// preprocessing await, so a steer landing in that window parks and injects instead of
		// being declined.
		const session = await createSessionWithMockModel([], [{ content: ["ok"] }]);
		const dispatched = session.prompt("hello there");
		const steer = session.joinActiveTurn("steer the dispatching prompt");
		expect(await steer).toBe(true);
		expect(await dispatched).toBe(true);
		await session.waitForIdle();
	});
});
