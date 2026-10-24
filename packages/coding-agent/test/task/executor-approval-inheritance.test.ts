/**
 * A subagent runs without prompts, yet it must honour what its spawning session's user rejected for good:
 * the denial ledger chain of D5 reaches `task` children, grandchildren, eval `agent()` children, vibe
 * workers and revived agents, and reads the parent's denials live. Every case spawns through the real path
 * (`TaskTool`, `runStructuredSubagent`, `VibeSessionRegistry`, `restoreSession`); only the model is scripted.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async/job-manager";
import type { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
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
import { sessionGrantKey } from "@oh-my-pi/pi-coding-agent/tools/approval";
import { VibeSessionRegistry } from "@oh-my-pi/pi-coding-agent/vibe/runtime";
import type { TaskParams } from "@oh-my-pi/pi-tui/tools/task";
import { type ChildStep, SubagentSpawnHarness } from "../helpers/subagent-spawn-harness";

const DENIED = "denied by user for this session: bash";

let harness: SubagentSpawnHarness;
let marker: string;
/** Disposal closures of artifact directories a kept-alive child retained for its revives. */
let retained: Array<() => Promise<void>>;

beforeEach(async () => {
	retained = [];
	harness = await SubagentSpawnHarness.create("test/executor-approval-inheritance");
	marker = path.join(harness.cwd, "ran.marker");
});

afterEach(async () => {
	VibeSessionRegistry.resetGlobalForTests();
	await Promise.all(retained.map(cleanup => cleanup()));
	await harness.dispose();
});

/** The command a denied child must not run: it leaves `marker` behind when it does. */
const touchMarker = (): ChildStep => ({ name: "bash", arguments: { command: `touch ${marker}` } });

/** The parent's own runner with `bash` rejected for the session, as an ACP "always reject" answer records it. */
function parentRejectingBash(): ExtensionRunner {
	const runner = harness.parentRunner();
	runner.denySessionApproval(sessionGrantKey("bash", "exec"));
	return runner;
}

function spawnParams(agent: string, name: string): TaskParams {
	return {
		context: "Inherited denials.",
		tasks: [{ agent, name, task: "Run the scripted calls.", solutionSpace: "one fix: calls given" }],
	} as TaskParams;
}

async function runTask(parent: ToolSession, agent: string, name: string): Promise<void> {
	const tool = await TaskTool.create(parent);
	await tool.execute(`spawn-${name}`, spawnParams(agent, name));
}

const markerExists = (): Promise<boolean> => Bun.file(marker).exists();

describe("inherited denial", () => {
	it("inherited denial: a task child's bash is denied after the parent denied bash for the session", async () => {
		await harness.defineAgent("worker", ["bash", "read"], [touchMarker()]);
		const runner = parentRejectingBash();
		await runTask(harness.parentSession({ getApprovalLedger: () => runner.approvalLedger }), "worker", "Child");

		const [bash] = harness.outcomesOf("worker", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	});

	it("inherited denial: a denial recorded while the child runs applies to its next bash call", async () => {
		const runner = harness.parentRunner();
		await harness.defineAgent(
			"worker",
			["bash", "read"],
			[
				{ name: "read", arguments: { path: "note.txt" } },
				{
					...touchMarker(),
					// The parent rejects bash after the child already started, between two of its calls.
					before: () => runner.denySessionApproval(sessionGrantKey("bash", "exec")),
				},
			],
		);
		await Bun.write(path.join(harness.cwd, "note.txt"), "hello\n");
		await runTask(harness.parentSession({ getApprovalLedger: () => runner.approvalLedger }), "worker", "Live");

		expect(harness.outcomesOf("worker", "read")[0]?.isError).toBe(false);
		const [bash] = harness.outcomesOf("worker", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	});

	it("inherited denial: a grandchild's bash is denied after the root denied bash", async () => {
		await harness.defineAgent("grandchild", ["bash"], [touchMarker()]);
		await harness.defineAgent(
			"child",
			["task"],
			[{ name: "task", arguments: { ...spawnParams("grandchild", "Grandchild") } }],
		);
		const runner = parentRejectingBash();
		await runTask(harness.parentSession({ getApprovalLedger: () => runner.approvalLedger }), "child", "Middle");

		expect(harness.outcomesOf("child", "task")[0]?.isError).toBe(false);
		const [bash] = harness.outcomesOf("grandchild", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	});

	it("inherited denial: a child's edit still runs unprompted when only bash was denied", async () => {
		const target = path.join(harness.cwd, "fresh.txt");
		const patch = ["*** Begin Patch", "*** Add File: fresh.txt", "+created by the child", "*** End Patch"].join("\n");
		await harness.defineAgent("worker", ["edit", "bash"], [{ name: "edit", arguments: { input: patch } }]);
		const runner = parentRejectingBash();
		await runTask(harness.parentSession({ getApprovalLedger: () => runner.approvalLedger }), "worker", "Editor");

		const [edit] = harness.outcomesOf("worker", "edit");
		expect(edit?.isError, edit?.text).toBe(false);
		expect(await Bun.file(target).text()).toContain("created by the child");
	});

	it("inherited denial: an eval agent() child's bash is denied after the parent denied bash", async () => {
		await harness.defineAgent("scripted", ["bash"], [touchMarker()]);
		const runner = parentRejectingBash();
		const settled = await runStructuredSubagent({
			session: harness.parentSession({ getApprovalLedger: () => runner.approvalLedger }),
			invocationKind: "eval",
			assignment: "Run the scripted calls.",
			agent: "scripted",
			structured: false,
			keepAlive: false,
			identity: { id: "EvalChild" },
		});

		expect(settled.result.exitCode).toBe(0);
		const [bash] = harness.outcomesOf("scripted", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	});

	it("inherited denial: a vibe worker's bash is denied after the parent denied bash", async () => {
		const tag = harness.defineScript("vibe", [touchMarker()]);
		const manager = new AsyncJobManager({ onJobComplete: () => {} });
		const runner = parentRejectingBash();
		try {
			const parent = harness.parentSession({
				getApprovalLedger: () => runner.approvalLedger,
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
			const job = manager.getJob(spawned.jobId);
			await job?.promise;
		} finally {
			await manager.dispose({ timeoutMs: 1_000 });
		}

		const [bash] = harness.outcomesOf("vibe", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	}, 30_000);

	it("inherited denial: a warm-revived child is denied bash after the parent's denial", async () => {
		await harness.defineAgent("scripted", ["bash"], []);
		const runner = harness.parentRunner();
		const parent = harness.parentSession({ getApprovalLedger: () => runner.approvalLedger });
		const settled = await runStructuredSubagent({
			session: parent,
			invocationKind: "eval",
			assignment: "Run the scripted calls.",
			agent: "scripted",
			structured: false,
			keepAlive: true,
			retainArtifacts: true,
			onArtifactsRetained: cleanup => retained.push(cleanup),
			identity: { id: "WarmChild" },
		});
		expect(settled.result.exitCode).toBe(0);

		await AgentLifecycleManager.global().park("WarmChild");
		expect(AgentRegistry.global().get("WarmChild")).toMatchObject({ status: "parked", session: null });
		// The parent rejects bash only after the child parked; the revive must read it live.
		runner.denySessionApproval(sessionGrantKey("bash", "exec"));
		harness.setScript("scripted", [touchMarker()]);
		const followUp = await runSubagentFollowUpTurn({
			id: "WarmChild",
			agent: settled.policy.agent,
			message: "Run the marker command now.",
			structured: false,
		});

		expect(followUp.exitCode).toBe(0);
		const [bash] = harness.outcomesOf("scripted", "bash");
		expect(bash?.isError).toBe(true);
		expect(bash?.text).toContain(DENIED);
		expect(await markerExists()).toBe(false);
	}, 30_000);

	it("inherited denial: a child revived from its JSONL after the parent's denial is denied bash", async () => {
		const agentId = "Revived";
		const main = SessionManager.create(harness.cwd, path.join(harness.root, "sessions"));
		main.appendMessage({ role: "user", content: "fan out", timestamp: Date.now() });
		const mainFile = main.getSessionFile();
		if (!mainFile) throw new Error("Expected a persisted session file");
		await main.close();
		// The subagent's transcript as a crash left it: inside its `bash` call, no result yet.
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
			systemPrompt: ["test", "Role marker revived."],
			task: "run the marker command",
			tools: ["bash"],
			agent: "task",
			resolvedModel: "mock/mock-model",
		});
		child.appendMessage({ role: "user", content: "run the marker command", timestamp: Date.now() });
		child.appendMessage({
			role: "assistant",
			content: [{ type: "toolCall", id: "call_bash", name: "bash", arguments: { command: `touch ${marker}` } }],
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
		const runner = parentRejectingBash();
		const settings = harness.parentSession().settings;
		const session = {
			sessionManager: {
				getSessionFile: () => mainFile,
				getCwd: () => harness.cwd,
				getArtifactManager: () => undefined,
			},
			asyncJobManager: manager,
			settings,
			extensionRunner: runner,
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
			expect(await markerExists()).toBe(false);
			// The revived transcript holds the denial as the `bash` call's result.
			const revived = AgentRegistry.global().get(agentId)?.session;
			const results = (revived?.agent.state.messages ?? []).filter(message => message.role === "toolResult");
			expect(JSON.stringify(results)).toContain(DENIED);
		} finally {
			AsyncJobManager.setInstance(undefined);
			await manager.dispose({ timeoutMs: 1_000 });
		}
	}, 30_000);
});
