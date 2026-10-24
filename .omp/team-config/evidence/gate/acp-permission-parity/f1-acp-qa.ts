#!/usr/bin/env bun
/**
 * F1 manual QA for the OpenSpec change `acp-permission-parity` (tasks.md 5.3).
 *
 * `--run` drives the real `omp acp` server (source CLI of this worktree) over stdio
 * against a scripted local model, no real model and no real credential, and logs
 * every JSON-RPC frame to `f1-frames.jsonl`. `--check <frames>` decides each
 * scenario from the logged frames alone and writes `f1-qa.md`.
 *
 * Scenarios (marker in the prompt text selects the fixture model's script):
 *   a  `eval` asks the client before it runs and completes after allow_once
 *   b  `bash` rejected with reject_always; a spawned `task` child is denied `bash` without a request
 *   c  a client without form elicitation gets the `bash` request and the call completes
 *   d  a `task` child reads the client's unsaved buffer through `fs/read_text_file`
 *   e  an `edit` delete offers only allow_once/reject_once; reject_once keeps the file
 *   f  a `_session/steering` message sent while the `bash` request is open supersedes it: the agent
 *      withdraws the request (`$/cancel_request`), the call fails as superseded without running, and
 *      the model's next request carries the steer
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils";
import { $ } from "bun";

const HERE = import.meta.dir;
const FRAMES_DEFAULT = path.join(HERE, "f1-frames.jsonl");
const QA_MD = path.join(HERE, "f1-qa.md");
const SCENARIOS = ["a", "b", "c", "d", "e", "f"] as const;
type Scenario = (typeof SCENARIOS)[number];
const SCENARIO_TIMEOUT_MS = 120_000;
const SENTINEL = "UNSAVED-SENTINEL";
const STEER_TEXT = "QA-f-steer: explain the command first";

type Json = Record<string, unknown>;
interface Frame {
	dir: "agent->client" | "client->agent" | "qa";
	msg: Json;
}

async function gitHead(): Promise<string> {
	return (await $`git rev-parse HEAD`.cwd(HERE).quiet().text()).trim();
}

async function worktreeRoot(): Promise<string> {
	return (await $`git rev-parse --show-toplevel`.cwd(HERE).quiet().text()).trim();
}

// ---------------------------------------------------------------------------
// Scripted fixture model (OpenAI chat-completions, SSE)
// ---------------------------------------------------------------------------

interface Step {
	name: string;
	args: Json;
}

const SCRIPTS: Record<string, Step[]> = {
	a: [{ name: "eval", args: { language: "py", code: "print(1)" } }],
	b: [
		{ name: "bash", args: { command: "echo b1" } },
		{ name: "task", args: { agent: "task", task: "[QA-b-child] run echo b2", solutionSpace: "One bash call." } },
	],
	"b-child": [{ name: "bash", args: { command: "echo b2" } }],
	c: [{ name: "bash", args: { command: "echo c" } }],
	d: [{ name: "task", args: { agent: "task", task: "[QA-d-child] read buffer.txt", solutionSpace: "One read call." } }],
	"d-child": [{ name: "read", args: { path: "buffer.txt" } }],
	e: [{ name: "edit", args: { input: "*** Begin Patch\n[doomed.txt#0000]\nREM\n*** End Patch" } }],
	f: [{ name: "bash", args: { command: "echo f > steered.txt" } }],
};

function messageText(message: Json): string {
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map(part => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
		.join("\n");
}

function scriptKey(messages: Json[]): string | undefined {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "user") continue;
		const match = /\[QA-([a-f](?:-child)?)\]/.exec(messageText(message));
		if (match) return match[1];
	}
	return undefined;
}

function sse(model: string, delta: Json, finishReason: string): Response {
	const chunk = { id: "fixture", object: "chat.completion.chunk", model, created: 1 };
	const body =
		`data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n` +
		`data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n` +
		"data: [DONE]\n\n";
	return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

function textReply(model: string, text: string): Response {
	return sse(model, { role: "assistant", content: text }, "stop");
}

function toolReply(model: string, id: string, name: string, args: Json): Response {
	return sse(
		model,
		{
			role: "assistant",
			tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
		},
		"tool_calls",
	);
}

function startFixtureModel(): ReturnType<typeof Bun.serve> {
	return Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			if (request.method === "GET") {
				return Response.json({ object: "list", data: [{ id: "main" }, { id: "tiny" }] });
			}
			const body = (await request.json()) as { model: string; messages?: Json[]; tools?: Json[] };
			if (body.model === "tiny") return textReply(body.model, "fixture title");
			const messages = body.messages ?? [];
			const key = scriptKey(messages);
			if (!key) return textReply(body.model, "fixture: no scenario");
			const steps = SCRIPTS[key] ?? [];
			const toolResults = messages.filter(message => message.role === "tool");
			const index = toolResults.length;
			if (index < steps.length) {
				const step = steps[index];
				return toolReply(body.model, `call_${key}_${index}`, step.name, step.args);
			}
			const last = toolResults.at(-1);
			const report = `done ${key}${last ? `: ${messageText(last)}` : ""}`;
			const offersYield = (body.tools ?? []).some(
				tool => isRecord(tool) && isRecord(tool.function) && tool.function.name === "yield",
			);
			// A subagent finishes through `yield`; its data becomes the `task` result the client sees.
			if (key.endsWith("-child") && offersYield && index === steps.length) {
				return toolReply(body.model, `call_${key}_yield`, "yield", { data: report });
			}
			const sawSteer = messages.some(message => message.role === "user" && messageText(message).includes(STEER_TEXT));
			return textReply(body.model, key.endsWith("-child") ? report : `done ${key}${sawSteer ? " saw-steer" : ""}`);
		},
	});
}

// ---------------------------------------------------------------------------
// --run
// ---------------------------------------------------------------------------

/** Client answer per tool call id; every other permission request gets allow_once. */
const ANSWERS: Record<string, string> = { call_b_0: "reject_always", call_e_0: "reject_once" };

function isolatedEnv(agentDir: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (/^(PI_|OMP_)/.test(key)) continue;
		// No real credential may reach the QA run (user decision, 2026-10-24).
		if (/(API_KEY|_TOKEN|_SECRET|_KEY)$/.test(key)) continue;
		env[key] = value;
	}
	env.PI_CODING_AGENT_DIR = agentDir;
	return env;
}

async function run(): Promise<void> {
	const root = await worktreeRoot();
	const work = await fs.mkdtemp(path.join(os.tmpdir(), "omp-f1-acp-qa-"));
	const workspace = path.join(work, "workspace");
	const agentDir = path.join(work, "agent");
	const stderrPath = path.join(work, "acp-stderr.log");
	const server = startFixtureModel();
	await fs.rm(FRAMES_DEFAULT, { force: true });
	const log = Bun.file(FRAMES_DEFAULT).writer();
	const record = (frame: Frame) => {
		log.write(`${JSON.stringify(frame)}\n`);
		log.flush();
	};
	record({ dir: "qa", msg: { method: "qa/head", params: { head: await gitHead() } } });

	await Bun.write(path.join(workspace, "doomed.txt"), "doomed\n");
	await Bun.write(path.join(workspace, "buffer.txt"), "DISK\n");
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
			"modelRoles:",
			...chatRoles.map(role => `  ${role}: fixture/main`),
			"  tiny: fixture/tiny",
			"  memory: fixture/tiny",
			"",
		].join("\n"),
	);

	const child = Bun.spawn(["bun", "packages/coding-agent/src/cli.ts", "acp"], {
		cwd: root,
		env: isolatedEnv(agentDir),
		stdin: "pipe",
		stdout: "pipe",
		stderr: Bun.file(stderrPath),
	});

	let nextId = 1;
	const pending = new Map<number, PromiseWithResolvers<Json>>();
	const send = (msg: Json) => {
		record({ dir: "client->agent", msg });
		child.stdin.write(`${JSON.stringify(msg)}\n`);
		child.stdin.flush();
	};
	const request = (method: string, params: Json): Promise<Json> => {
		const id = nextId++;
		const waiter = Promise.withResolvers<Json>();
		pending.set(id, waiter);
		send({ jsonrpc: "2.0", id, method, params });
		return waiter.promise;
	};

	const answerAgentRequest = async (msg: Json): Promise<void> => {
		const params = isRecord(msg.params) ? msg.params : {};
		const reply = (result: unknown) => send({ jsonrpc: "2.0", id: msg.id, result });
		switch (msg.method) {
			case "session/request_permission": {
				const toolCall = isRecord(params.toolCall) ? params.toolCall : {};
				// Scenario f: leave the request open and steer the running turn instead.
				if (toolCall.toolCallId === "call_f_0") {
					void request("_session/steering", {
						sessionId: params.sessionId,
						prompt: [{ type: "text", text: STEER_TEXT }],
					}).then(
						result => record({ dir: "qa", msg: { method: "qa/steer_result", params: result } }),
						error => record({ dir: "qa", msg: { method: "qa/steer_result", params: { error: String(error) } } }),
					);
					return;
				}
				const optionId = ANSWERS[String(toolCall.toolCallId)] ?? "allow_once";
				reply({ outcome: { outcome: "selected", optionId } });
				return;
			}
			case "fs/read_text_file": {
				const file = String(params.path);
				if (path.basename(file) === "buffer.txt") {
					reply({ content: SENTINEL });
					return;
				}
				reply({ content: await Bun.file(file).text() });
				return;
			}
			case "fs/write_text_file": {
				await Bun.write(String(params.path), String(params.content));
				reply(null);
				return;
			}
			default:
				send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `unsupported: ${String(msg.method)}` } });
		}
	};

	const reading = (async () => {
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
			buffer += decoder.decode(chunk, { stream: true });
			let newline = buffer.indexOf("\n");
			while (newline >= 0) {
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				newline = buffer.indexOf("\n");
				if (!line) continue;
				let msg: Json;
				try {
					msg = JSON.parse(line) as Json;
				} catch {
					record({ dir: "qa", msg: { method: "qa/stdout_noise", params: { line } } });
					continue;
				}
				record({ dir: "agent->client", msg });
				if ("id" in msg && typeof msg.method === "string") {
					void answerAgentRequest(msg);
				} else if ("id" in msg && typeof msg.id === "number") {
					const waiter = pending.get(msg.id);
					pending.delete(msg.id);
					if (msg.error) waiter?.reject(new Error(JSON.stringify(msg.error)));
					else waiter?.resolve(isRecord(msg.result) ? msg.result : {});
				}
			}
		}
	})();

	const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
		const timer = Bun.sleep(SCENARIO_TIMEOUT_MS).then(() => {
			throw new Error(`timeout: ${label}`);
		});
		return Promise.race([promise, timer]);
	};

	let failed = false;
	try {
		await withTimeout(
			request("initialize", {
				protocolVersion: 1,
				clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
				clientInfo: { name: "f1-acp-qa", version: "1" },
			}),
			"initialize",
		);
		for (const scenario of SCENARIOS) {
			try {
				const created = await withTimeout(
					request("session/new", { cwd: workspace, mcpServers: [] }),
					`session/new ${scenario}`,
				);
				const sessionId = String(created.sessionId);
				record({ dir: "qa", msg: { method: "qa/scenario", params: { scenario, sessionId } } });
				await withTimeout(
					request("session/prompt", { sessionId, prompt: [{ type: "text", text: `[QA-${scenario}]` }] }),
					`session/prompt ${scenario}`,
				);
			} catch (error) {
				failed = true;
				record({ dir: "qa", msg: { method: "qa/error", params: { scenario, error: String(error) } } });
			}
			if (scenario === "e") {
				const exists = await Bun.file(path.join(workspace, "doomed.txt")).exists();
				record({ dir: "qa", msg: { method: "qa/file_exists", params: { path: "doomed.txt", exists } } });
			}
			if (scenario === "f") {
				const exists = await Bun.file(path.join(workspace, "steered.txt")).exists();
				record({ dir: "qa", msg: { method: "qa/file_exists", params: { path: "steered.txt", exists } } });
			}
		}
	} finally {
		child.stdin.end();
		const exited = await Promise.race([child.exited.then(() => true), Bun.sleep(5_000).then(() => false)]);
		if (!exited) child.kill();
		await Promise.race([reading, Bun.sleep(2_000)]);
		await log.end();
		server.stop(true);
		console.log(`frames: ${FRAMES_DEFAULT}`);
		console.log(`acp stderr: ${stderrPath}`);
	}
	if (failed) {
		console.error("one or more scenarios did not finish; see qa/error frames");
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// --check
// ---------------------------------------------------------------------------

interface Indexed {
	index: number;
	frame: Frame;
}

async function check(framesPath: string): Promise<void> {
	const text = await Bun.file(framesPath).text();
	const frames = text
		.split("\n")
		.filter(line => line.trim().length > 0)
		.map((line, index): Indexed => ({ index, frame: JSON.parse(line) as Frame }));
	const qa = (method: string) => frames.filter(entry => entry.frame.dir === "qa" && entry.frame.msg.method === method);
	const params = (entry: Indexed): Json => (isRecord(entry.frame.msg.params) ? entry.frame.msg.params : {});

	const recordedHead = String(params(qa("qa/head")[0] ?? { index: -1, frame: { dir: "qa", msg: {} } }).head ?? "");
	const head = await gitHead();
	const lines: string[] = [`head ${head}`];
	let ok = recordedHead === head;
	if (!ok) lines.push(`FAIL head (frames recorded ${recordedHead || "none"})`);

	const sessionOf = new Map<string, string>();
	for (const entry of qa("qa/scenario")) sessionOf.set(String(params(entry).scenario), String(params(entry).sessionId));

	const agentRequests = (method: string, sessionId: string) =>
		frames.filter(
			entry =>
				entry.frame.dir === "agent->client" &&
				entry.frame.msg.method === method &&
				"id" in entry.frame.msg &&
				params(entry).sessionId === sessionId,
		);
	const answerTo = (requestEntry: Indexed): Indexed | undefined =>
		frames.find(
			entry =>
				entry.frame.dir === "client->agent" &&
				entry.frame.msg.id === requestEntry.frame.msg.id &&
				entry.frame.msg.method === undefined,
		);
	const answeredOption = (requestEntry: Indexed): string | undefined => {
		const answer = answerTo(requestEntry);
		const result = answer && isRecord(answer.frame.msg.result) ? answer.frame.msg.result : undefined;
		const outcome = result && isRecord(result.outcome) ? result.outcome : undefined;
		return outcome && typeof outcome.optionId === "string" ? outcome.optionId : undefined;
	};
	const permissionFor = (sessionId: string, toolCallId: string) =>
		agentRequests("session/request_permission", sessionId).filter(entry => {
			const toolCall = params(entry).toolCall;
			return isRecord(toolCall) && toolCall.toolCallId === toolCallId;
		});
	const updatesFor = (sessionId: string, toolCallId: string) =>
		frames.filter(entry => {
			if (entry.frame.dir !== "agent->client" || entry.frame.msg.method !== "session/update") return false;
			const p = params(entry);
			return p.sessionId === sessionId && isRecord(p.update) && p.update.toolCallId === toolCallId;
		});
	const statusOf = (entry: Indexed): unknown => {
		const update = params(entry).update;
		return isRecord(update) ? update.status : undefined;
	};
	const optionKinds = (entry: Indexed): string[] => {
		const options = params(entry).options;
		return Array.isArray(options)
			? options.map(option => (isRecord(option) ? String(option.kind) : "")).sort()
			: [];
	};

	const verdicts: Record<Scenario, () => string | undefined> = {
		a() {
			const sid = sessionOf.get("a");
			if (!sid) return "no session";
			const [permission] = permissionFor(sid, "call_a_0");
			if (!permission) return "no permission request for the eval call";
			const completed = updatesFor(sid, "call_a_0").filter(entry => statusOf(entry) === "completed");
			if (completed.length === 0) return "eval call never completed";
			if (completed[0].index < permission.index) return "eval completed before its permission request";
			if (answeredOption(permission) !== "allow_once") return "permission not answered allow_once";
			const answer = answerTo(permission);
			if (!answer || completed.at(-1)!.index < answer.index) return "eval did not complete after allow_once";
			return undefined;
		},
		b() {
			const sid = sessionOf.get("b");
			if (!sid) return "no session";
			const bash = permissionFor(sid, "call_b_0");
			if (bash.length !== 1) return `expected one bash permission request, got ${bash.length}`;
			if (answeredOption(bash[0]) !== "reject_always") return "bash request not answered reject_always";
			const all = agentRequests("session/request_permission", sid);
			const others = all.filter(entry => {
				const toolCall = params(entry).toolCall;
				return !isRecord(toolCall) || !["call_b_0", "call_b_1"].includes(String(toolCall.toolCallId));
			});
			if (others.length > 0) return `unexpected permission requests after the denial: ${others.length}`;
			const taskText = JSON.stringify(updatesFor(sid, "call_b_1").map(entry => params(entry).update));
			if (!/denied by user for this session: bash/.test(taskText)) {
				return "task result does not report the child's bash denied";
			}
			return undefined;
		},
		c() {
			const init = frames.find(
				entry => entry.frame.dir === "client->agent" && entry.frame.msg.method === "initialize",
			);
			const caps = init && isRecord(params(init).clientCapabilities) ? params(init).clientCapabilities : undefined;
			if (!isRecord(caps) || "elicitation" in caps) return "initialize advertised elicitation";
			const sid = sessionOf.get("c");
			if (!sid) return "no session";
			const [permission] = permissionFor(sid, "call_c_0");
			if (!permission) return "no bash permission request";
			const completed = updatesFor(sid, "call_c_0").filter(entry => statusOf(entry) === "completed");
			if (completed.length === 0 || completed.at(-1)!.index < permission.index) return "bash did not complete";
			return undefined;
		},
		d() {
			const sid = sessionOf.get("d");
			if (!sid) return "no session";
			const updates = updatesFor(sid, "call_d_0");
			if (updates.length === 0) return "no task tool call";
			// `task` runs async: the call reports `completed` at spawn, and the child's
			// progress and result arrive as later updates for the same toolCallId. The
			// final update carries the child's result.
			const done = updates[updates.length - 1];
			const reads = agentRequests("fs/read_text_file", sid).filter(
				entry => path.basename(String(params(entry).path)) === "buffer.txt",
			);
			const during = reads.filter(entry => entry.index > updates[0].index && entry.index < done.index);
			if (during.length === 0) return "no fs/read_text_file for buffer.txt before the task call's final update";
			if (statusOf(done) !== "completed") return "task call did not complete";
			if (!JSON.stringify(params(done).update).includes(SENTINEL)) return "task result lacks the unsaved content";
			return undefined;
		},
		e() {
			const sid = sessionOf.get("e");
			if (!sid) return "no session";
			const [permission] = permissionFor(sid, "call_e_0");
			if (!permission) return "no edit permission request";
			const kinds = optionKinds(permission);
			if (JSON.stringify(kinds) !== JSON.stringify(["allow_once", "reject_once"])) {
				return `edit request offered ${kinds.join(",")}`;
			}
			if (answeredOption(permission) !== "reject_once") return "edit request not answered reject_once";
			if (!updatesFor(sid, "call_e_0").some(entry => statusOf(entry) === "failed")) return "edit call did not fail";
			const exists = qa("qa/file_exists").find(entry => params(entry).path === "doomed.txt");
			if (!exists || params(exists).exists !== true) return "doomed.txt was deleted";
			return undefined;
		},
		f() {
			const sid = sessionOf.get("f");
			if (!sid) return "no session";
			const [permission] = permissionFor(sid, "call_f_0");
			if (!permission) return "no bash permission request";
			if (answerTo(permission)) return "the client answered the request it meant to leave open";
			const steer = frames.find(
				entry =>
					entry.frame.dir === "client->agent" &&
					entry.frame.msg.method === "_session/steering" &&
					entry.index > permission.index,
			);
			if (!steer) return "no _session/steering sent while the request was open";
			const [steerResult] = qa("qa/steer_result");
			if (!steerResult || params(steerResult).outcome !== "injected") {
				return `steer not injected: ${JSON.stringify(steerResult ? params(steerResult) : null)}`;
			}
			const withdrawn = frames.find(
				entry =>
					entry.frame.dir === "agent->client" &&
					entry.frame.msg.method === "$/cancel_request" &&
					params(entry).requestId === permission.frame.msg.id &&
					entry.index > steer.index,
			);
			if (!withdrawn) return "the agent did not withdraw the open permission request";
			const failed = updatesFor(sid, "call_f_0").filter(entry => statusOf(entry) === "failed");
			if (failed.length === 0) return "bash call did not fail";
			if (!JSON.stringify(params(failed.at(-1)!).update).includes("superseded by user steering")) {
				return "bash call failure does not report the supersede";
			}
			const file = qa("qa/file_exists").find(entry => params(entry).path === "steered.txt");
			if (!file || params(file).exists !== false) return "steered.txt was written: bash ran";
			const sawSteer = frames.some(entry => {
				if (entry.frame.dir !== "agent->client" || entry.frame.msg.method !== "session/update") return false;
				const p = params(entry);
				return p.sessionId === sid && JSON.stringify(p.update).includes("done f saw-steer");
			});
			if (!sawSteer) return "the model's reply after the supersede did not see the steer";
			return undefined;
		},
	};

	for (const scenario of SCENARIOS) {
		const errors = qa("qa/error").filter(entry => params(entry).scenario === scenario);
		const reason = errors.length > 0 ? String(params(errors[0]).error) : verdicts[scenario]();
		if (reason) {
			ok = false;
			lines.push(`FAIL ${scenario} (${reason})`);
		} else {
			lines.push(`PASS ${scenario}`);
		}
	}
	await Bun.write(QA_MD, `${lines.join("\n")}\n`);
	console.log(lines.join("\n"));
	if (!ok) process.exit(1);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "--run") await run();
else if (mode === "--check") await check(path.resolve(arg ?? FRAMES_DEFAULT));
else {
	console.error("usage: bun f1-acp-qa.ts --run | --check <f1-frames.jsonl>");
	process.exit(2);
}
