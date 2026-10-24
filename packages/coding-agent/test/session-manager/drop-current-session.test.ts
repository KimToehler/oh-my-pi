import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { FileSessionStorage } from "@oh-my-pi/pi-coding-agent/session/session-storage";

import { makeAssistantMessage } from "./helpers";

function userMessage(text: string) {
	return { role: "user" as const, content: text, timestamp: Date.now() };
}

function entryType(line: string): string | undefined {
	const parsed: unknown = JSON.parse(line);
	return parsed && typeof parsed === "object" && "type" in parsed && typeof parsed.type === "string"
		? parsed.type
		: undefined;
}

function firstEntryTypes(file: string): Array<string | undefined> {
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.filter(line => line.length > 0)
		.slice(0, 2)
		.map(entryType);
}

describe("SessionManager.dropSession of the current file", () => {
	let root: string;
	let cwd: string;
	let sessionDir: string;

	beforeEach(async () => {
		root = await fsp.mkdtemp(path.join(os.tmpdir(), "omp-drop-current-"));
		cwd = path.join(root, "project");
		sessionDir = path.join(root, "sessions");
		fs.mkdirSync(cwd, { recursive: true });
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await fsp.rm(root, { recursive: true, force: true });
	});

	async function persistedManager(storage = new FileSessionStorage()): Promise<SessionManager> {
		const manager = SessionManager.create(cwd, sessionDir, storage);
		await manager.newSession();
		manager.appendMessage(userMessage("before delete"));
		manager.appendMessage(makeAssistantMessage());
		await manager.flush();
		expect(fs.existsSync(manager.getSessionFile()!)).toBe(true);
		return manager;
	}

	it("never recreates the deleted file for later entries", async () => {
		const manager = await persistedManager();
		const deleted = manager.getSessionFile()!;

		await manager.dropSession(deleted);
		manager.appendMessage(userMessage("after delete"));
		manager.appendCustomEntry("session_exit", { reason: "test" });
		await manager.flush();
		await manager.close();

		expect(fs.existsSync(deleted)).toBe(false);
		expect(fs.readdirSync(sessionDir).filter(name => name.endsWith(".jsonl"))).toEqual([]);
	});

	it("persists again once a new session starts", async () => {
		const manager = await persistedManager();
		const deleted = manager.getSessionFile()!;

		await manager.dropSession(deleted);
		await manager.newSession();
		manager.appendMessage(userMessage("fresh session"));
		manager.appendMessage(makeAssistantMessage());
		await manager.flush();

		const fresh = manager.getSessionFile()!;
		expect(fresh).not.toBe(deleted);
		expect(firstEntryTypes(fresh)).toEqual(["title", "session"]);
		expect(fs.readFileSync(fresh, "utf8")).toContain("fresh session");
		expect(fs.existsSync(deleted)).toBe(false);
		await manager.close();
	});

	it("persists into another stored session after switching to it", async () => {
		const other = await persistedManager();
		const otherFile = other.getSessionFile()!;
		await other.close();

		const manager = await persistedManager();
		const deleted = manager.getSessionFile()!;
		await manager.dropSession(deleted);
		await manager.setSessionFile(otherFile);
		manager.appendMessage(userMessage("continued elsewhere"));
		await manager.flush();

		expect(fs.readFileSync(otherFile, "utf8")).toContain("continued elsewhere");
		expect(fs.existsSync(deleted)).toBe(false);
		await manager.close();
	});

	it("keeps persisting the current file when another session's file is deleted", async () => {
		const other = await persistedManager();
		const otherFile = other.getSessionFile()!;
		await other.close();

		const manager = await persistedManager();
		const current = manager.getSessionFile()!;
		await manager.dropSession(otherFile);
		manager.appendMessage(userMessage("still here"));
		await manager.flush();

		expect(fs.existsSync(otherFile)).toBe(false);
		expect(manager.getSessionFile()).toBe(current);
		expect(fs.readFileSync(current, "utf8")).toContain("still here");
		await manager.close();
	});

	it("keeps the original file as persistence target when the delete fails", async () => {
		const storage = new FileSessionStorage();
		const manager = await persistedManager(storage);
		const current = manager.getSessionFile()!;
		vi.spyOn(storage, "deleteSessionWithArtifacts").mockRejectedValue(new Error("EPERM: delete refused"));

		await expect(manager.dropSession(current)).rejects.toThrow("EPERM: delete refused");
		manager.appendMessage(userMessage("after failed delete"));
		await manager.flush();

		expect(manager.getSessionFile()).toBe(current);
		expect(firstEntryTypes(current)).toEqual(["title", "session"]);
		expect(fs.readFileSync(current, "utf8")).toContain("after failed delete");
		await manager.close();
	});
});
