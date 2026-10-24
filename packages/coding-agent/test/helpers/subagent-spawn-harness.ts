/**
 * Real subagent spawns for the approval-inheritance and client-bridge suites: an isolated HOME, a mock model
 * served through the real `ModelRegistry`, agent definitions on disk, and a scripted child. The spawn paths
 * under test (`task`, eval `agent()`, vibe, revive) run unmodified; only the model is scripted.
 */
import { vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { unregisterCustomApis } from "@oh-my-pi/pi-ai/api-registry";
import { createMockModel, type MockModel, type MockResponse, registerMockApi } from "@oh-my-pi/pi-ai/providers/mock";
import { closeModelCache } from "@oh-my-pi/pi-catalog/model-cache";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { ExtensionRuntime } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { AgentStorage } from "@oh-my-pi/pi-coding-agent/session/agent-storage";
import type {
	ClientBridge,
	ClientBridgeCreateTerminalParams,
	ClientBridgePermissionToolCall,
} from "@oh-my-pi/pi-coding-agent/session/client-bridge";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { __resetDirsFromEnvForTests, removeWithRetries, setAgentDir } from "@oh-my-pi/pi-utils";
import { createInMemoryAuthStorage } from "./agent-session-setup";

const ENV_KEYS = ["HOME", "PI_CODING_AGENT_DIR", "OMP_PROFILE", "PI_PROFILE"] as const;

function restoreEnvValue(key: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
		delete Bun.env[key];
		return;
	}
	process.env[key] = value;
	Bun.env[key] = value;
}

/** One scripted tool call of a child; `before` runs as the model produces it. */
export interface ChildStep {
	name: string;
	arguments: Record<string, unknown>;
	before?: () => void;
}

/** A tool result a child received, in call order. */
export interface ChildToolOutcome {
	agent: string;
	toolName: string;
	isError: boolean;
	text: string;
}

/** Settings every spawned child needs to run quietly and deterministically. */
export const QUIET_SETTINGS = {
	"async.enabled": false,
	"task.agentIdleTtlMs": 0,
	"task.enableLsp": false,
	"task.isolation.enabled": false,
	"task.completionProbe": false,
	"task.structured": false,
	"compaction.enabled": false,
	"retry.enabled": false,
	"todo.enabled": false,
	"todo.reminders": false,
	"advisor.enabled": false,
	"autolearn.enabled": false,
	"bash.autoBackground.enabled": false,
	"bashInterceptor.enabled": false,
	"edit.mode": "apply_patch",
	modelRoles: { default: "mock/mock-model", task: "mock/mock-model", smol: "mock/mock-model" },
} as const;

export class SubagentSpawnHarness {
	readonly outcomes: ChildToolOutcome[] = [];
	readonly #scripts = new Map<string, ChildStep[]>();
	/** Text whose presence in a child's system prompt or user messages selects its script. */
	readonly #needles = new Map<string, string>();
	readonly #seen = new Set<string>();

	private constructor(
		readonly root: string,
		readonly cwd: string,
		readonly authStorage: AuthStorage,
		readonly modelRegistry: ModelRegistry,
		readonly mock: MockModel,
		private readonly sourceId: string,
		private readonly savedEnv: Record<string, string | undefined>,
	) {}

	static async create(sourceId: string): Promise<SubagentSpawnHarness> {
		const savedEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "omp-subagent-spawn-"));
		const home = path.join(root, "home");
		const cwd = path.join(home, "work");
		await fs.mkdir(cwd, { recursive: true });
		restoreEnvValue("HOME", home);
		vi.spyOn(os, "homedir").mockReturnValue(home);
		setAgentDir(path.join(home, ".omp", "agent"));
		AgentRegistry.resetGlobalForTests();
		AgentLifecycleManager.resetGlobalForTests();
		registerMockApi(sourceId);
		const authStorage = createInMemoryAuthStorage();
		authStorage.keys.setRuntime("mock", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		// Declared before `harness` is assigned so the handler can close over it.
		const holder: { harness?: SubagentSpawnHarness } = {};
		const mock = createMockModel({
			handler: context => {
				const { harness } = holder;
				return harness ? harness.#respond(context) : { content: ["label"] };
			},
		});
		const catalogAvailable = modelRegistry.getAvailable.bind(modelRegistry);
		vi.spyOn(modelRegistry, "getAvailable").mockImplementation(kind => [mock, ...catalogAvailable(kind)]);
		const harness = new SubagentSpawnHarness(root, cwd, authStorage, modelRegistry, mock, sourceId, savedEnv);
		holder.harness = harness;
		return harness;
	}

	async dispose(): Promise<void> {
		await AgentLifecycleManager.global().dispose();
		AgentLifecycleManager.resetGlobalForTests();
		AgentRegistry.resetGlobalForTests();
		unregisterCustomApis(this.sourceId);
		vi.restoreAllMocks();
		for (const key of ENV_KEYS) restoreEnvValue(key, this.savedEnv[key]);
		__resetDirsFromEnvForTests();
		this.authStorage.close();
		// Child sessions opened agent.db and models.db under root; Windows cannot delete open files.
		AgentStorage.close();
		closeModelCache();
		await removeWithRetries(this.root);
	}

	/** Registers a user agent `name` with `tools`; its scripted tool calls run in order, then it answers `done`. */
	async defineAgent(name: string, tools: readonly string[], script: readonly ChildStep[]): Promise<void> {
		const agentsDir = path.join(this.root, "home", ".omp", "agent", "agents");
		await fs.mkdir(agentsDir, { recursive: true });
		await Bun.write(
			path.join(agentsDir, `${name}.md`),
			[
				"---",
				`name: ${name}`,
				"description: Scripted test agent",
				"model: mock/mock-model",
				`tools: ${tools.join(", ")}`,
				"---",
				"",
				`Role marker ${name}.`,
			].join("\n"),
		);
		this.#scripts.set(name, [...script]);
		this.#needles.set(name, `Role marker ${name}.`);
	}

	/**
	 * Scripts a child whose agent is not defined here (a bundled one): the script applies to every conversation
	 * whose prompt contains the returned tag, so the spawn's task text must include it.
	 */
	defineScript(name: string, script: readonly ChildStep[]): string {
		const tag = `[script:${name}]`;
		this.#scripts.set(name, [...script]);
		this.#needles.set(name, tag);
		return tag;
	}

	/** Gives an already-defined agent a new script (a follow-up turn replays from its first step). */
	setScript(name: string, script: readonly ChildStep[]): void {
		this.#scripts.set(name, [...script]);
	}

	outcomesOf(agent: string, toolName: string): ChildToolOutcome[] {
		return this.outcomes.filter(outcome => outcome.agent === agent && outcome.toolName === toolName);
	}

	/** The parent `ToolSession` a spawn site reads: settings, models, and the ledger and bridge under test. */
	parentSession(
		extra: Partial<ToolSession> & { settings?: Settings } = {},
		settingsOverrides: Record<string, unknown> = {},
	): ToolSession {
		const { settings, ...rest } = extra;
		return {
			cwd: this.cwd,
			hasUI: false,
			settings: settings ?? Settings.isolated({ ...QUIET_SETTINGS, ...settingsOverrides }),
			getSessionFile: () => null,
			getSessionSpawns: () => "*",
			modelRegistry: this.modelRegistry,
			authStorage: this.authStorage,
			enableLsp: false,
			enableMCP: false,
			enableIrc: false,
			...rest,
		} as unknown as ToolSession;
	}

	/** A real runner standing in for the spawning session's: its denials are what children inherit. */
	parentRunner(): ExtensionRunner {
		return new ExtensionRunner(
			[],
			new ExtensionRuntime(),
			this.cwd,
			SessionManager.inMemory(this.cwd),
			this.modelRegistry,
		);
	}

	#respond(context: { systemPrompt?: string[]; messages: readonly unknown[] }): MockResponse {
		const messages = context.messages as ReadonlyArray<{
			role: string;
			toolCallId?: string;
			toolName?: string;
			isError?: boolean;
			content?: unknown;
		}>;
		const userText = messages
			.filter(message => message.role === "user")
			.map(message => JSON.stringify(message.content))
			.join("\n");
		const conversation = `${context.systemPrompt?.join("\n") ?? ""}\n${userText}`;
		const agent = [...this.#needles].find(([, needle]) => conversation.includes(needle))?.[0];
		if (!agent) return { content: ["label"] };
		let results = 0;
		for (const message of messages) {
			if (message.role !== "toolResult") continue;
			results++;
			const key = `${agent}:${message.toolCallId}`;
			if (this.#seen.has(key)) continue;
			this.#seen.add(key);
			const parts = Array.isArray(message.content) ? message.content : [];
			this.outcomes.push({
				agent,
				toolName: message.toolName ?? "",
				isError: message.isError === true,
				text: parts
					.map(part => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
					.join(""),
			});
		}
		const step = this.#scripts.get(agent)?.[results];
		if (!step) return { content: ["done"] };
		step.before?.();
		return { content: [{ type: "toolCall", id: `${agent}-${results}`, name: step.name, arguments: step.arguments }] };
	}
}

/** What a recording ACP client bridge saw. */
export interface BridgeCalls {
	reads: string[];
	writes: Array<{ path: string; content: string }>;
	terminals: ClientBridgeCreateTerminalParams[];
	permissions: ClientBridgePermissionToolCall[];
}

/**
 * An ACP-style client bridge with every capability, serving `buffers` (path -> unsaved editor content) for
 * reads and writing through to disk, recording every call it receives.
 */
export function recordingClientBridge(
	options: {
		buffers?: Record<string, string>;
		capabilities?: { readTextFile?: boolean; writeTextFile?: boolean };
	} = {},
): { bridge: ClientBridge; calls: BridgeCalls } {
	const calls: BridgeCalls = { reads: [], writes: [], terminals: [], permissions: [] };
	const canRead = options.capabilities?.readTextFile ?? true;
	const canWrite = options.capabilities?.writeTextFile ?? true;
	const bridge: ClientBridge = {
		capabilities: { readTextFile: canRead, writeTextFile: canWrite, terminal: true, requestPermission: true },
		allowAgentInitiatedTurns: () => true,
		readTextFile: async params => {
			calls.reads.push(params.path);
			return options.buffers?.[params.path] ?? (await Bun.file(params.path).text());
		},
		writeTextFile: async params => {
			calls.writes.push(params);
			await Bun.write(params.path, params.content);
		},
		createTerminal: async params => {
			calls.terminals.push(params);
			throw new Error("the client terminal must not be used by a subagent");
		},
		requestPermission: async toolCall => {
			calls.permissions.push(toolCall);
			return { outcome: "cancelled" };
		},
	};
	return { bridge, calls };
}
