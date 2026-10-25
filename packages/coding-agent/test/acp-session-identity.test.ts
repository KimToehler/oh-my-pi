import { afterEach, describe, expect, it, vi } from "bun:test";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { cleanupHarnessState, createHarness, makeAssistantMessage } from "./acp-test-harness";

afterEach(cleanupHarnessState);

async function storedSessionFile(cwd: string): Promise<string> {
	const manager = SessionManager.create(cwd);
	await manager.newSession();
	manager.appendMessage({ role: "user", content: "other conversation", timestamp: Date.now() });
	manager.appendMessage(makeAssistantMessage("other reply"));
	await manager.flush();
	const file = manager.getSessionFile();
	await manager.close();
	if (!file) throw new Error("Expected a persisted session file");
	return file;
}

describe("ACP session identity", () => {
	it("refuses extension actions that would replace the session's transcript", async () => {
		const harness = await createHarness({ extensionRunners: true });
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session?.extensionRunner) throw new Error("Expected a session with an extension runner");
		const ctx = session.extensionRunner.createCommandContext();
		const otherFile = await storedSessionFile(harness.cwdA);
		const fileBefore = session.sessionManager.getSessionFile();
		const setup = vi.fn(async () => {});

		expect(await ctx.newSession({ setup })).toEqual({ cancelled: true });
		expect(await ctx.branch("earlier-user-entry")).toEqual({ cancelled: true });
		expect(await ctx.switchSession(otherFile)).toEqual({ cancelled: true });

		expect(setup).not.toHaveBeenCalled();
		expect(session.sessionId).toBe(created.sessionId);
		expect(session.sessionManager.getSessionFile()).toBe(fileBefore);

		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "still A?" }] });
		const chunks = harness.updates.filter(update => update.update.sessionUpdate === "agent_message_chunk");
		expect(chunks.length).toBeGreaterThan(0);
		expect(new Set(harness.updates.map(update => update.sessionId))).toEqual(new Set([created.sessionId]));

		await harness.agent.dispose();
	});

	it("keeps tree navigation and reload on the same session", async () => {
		const harness = await createHarness({ extensionRunners: true });
		const created = await harness.agent.newSession({ cwd: harness.cwdA, mcpServers: [] });
		const session = harness.findSession(created.sessionId);
		if (!session?.extensionRunner) throw new Error("Expected a session with an extension runner");
		const ctx = session.extensionRunner.createCommandContext();
		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "first" }] });
		const fileBefore = session.sessionManager.getSessionFile();
		const entriesBefore = session.sessionManager.getEntries().length;
		const navigate = vi.spyOn(session, "navigateTree");
		const reload = vi.spyOn(session, "reload");

		expect(await ctx.navigateTree("earlier-entry")).toEqual({ cancelled: false });
		await ctx.reload();

		expect(navigate).toHaveBeenCalledWith("earlier-entry", { summarize: undefined });
		expect(reload).toHaveBeenCalledTimes(1);
		expect(session.sessionId).toBe(created.sessionId);
		expect(session.sessionManager.getSessionFile()).toBe(fileBefore);
		expect(session.sessionManager.getEntries().length).toBe(entriesBefore);

		harness.updates.length = 0;
		await harness.agent.prompt({ sessionId: created.sessionId, prompt: [{ type: "text", text: "second" }] });
		expect(harness.updates.length).toBeGreaterThan(0);
		expect(new Set(harness.updates.map(update => update.sessionId))).toEqual(new Set([created.sessionId]));

		await harness.agent.dispose();
	});
});
