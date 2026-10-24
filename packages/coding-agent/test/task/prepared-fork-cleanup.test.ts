import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { unregisterCustomApis } from "@oh-my-pi/pi-ai/api-registry";
import type { MockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { createMockModel, registerMockApi } from "@oh-my-pi/pi-ai/providers/mock";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { IrcBus } from "@oh-my-pi/pi-coding-agent/irc/bus";
import { AgentLifecycleManager } from "@oh-my-pi/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { CURRENT_SESSION_VERSION } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { getBundledAgent } from "@oh-my-pi/pi-coding-agent/task/agents";
import { runSubprocess } from "@oh-my-pi/pi-coding-agent/task/executor";
import { getAgentDir, logger, setAgentDir, TempDir } from "@oh-my-pi/pi-utils";

const MOCK_API_SOURCE = "prepared-fork-cleanup-test";
const AGENT_ID = "PreparedForkCleanup";

function makeModelRegistry(authStorage: AuthStorage, modelsPath: string, model: MockModel): ModelRegistry {
	const registry = new ModelRegistry(authStorage, modelsPath);
	vi.spyOn(registry, "getAvailable").mockReturnValue([model]);
	vi.spyOn(registry, "getAvailableForProviders").mockReturnValue([model]);
	vi.spyOn(registry, "getAll").mockReturnValue([model]);
	vi.spyOn(registry, "find").mockImplementation((provider, id) =>
		provider === model.provider && id === model.id ? model : undefined,
	);
	return registry;
}

beforeEach(() => {
	AgentLifecycleManager.resetGlobalForTests();
	AgentRegistry.resetGlobalForTests();
	IrcBus.resetGlobalForTests();
});

afterEach(() => {
	AgentLifecycleManager.resetGlobalForTests();
	AgentRegistry.resetGlobalForTests();
	IrcBus.resetGlobalForTests();
	unregisterCustomApis(MOCK_API_SOURCE);
	vi.restoreAllMocks();
});

describe("prepared session fork cleanup", () => {
	it("removes the forked session file and artifacts when the subagent fails before it is ready", async () => {
		using tempDir = TempDir.createSync("@omp-prepared-fork-cleanup-");
		const cwd = path.join(tempDir.path(), "project");
		const sourceFile = path.join(tempDir.path(), "sessions", "host.jsonl");
		const artifactsDir = sourceFile.slice(0, -".jsonl".length);
		fs.mkdirSync(cwd, { recursive: true });
		fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
		const timestamp = "2026-10-01T00:00:00.000Z";
		const sourceEntries = [
			{ type: "session", version: CURRENT_SESSION_VERSION, id: "host-session", timestamp, cwd },
			{
				type: "message",
				id: "host-message",
				parentId: null,
				timestamp,
				message: { role: "user", content: "historical request", timestamp: 1 },
			},
		];
		await Bun.write(sourceFile, `${sourceEntries.map(entry => JSON.stringify(entry)).join("\n")}\n`);

		const mock = createMockModel({ provider: "mock", id: "prepared-fork-cleanup", responses: [] });
		registerMockApi(MOCK_API_SOURCE);
		const authStorage = await AuthStorage.create(":memory:");
		authStorage.keys.setRuntime(mock.model.provider, "test-key");
		const modelRegistry = makeModelRegistry(authStorage, path.join(tempDir.path(), "models.yml"), mock.model);
		const warn = vi.spyOn(logger, "warn");
		const previousAgentDir = getAgentDir();
		setAgentDir(path.join(tempDir.path(), "agent"));
		const agent = getBundledAgent("seance");
		if (!agent) throw new Error("Expected the bundled seance agent");
		const missingSkillDir = path.join(tempDir.path(), "missing-skill");

		try {
			const result = await runSubprocess({
				cwd,
				agent,
				task: "Consult the host session.",
				index: 0,
				id: AGENT_ID,
				settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false }),
				modelRegistry,
				authStorage,
				getApiKey: async () => "test-key",
				modelOverride: [`${mock.model.provider}/${mock.model.id}`],
				preparedSession: { fork: { sourceFile }, promptSuffix: () => "Consulting host-session." },
				// The autoload read fails after the fork file was opened and before the subagent is ready.
				autoloadSkills: [
					{
						name: "missing",
						description: "skill whose file does not exist",
						filePath: path.join(missingSkillDir, "SKILL.md"),
						baseDir: missingSkillDir,
						source: "test",
					},
				],
				artifactsDir,
				enableLsp: false,
				enableMCP: false,
				parentAgentId: "Main",
			});

			expect(result.exitCode).not.toBe(0);
			expect(fs.existsSync(path.join(artifactsDir, `${AGENT_ID}.jsonl`))).toBe(false);
			expect(fs.existsSync(path.join(artifactsDir, AGENT_ID))).toBe(false);
			expect(warn.mock.calls.map(call => call[0])).not.toContain("Failed to remove incomplete prepared session fork");
			expect(fs.existsSync(sourceFile)).toBe(true);
		} finally {
			setAgentDir(previousAgentDir);
		}
	});
});
