/**
 * ACP reopen of a session whose directory differs from the client's `cwd`: a session moved into a worktree of
 * the client's repository opens there (load, resume, fork, already open), a session from a removed worktree moves
 * into the client's directory, and every other mismatch is refused naming the session's directory. Driven over the
 * raw NDJSON wire with a real `AgentSession` and the mock provider; "restart" reconnects a fresh ACP agent over
 * the same session storage.
 */
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { AsyncJobManager } from "@oh-my-pi/pi-coding-agent/async";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { AcpSessionFactory } from "@oh-my-pi/pi-coding-agent/modes/acp/acp-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { createSessionWorktree } from "@oh-my-pi/pi-coding-agent/session/session-worktree";
import { getProjectDir, isRecord, setProjectDir } from "@oh-my-pi/pi-utils";
import { $ } from "bun";
import {
	cleanupHarnessState,
	createV2WireHarness,
	type RawAcpClient,
	type RawAcpResponse,
	type V2WireHarness,
} from "./acp-test-harness";

setDefaultTimeout(30_000);

/** Host git config (signing, hooks) must not leak into the fixture repos; `/wt` worktrees stay under the temp root. */
const TEST_ENV_KEYS = [
	"GIT_CONFIG_GLOBAL",
	"GIT_CONFIG_NOSYSTEM",
	"GIT_AUTHOR_NAME",
	"GIT_AUTHOR_EMAIL",
	"GIT_COMMITTER_NAME",
	"GIT_COMMITTER_EMAIL",
	"OMP_WORKTREE_DIR",
] as const;
const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map(key => [key, process.env[key]]));
// `/move` `chdir`s the process and the project-dir cache into the target; restore both per test.
const originalProjectDir = getProjectDir();
const teardown: Array<() => Promise<void>> = [];

afterEach(async () => {
	setProjectDir(originalProjectDir);
	for (const step of teardown.splice(0)) await step();
	await cleanupHarnessState();
	AsyncJobManager.resetForTests();
	for (const key of TEST_ENV_KEYS) {
		if (originalEnv[key] === undefined) delete process.env[key];
		else process.env[key] = originalEnv[key];
	}
});

interface Rig {
	h: V2WireHarness;
	version: 1 | 2;
	root: string;
	repo: string;
	/** Linked worktree `.worktrees/a` of {@link repo}. */
	worktree: string;
	/** Every `cwd` the ACP session factory was called with, in order. */
	factoryCwds: string[];
	sessions: AgentSession[];
}

async function initRepo(dir: string): Promise<void> {
	fs.mkdirSync(dir, { recursive: true });
	await $`git init -q && git commit -q --allow-empty -m init`.cwd(dir).quiet();
}

async function initialize(client: RawAcpClient, version: 1 | 2): Promise<void> {
	resultOf(
		await client.request(
			"initialize",
			version === 2
				? { protocolVersion: 2, info: { name: "acp-resume-location", version: "0" }, capabilities: {} }
				: { protocolVersion: 1, clientCapabilities: {} },
		),
	);
}

async function startRig(version: 1 | 2): Promise<Rig> {
	const sessions: AgentSession[] = [];
	const storages: AuthStorage[] = [];
	const factoryCwds: string[] = [];
	let calls = 0;
	const factory: AcpSessionFactory = async cwd => {
		factoryCwds.push(cwd);
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");
		const mock = createMockModel({
			provider: model.provider,
			id: model.id,
			handler: async () => ({ content: [`reply ${calls++}`] }),
		});
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: ["Test"], tools: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		const authStorage = await AuthStorage.create(":memory:");
		storages.push(authStorage);
		authStorage.keys.setRuntime("anthropic", "test-key");
		const session = new AgentSession({
			agent,
			sessionManager: SessionManager.create(cwd),
			settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false }),
			modelRegistry: new ModelRegistry(authStorage),
			toolRegistry: new Map(),
		});
		sessions.push(session);
		return session;
	};
	const h = await createV2WireHarness({ factory, maxVersion: version, validate: version === 2 });
	teardown.push(async () => {
		await h.close();
		for (const session of sessions) await session.dispose();
		for (const storage of storages) storage.close();
	});
	const root = fs.realpathSync(h.root);
	Object.assign(process.env, {
		GIT_CONFIG_GLOBAL: "/dev/null",
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_AUTHOR_NAME: "Test",
		GIT_AUTHOR_EMAIL: "test@example.com",
		GIT_COMMITTER_NAME: "Test",
		GIT_COMMITTER_EMAIL: "test@example.com",
		OMP_WORKTREE_DIR: path.join(root, "wt-base"),
	});
	const repo = path.join(root, "repo");
	await initRepo(repo);
	const worktree = path.join(repo, ".worktrees", "a");
	await $`git worktree add -q -b a ${worktree}`.cwd(repo).quiet();
	await initialize(h.client, version);
	return { h, version, root, repo, worktree, factoryCwds, sessions };
}

function resultOf(response: RawAcpResponse): Record<string, unknown> {
	if (response.error) throw new Error(`unexpected error ${response.error.code}: ${response.error.message}`);
	if (!isRecord(response.result)) throw new Error("expected an object result");
	return response.result;
}

/** The refusal a client sees: the JSON-RPC error message plus its `data` details. */
function errorOf(response: RawAcpResponse): string {
	if (!response.error) throw new Error("expected an error response");
	return `${response.error.message}: ${JSON.stringify(response.error.data)}`;
}

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map(contentText).join("");
	if (isRecord(content) && typeof content.text === "string") return content.text;
	return "";
}

/** The newest `AgentSession` the factory built for `sessionId`. */
function live(rig: Rig, sessionId: string): AgentSession {
	const session = rig.sessions.findLast(candidate => candidate.sessionId === sessionId);
	if (!session) throw new Error(`no session ${sessionId}`);
	return session;
}

async function prompt(rig: Rig, sessionId: string, text: string): Promise<void> {
	resultOf(await rig.h.client.request("session/prompt", { sessionId, prompt: [{ type: "text", text }] }));
	if (rig.version === 2) {
		await rig.h.client.waitFor(c => c.states(sessionId).at(-1)?.state === "idle", `${sessionId} idle`);
	}
}

/** `session/new` in `cwd` plus one answered `hello` turn, so the session is persisted. */
async function openNew(rig: Rig, cwd: string): Promise<string> {
	fs.mkdirSync(cwd, { recursive: true });
	const sessionId = String(resultOf(await rig.h.client.request("session/new", { cwd, mcpServers: [] })).sessionId);
	await prompt(rig, sessionId, "hello");
	return sessionId;
}

/** `/move <target>` in the session, as a user does in the IDE. */
async function move(rig: Rig, sessionId: string, target: string): Promise<void> {
	await prompt(rig, sessionId, `/move ${target}`);
	expect(live(rig, sessionId).sessionManager.getCwd()).toBe(target);
}

/** A fresh ACP agent over the same session storage; the process starts in its original directory again. */
async function restart(rig: Rig): Promise<RawAcpClient> {
	const client = await rig.h.reconnect();
	setProjectDir(originalProjectDir);
	await initialize(client, rig.version);
	return client;
}

async function removeWorktree(rig: Rig, dir: string): Promise<void> {
	await $`git worktree remove --force ${dir} && git worktree prune`.cwd(rig.repo).quiet();
}

function userTexts(client: RawAcpClient, sessionId: string): string[] {
	return client
		.updates(sessionId)
		.filter(entry => ["user_message", "user_message_chunk"].includes(String(entry.update.sessionUpdate)))
		.map(entry => contentText(entry.update.content));
}

function transcriptUserTexts(session: AgentSession): string[] {
	return session.sessionManager
		.getEntries()
		.flatMap(entry =>
			entry.type === "message" && entry.message.role === "user" ? [contentText(entry.message.content)] : [],
		);
}

function sessionFileOf(rig: Rig, sessionId: string): string {
	const file = live(rig, sessionId).sessionManager.getSessionFile();
	if (!file) throw new Error(`session ${sessionId} has no file`);
	return file;
}

/** Writes `marker.txt` into the session's artifacts directory. */
function seedArtifact(rig: Rig, sessionId: string): string {
	const dir = live(rig, sessionId).sessionManager.getArtifactsDir();
	if (!dir) throw new Error(`session ${sessionId} has no artifacts directory`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "marker.txt"), `artifact of ${sessionId}`);
	return dir;
}

async function listedIds(client: RawAcpClient): Promise<string[]> {
	const sessions = resultOf(await client.request("session/list", {})).sessions;
	if (!Array.isArray(sessions)) throw new Error("expected a session list");
	return sessions.map(session => (isRecord(session) ? String(session.sessionId) : "")).sort();
}

/** A session moved by `/move` from the primary checkout into `.worktrees/a`, its file path after the move. */
async function sessionMovedIntoWorktree(rig: Rig): Promise<{ sessionId: string; file: string }> {
	const sessionId = await openNew(rig, rig.repo);
	await move(rig, sessionId, rig.worktree);
	return { sessionId, file: sessionFileOf(rig, sessionId) };
}

/** After a reopen in the moved-into worktree: same id, factory built for it, runs there, file stayed. */
function expectOpenedInWorktree(rig: Rig, sessionId: string, file: string): void {
	expect(rig.factoryCwds.at(-1)).toBe(rig.worktree);
	expect(live(rig, sessionId).sessionManager.getCwd()).toBe(rig.worktree);
	expect(sessionFileOf(rig, sessionId)).toBe(file);
	expect(path.dirname(file)).toBe(SessionManager.getDefaultSessionDir(rig.worktree));
}

describe("acp resume location", () => {
	it("acp resume location: v1 session/load after restart opens a worktree session in the worktree", async () => {
		const rig = await startRig(1);
		const { sessionId, file } = await sessionMovedIntoWorktree(rig);
		const client = await restart(rig);
		const built = rig.factoryCwds.length;

		resultOf(await client.request("session/load", { sessionId, cwd: rig.repo, mcpServers: [] }));

		// A fresh agent: the load built a new session instead of finding an open record.
		expect(rig.factoryCwds.length).toBe(built + 1);
		expect(userTexts(client, sessionId)).toContain("hello");
		expectOpenedInWorktree(rig, sessionId, file);
	});

	it("acp resume location: v1 session/resume after restart opens a worktree session in the worktree", async () => {
		const rig = await startRig(1);
		const { sessionId, file } = await sessionMovedIntoWorktree(rig);
		const client = await restart(rig);

		resultOf(await client.request("session/resume", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(userTexts(client, sessionId)).toEqual([]);
		expect(transcriptUserTexts(live(rig, sessionId))).toContain("hello");
		expectOpenedInWorktree(rig, sessionId, file);
	});

	it("acp resume location: v2 session/resume after restart opens a worktree session in the worktree", async () => {
		const rig = await startRig(2);
		const { sessionId, file } = await sessionMovedIntoWorktree(rig);

		const snapshotClient = await restart(rig);
		resultOf(await snapshotClient.request("session/resume", { sessionId, cwd: rig.repo }));
		expect(userTexts(snapshotClient, sessionId)).toEqual([]);
		expectOpenedInWorktree(rig, sessionId, file);

		const replayClient = await restart(rig);
		resultOf(
			await replayClient.request("session/resume", { sessionId, cwd: rig.repo, replayFrom: { type: "start" } }),
		);
		expect(userTexts(replayClient, sessionId)).toContain("hello");
		expectOpenedInWorktree(rig, sessionId, file);
	});

	it("acp resume location: a session recorded through a symlinked spelling of the request directory loads", async () => {
		const rig = await startRig(1);
		const link = path.join(rig.root, "repo-link");
		fs.symlinkSync(rig.repo, link);
		const sessionId = await openNew(rig, link);
		const client = await restart(rig);

		resultOf(await client.request("session/load", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(live(rig, sessionId).sessionManager.getCwd()).toBe(link);
	});

	it("acp resume location: a session from a removed .worktrees worktree moves into the request cwd", async () => {
		const rig = await startRig(1);
		const { sessionId, file } = await sessionMovedIntoWorktree(rig);
		const oldArtifacts = seedArtifact(rig, sessionId);
		const client = await restart(rig);
		await removeWorktree(rig, rig.worktree);

		resultOf(await client.request("session/resume", { sessionId, cwd: rig.repo, mcpServers: [] }));

		const session = live(rig, sessionId);
		expect(session.sessionManager.getCwd()).toBe(rig.repo);
		expect(sessionFileOf(rig, sessionId)).toBe(
			path.join(SessionManager.getDefaultSessionDir(rig.repo), path.basename(file)),
		);
		expect(fs.existsSync(file)).toBe(false);
		const artifacts = session.sessionManager.getArtifactsDir();
		expect(artifacts && fs.readFileSync(path.join(artifacts, "marker.txt"), "utf8")).toBe(`artifact of ${sessionId}`);
		expect(fs.existsSync(oldArtifacts)).toBe(false);
	});

	it("acp resume location: a session from a removed /wt worktree moves into the request cwd", async () => {
		const rig = await startRig(1);
		const { path: managed } = await createSessionWorktree(rig.repo, Settings.isolated(), "wt/gone");
		const sessionId = await openNew(rig, rig.repo);
		await move(rig, sessionId, managed);
		const file = sessionFileOf(rig, sessionId);
		const oldArtifacts = seedArtifact(rig, sessionId);
		const client = await restart(rig);
		await removeWorktree(rig, managed);

		resultOf(await client.request("session/resume", { sessionId, cwd: rig.repo, mcpServers: [] }));

		const session = live(rig, sessionId);
		expect(session.sessionManager.getCwd()).toBe(rig.repo);
		expect(path.dirname(sessionFileOf(rig, sessionId))).toBe(SessionManager.getDefaultSessionDir(rig.repo));
		expect(fs.existsSync(file)).toBe(false);
		const artifacts = session.sessionManager.getArtifactsDir();
		expect(artifacts && fs.readFileSync(path.join(artifacts, "marker.txt"), "utf8")).toBe(`artifact of ${sessionId}`);
		expect(fs.existsSync(oldArtifacts)).toBe(false);
	});

	it("acp resume location: a session of another repository is refused naming its directory", async () => {
		const rig = await startRig(1);
		const other = path.join(rig.root, "other");
		await initRepo(other);
		const sessionId = await openNew(rig, other);
		const file = sessionFileOf(rig, sessionId);
		const client = await restart(rig);
		const before = fs.readFileSync(file, "utf8");
		const built = rig.factoryCwds.length;

		const message = errorOf(await client.request("session/load", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(message).toContain(other);
		expect(message).not.toContain("cancelled");
		expect(rig.factoryCwds.length).toBe(built);
		expect(fs.readFileSync(file, "utf8")).toBe(before);
	});

	for (const [name, dir] of [
		["a missing directory outside the repository", (rig: Rig) => path.join(rig.root, "gone")],
		["a deleted plain subdirectory of the checkout", (rig: Rig) => path.join(rig.repo, "pkg", "old")],
		["a deleted directory inside a live worktree", (rig: Rig) => path.join(rig.worktree, "pkg", "old")],
	] as const) {
		it(`acp resume location: ${name} is refused as no longer existing`, async () => {
			const rig = await startRig(1);
			const gone = dir(rig);
			const sessionId = await openNew(rig, gone);
			const file = sessionFileOf(rig, sessionId);
			const client = await restart(rig);
			const before = fs.readFileSync(file, "utf8");
			fs.rmSync(gone, { recursive: true });
			const built = rig.factoryCwds.length;

			const message = errorOf(await client.request("session/load", { sessionId, cwd: rig.repo, mcpServers: [] }));

			expect(message).toContain(gone);
			expect(message).toContain("no longer exists");
			expect(rig.factoryCwds.length).toBe(built);
			expect(fs.readFileSync(file, "utf8")).toBe(before);
		});
	}

	for (const method of ["session/load", "session/resume"] as const) {
		const label = method === "session/load" ? "a reload" : "a v1 resume";
		it(`acp resume location: ${label} after a live /move returns the open session`, async () => {
			const rig = await startRig(1);
			const { sessionId } = await sessionMovedIntoWorktree(rig);
			const built = rig.factoryCwds.length;

			resultOf(await rig.h.client.request(method, { sessionId, cwd: rig.repo, mcpServers: [] }));

			expect(rig.factoryCwds.length).toBe(built);
			const updatesBefore = rig.h.client.updates(sessionId).length;
			await prompt(rig, sessionId, "again");
			expect(rig.h.client.updates(sessionId).length).toBeGreaterThan(updatesBefore);
			expect(live(rig, sessionId).sessionManager.getCwd()).toBe(rig.worktree);
		});
	}

	it("acp resume location: a v2 resume after a live move returns the open session", async () => {
		const rig = await startRig(2);
		const { sessionId } = await sessionMovedIntoWorktree(rig);
		const built = rig.factoryCwds.length;

		resultOf(await rig.h.client.request("session/resume", { sessionId, cwd: rig.repo }));

		expect(rig.factoryCwds.length).toBe(built);
		const updatesBefore = rig.h.client.updates(sessionId).length;
		await prompt(rig, sessionId, "again");
		expect(rig.h.client.updates(sessionId).length).toBeGreaterThan(updatesBefore);
		expect(live(rig, sessionId).sessionManager.getCwd()).toBe(rig.worktree);
	});

	it("acp resume location: an open session in another repository is refused", async () => {
		const rig = await startRig(1);
		const other = path.join(rig.root, "other");
		await initRepo(other);
		const sessionId = await openNew(rig, other);

		const message = errorOf(await rig.h.client.request("session/load", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(message).toContain(other);
		expect(live(rig, sessionId).sessionManager.getCwd()).toBe(other);
		await prompt(rig, sessionId, "still here");
		expect(transcriptUserTexts(live(rig, sessionId))).toContain("still here");
	});

	it("acp resume location: forking a stored worktree session runs the fork in the worktree", async () => {
		const rig = await startRig(1);
		const { sessionId } = await sessionMovedIntoWorktree(rig);
		const client = await restart(rig);

		const forkId = String(
			resultOf(await client.request("session/fork", { sessionId, cwd: rig.repo, mcpServers: [] })).sessionId,
		);

		expect(forkId).not.toBe(sessionId);
		expect(rig.factoryCwds.at(-1)).toBe(rig.worktree);
		expect(transcriptUserTexts(live(rig, forkId))).toContain("hello");
	});

	it("acp resume location: forking an open session after a live /move runs the fork in the worktree", async () => {
		const rig = await startRig(1);
		const { sessionId } = await sessionMovedIntoWorktree(rig);

		const forkId = String(
			resultOf(await rig.h.client.request("session/fork", { sessionId, cwd: rig.repo, mcpServers: [] })).sessionId,
		);

		expect(forkId).not.toBe(sessionId);
		expect(rig.factoryCwds.at(-1)).toBe(rig.worktree);
		expect(live(rig, forkId).sessionManager.getCwd()).toBe(rig.worktree);
		expect(live(rig, sessionId).sessionManager.getCwd()).toBe(rig.worktree);
	});

	it("acp resume location: forking a session from a removed .worktrees worktree relocates the source first", async () => {
		const rig = await startRig(1);
		const { sessionId, file } = await sessionMovedIntoWorktree(rig);
		const oldArtifacts = seedArtifact(rig, sessionId);
		const client = await restart(rig);
		await removeWorktree(rig, rig.worktree);

		const forkId = String(
			resultOf(await client.request("session/fork", { sessionId, cwd: rig.repo, mcpServers: [] })).sessionId,
		);

		const repoBucket = SessionManager.getDefaultSessionDir(rig.repo);
		const movedSource = path.join(repoBucket, path.basename(file));
		expect(forkId).not.toBe(sessionId);
		expect(rig.factoryCwds.at(-1)).toBe(rig.repo);
		expect(fs.existsSync(movedSource)).toBe(true);
		expect(fs.existsSync(file)).toBe(false);
		expect(fs.readFileSync(path.join(movedSource.slice(0, -".jsonl".length), "marker.txt"), "utf8")).toBe(
			`artifact of ${sessionId}`,
		);
		expect(fs.existsSync(oldArtifacts)).toBe(false);
		expect(path.dirname(sessionFileOf(rig, forkId))).toBe(repoBucket);
	});

	it("acp resume location: forking a session whose directory no longer exists is refused", async () => {
		const rig = await startRig(1);
		const gone = path.join(rig.root, "gone");
		const sessionId = await openNew(rig, gone);
		const file = sessionFileOf(rig, sessionId);
		const client = await restart(rig);
		const before = fs.readFileSync(file, "utf8");
		fs.rmSync(gone, { recursive: true });
		const ids = await listedIds(client);
		const files = fs.readdirSync(path.dirname(file)).sort();

		const message = errorOf(await client.request("session/fork", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(message).toContain(gone);
		expect(message).toContain("no longer exists");
		expect(await listedIds(client)).toEqual(ids);
		expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(files);
		expect(fs.readFileSync(file, "utf8")).toBe(before);
	});

	it("acp resume location: forking a session of another repository is refused", async () => {
		const rig = await startRig(1);
		const other = path.join(rig.root, "other");
		await initRepo(other);
		const sessionId = await openNew(rig, other);
		const client = await restart(rig);
		const ids = await listedIds(client);

		const message = errorOf(await client.request("session/fork", { sessionId, cwd: rig.repo, mcpServers: [] }));

		expect(message).toContain(other);
		expect(await listedIds(client)).toEqual(ids);
	});
});
