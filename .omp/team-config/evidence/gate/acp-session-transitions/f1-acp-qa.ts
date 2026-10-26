#!/usr/bin/env bun
/**
 * F1 manual QA for OpenSpec change `acp-session-transitions` (tasks.md 4.2).
 * Usage: bun f1-acp-qa.ts <worktree root>
 * Runs the real `omp acp` over stdio (isolated agent dir, local scripted fixture model), once per protocol
 * version, and writes f1-results.json + per-scenario evidence files next to this script.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const HERE = import.meta.dir;
const ROOT = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
	console.error("usage: bun f1-acp-qa.ts <worktree root>");
	process.exit(2);
}
const TIMEOUT_MS = 90_000;

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------------------
// Fixture model
// ---------------------------------------------------------------------------

function textReply(model: string, text: string): Response {
	const chunk = { id: "fixture", object: "chat.completion.chunk", model, created: 1 };
	const body =
		`data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] })}\n\n` +
		`data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n` +
		"data: [DONE]\n\n";
	return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function startFixtureModel(): ReturnType<typeof Bun.serve> {
	return Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			if (request.method === "GET") return Response.json({ object: "list", data: [{ id: "main" }, { id: "tiny" }] });
			const body = (await request.json()) as { model: string };
			return textReply(body.model, body.model === "tiny" ? "fixture title" : "fixture reply");
		},
	});
}

// ---------------------------------------------------------------------------
// Extension under test
// ---------------------------------------------------------------------------

const EXTENSION = `
import * as fs from "node:fs";
export default function (pi) {
	const out = process.env.QA_EXT_OUT;
	const record = (name, value) => fs.appendFileSync(out, JSON.stringify({ name, ...value }) + "\\n");
	const firstUserEntry = ctx => {
		const entry = ctx.sessionManager.getEntries().find(e => e.type === "message" && e.message?.role === "user");
		if (!entry) throw new Error("no user entry");
		return entry.id;
	};
	pi.registerCommand("qa-refuse", {
		description: "QA: newSession/switchSession/branch",
		handler: async (args, ctx) => {
			let setupCalled = false;
			const entryId = firstUserEntry(ctx);
			const sessionFileBefore = ctx.sessionManager.getSessionFile();
			const newSession = await ctx.newSession({ setup: async () => { setupCalled = true; } });
			const switchSession = await ctx.switchSession(String(args).trim());
			const branch = await ctx.branch(entryId);
			const sessionFileAfter = ctx.sessionManager.getSessionFile();
			const result = { newSession, switchSession, branch, setupCalled, sessionFileBefore, sessionFileAfter };
			record("qa-refuse", result);
			ctx.ui.notify("QA-REFUSE " + JSON.stringify(result), "info");
			pi.sendMessage({ customType: "qa-refuse", content: "QA-REFUSE " + JSON.stringify(result), display: true });
		},
	});
	pi.registerCommand("qa-nav", {
		description: "QA: navigateTree/reload",
		handler: async (_args, ctx) => {
			const entryId = firstUserEntry(ctx);
			const navigate = await ctx.navigateTree(entryId);
			let reload = "ok";
			try { await ctx.reload(); } catch (e) { reload = "threw: " + String(e); }
			const result = { navigate, reload, entryId, leaf: ctx.sessionManager.getLeafId?.() };
			record("qa-nav", result);
			ctx.ui.notify("QA-NAV " + JSON.stringify(result), "info");
			pi.sendMessage({ customType: "qa-nav", content: "QA-NAV " + JSON.stringify(result), display: true });
		},
	});
}
`;

// ---------------------------------------------------------------------------
// Run one protocol version
// ---------------------------------------------------------------------------

interface ResultEntry {
	scenario: string;
	protocolVersion: 1 | 2;
	pass: boolean;
	evidence: string;
	detail: string;
}

function isolatedEnv(agentDir: string, extOut: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (/^(PI_|OMP_)/.test(key)) continue;
		if (/(API_KEY|_TOKEN|_SECRET|_KEY)$/.test(key)) continue;
		env[key] = value;
	}
	env.PI_CODING_AGENT_DIR = agentDir;
	env.QA_EXT_OUT = extOut;
	return env;
}

async function listJsonl(dir: string): Promise<string[]> {
	const out: string[] = [];
	const walk = async (d: string): Promise<void> => {
		let entries: import("node:fs").Dirent[];
		try {
			entries = await fs.readdir(d, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) await walk(p);
			else if (e.name.endsWith(".jsonl")) out.push(p);
		}
	};
	await walk(dir);
	return out.sort();
}

async function runVersion(version: 1 | 2): Promise<ResultEntry[]> {
	const work = await fs.mkdtemp(path.join(os.tmpdir(), `omp-f1-transitions-v${version}-`));
	const workspace = path.join(work, "workspace");
	const agentDir = path.join(work, "agent");
	const sessionsDir = path.join(agentDir, "sessions");
	const extOut = path.join(work, "ext-out.jsonl");
	const stderrPath = path.join(HERE, `f1-v${version}-stderr.log`);
	const framesPath = path.join(HERE, `f1-v${version}-frames.jsonl`);
	const server = startFixtureModel();
	await fs.mkdir(workspace, { recursive: true });
	await Bun.write(extOut, "");
	const baseUrl = `http://127.0.0.1:${server.port}/v1`;
	await Bun.write(
		path.join(agentDir, "models.yml"),
		[
			"providers:",
			"  fixture:",
			`    baseUrl: ${baseUrl}`,
			"    api: openai-completions",
			"    apiKey: fixture-dummy-key",
			"    models:",
			"      - id: main",
			"        name: Fixture Main",
			"        contextWindow: 128000",
			"        maxTokens: 4096",
			"      - id: tiny",
			"        name: Fixture Tiny",
			"        contextWindow: 128000",
			"        maxTokens: 1024",
			"",
		].join("\n"),
	);
	const chatRoles = ["default", "smol", "slow", "vision", "plan", "commit", "task", "advisor", "judge"];
	await Bun.write(
		path.join(agentDir, "config.yml"),
		[
			...(version === 2 ? ["acp:", "  protocolV2: true"] : []),
			"modelRoles:",
			...chatRoles.map(role => `  ${role}: fixture/main`),
			"  tiny: fixture/tiny",
			"  memory: fixture/tiny",
			"",
		].join("\n"),
	);
	await Bun.write(path.join(agentDir, "extensions", "qa-transitions.ts"), EXTENSION);

	await fs.rm(framesPath, { force: true });
	const log = Bun.file(framesPath).writer();
	const frames: { dir: string; msg: Json }[] = [];
	const record = (dir: string, msg: Json) => {
		frames.push({ dir, msg });
		log.write(`${JSON.stringify({ dir, msg })}\n`);
		log.flush();
	};

	const child = Bun.spawn(["bun", "packages/coding-agent/src/cli.ts", "acp"], {
		cwd: ROOT,
		env: isolatedEnv(agentDir, extOut),
		stdin: "pipe",
		stdout: "pipe",
		stderr: Bun.file(stderrPath),
	});
	let nextId = 1;
	const pending = new Map<number, PromiseWithResolvers<Json>>();
	const send = (msg: Json) => {
		record("client->agent", msg);
		child.stdin.write(`${JSON.stringify(msg)}\n`);
		child.stdin.flush();
	};
	/** Resolves with the whole JSON-RPC response ({result} or {error}); never rejects on a JSON-RPC error. */
	const request = (method: string, params: Json): Promise<Json> => {
		const id = nextId++;
		const waiter = Promise.withResolvers<Json>();
		pending.set(id, waiter);
		send({ jsonrpc: "2.0", id, method, params });
		return Promise.race([
			waiter.promise,
			Bun.sleep(TIMEOUT_MS).then(() => {
				throw new Error(`timeout: ${method}`);
			}),
		]);
	};
	const reading = (async () => {
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
			buffer += decoder.decode(chunk, { stream: true });
			let nl = buffer.indexOf("\n");
			while (nl >= 0) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				nl = buffer.indexOf("\n");
				if (!line) continue;
				let msg: Json;
				try {
					msg = JSON.parse(line) as Json;
				} catch {
					record("qa", { method: "qa/stdout_noise", params: { line } });
					continue;
				}
				record("agent->client", msg);
				if ("id" in msg && typeof msg.method === "string") {
					const reply = (result: unknown) => send({ jsonrpc: "2.0", id: msg.id, result });
					if (msg.method === "session/request_permission") {
						reply({ outcome: { outcome: "selected", optionId: "allow_once" } });
					} else {
						send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `unsupported: ${String(msg.method)}` } });
					}
				} else if ("id" in msg && typeof msg.id === "number") {
					const w = pending.get(msg.id);
					pending.delete(msg.id);
					w?.resolve(msg);
				}
			}
		}
	})();

	// -- helpers over recorded frames --
	const updatesFrom = (from: number): { sessionId: string; update: Json }[] =>
		frames
			.slice(from)
			.filter(f => f.dir === "agent->client" && f.msg.method === "session/update" && isRecord(f.msg.params))
			.map(f => {
				const params = f.msg.params as Json;
				return { sessionId: String(params.sessionId), update: isRecord(params.update) ? params.update : {} };
			});
	const textOf = (u: Json): string => {
		const c = u.content;
		return u.sessionUpdate === "agent_message_chunk" && isRecord(c) && typeof c.text === "string" ? c.text : "";
	};
	const sleepUntil = async (cond: () => boolean, what: string): Promise<void> => {
		const deadline = Date.now() + TIMEOUT_MS;
		while (!cond()) {
			if (Date.now() > deadline) throw new Error(`timeout waiting for ${what}`);
			await Bun.sleep(50);
		}
	};
	const idleCount = (sessionId: string): number =>
		updatesFrom(0).filter(u => u.sessionId === sessionId && u.update.sessionUpdate === "state_update" && u.update.state === "idle")
			.length;

	/** Sends session/prompt and waits for the turn to end; returns the end marker plus the frame offset. */
	const turn = async (
		sessionId: string,
		text: string,
	): Promise<{ from: number; stop: string | undefined; error?: Json; text: string; ids: string[] }> => {
		const from = frames.length;
		const idleBefore = idleCount(sessionId);
		const res = await request("session/prompt", { sessionId, prompt: [{ type: "text", text }] });
		let stop: string | undefined;
		if (isRecord(res.error)) return { from, stop, error: res.error, text: "", ids: [] };
		if (version === 1) {
			stop = isRecord(res.result) ? String(res.result.stopReason) : undefined;
		} else {
			await sleepUntil(() => idleCount(sessionId) > idleBefore, "v2 idle state_update");
			const idles = updatesFrom(0).filter(
				u => u.sessionId === sessionId && u.update.sessionUpdate === "state_update" && u.update.state === "idle",
			);
			stop = String(idles.at(-1)?.update.stopReason);
		}
		// v2 notifications can trail the idle marker slightly; allow them to flush.
		await Bun.sleep(300);
		const ups = updatesFrom(from);
		return { from, stop, text: ups.map(u => textOf(u.update)).join(""), ids: [...new Set(ups.map(u => u.sessionId))] };
	};

	const newSessionFile = async (before: Set<string>): Promise<string> => {
		const files = await listJsonl(sessionsDir);
		const fresh = files.filter(f => !before.has(f));
		if (fresh.length !== 1) throw new Error(`expected exactly one new session file, got ${JSON.stringify(fresh)}`);
		return fresh[0];
	};
	const extResults = async (): Promise<Json[]> =>
		(await Bun.file(extOut).text())
			.split("\n")
			.filter(Boolean)
			.map(l => JSON.parse(l) as Json);

	const results: ResultEntry[] = [];
	const scenarioEvidence = async (scenario: string, start: number, extra: Json): Promise<string> => {
		const p = path.join(HERE, `f1-v${version}-${scenario}.evidence.json`);
		await Bun.write(p, `${JSON.stringify({ scenario, protocolVersion: version, frames: frames.slice(start), ...extra }, null, 2)}\n`);
		return p;
	};
	const scenario = async (
		name: string,
		body: (note: (k: string, v: unknown) => void) => Promise<string>,
	): Promise<void> => {
		const start = frames.length;
		const notes: Json = {};
		let pass = false;
		let detail: string;
		try {
			detail = await body((k, v) => {
				notes[k] = v;
			});
			pass = true;
		} catch (error) {
			detail = error instanceof Error ? error.message : String(error);
		}
		const evidence = await scenarioEvidence(name, start, { notes, pass, detail });
		results.push({ scenario: name, protocolVersion: version, pass, evidence, detail });
		console.log(`[v${version}] ${name}: ${pass ? "PASS" : "FAIL"} - ${detail}`);
	};
	const assert = (cond: unknown, message: string): void => {
		if (!cond) throw new Error(message);
	};

	try {
		const init = await request(
			"initialize",
			version === 1
				? { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "f1-acp-qa", version: "1" } }
				: { protocolVersion: 2, info: { name: "f1-acp-qa", version: "1" }, capabilities: {} },
		);
		assert(isRecord(init.result), `initialize failed: ${JSON.stringify(init)}`);
		assert(
			(init.result as Json).protocolVersion === version,
			`negotiated protocolVersion ${String((init.result as Json).protocolVersion)} != ${version}`,
		);

		const newSession = async (): Promise<string> => {
			const created = await request("session/new", { cwd: workspace, mcpServers: [] });
			assert(isRecord(created.result), `session/new failed: ${JSON.stringify(created)}`);
			return String((created.result as Json).sessionId);
		};
		const listIds = async (): Promise<string[]> => {
			const res = await request("session/list", { cwd: workspace });
			assert(isRecord(res.result), `session/list failed: ${JSON.stringify(res)}`);
			const sessions = (res.result as Json).sessions;
			return Array.isArray(sessions) ? sessions.map(s => String((s as Json).sessionId)) : [];
		};

		// Another stored session (B) for switchSession.
		let beforeFiles = new Set(await listJsonl(sessionsDir));
		const bId = await newSession();
		const bTurn = await turn(bId, "hello from B");
		assert(!bTurn.error, `prompt in B failed: ${JSON.stringify(bTurn.error)}`);
		const bFile = await newSessionFile(beforeFiles);

		// 1 extension-refusal
		await scenario("extension-refusal", async note => {
			beforeFiles = new Set(await listJsonl(sessionsDir));
			const a = await newSession();
			const first = await turn(a, "first message in A");
			assert(!first.error, `first prompt failed: ${JSON.stringify(first.error)}`);
			const aFile = await newSessionFile(beforeFiles);
			const sessionsBefore = await listIds();
			const filesBefore = await listJsonl(sessionsDir);
			const cmd = await turn(a, `/qa-refuse ${bFile}`);
			assert(!cmd.error, `command prompt failed: ${JSON.stringify(cmd.error)}`);
			const res = (await extResults()).filter(r => r.name === "qa-refuse");
			assert(res.length === 1, `expected one qa-refuse result, got ${res.length}; command text: ${cmd.text}`);
			const r = res[0];
			note("extension result", r);
			for (const k of ["newSession", "switchSession", "branch"]) {
				assert(JSON.stringify(r[k]) === JSON.stringify({ cancelled: true }), `${k} returned ${JSON.stringify(r[k])}, want {cancelled:true}`);
			}
			assert(r.setupCalled === false, "newSession setup callback ran");
			assert(r.sessionFileBefore === r.sessionFileAfter && r.sessionFileAfter === aFile, "session file changed");
			note("command turn text (extension notify/sendMessage output is not forwarded by ACP)", cmd.text);
			assert(cmd.ids.every(id => id === a), `command turn updates carried ids ${JSON.stringify(cmd.ids)}, want only ${a}`);
			const next = await turn(a, "ordinary prompt after refusal");
			assert(!next.error && next.ids.length > 0 && next.ids.every(id => id === a), `next prompt ids ${JSON.stringify(next.ids)}, error ${JSON.stringify(next.error)}`);
			const sessionsAfter = await listIds();
			const filesAfter = await listJsonl(sessionsDir);
			assert(
				JSON.stringify([...sessionsAfter].sort()) === JSON.stringify([...sessionsBefore].sort()),
				`session/list changed: ${JSON.stringify(sessionsBefore)} -> ${JSON.stringify(sessionsAfter)}`,
			);
			assert(JSON.stringify(filesAfter) === JSON.stringify(filesBefore), "session files changed");
			const content = await Bun.file(aFile).text();
			assert(content.includes("ordinary prompt after refusal"), "next prompt not persisted in A's file");
			return `all three {cancelled:true}, setup not run, file unchanged, updates carry only ${a}, no new session/file, next prompt persisted in A's file`;
		});

		// 2 navigate-reload
		await scenario("navigate-reload", async note => {
			beforeFiles = new Set(await listJsonl(sessionsDir));
			const a = await newSession();
			const first = await turn(a, "first message in A (nav)");
			assert(!first.error, `first prompt failed: ${JSON.stringify(first.error)}`);
			const second = await turn(a, "second message in A (nav)");
			assert(!second.error, `second prompt failed: ${JSON.stringify(second.error)}`);
			const aFile = await newSessionFile(beforeFiles);
			const cmd = await turn(a, "/qa-nav");
			assert(!cmd.error, `command prompt failed: ${JSON.stringify(cmd.error)}`);
			const res = (await extResults()).filter(r => r.name === "qa-nav");
			assert(res.length === 1, `expected one qa-nav result, got ${res.length}; command text: ${cmd.text}`);
			const r = res[0];
			note("extension result", r);
			assert(JSON.stringify(r.navigate) === JSON.stringify({ cancelled: false }), `navigateTree returned ${JSON.stringify(r.navigate)}`);
			assert(r.reload === "ok", `reload: ${String(r.reload)}`);
			assert(cmd.ids.every(id => id === a), `command turn ids ${JSON.stringify(cmd.ids)}`);
			const next = await turn(a, "prompt after navigate and reload");
			assert(!next.error && next.ids.length > 0 && next.ids.every(id => id === a), `next ids ${JSON.stringify(next.ids)}, error ${JSON.stringify(next.error)}`);
			const content = await Bun.file(aFile).text();
			assert(content.includes("prompt after navigate and reload"), "next prompt not persisted in A's file");
			return `navigateTree {cancelled:false}, reload completed, updates keep ${a}, later prompt persisted in A's file`;
		});

		// 3 delete
		await scenario("delete", async note => {
			beforeFiles = new Set(await listJsonl(sessionsDir));
			const a = await newSession();
			const first = await turn(a, "first message in A (delete)");
			assert(!first.error, `first prompt failed: ${JSON.stringify(first.error)}`);
			const aFile = await newSessionFile(beforeFiles);
			assert(await Bun.file(aFile).exists(), "A's file missing before delete");
			assert((await listIds()).includes(a), "A not in session/list before delete");
			const del = await turn(a, "/session delete");
			assert(!del.error, `delete prompt rejected: ${JSON.stringify(del.error)}`);
			note("delete text", del.text);
			assert(/delet/i.test(del.text), `no confirmation text: ${JSON.stringify(del.text)}`);
			if (version === 1) assert(del.stop === "end_turn", `v1 stopReason ${del.stop}, want end_turn`);
			else assert(del.stop !== undefined && del.stop !== "error", `v2 idle stopReason ${del.stop}`);
			// the session close runs after the turn settles; give it a moment
			await Bun.sleep(500);
			const ghost = crypto.randomUUID();
			const calls: [string, (id: string) => Json][] = [
				["session/prompt", id => ({ sessionId: id, prompt: [{ type: "text", text: "after delete" }] })],
				["session/resume", id => ({ sessionId: id, cwd: workspace, mcpServers: [] })],
				version === 1
					? ["session/set_mode", id => ({ sessionId: id, modeId: "plan" })]
					: ["session/set_config_option", id => ({ sessionId: id, configId: "thinking", value: "high" })],
			];
			const errText = (res: Json): string => (isRecord(res.error) ? JSON.stringify(res.error) : "");
			const failures: string[] = [];
			for (const [method, params] of calls) {
				try {
				const resA = await request(method, params(a));
				const resG = await request(method, params(ghost));
				note(method, { deleted: resA, neverIssued: resG });
				assert(isRecord(resA.error), `${method} for deleted A succeeded: ${JSON.stringify(resA)}`);
				assert(isRecord(resG.error), `${method} for never-issued id succeeded: ${JSON.stringify(resG)}`);
				const norm = (s: string, id: string) => s.split(id).join("<id>");
				assert(
					norm(errText(resA), a) === norm(errText(resG), ghost),
					`${method} error differs from never-issued id: ${errText(resA)} vs ${errText(resG)}`,
				);
				} catch (error) {
					failures.push(error instanceof Error ? error.message : String(error));
				}
			}
			assert(failures.length === 0, failures.join(" | "));
			assert(!(await Bun.file(aFile).exists()), `A's file still exists: ${aFile}`);
			assert(!(await listIds()).includes(a), "A still in session/list");
			return `confirmation delivered (${version === 1 ? "stopReason end_turn" : `idle ${del.stop}`}); prompt/resume/${version === 1 ? "set_mode" : "set_config_option"} for A rejected like a never-issued id; file gone; A not listed`;
		});

		// 4 no-headerless-file
		await scenario("no-headerless-file", async note => {
			await Bun.sleep(500);
			const files = await listJsonl(agentDir);
			const bad: string[] = [];
			for (const f of files) {
				const text = await Bun.file(f).text();
				const lines = text.split("\n").filter(Boolean);
				const types = lines.slice(0, 2).map(l => {
					try {
						return String((JSON.parse(l) as Json).type);
					} catch {
						return "unparseable";
					}
				});
				// A store file starts with a title and/or session header entry; the header must be in the first two lines.
				const ok = types.length > 0 && types.every(t => t === "title" || t === "session") && types.includes("session");
				if (!ok) bad.push(`${f}: first line types ${JSON.stringify(types)}`);
			}
			note("files", files);
			note("headerless", bad);
			assert(files.length > 0, "no .jsonl files found under the isolated agent dir");
			assert(bad.length === 0, `files without a session header first line: ${bad.join("; ")}`);
			return `${files.length} .jsonl file(s) under isolated agent dir, all start with a session header`;
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const evidence = await scenarioEvidence("setup", 0, { error: message });
		results.push({ scenario: "setup", protocolVersion: version, pass: false, evidence, detail: message });
		console.log(`[v${version}] setup: FAIL - ${message}`);
	} finally {
		child.stdin.end();
		const exited = await Promise.race([child.exited.then(() => true), Bun.sleep(5_000).then(() => false)]);
		if (!exited) child.kill();
		await Promise.race([reading, Bun.sleep(2_000)]);
		await log.end();
		server.stop(true);
		console.log(`[v${version}] frames: ${framesPath}; stderr: ${stderrPath}; work dir: ${work}`);
	}
	return results;
}

const all: ResultEntry[] = [];
for (const version of [1, 2] as const) all.push(...(await runVersion(version)));
await Bun.write(path.join(HERE, "f1-results.json"), `${JSON.stringify(all, null, 2)}\n`);
const failed = all.filter(r => !r.pass);
console.log(`${all.length - failed.length}/${all.length} passed`);
process.exit(failed.length ? 1 : 0);
