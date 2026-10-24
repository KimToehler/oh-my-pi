/**
 * A non-isolated subagent of an ACP session reads and writes files through the client (so it sees unsaved
 * buffers) but gets no terminal, no permission dialog and no agent-initiated turns (D8). Every case spawns
 * through the real path (`TaskTool`, `runStructuredSubagent`, `VibeSessionRegistry`, warm and persisted
 * revive) against a recording client bridge; only the model is scripted.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async/job-manager";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry, MAIN_AGENT_ID } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TaskTool } from "@oh-my-pi/pi-coding-agent/task";
import { runSubagentFollowUpTurn } from "@oh-my-pi/pi-coding-agent/task/executor";
import { createPersistedSubagentReviverFactory } from "@oh-my-pi/pi-coding-agent/task/persisted-revive";
import { restoreSession } from "@oh-my-pi/pi-coding-agent/task/restore";
import { runStructuredSubagent } from "@oh-my-pi/pi-coding-agent/task/structured-subagent";
import type { ToolSession } from "@oh-my-pi/pi-coding-agent/tools";
import { VibeSessionRegistry } from "@oh-my-pi/pi-coding-agent/vibe/runtime";
import type { TaskParams } from "@oh-my-pi/pi-tui/tools/task";
import {
	type BridgeCalls,
	type ChildStep,
	QUIET_SETTINGS,
	recordingClientBridge,
	SubagentSpawnHarness,
} from "../helpers/subagent-spawn-harness";

const UNSAVED = "UNSAVED EDITOR CONTENT";
const ON_DISK = "content saved on disk";

let harness: SubagentSpawnHarness;
let note: string;
/** Disposal closures of artifact directories a kept-alive eval child retained for its revives. */
let retained: Array<() => Promise<void>>;

beforeEach(async () => {
	retained = [];
	harness = await SubagentSpawnHarness.create("test/executor-client-bridge");
	note = path.join(harness.cwd, "note.txt");
	await Bun.write(note, `${ON_DISK}\n`);
});

afterEach(async () => {
	VibeSessionRegistry.resetGlobalForTests();
	await Promise.all(retained.map(cleanup => cleanup()));
	await harness.dispose();
});

const readNote: ChildStep = { name: "read", arguments: { path: "note.txt" } };

function client(capabilities?: { readTextFile?: boolean; writeTextFile?: boolean }) {
	return recordingClientBridge({ buffers: { [note]: UNSAVED }, capabilities });
}

async function runTask(parent: ToolSession, agent: string, isolated = false): Promise<void> {
	const tool = await TaskTool.create(parent);
	await tool.execute("spawn-bridge", {
		context: "Bridge.",
		tasks: [
			{
				agent,
				name: "Child",
				task: "Run the scripted calls.",
				solutionSpace: "one fix: calls given",
				...(isolated ? { isolated: true } : {}),
			},
		],
	} as TaskParams);
}

/** An eval `agent()` spawn, the `task/structured-subagent.ts` site, kept alive for revive cases. */
function spawnEval(parent: ToolSession, agent: string, keepAlive = false) {
	return runStructuredSubagent({
		session: parent,
		invocationKind: "eval",
		assignment: "Run the scripted calls.",
		agent,
		structured: false,
		keepAlive,
		...(keepAlive ? { retainArtifacts: true, onArtifactsRetained: cleanup => retained.push(cleanup) } : {}),
		identity: { id: "EvalChild" },
	});
}

/** The tool results a child's single call of `toolName` produced. */
function sole(agent: string, toolName: string) {
	const outcomes = harness.outcomesOf(agent, toolName);
	expect(outcomes).toHaveLength(1);
	return outcomes[0]!;
}

const noClientTerminalOrDialog = (calls: BridgeCalls): void => {
	expect(calls.terminals).toEqual([]);
	expect(calls.permissions).toEqual([]);
};

describe("subagent bridge", () => {
	it("subagent bridge: a child read returns the client's unsaved content", async () => {
		await harness.defineAgent("worker", ["read"], [readNote]);
		const { bridge, calls } = client();
		await runTask(harness.parentSession({ getClientBridge: () => bridge }), "worker");

		expect(sole("worker", "read").text).toContain(UNSAVED);
		expect(sole("worker", "read").text).not.toContain(ON_DISK);
		expect(calls.reads).toEqual([note]);
	});

	it("subagent bridge: without fs.readTextFile the child reads the disk", async () => {
		await harness.defineAgent("worker", ["read"], [readNote]);
		const { bridge, calls } = client({ readTextFile: false });
		await runTask(harness.parentSession({ getClientBridge: () => bridge }), "worker");

		expect(sole("worker", "read").text).toContain(ON_DISK);
		expect(calls.reads).toEqual([]);
	});

	it("subagent bridge: a child write of a workspace file issues fs/write_text_file", async () => {
		await harness.defineAgent(
			"worker",
			["write"],
			[{ name: "write", arguments: { path: "out.txt", content: "hi\n" } }],
		);
		const { bridge, calls } = client();
		await runTask(harness.parentSession({ getClientBridge: () => bridge }), "worker");

		expect(sole("worker", "write").isError, sole("worker", "write").text).toBe(false);
		expect(calls.writes.map(write => write.path)).toEqual([path.join(harness.cwd, "out.txt")]);
		expect(await Bun.file(path.join(harness.cwd, "out.txt")).text()).toBe("hi\n");
	});

	it("subagent bridge: a child bash runs locally and never calls createTerminal", async () => {
		const ranHere = path.join(harness.cwd, "local.marker");
		await harness.defineAgent("worker", ["bash"], [{ name: "bash", arguments: { command: `touch ${ranHere}` } }]);
		const { bridge, calls } = client();
		await runTask(harness.parentSession({ getClientBridge: () => bridge }), "worker");

		expect(sole("worker", "bash").isError, sole("worker", "bash").text).toBe(false);
		expect(await Bun.file(ranHere).exists()).toBe(true);
		expect(calls.terminals).toEqual([]);
	});

	it("subagent bridge: a child call resolving to a prompt is rejected and requestPermission is never called", async () => {
		await harness.defineAgent("worker", ["bash"], [{ name: "bash", arguments: { command: "echo needs-a-prompt" } }]);
		const { bridge, calls } = client();
		const settings = Settings.isolated({
			...QUIET_SETTINGS,
			"bash.patterns": [{ match: "echo needs-a-prompt", approval: "prompt" }],
		});
		await runTask(harness.parentSession({ getClientBridge: () => bridge, settings }), "worker");

		const bash = sole("worker", "bash");
		expect(bash.isError).toBe(true);
		expect(bash.text).not.toContain("needs-a-prompt\n");
		noClientTerminalOrDialog(calls);
	});

	it("subagent bridge: an isolated child sends no fs request", async () => {
		await harness.defineAgent(
			"worker",
			["read", "write"],
			[readNote, { name: "write", arguments: { path: "isolated-out.txt", content: "iso\n" } }],
		);
		await Bun.$`git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -q -m base`
			.cwd(harness.cwd)
			.quiet();
		const { bridge, calls } = client();
		const settings = Settings.isolated({
			...QUIET_SETTINGS,
			"task.isolation.enabled": true,
			"isolation.backend": "rcopy",
			"task.isolation.apply": false,
		});
		await runTask(harness.parentSession({ getClientBridge: () => bridge, settings }), "worker", true);

		expect(sole("worker", "read").text).toContain(ON_DISK);
		expect(calls.reads).toEqual([]);
		expect(calls.writes).toEqual([]);
	});

	it("subagent bridge: a vibe worker reads the unsaved content", async () => {
		const tag = harness.defineScript("vibe", [readNote]);
		const manager = new AsyncJobManager({ onJobComplete: () => {} });
		const { bridge, calls } = client();
		try {
			const parent = harness.parentSession({
				getClientBridge: () => bridge,
				asyncJobManager: manager,
				getSessionId: () => "vibe-parent",
				getArtifactsDir: () => null,
				taskDepth: 0,
				contextFiles: [],
				skills: [],
				promptTemplates: [],
				rules: [],
				extensionPaths: [],
				customToolPaths: [],
			});
			const spawned = await VibeSessionRegistry.global().spawn(parent, {
				name: "Worker",
				cli: "good",
				prompt: `Run the scripted calls. ${tag}`,
			});
			await manager.getJob(spawned.jobId)?.promise;
		} finally {
			await manager.dispose({ timeoutMs: 1_000 });
		}

		expect(sole("vibe", "read").text).toContain(UNSAVED);
		expect(calls.reads).toEqual([note]);
	}, 30_000);

	it("subagent bridge: an eval agent() child reads and writes through the client and uses no terminal or dialog", async () => {
		const ranHere = path.join(harness.cwd, "eval-local.marker");
		await harness.defineAgent(
			"scripted",
			["read", "write", "bash"],
			[
				readNote,
				{ name: "write", arguments: { path: "eval-out.txt", content: "eval\n" } },
				{ name: "bash", arguments: { command: `touch ${ranHere}` } },
			],
		);
		const { bridge, calls } = client();
		const settled = await spawnEval(harness.parentSession({ getClientBridge: () => bridge }), "scripted");

		expect(settled.result.exitCode).toBe(0);
		expect(sole("scripted", "read").text).toContain(UNSAVED);
		expect(calls.reads).toEqual([note]);
		expect(calls.writes.map(write => write.path)).toEqual([path.join(harness.cwd, "eval-out.txt")]);
		expect(await Bun.file(ranHere).exists()).toBe(true);
		noClientTerminalOrDialog(calls);
	});

	it("subagent bridge: a warm-revived child reads the unsaved content", async () => {
		await harness.defineAgent("scripted", ["read"], []);
		const { bridge, calls } = client();
		const parent = harness.parentSession({ getClientBridge: () => bridge });
		const settled = await spawnEval(parent, "scripted", true);
		expect(settled.result.exitCode).toBe(0);
		expect(calls.reads).toEqual([]);

		await AgentLifecycleManager.global().park("EvalChild");
		expect(AgentRegistry.global().get("EvalChild")).toMatchObject({ status: "parked", session: null });
		harness.setScript("scripted", [readNote]);
		const followUp = await runSubagentFollowUpTurn({
			id: "EvalChild",
			agent: settled.policy.agent,
			message: "Read the note now.",
			structured: false,
		});

		expect(followUp.exitCode).toBe(0);
		expect(sole("scripted", "read").text).toContain(UNSAVED);
		expect(calls.reads).toEqual([note]);
	}, 30_000);

	it("subagent bridge: a persisted-revived child reads the unsaved content", async () => {
		const agentId = "Revived";
		const main = SessionManager.create(harness.cwd, path.join(harness.root, "sessions"));
		main.appendMessage({ role: "user", content: "fan out", timestamp: Date.now() });
		const mainFile = main.getSessionFile();
		if (!mainFile) throw new Error("Expected a persisted session file");
		await main.close();
		// The subagent's transcript as a crash left it: inside its `read` call, no result yet.
		const child = await SessionManager.open(
			path.join(mainFile.slice(0, -6), `${agentId}.jsonl`),
			undefined,
			undefined,
			{
				initialCwd: harness.cwd,
				parentSession: mainFile,
				suppressBreadcrumb: true,
			},
		);
		child.appendSessionInit({
			systemPrompt: ["test"],
			task: "read the note",
			tools: ["read"],
			agent: "task",
			resolvedModel: "mock/mock-model",
		});
		child.appendMessage({ role: "user", content: "read the note", timestamp: Date.now() });
		child.appendMessage({
			role: "assistant",
			content: [{ type: "toolCall", id: "call_read", name: "read", arguments: { path: note } }],
			api: "mock",
			provider: "mock",
			model: "mock-model",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		});
		await child.close();

		const manager = new AsyncJobManager({ maxRunningJobs: 4 });
		AsyncJobManager.setInstance(manager);
		const { bridge, calls } = client();
		const settings = harness.parentSession().settings;
		const session = {
			sessionManager: {
				getSessionFile: () => mainFile,
				getCwd: () => harness.cwd,
				getArtifactManager: () => undefined,
			},
			asyncJobManager: manager,
			settings,
			clientBridge: bridge,
			effectiveExtensionRoots: { explicit: [], mode: "merge", configured: [], configuredLevel: "user" },
			preparedExtensions: undefined,
			restoreInterruptedTurn: async () => false,
		} as unknown as AgentSession;
		AgentLifecycleManager.global().setPersistedSubagentReviverFactory(
			createPersistedSubagentReviverFactory({
				session,
				authStorage: harness.authStorage,
				modelRegistry: harness.modelRegistry,
				settings,
				enableLsp: false,
			}),
			() => 0,
		);
		const delivered = Promise.withResolvers<string>();
		manager.registerDeliverySink(MAIN_AGENT_ID, (_jobId, text) => {
			delivered.resolve(text);
		});
		try {
			const outcome = await restoreSession(session);
			expect(outcome.subagents).toEqual([agentId]);
			await delivered.promise;
			expect(calls.reads).toEqual([note]);
			const revived = AgentRegistry.global().get(agentId)?.session;
			const results = (revived?.agent.state.messages ?? []).filter(message => message.role === "toolResult");
			expect(JSON.stringify(results)).toContain(UNSAVED);
			noClientTerminalOrDialog(calls);
		} finally {
			AsyncJobManager.setInstance(undefined);
			await manager.dispose({ timeoutMs: 1_000 });
		}
	}, 30_000);
});
