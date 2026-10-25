import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { FileSessionStorage, type SessionStorageWriter } from "@oh-my-pi/pi-coding-agent/session/session-storage";

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

	/** Run the real unlink, then hold the deletion open until `release` is called. */
	function holdDeletionAfterUnlink(storage: FileSessionStorage, outcome: "succeed" | Error) {
		const realDelete = storage.deleteSessionWithArtifacts.bind(storage);
		const unlinked = Promise.withResolvers<void>();
		const gate = Promise.withResolvers<void>();
		vi.spyOn(storage, "deleteSessionWithArtifacts").mockImplementation(async sessionPath => {
			await realDelete(sessionPath);
			unlinked.resolve();
			await gate.promise;
			if (outcome !== "succeed") throw outcome;
		});
		return { unlinked: unlinked.promise, release: () => gate.resolve() };
	}

	it("keeps entries appended while the delete runs in memory when the delete succeeds", async () => {
		const storage = new FileSessionStorage();
		const manager = await persistedManager(storage);
		const deleted = manager.getSessionFile()!;
		const held = holdDeletionAfterUnlink(storage, "succeed");

		const dropping = manager.dropSession(deleted);
		await held.unlinked;
		manager.appendMessage(userMessage("during delete"));
		await manager.setSessionName("Late title", "user");
		held.release();
		await dropping;
		await manager.flush();
		await manager.close();

		expect(fs.existsSync(deleted)).toBe(false);
		expect(fs.readdirSync(sessionDir).filter(name => name.endsWith(".jsonl"))).toEqual([]);
	});

	it("keeps entries appended while the current writer drains in memory and leaves no writer open", async () => {
		const storage = new FileSessionStorage();
		const realOpenWriter = storage.openWriter.bind(storage);
		const opened: Array<{ path: string; writer: SessionStorageWriter }> = [];
		const closing = Promise.withResolvers<void>();
		const gate = Promise.withResolvers<void>();
		let holdClose = false;
		vi.spyOn(storage, "openWriter").mockImplementation((fpath, options) => {
			const writer = realOpenWriter(fpath, options);
			opened.push({ path: fpath, writer });
			const realClose = writer.close.bind(writer);
			vi.spyOn(writer, "close").mockImplementation(async () => {
				if (holdClose) {
					holdClose = false;
					closing.resolve();
					await gate.promise;
				}
				await realClose();
			});
			return writer;
		});
		const manager = await persistedManager(storage);
		const deleted = manager.getSessionFile()!;

		holdClose = true;
		const dropping = manager.dropSession(deleted);
		await closing.promise;
		manager.appendMessage(userMessage("during drain"));
		const titled = manager.setSessionName("Drain title", "user");
		gate.resolve();
		await dropping;
		await titled;
		manager.appendMessage(userMessage("after delete"));
		await manager.flush();
		await manager.close();

		expect(fs.existsSync(deleted)).toBe(false);
		expect(fs.readdirSync(sessionDir).filter(name => name.endsWith(".jsonl"))).toEqual([]);
		// A writer opened on the old path while the drain runs would hold the deleted file open.
		expect(opened.filter(entry => entry.path === deleted && entry.writer.isOpen())).toEqual([]);
	});

	it("persists the whole session including entries appended during a failed delete", async () => {
		const storage = new FileSessionStorage();
		const manager = await persistedManager(storage);
		const current = manager.getSessionFile()!;
		const held = holdDeletionAfterUnlink(storage, new Error("EPERM: delete refused"));

		const dropping = manager.dropSession(current).then(
			() => undefined,
			(err: unknown) => err,
		);
		await held.unlinked;
		manager.appendMessage(userMessage("during delete"));
		held.release();
		expect(String(await dropping)).toContain("EPERM: delete refused");
		await manager.flush();

		expect(manager.getSessionFile()).toBe(current);
		const lines = fs
			.readFileSync(current, "utf8")
			.split("\n")
			.filter(line => line.length > 0);
		expect(lines.map(entryType).filter(type => type === "session")).toHaveLength(1);
		const text = lines.join("\n");
		expect(text).toContain("before delete");
		expect(text).toContain("during delete");
		expect(lines.filter(line => entryType(line) === "message")).toHaveLength(3);
		await manager.close();
	});

	it("keeps a session started during a failed delete as the target and does not write it to the old path", async () => {
		const storage = new FileSessionStorage();
		const manager = await persistedManager(storage);
		const deleted = manager.getSessionFile()!;
		const held = holdDeletionAfterUnlink(storage, new Error("EPERM: delete refused"));

		const dropping = manager.dropSession(deleted).then(
			() => undefined,
			(err: unknown) => err,
		);
		await held.unlinked;
		const started = await manager.newSession();
		manager.appendMessage(userMessage("in the new session"));
		held.release();
		expect(String(await dropping)).toContain("EPERM: delete refused");
		await manager.flush();
		await manager.close();

		expect(manager.getSessionFile()).toBe(started);
		expect(fs.existsSync(deleted)).toBe(false);
		expect(fs.readFileSync(started!, "utf8")).toContain("in the new session");
	});
});
