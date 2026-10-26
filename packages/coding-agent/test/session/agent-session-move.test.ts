/**
 * `session_move` contract in AgentSession: a tool requests a move, the run stops after its batch
 * without aborting siblings, the host relocator runs inside the session-transition fence, and
 * exactly one hidden continuation turn follows.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import { scheduler } from "node:timers/promises";
import * as path from "node:path";
import { Agent, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolCall } from "@oh-my-pi/pi-ai";
import { createMockModel, type MockHandler, type MockModel, type MockResponse } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async/job-manager";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { GoalHostController } from "@oh-my-pi/pi-coding-agent/goals/host-controller";
import { IrcBus } from "@oh-my-pi/pi-coding-agent/irc/bus";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import {
	describeRunningSessionWork,
	findRunningSessionWork,
	type SessionRelocationResult,
	type SessionRelocator,
} from "@oh-my-pi/pi-coding-agent/session/session-move";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { runSubagentFollowUpTurn } from "@oh-my-pi/pi-coding-agent/task/executor";
import type { IrcMessage } from "@oh-my-pi/pi-tui/tools/irc";
import { TempDir } from "@oh-my-pi/pi-utils";
import { Type } from "@sinclair/typebox";

function call(id: string, name: string, args: Record<string, unknown> = {}): ToolCall {
	return { type: "toolCall", id, name, arguments: args };
}

const AGENT_ID = "MoveMain";

describe("session move", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;
	let session: AgentSession | undefined;
	let jobManager: AsyncJobManager | undefined;
	const registered: string[] = [];

	beforeAll(async () => {
		tempDir = TempDir.createSync("@pi-session-move-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		authStorage.keys.setRuntime("anthropic", "anthropic-test-key");
		modelRegistry = new ModelRegistry(authStorage, path.join(tempDir.path(), "models.yml"));
	});

	afterAll(() => {
		authStorage.close();
		tempDir.removeSync();
	});

	afterEach(async () => {
		for (const id of registered.splice(0)) AgentRegistry.global().unregister(id);
		await session?.dispose();
		session = undefined;
		await jobManager?.dispose();
		jobManager = undefined;
	});

	interface Fixture {
		session: AgentSession;
		mock: MockModel;
		srcDir: string;
		dstDir: string;
		dstSessions: string;
		relocatorCalls: string[];
		events: string[];
		/** The session's cwd at each provider request. */
		requestCwds: string[];
	}

	/**
	 * `tools` receive the session so test tools can call `reserveSessionMove`.
	 * `relocate` defaults to the real `moveSession` into `dstSessions`.
	 */
	function setup(options: {
		name: string;
		responses: MockResponse[];
		tools: (ctx: { getSession: () => AgentSession; srcDir: string; events: string[] }) => AgentTool[];
		relocate?: (target: string, fx: () => Fixture) => Promise<SessionRelocationResult>;
		withJobManager?: boolean;
		settings?: Record<string, unknown>;
		agentRegistry?: AgentRegistry;
	}): Fixture {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled test model to exist");
		const root = path.join(tempDir.path(), options.name);
		const srcDir = path.join(root, "src");
		const dstDir = path.join(root, "dst");
		const srcSessions = path.join(root, "sessions-src");
		const dstSessions = path.join(root, "sessions-dst");
		for (const dir of [srcDir, dstDir, srcSessions, dstSessions]) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(srcDir, "a.txt"), "old cwd content");
		fs.writeFileSync(path.join(dstDir, "a.txt"), "new cwd content");
		const mock = createMockModel({ responses: options.responses });
		const settings = Settings.isolated({
			"compaction.enabled": false,
			"retry.enabled": false,
			"todo.reminders": false,
			"tools.xdev": false,
			...options.settings,
		});
		settings.setModelRole("default", `${model.provider}/${model.id}`);
		const events: string[] = [];
		const requestCwds: string[] = [];
		const tools = options.tools({ getSession: () => session as AgentSession, srcDir, events });
		const agent = new Agent({
			getApiKey: agentModel => `${agentModel.provider}-test-key`,
			initialState: { model, systemPrompt: ["Test"], tools, messages: [] },
			streamFn: (streamModel, context, streamOptions) => {
				events.push("provider-request");
				requestCwds.push(session?.sessionManager.getCwd() ?? "");
				return mock.stream(streamModel, context, streamOptions);
			},
			convertToLlm,
		});
		if (options.withJobManager) jobManager = new AsyncJobManager({ retentionMs: 1000 });
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.create(srcDir, srcSessions),
			settings,
			modelRegistry,
			agentId: AGENT_ID,
			asyncJobManager: jobManager,
			agentRegistry: options.agentRegistry,
		});
		const relocatorCalls: string[] = [];
		const fx: Fixture = { session, mock, srcDir, dstDir, dstSessions, relocatorCalls, events, requestCwds };
		const relocator: SessionRelocator = async target => {
			relocatorCalls.push(target);
			events.push("relocator");
			if (options.relocate) return options.relocate(target, () => fx);
			await session?.moveSession(target, dstSessions);
			return { ok: true };
		};
		session.setSessionRelocator(relocator);
		return fx;
	}

	/** The `session_move` stand-in: records the request and stops the batch, like the real tool (5.1). */
	function sessionMoveTool(getSession: () => AgentSession, target: () => string, events: string[]): AgentTool {
		return {
			name: "session_move",
			label: "session_move",
			description: "move",
			parameters: Type.Object({}),
			async execute() {
				getSession().reserveSessionMove()?.commit({ path: target() });
				events.push("session_move-result");
				return { content: [{ type: "text", text: "scheduled" }] };
			},
		};
	}

	function textOf(message: { content: unknown }): string {
		if (typeof message.content === "string") return message.content;
		return (message.content as Array<{ type: string; text?: string }>)
			.map(part => (part.type === "text" ? (part.text ?? "") : ""))
			.join("");
	}

	/** Structured facts `AgentSession` records on each `session-move-result` continuation message. */
	interface MoveResultDetails {
		outcome: "moved" | "failed";
		cwd: string;
		target: string;
		reason?: string;
	}

	/** Select the continuation messages by type, never by their rendered prose. */
	function moveResults(target: AgentSession): MoveResultDetails[] {
		return target.sessionManager
			.getEntries()
			.flatMap(entry =>
				entry.type === "custom_message" && entry.customType === "session-move-result"
					? [entry.details as MoveResultDetails]
					: [],
			);
	}

	it("session move: batch stop lets the sibling finish in the old cwd and relocates after both results persist", async () => {
		const release = Promise.withResolvers<void>();
		let slowReadAborted: boolean | undefined;
		const persistedAtRelocation: string[] = [];
		const fx = setup({
			name: "batch",
			responses: [
				{ content: [call("m1", "session_move"), call("r1", "slow_read", { path: "a.txt" })] },
				{ content: ["done"] },
			],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "slow_read",
					label: "slow_read",
					description: "read",
					parameters: Type.Object({ path: Type.String() }),
					async execute(_id, params, signal) {
						const cwd = getSession().sessionManager.getCwd();
						await release.promise;
						slowReadAborted = signal?.aborted;
						return {
							content: [
								{
									type: "text",
									text: fs.readFileSync(path.join(cwd, (params as { path: string }).path), "utf8"),
								},
							],
						};
					},
				},
			],
			relocate: async target => {
				for (const entry of session?.sessionManager.getEntries() ?? []) {
					if (entry.type === "message" && entry.message.role === "toolResult") {
						persistedAtRelocation.push(`${entry.message.toolName}:${textOf(entry.message)}`);
					}
				}
				await session?.moveSession(target, path.join(path.dirname(target), "sessions-dst"));
				return { ok: true };
			},
		});
		const unsubscribe = fx.session.subscribe(event => {
			if (event.type === "tool_execution_end" && event.toolName === "session_move") release.resolve();
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();
		unsubscribe();

		expect(slowReadAborted).toBe(false);
		expect(persistedAtRelocation.sort()).toEqual(["session_move:scheduled", "slow_read:old cwd content"]);
		// One provider request for the batch, then the relocator, then the continuation request.
		expect(fx.events.filter(e => e === "provider-request" || e === "relocator")).toEqual([
			"provider-request",
			"relocator",
			"provider-request",
		]);
		expect(fx.relocatorCalls).toEqual([fx.dstDir]);
	});

	it("session move: relocation runs one continuation turn in the new cwd", async () => {
		const fx = setup({
			name: "success",
			responses: [{ content: [call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
			],
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.mock.calls).toHaveLength(2);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.dstDir);
		expect(fx.session.isSessionTransitioning).toBe(false);
		expect(moveResults(fx.session)).toEqual([{ outcome: "moved", cwd: fx.dstDir, target: fx.dstDir }]);
		// Relocated session accepts a later request with no pending move left behind.
		expect(fx.relocatorCalls).toHaveLength(1);
	});

	it("session move: relocation failure keeps cwd and session file and tells the model why", async () => {
		const fx = setup({
			name: "failure",
			responses: [{ content: [call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
			],
			relocate: async () => ({ ok: false, reason: "host refused: settings flush failed" }),
		});
		const fileBefore = fx.session.sessionManager.getSessionFile();
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(fx.session.sessionManager.getSessionFile()).toBe(fileBefore);
		expect(fx.session.isSessionTransitioning).toBe(false);
		expect(fx.mock.calls).toHaveLength(2);
		expect(moveResults(fx.session)).toEqual([
			{ outcome: "failed", cwd: fx.srcDir, target: fx.dstDir, reason: "host refused: settings flush failed" },
		]);
	});

	it("session move: relocation is refused while a sibling async job is running and names the job", async () => {
		let jobId = "";
		const releaseJob = Promise.withResolvers<void>();
		const fx = setup({
			name: "sibling-job",
			withJobManager: true,
			responses: [{ content: [call("j1", "spawn_job"), call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "spawn_job",
					label: "spawn_job",
					description: "spawn",
					parameters: Type.Object({}),
					async execute() {
						jobId = jobManager?.register("bash", "sleeper", () => releaseJob.promise.then(() => "ok"), {
							ownerId: AGENT_ID,
						}) as string;
						return { content: [{ type: "text", text: "started" }] };
					},
				},
			],
		});
		const fileBefore = fx.session.sessionManager.getSessionFile();
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(fx.session.sessionManager.getSessionFile()).toBe(fileBefore);
		expect(jobId).not.toBe("");
		expect(fx.mock.calls).toHaveLength(2);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir, target: fx.dstDir });
		expect(results[0]?.reason).toContain(jobId);
		releaseJob.resolve();
	});

	it("session move: relocation is refused while a registry subagent of this session runs and names the agent", async () => {
		const fx = setup({
			name: "sibling-agent",
			responses: [{ content: [call("a1", "spawn_agent"), call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "spawn_agent",
					label: "spawn_agent",
					description: "spawn",
					parameters: Type.Object({}),
					async execute() {
						const sessionFile = getSession().sessionManager.getSessionFile() as string;
						const artifacts = sessionFile.slice(0, -".jsonl".length);
						AgentRegistry.global().register({
							id: "MoveSub",
							displayName: "MoveSub",
							kind: "sub",
							session: null,
							sessionFile: path.join(artifacts, "MoveSub.jsonl"),
							status: "running",
						});
						registered.push("MoveSub");
						return { content: [{ type: "text", text: "started" }] };
					},
				},
			],
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(fx.mock.calls).toHaveLength(2);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir, target: fx.dstDir });
		expect(results[0]?.reason).toContain("MoveSub");
	});

	it("session move: the post-batch re-check sees subagents of a custom registry", async () => {
		const customRegistry = new AgentRegistry();
		const fx = setup({
			name: "custom-registry",
			agentRegistry: customRegistry,
			responses: [{ content: [call("a1", "spawn_agent"), call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "spawn_agent",
					label: "spawn_agent",
					description: "spawn",
					parameters: Type.Object({}),
					async execute() {
						const sessionFile = getSession().sessionManager.getSessionFile() as string;
						const artifacts = sessionFile.slice(0, -".jsonl".length);
						customRegistry.register({
							id: "CustomSub",
							displayName: "CustomSub",
							kind: "sub",
							session: null,
							sessionFile: path.join(artifacts, "CustomSub.jsonl"),
							status: "running",
						});
						return { content: [{ type: "text", text: "started" }] };
					},
				},
			],
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(fx.mock.calls).toHaveLength(2);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir, target: fx.dstDir });
		expect(results[0]?.reason).toContain("CustomSub");
	});

	it("session move: running work helper counts only own jobs and subagents inside the artifacts directory", async () => {
		const manager = new AsyncJobManager({ retentionMs: 1000 });
		jobManager = manager;
		const hold = Promise.withResolvers<string>();
		const own = manager.register("bash", "own", () => hold.promise, { ownerId: "Owner" });
		manager.register("bash", "other", () => hold.promise, { ownerId: "Someone" });
		const registry = AgentRegistry.global();
		const artifacts = path.join(tempDir.path(), "helper", "s1");
		const mk = (id: string, sessionFile: string | null, status: "running" | "idle" = "running") => {
			registry.register({ id, displayName: id, kind: "sub", session: null, sessionFile, status });
			registered.push(id);
		};
		mk("HelperInside", path.join(artifacts, "HelperInside.jsonl"));
		mk("HelperNested", path.join(artifacts, "HelperInside", "HelperNested.jsonl"));
		mk("HelperSibling", path.join(`${artifacts}-other`, "x.jsonl"));
		mk("HelperNoFile", null);
		mk("HelperIdle", path.join(artifacts, "HelperIdle.jsonl"), "idle");

		const work = findRunningSessionWork({
			asyncJobManager: manager,
			agentId: "Owner",
			sessionFile: `${artifacts}.jsonl`,
		});
		expect(work.jobIds).toEqual([own]);
		expect(work.agentIds.sort()).toEqual(["HelperInside", "HelperNested"]);
		expect(describeRunningSessionWork(work)).toContain(own);
		expect(describeRunningSessionWork(work)).toContain("HelperNested");
		hold.resolve("done");
	});

	it("session move: a descendant registered before the move is still owned work for the next move", async () => {
		const customRegistry = new AgentRegistry();
		const fx = setup({
			name: "rebase-descendant",
			responses: [{ content: [call("s1", "spawn_agent"), call("m1", "session_move")] }, { content: ["continued"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "spawn_agent",
					label: "spawn_agent",
					description: "spawn",
					parameters: Type.Object({}),
					async execute() {
						const sessionFile = getSession().sessionManager.getSessionFile() as string;
						const artifacts = sessionFile.slice(0, -".jsonl".length);
						// Idle, so it does not block this move; a peer wake can make it run again later.
						customRegistry.register({
							id: "RebaseSub",
							displayName: "RebaseSub",
							kind: "sub",
							session: null,
							sessionFile: path.join(artifacts, "RebaseSub.jsonl"),
							status: "idle",
						});
						return { content: [{ type: "text", text: "started" }] };
					},
				},
			],
			agentRegistry: customRegistry,
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();
		expect(fx.relocatorCalls).toEqual([fx.dstDir]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.dstDir);

		// The move renamed the artifacts directory; a peer wakes the descendant afterwards.
		expect(customRegistry.setStatus("RebaseSub", "running")).toBe(true);
		const movedFile = fx.session.sessionManager.getSessionFile() as string;
		expect(customRegistry.get("RebaseSub")?.sessionFile).toBe(
			path.join(movedFile.slice(0, -".jsonl".length), "RebaseSub.jsonl"),
		);
		const work = findRunningSessionWork({
			asyncJobManager: undefined,
			agentId: AGENT_ID,
			sessionFile: movedFile,
			registry: customRegistry,
		});
		expect(work.agentIds).toEqual(["RebaseSub"]);
	});

	it("session move: a descendant file left at the source by a merged artifacts directory keeps its path", async () => {
		const customRegistry = new AgentRegistry();
		const fx = setup({
			name: "rebase-collision",
			responses: [{ content: ["ok"] }],
			tools: () => [],
			agentRegistry: customRegistry,
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();
		const srcSessions = path.join(path.dirname(fx.srcDir), "sessions-src");
		const fileInSrc = fx.session.sessionManager.getSessionFile() as string;
		const artifactsInSrc = fileInSrc.slice(0, -".jsonl".length);
		const childInSrc = path.join(artifactsInSrc, "RebaseSub.jsonl");
		fs.mkdirSync(artifactsInSrc, { recursive: true });
		fs.writeFileSync(childInSrc, "first\n");
		customRegistry.register({
			id: "RebaseSub",
			displayName: "RebaseSub",
			kind: "sub",
			session: null,
			sessionFile: childInSrc,
			status: "idle",
		});

		await fx.session.moveSession(fx.dstDir, fx.dstSessions);
		const fileInDst = fx.session.sessionManager.getSessionFile() as string;
		const childInDst = path.join(fileInDst.slice(0, -".jsonl".length), "RebaseSub.jsonl");
		expect(customRegistry.get("RebaseSub")?.sessionFile).toBe(childInDst);

		// A writer that captured the old path recreates the child while the session is away, so
		// moving back merges the directories and leaves the colliding child at the source.
		fs.mkdirSync(artifactsInSrc, { recursive: true });
		fs.writeFileSync(childInSrc, "stale writer\n");
		await fx.session.moveSession(fx.srcDir, srcSessions);

		expect(fs.existsSync(childInDst)).toBe(true);
		expect(customRegistry.get("RebaseSub")?.sessionFile).toBe(childInDst);
		expect(fs.readFileSync(childInSrc, "utf8")).toBe("stale writer\n");
	});

	it("session move: a host rollback after the move restores descendant ownership at the source", async () => {
		const customRegistry = new AgentRegistry();
		const fx = setup({
			name: "rebase-rollback",
			responses: [{ content: ["ok"] }],
			tools: () => [],
			agentRegistry: customRegistry,
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();
		const fileInSrc = fx.session.sessionManager.getSessionFile() as string;
		const childInSrc = path.join(fileInSrc.slice(0, -".jsonl".length), "RebaseSub.jsonl");
		fs.mkdirSync(path.dirname(childInSrc), { recursive: true });
		fs.writeFileSync(childInSrc, "child\n");
		customRegistry.register({
			id: "RebaseSub",
			displayName: "RebaseSub",
			kind: "sub",
			session: null,
			sessionFile: childInSrc,
			status: "idle",
		});

		// The host step after `moveSession` fails, so the host rolls the move back the way
		// the TUI and headless relocators do: `rollbackMove` with the pre-move snapshot.
		const previousState = fx.session.sessionManager.captureState();
		await fx.session.moveSession(fx.dstDir, fx.dstSessions);
		await fx.session.sessionManager.rollbackMove(previousState);

		expect(fx.session.sessionManager.getSessionFile()).toBe(fileInSrc);
		expect(fs.readFileSync(childInSrc, "utf8")).toBe("child\n");
		expect(customRegistry.get("RebaseSub")?.sessionFile).toBe(childInSrc);
		expect(customRegistry.setStatus("RebaseSub", "running")).toBe(true);
		const work = findRunningSessionWork({
			asyncJobManager: undefined,
			agentId: AGENT_ID,
			sessionFile: fileInSrc,
			registry: customRegistry,
		});
		expect(work.agentIds).toEqual(["RebaseSub"]);
	});

	it("session move: relocation is skipped and cleared when the run is aborted before agent_end", async () => {
		const gate = Promise.withResolvers<void>();
		const started = Promise.withResolvers<void>();
		const fx = setup({
			name: "abort",
			responses: [{ content: [call("m1", "session_move"), call("b1", "blocker")] }, { content: ["after"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
				{
					name: "blocker",
					label: "blocker",
					description: "block",
					parameters: Type.Object({}),
					async execute() {
						started.resolve();
						await gate.promise;
						return { content: [{ type: "text", text: "late" }] };
					},
				},
			],
		});
		const run = fx.session.prompt("go");
		await started.promise;
		const aborting = fx.session.abort();
		gate.resolve();
		await run.catch(() => {});
		await aborting;
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(fx.session.isSessionTransitioning).toBe(false);
	});

	it("session move: goal continuation starts one move turn, then decides again at that turn's end", async () => {
		const fx = setup({
			name: "goal",
			settings: { "goal.continuationModes": ["rpc"] },
			responses: [
				{ content: [call("m1", "session_move")] },
				{ content: ["continued"] },
				{ content: ["goal turn"] },
				{ content: ["unexpected extra turn"] },
			],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
			],
		});
		fx.session.setGoalModeState({
			enabled: true,
			mode: "active",
			goal: {
				id: "g1",
				objective: "finish",
				status: "active",
				tokensUsed: 0,
				timeUsedSeconds: 0,
				createdAt: 0,
				updatedAt: 0,
			},
		});
		let goalTurns = 0;
		const controller = new GoalHostController(fx.session, {
			continuationMode: "rpc",
			// One goal turn after the move; the decision at its agent_end stops.
			canAutoContinue: () => goalTurns < 1,
		});
		const turnStarts: string[] = [];
		fx.session.subscribe(event => {
			controller.observe(event);
			if (
				event.type === "message_start" &&
				event.message.role === "custom" &&
				(event.message.customType === "session-move-result" || event.message.customType === "goal-continuation")
			) {
				turnStarts.push(
					`${event.message.customType}@${fx.session.sessionManager.getCwd() === fx.dstDir ? "dst" : "src"}`,
				);
				if (event.message.customType === "goal-continuation") goalTurns++;
			}
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();
		await Bun.sleep(20);
		await fx.session.waitForIdle();

		expect(turnStarts).toEqual(["session-move-result@dst", "goal-continuation@dst"]);
		expect(fx.mock.calls).toHaveLength(3);
		expect(fx.relocatorCalls).toEqual([fx.dstDir]);
	});

	// ── Relocation admission (relocation-admission-lease, tasks 4.1/4.2) ──

	const lifecycles: AgentLifecycleManager[] = [];
	afterEach(async () => {
		for (const lifecycle of lifecycles.splice(0)) await lifecycle.dispose();
	});

	interface AdmissionFixture extends Fixture {
		registry: AgentRegistry;
		bus: IrcBus;
		/** Bodies each stub descendant received, in delivery order. */
		delivered: Map<string, string[]>;
		/** The session file each revived descendant was rebuilt from. */
		revivedFrom: Map<string, string | null>;
		/** Resolves once the relocator runs, that is, while the relocation holds the barrier. */
		relocating: Promise<void>;
		/** Lets the paused relocator go on. */
		releaseRelocator(): void;
		/** The artifacts directory of the session file at setup. */
		artifactsDir: string;
	}

	function stubDescendant(id: string, fx: { delivered: Map<string, string[]>; events: string[] }): AgentSession {
		return {
			deliverIrcMessage: async (message: { body: string }) => {
				fx.events.push(`${id}-delivered`);
				fx.delivered.set(id, [...(fx.delivered.get(id) ?? []), message.body]);
				return "woken" as const;
			},
			subscribe: () => () => {},
			dispose: async () => {},
		} as unknown as AgentSession;
	}

	/**
	 * A session on its own registry, IRC bus and lifecycle whose `session_move` relocator pauses
	 * until {@link AdmissionFixture.releaseRelocator}, then moves for real (or fails).
	 */
	function admissionSetup(options: {
		name: string;
		relocation: "move" | "fail" | "unpaused";
		registerRoot?: boolean;
	}): AdmissionFixture {
		const registry = new AgentRegistry();
		const relocating = Promise.withResolvers<void>();
		const gate = Promise.withResolvers<void>();
		const delivered = new Map<string, string[]>();
		const revivedFrom = new Map<string, string | null>();
		const base = setup({
			name: options.name,
			responses: [
				{ content: [call("m1", "session_move")] },
				{ content: ["first"] },
				{ content: ["second"] },
				{ content: ["third"] },
			],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
			],
			agentRegistry: registry,
			relocate: async (target, fx) => {
				relocating.resolve();
				if (options.relocation !== "unpaused") await gate.promise;
				if (options.relocation === "fail") return { ok: false, reason: "host refused" };
				await session?.moveSession(target, fx().dstSessions);
				fx().events.push("relocator-returned");
				return { ok: true };
			},
		});
		const lifecycle = new AgentLifecycleManager(registry);
		lifecycles.push(lifecycle);
		const fx: AdmissionFixture = {
			...base,
			registry,
			bus: new IrcBus(registry, lifecycle),
			delivered,
			revivedFrom,
			relocating: relocating.promise,
			releaseRelocator: () => gate.resolve(),
			artifactsDir: (base.session.sessionManager.getSessionFile() as string).slice(0, -".jsonl".length),
		};
		lifecycle.setPersistedSubagentReviverFactory(
			async ref => async live => {
				revivedFrom.set(ref.id, live.sessionFile);
				return stubDescendant(ref.id, fx);
			},
			() => 0,
		);
		if (options.registerRoot) {
			registry.register({
				id: AGENT_ID,
				displayName: AGENT_ID,
				kind: "main",
				session: base.session,
				sessionFile: base.session.sessionManager.getSessionFile() ?? null,
				status: "idle",
			});
		}
		return fx;
	}

	/** Register a descendant whose transcript lies in the session's artifacts directory. */
	function addDescendant(fx: AdmissionFixture, id: string, status: "idle" | "parked"): string {
		const file = path.join(fx.artifactsDir, `${id}.jsonl`);
		fs.mkdirSync(fx.artifactsDir, { recursive: true });
		fs.writeFileSync(file, `${id}\n`);
		fx.registry.register({
			id,
			displayName: id,
			kind: "sub",
			parentId: AGENT_ID,
			session: status === "idle" ? stubDescendant(id, fx) : null,
			sessionFile: file,
			status,
		});
		return file;
	}

	/** Drain pending promise continuations; the paths under test settle through microtasks only. */
	async function flushMicrotasks(): Promise<void> {
		for (let i = 0; i < 50; i++) await Promise.resolve();
	}

	/** Provider calls whose context carries `text`. */
	function callsMentioning(mock: MockModel, text: string): number {
		return mock.calls.filter(entry => JSON.stringify(entry.context).includes(text)).length;
	}

	/** Whether `promise` has settled, read synchronously. */
	function track(promise: Promise<unknown>): { readonly settled: boolean } {
		const state = { settled: false };
		void promise.finally(() => {
			state.settled = true;
		});
		return state;
	}

	it("session move: a peer message to the session during a paused relocation starts its turn after the move in the new cwd", async () => {
		const fx = admissionSetup({ name: "admit-root", relocation: "move", registerRoot: true });
		const run = fx.session.prompt("go");
		await fx.relocating;
		const send = fx.bus.send({ from: "Peer", to: AGENT_ID, body: "peer-ping" });
		const sent = track(send);
		await flushMicrotasks();
		// Held at the barrier: not delivered into the session that is still in the old checkout.
		expect(sent.settled).toBe(false);
		expect(fx.events.filter(event => event === "provider-request")).toHaveLength(1);

		fx.releaseRelocator();
		expect((await send).outcome).not.toBe("failed");
		await run;
		await fx.session.waitForIdle();

		expect(fx.session.sessionManager.getCwd()).toBe(fx.dstDir);
		expect(callsMentioning(fx.mock, "peer-ping")).toBeGreaterThan(0);
		expect(fx.requestCwds.slice(1).length).toBeGreaterThan(0);
		expect(fx.requestCwds.slice(1).every(cwd => cwd === fx.dstDir)).toBe(true);
	});

	it("session move: an idle descendant messaged during a paused relocation starts no turn before the relocator returns", async () => {
		const fx = admissionSetup({ name: "admit-idle-child", relocation: "move" });
		addDescendant(fx, "IdleChild", "idle");
		const run = fx.session.prompt("go");
		await fx.relocating;
		const send = fx.bus.send({ from: "Peer", to: "IdleChild", body: "child-ping" });
		await flushMicrotasks();
		expect(fx.delivered.get("IdleChild")).toBeUndefined();

		fx.releaseRelocator();
		expect((await send).outcome).toBe("woken");
		await run;
		await fx.session.waitForIdle();
		expect(fx.delivered.get("IdleChild")).toEqual(["child-ping"]);
		expect(fx.events.indexOf("relocator-returned")).toBeLessThan(fx.events.indexOf("IdleChild-delivered"));
	});

	it("session move: a parked descendant messaged during a paused relocation revives after the move from its rebased transcript", async () => {
		const fx = admissionSetup({ name: "admit-parked-child", relocation: "move" });
		const sourceFile = addDescendant(fx, "ParkedChild", "parked");
		const run = fx.session.prompt("go");
		await fx.relocating;
		const send = fx.bus.send({ from: "Peer", to: "ParkedChild", body: "revive-ping" });
		await flushMicrotasks();
		expect(fx.revivedFrom.has("ParkedChild")).toBe(false);

		fx.releaseRelocator();
		expect((await send).outcome).toBe("revived");
		await run;
		await fx.session.waitForIdle();
		const movedArtifacts = (fx.session.sessionManager.getSessionFile() as string).slice(0, -".jsonl".length);
		const revivedFile = fx.revivedFrom.get("ParkedChild");
		expect(revivedFile).toBe(path.join(movedArtifacts, "ParkedChild.jsonl"));
		expect(fs.readFileSync(revivedFile as string, "utf8")).toBe("ParkedChild\n");
		expect(fs.existsSync(sourceFile)).toBe(false);
		expect(fx.delivered.get("ParkedChild")).toEqual(["revive-ping"]);
	});

	it("session move: a failed relocation releases a held message, which is delivered in the unchanged cwd", async () => {
		const fx = admissionSetup({ name: "admit-failed", relocation: "fail", registerRoot: true });
		const run = fx.session.prompt("go");
		await fx.relocating;
		const send = fx.bus.send({ from: "Peer", to: AGENT_ID, body: "after-failure" });
		const sent = track(send);
		await flushMicrotasks();
		expect(sent.settled).toBe(false);
		expect(fx.events.filter(event => event === "provider-request")).toHaveLength(1);

		fx.releaseRelocator();
		expect((await send).outcome).not.toBe("failed");
		await run;
		await fx.session.waitForIdle();
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		expect(callsMentioning(fx.mock, "after-failure")).toBeGreaterThan(0);
		expect(fx.requestCwds.slice(1).every(cwd => cwd === fx.srcDir)).toBe(true);
	});

	it("session move: a descendant rebased before the manager publishes its new session file stays held", async () => {
		const fx = admissionSetup({ name: "admit-rebase-window", relocation: "unpaused" });
		addDescendant(fx, "FirstChild", "idle");
		const secondFile = addDescendant(fx, "SecondChild", "idle");
		const lstatPaused = Promise.withResolvers<void>();
		const lstatGate = Promise.withResolvers<void>();
		const originalLstat = fsPromises.lstat;
		const spy = vi.spyOn(fsPromises, "lstat").mockImplementation((async (file: fs.PathLike) => {
			if (String(file) === secondFile) {
				lstatPaused.resolve();
				await lstatGate.promise;
			}
			return originalLstat(file);
		}) as typeof fsPromises.lstat);
		try {
			const run = fx.session.prompt("go");
			await lstatPaused.promise;
			// FirstChild's ref already points into the destination; the manager has not published it yet.
			expect(fx.registry.get("FirstChild")?.sessionFile?.startsWith(fx.artifactsDir + path.sep)).toBe(false);
			const send = fx.bus.send({ from: "Peer", to: "FirstChild", body: "window-ping" });
			await flushMicrotasks();
			expect(fx.delivered.get("FirstChild")).toBeUndefined();

			lstatGate.resolve();
			expect((await send).outcome).toBe("woken");
			await run;
			await fx.session.waitForIdle();
			expect(fx.delivered.get("FirstChild")).toEqual(["window-ping"]);
			expect(fx.events.indexOf("relocator-returned")).toBeLessThan(fx.events.indexOf("FirstChild-delivered"));
		} finally {
			spy.mockRestore();
		}
	});

	// ── Work admitted just before the barrier (relocation-admission-lease, task 4.2) ──

	const subSessions: AgentSession[] = [];
	afterEach(async () => {
		vi.restoreAllMocks();
		for (const sub of subSessions.splice(0)) await sub.dispose();
		AgentLifecycleManager.resetGlobalForTests();
		AgentRegistry.resetGlobalForTests();
	});

	const followUpAgent = { name: "task", description: "test", systemPrompt: "charter", source: "bundled" } as const;

	/** A real subagent session answering from `handlers`, disposed after the test. */
	function subSession(options: {
		name: string;
		id: string;
		handlers: MockHandler[];
		registry?: AgentRegistry;
		sessionManager?: SessionManager;
	}): { session: AgentSession; mock: MockModel } {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled test model to exist");
		const dir = path.join(tempDir.path(), options.name, `sub-${options.id}`);
		fs.mkdirSync(dir, { recursive: true });
		const mock = createMockModel({ responses: options.handlers });
		const settings = Settings.isolated({
			"compaction.enabled": false,
			"retry.enabled": false,
			"todo.reminders": false,
			"tools.xdev": false,
		});
		settings.setModelRole("default", `${model.provider}/${model.id}`);
		const sessionManager = options.sessionManager ?? SessionManager.create(dir, path.join(dir, "sessions"));
		const agent = new Agent({
			getApiKey: agentModel => `${agentModel.provider}-test-key`,
			initialState: {
				model,
				systemPrompt: ["Sub"],
				tools: [],
				messages: sessionManager.buildSessionContext().messages,
			},
			streamFn: (streamModel, context, streamOptions) => mock.stream(streamModel, context, streamOptions),
			convertToLlm,
		});
		const sub = new AgentSession({
			agent,
			sessionManager,
			settings,
			modelRegistry,
			agentId: options.id,
			agentRegistry: options.registry,
		});
		subSessions.push(sub);
		return { session: sub, mock };
	}

	/** A session whose model requests one `session_move`; the default relocator records each call and moves. */
	function barrierSetup(options: { name: string; registry?: AgentRegistry }) {
		const fx = setup({
			name: options.name,
			responses: [{ content: [call("m1", "session_move")] }, { content: ["first"] }, { content: ["second"] }],
			tools: ({ getSession, srcDir, events }) => [
				sessionMoveTool(getSession, () => path.join(path.dirname(srcDir), "dst"), events),
			],
			agentRegistry: options.registry,
		});
		const artifactsDir = (fx.session.sessionManager.getSessionFile() as string).slice(0, -".jsonl".length);
		fs.mkdirSync(artifactsDir, { recursive: true });
		return { ...fx, artifactsDir };
	}

	/** Runs `before` synchronously at the relocation's hold, after its idle wait; resolves once the hold is taken. */
	function atHold(target: AgentSession, before: () => void): Promise<void> {
		const held = Promise.withResolvers<void>();
		const real = target.holdRelocationAdmission.bind(target);
		vi.spyOn(target, "holdRelocationAdmission").mockImplementationOnce(() => {
			before();
			const lease = real();
			held.resolve();
			return lease;
		});
		return held.promise;
	}

	function ircMessage(to: string, body: string): IrcMessage {
		return { id: `msg-${to}`, from: "Peer", to, body, ts: Date.now() };
	}

	it("session move: a wake admitted just before the barrier refuses the move and names the agent", async () => {
		const registry = new AgentRegistry();
		const fx = barrierSetup({ name: "barrier-wake", registry });
		const childGate = Promise.withResolvers<void>();
		const child = subSession({
			name: "barrier-wake",
			id: "WakeChild",
			registry,
			handlers: [
				async () => {
					await childGate.promise;
					return { content: ["woke"] };
				},
			],
		});
		const childFile = path.join(fx.artifactsDir, "WakeChild.jsonl");
		registry.register({
			id: "WakeChild",
			displayName: "WakeChild",
			kind: "sub",
			parentId: AGENT_ID,
			session: child.session,
			sessionFile: childFile,
			status: "idle",
		});
		// The delivery was admitted and handed off before the barrier: the wake is claimed, its status still idle.
		void atHold(fx.session, () => {
			void child.session.deliverIrcMessage(ircMessage("WakeChild", "wake-ping"));
		});

		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir });
		expect(results[0]?.reason).toContain("WakeChild");
		expect(registry.get("WakeChild")?.sessionFile).toBe(childFile);

		childGate.resolve();
		await child.session.waitForIdle();
	});

	/** A parked descendant of `artifactsDir` in the global registry, revived into `build()` on demand. */
	function parkedDescendant(artifactsDir: string, id: string, build: () => AgentSession): string {
		const file = path.join(artifactsDir, `${id}.jsonl`);
		fs.writeFileSync(file, `${id}\n`);
		AgentRegistry.global().register({
			id,
			displayName: id,
			kind: "sub",
			parentId: AGENT_ID,
			session: null,
			sessionFile: file,
			status: "parked",
		});
		AgentLifecycleManager.global().setPersistedSubagentReviverFactory(
			async () => async () => build(),
			() => 0,
		);
		return file;
	}

	it("session move: a task resume admitted just before the barrier refuses the move and names the subagent", async () => {
		const fx = barrierSetup({ name: "barrier-resume" });
		// The revived session still loads its deferred extensions, so the follow-up's submission is
		// admitted (`hasAdmittedSubmission`) but has not started a turn when the relocation checks.
		const extensionsLoaded = Promise.withResolvers<void>();
		const childFile = parkedDescendant(fx.artifactsDir, "ResumeChild", () => {
			const child = subSession({
				name: "barrier-resume",
				id: "ResumeChild",
				handlers: [{ content: ["follow-up"] }],
			});
			child.session.setDeferredExtensionLoader(() => extensionsLoaded.promise);
			return child.session;
		});
		// Pause the resume between its revival and its submission.
		const lifecycle = AgentLifecycleManager.global();
		const realEnsureLive = lifecycle.ensureLive.bind(lifecycle);
		const revived = Promise.withResolvers<void>();
		const resume = Promise.withResolvers<void>();
		vi.spyOn(lifecycle, "ensureLive").mockImplementationOnce(async (id, options) => {
			const live = await realEnsureLive(id, options);
			revived.resolve();
			await resume.promise;
			return live;
		});
		const turn = runSubagentFollowUpTurn({
			id: "ResumeChild",
			agent: followUpAgent,
			message: "continue",
			structured: false,
		});
		await revived.promise;
		const held = atHold(fx.session, () => {});

		const run = fx.session.prompt("go");
		await held;
		resume.resolve();
		await run;
		await fx.session.waitForIdle();

		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir });
		expect(results[0]?.reason).toContain("ResumeChild");
		expect(AgentRegistry.global().get("ResumeChild")?.sessionFile).toBe(childFile);

		extensionsLoaded.resolve();
		expect((await turn).exitCode).toBe(0);
	});

	it("session move: a task restore admitted just before the barrier refuses the move and names the subagent", async () => {
		const fx = barrierSetup({ name: "barrier-restore" });
		// A turn a crash cut off inside a tool call: no tool result, no exit record.
		const interrupted = SessionManager.inMemory();
		interrupted.appendMessage({ role: "user", content: "read it", timestamp: Date.now() });
		interrupted.appendMessage({
			role: "assistant",
			content: [{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.ts" } }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "mock",
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
		let child: { session: AgentSession; mock: MockModel } | undefined;
		const childFile = parkedDescendant(fx.artifactsDir, "RestoreChild", () => {
			child = subSession({
				name: "barrier-restore",
				id: "RestoreChild",
				sessionManager: interrupted,
				handlers: [{ content: ["done after restore"] }],
			});
			const realRestore = child.session.restoreInterruptedTurn.bind(child.session);
			vi.spyOn(child.session, "restoreInterruptedTurn").mockImplementation(async () => {
				const scheduled = await realRestore();
				restored.resolve();
				return scheduled;
			});
			return child.session;
		});
		// Hold the restored turn's scheduled continuation (`retry()` waits 1 ms) before its turn starts.
		const continuation = Promise.withResolvers<void>();
		const realWait = scheduler.wait.bind(scheduler);
		vi.spyOn(scheduler, "wait").mockImplementation(((delay: number, options?: Parameters<typeof realWait>[1]) =>
			delay === 1 ? continuation.promise : realWait(delay, options)) as typeof scheduler.wait);
		const restored = Promise.withResolvers<void>();
		const turn = runSubagentFollowUpTurn({
			id: "RestoreChild",
			agent: followUpAgent,
			message: "restore",
			restore: true,
			structured: false,
		});
		await restored.promise;
		await flushMicrotasks();

		// Refused, not stalled: the move settles while the continuation is still held.
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		expect(child?.mock.calls).toHaveLength(0);
		expect(fx.relocatorCalls).toEqual([]);
		expect(fx.session.sessionManager.getCwd()).toBe(fx.srcDir);
		const results = moveResults(fx.session);
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ outcome: "failed", cwd: fx.srcDir });
		expect(results[0]?.reason).toContain("RestoreChild");
		expect(AgentRegistry.global().get("RestoreChild")?.sessionFile).toBe(childFile);

		continuation.resolve();
		expect((await turn).exitCode).toBe(0);
	});

	it("session move: a peer message to the session admitted just before the barrier starts its turn only after the move", async () => {
		// The `session_move` path delivers into a session that is still inside its move fence, so a
		// claimed wake of the relocating root arises on host relocations (`/move`, ACP), which take
		// the barrier from an idle session (design D2/D3): drive that hold directly.
		const registry = new AgentRegistry();
		const fx = setup({
			name: "barrier-root",
			responses: [{ content: ["ready"] }, { content: ["woken"] }],
			tools: () => [],
			agentRegistry: registry,
		});
		registry.register({
			id: AGENT_ID,
			displayName: AGENT_ID,
			kind: "main",
			session: fx.session,
			sessionFile: null,
			status: "idle",
		});
		await fx.session.prompt("go");
		await fx.session.waitForIdle();

		// Admitted and handed off before the barrier: the wake is claimed, its turn not dispatched yet.
		const delivered = fx.session.deliverIrcMessage(ircMessage(AGENT_ID, "root-ping"));
		const lease = fx.session.holdRelocationAdmission();
		expect(await delivered).toBe("woken");
		await lease.ready;
		await flushMicrotasks();
		expect(fx.events.filter(event => event === "provider-request")).toHaveLength(1);

		await fx.session.moveSession(fx.dstDir, fx.dstSessions);
		await flushMicrotasks();
		expect(fx.events.filter(event => event === "provider-request")).toHaveLength(1);
		lease[Symbol.dispose]();
		await flushMicrotasks();
		await fx.session.waitForIdle();

		expect(fx.session.sessionManager.getCwd()).toBe(fx.dstDir);
		expect(callsMentioning(fx.mock, "root-ping")).toBe(1);
		expect(fx.requestCwds).toEqual([fx.srcDir, fx.dstDir]);
	});
});

describe.skipIf(process.platform === "win32")("session move through xd", () => {
	let root: string;
	let authStorage: AuthStorage;
	let created: AgentSession | undefined;

	beforeEach(async () => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omp-session-move-xd-")));
		authStorage = await AuthStorage.create(path.join(root, "testauth.db"));
		authStorage.keys.setRuntime("anthropic", "anthropic-test-key");
	});

	afterEach(async () => {
		await created?.dispose();
		created = undefined;
		authStorage.close();
		fs.rmSync(root, { recursive: true, force: true });
	});

	it("session move: batch stop through write xd://session_move", async () => {
		const repo = path.join(root, "repo");
		const worktree = path.join(root, "linked");
		const git = ["-c", "user.name=Probe", "-c", "user.email=probe@example.invalid", "-c", "commit.gpgsign=false"];
		await $`git init -q ${repo}`.quiet();
		fs.writeFileSync(path.join(repo, "a.txt"), "old cwd content");
		await $`git -C ${repo} ${git} add a.txt`.quiet();
		await $`git -C ${repo} ${git} commit -qm first`.quiet();
		await $`git -C ${repo} worktree add -q -b linked ${worktree}`.quiet();
		const release = Promise.withResolvers<void>();
		let slowReadCwd = "";

		const sessions = await createAgentSession({
			cwd: repo,
			authStorage,
			modelRegistry: new ModelRegistry(authStorage, path.join(root, "models.yml")),
			agentDir: root,
			sessionManager: SessionManager.create(repo, path.join(root, "sessions")),
			settings: Settings.isolated({
				"worktree.clone": false,
				"compaction.enabled": false,
				"retry.enabled": false,
				"todo.reminders": false,
				"tools.xdev": true,
				"tools.approvalMode": "yolo",
			}),
			model: getBundledModel("anthropic", "claude-sonnet-4-5"),
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			workspaceTree: { rootPath: repo, rendered: ".\n", truncated: false, totalLines: 1, agentsMdFiles: [] },
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			toolNames: ["write", "session_move"],
			customTools: [
				{
					name: "slow_read",
					label: "slow_read",
					description: "read",
					parameters: Type.Object({ path: Type.String() }),
					async execute() {
						await release.promise;
						slowReadCwd = created?.sessionManager.getCwd() ?? "";
						return {
							content: [
								{ type: "text" as const, text: fs.readFileSync(path.join(slowReadCwd, "a.txt"), "utf8") },
							],
						};
					},
				},
			],
			sessionRelocation: true,
		});
		created = sessions.session;
		const events: string[] = [];
		created.setSessionRelocator(async target => {
			events.push(`relocator:${target}`);
			return { ok: true };
		});
		const mock = createMockModel({
			responses: [
				{
					content: [
						call("w1", "write", { path: "xd://session_move", content: JSON.stringify({ path: worktree }) }),
						call("r1", "slow_read", { path: "a.txt" }),
					],
				},
				{ content: ["continued"] },
			],
		});
		created.agent.streamFn = (model, context, options) => {
			events.push("provider-request");
			return mock.stream(model, context, options);
		};
		const unsubscribe = created.subscribe(event => {
			if (event.type === "tool_execution_end" && event.toolName === "write") release.resolve();
		});
		await created.prompt("go");
		await created.waitForIdle();
		unsubscribe();

		// One request for the batch; the relocator runs before the continuation request, never a request in the old checkout.
		expect(events).toEqual(["provider-request", `relocator:${worktree}`, "provider-request"]);
		expect(slowReadCwd).toBe(repo);
		expect(mock.calls).toHaveLength(2);
	});
});
