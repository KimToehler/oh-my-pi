/**
 * Contract: a tool the Cursor provider runs through the host bridge stops with
 * the provider request that dispatched it. Bridged calls bypass the agent loop,
 * so the request signal the loop hands the stream function is the only path by
 * which an aborted turn reaches the tool. Covered on the two hosts that build a
 * bridge: the primary session (SDK) and an advisor.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentTool, type StreamFn } from "@oh-my-pi/pi-agent-core";
import type { Api, AssistantMessage, Model, ModelSpec, SimpleStreamOptions } from "@oh-my-pi/pi-ai";
import { clearCustomApis, registerCustomApi } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { AssistantMessageEventStream } from "@oh-my-pi/pi-ai/utils/event-stream";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { CursorExecHandlers } from "@oh-my-pi/pi-coding-agent/cursor";
import { type CustomTool, createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";
import { createAssistantMessage, createInMemoryAuthStorage } from "./helpers/agent-session-setup";

const PROBE = "slow_probe";

/** A tool that runs until its `execute` signal aborts, reporting the signal it was given. */
function createProbe() {
	const started = Promise.withResolvers<AbortSignal | undefined>();
	const release = Promise.withResolvers<void>();
	const run = async (signal: AbortSignal | undefined) => {
		started.resolve(signal);
		const aborted = Promise.withResolvers<void>();
		if (signal?.aborted) aborted.resolve();
		signal?.addEventListener("abort", () => aborted.resolve(), { once: true });
		await Promise.race([aborted.promise, release.promise]);
		return { content: [{ type: "text" as const, text: signal?.aborted ? "stopped" : "finished" }] };
	};
	return { started: started.promise, release: () => release.resolve(), run };
}

/** One Cursor-style MCP frame for the probe, issued through the handlers a request received. */
function dispatchProbe(options: SimpleStreamOptions | undefined, toolCallId: string): void {
	const handlers = options?.cursorExecHandlers;
	if (!handlers?.mcp) throw new Error("the request carried no Cursor bridge");
	void handlers.mcp({
		name: PROBE,
		toolName: PROBE,
		providerIdentifier: "pi-agent",
		toolCallId,
		args: {},
		rawArgs: {},
	});
}

/** A request that stays open until its signal aborts, as a turn awaiting a bridged tool does. */
function streamUntilAborted(message: AssistantMessage, options: SimpleStreamOptions | undefined) {
	const stream = new AssistantMessageEventStream();
	const finish = () => {
		const aborted: AssistantMessage = { ...message, content: [], stopReason: "aborted", errorMessage: "aborted" };
		stream.push({ type: "error", reason: "aborted", error: aborted });
	};
	if (options?.signal?.aborted) queueMicrotask(finish);
	else options?.signal?.addEventListener("abort", finish, { once: true });
	return stream;
}

describe("Cursor bridge cancellation", () => {
	const disposables: Array<{ dispose(): Promise<void> | void }> = [];

	afterEach(async () => {
		clearCustomApis();
		for (const item of disposables.splice(0).reverse()) await item.dispose();
	});

	it("aborts a streamed shell frame's tool with the request", async () => {
		const probe = createProbe();
		const bash: AgentTool = {
			name: "bash",
			label: "Bash",
			description: "Runs until cancelled.",
			parameters: type({ command: "string", "cwd?": "string", "timeout?": "number" }),
			execute: (_id, _params, signal) => probe.run(signal),
		};
		const controller = new AbortController();
		const handlers = new CursorExecHandlers({
			cwd: ".",
			tools: new Map([["bash", bash]]),
			signal: controller.signal,
		});
		const stdout: string[] = [];

		const pending = handlers.shellStream({ command: "sleep 600", toolCallId: "shell-stream-1" } as never, {
			onStdout: data => stdout.push(data),
			onStderr: () => {},
		});
		const toolSignal = await probe.started;
		controller.abort();
		probe.release();
		await pending;

		expect(toolSignal?.aborted).toBe(true);
		expect(stdout.join("")).toBe("stopped");
	});

	it("never starts a bridged call that arrives after the request aborted", async () => {
		const probe = createProbe();
		const probeTool: AgentTool = {
			name: PROBE,
			label: "Slow probe",
			description: "Runs until cancelled.",
			parameters: type({}),
			execute: (_id, _params, signal) => probe.run(signal),
		};
		const events: string[] = [];
		const handlers = new CursorExecHandlers({
			cwd: ".",
			tools: new Map([[PROBE, probeTool]]),
			emitEvent: event => events.push(event.type),
			signal: AbortSignal.abort("user interrupt"),
		});

		const result = await handlers.mcp({
			name: PROBE,
			toolName: PROBE,
			providerIdentifier: "pi-agent",
			toolCallId: "late-call",
			args: {},
			rawArgs: {},
		});

		expect(result.isError).toBe(true);
		expect(events).toEqual([]);
		expect(await Promise.race([probe.started.then(() => "started"), Bun.sleep(10).then(() => "idle")])).toBe("idle");
	});

	it("aborts a primary-session bridged tool when the session aborts its turn", async () => {
		using tempDir = TempDir.createSync("@pi-cursor-bridge-cancel-");
		const probe = createProbe();
		const api = "test-cursor-bridge-cancel";
		registerCustomApi(api, (_model, _context, options) => {
			dispatchProbe(options, "primary-probe");
			return streamUntilAborted(createAssistantMessage(""), options);
		});
		const model = buildModel({
			id: "bridge-cancel",
			name: "Bridge cancel",
			api,
			provider: "bridge-cancel-provider",
			baseUrl: "http://127.0.0.1:8080/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 32_768,
			maxTokens: 1024,
		} as ModelSpec<Api>) as Model<Api>;
		const authStorage = createInMemoryAuthStorage();
		disposables.push({ dispose: () => authStorage.close() });
		authStorage.keys.setRuntime(model.provider, "test-key");
		const probeTool: CustomTool = {
			name: PROBE,
			label: "Slow probe",
			description: "Runs until cancelled.",
			parameters: type({}),
			execute: (_id, _params, _onUpdate, _ctx, signal) => probe.run(signal),
		};
		const { session } = await createAgentSession({
			cwd: tempDir.path(),
			agentDir: tempDir.path(),
			sessionManager: SessionManager.inMemory(tempDir.path()),
			authStorage,
			modelRegistry: new ModelRegistry(authStorage, tempDir.join("models.yml")),
			settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false }),
			model,
			customTools: [probeTool],
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			skipPythonPreflight: true,
			taskDepth: 1,
			agentId: "SubAgent",
		});
		disposables.push(session);

		const prompting = session.prompt("run the probe");
		const toolSignal = await probe.started;
		await session.abort();
		probe.release();
		await prompting;

		expect(toolSignal?.aborted).toBe(true);
	});

	it("aborts an advisor's bridged tool when the advisor run aborts", async () => {
		using tempDir = TempDir.createSync("@pi-cursor-bridge-cancel-advisor-");
		const probe = createProbe();
		const authStorage = createInMemoryAuthStorage();
		disposables.push({ dispose: () => authStorage.close() });
		authStorage.keys.setRuntime("anthropic", "test-key");
		const primary = createMockModel({ provider: "anthropic", responses: [{ content: ["primary complete"] }] });
		const advisorModel = createMockModel({ provider: "anthropic" });
		const probeTool: AgentTool = {
			name: PROBE,
			label: "Slow probe",
			description: "Runs until cancelled.",
			parameters: type({}),
			execute: (_id, _params, signal) => probe.run(signal),
		};
		const advisorStreamFn: StreamFn = (_model, _context, options) => {
			dispatchProbe(options, "advisor-probe");
			return streamUntilAborted(createAssistantMessage(""), options);
		};
		const settings = Settings.isolated({
			"advisor.syncBacklog": "off",
			"compaction.enabled": false,
			"todo.enabled": false,
		});
		const session = new AgentSession({
			agent: new Agent({
				getApiKey: () => "test-key",
				initialState: { model: primary, systemPrompt: [], tools: [] },
				streamFn: primary.stream,
			}),
			sessionManager: SessionManager.inMemory(tempDir.path()),
			settings,
			modelRegistry: new ModelRegistry(authStorage, tempDir.join("models.yml")),
			advisorTools: [probeTool],
			advisorStreamFn,
			advisorConfigs: [{ name: "Probe reviewer", tools: [PROBE] }],
		});
		disposables.push(session);
		settings.setModelRole("advisor", "anthropic/claude-sonnet-4-5");
		expect(session.setAdvisorEnabled(true)).toBe(true);
		const advisor = session.getAdvisorAgent();
		if (!advisor) throw new Error("Expected advisor agent to be active");
		advisor.setModel(advisorModel);

		await session.prompt("only update");
		const toolSignal = await probe.started;
		advisor.abort();
		probe.release();
		await advisor.waitForIdle();

		expect(toolSignal?.aborted).toBe(true);
	});
});
