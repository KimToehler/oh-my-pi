// usage: node mk-synth.mjs <out.jsonl> <model-full e.g. onara/cc/claude-opus-5> <thinking> <cwd> <reply.md>
import { readFileSync, writeFileSync } from "node:fs";
const [out, full, level, cwd, replyPath] = process.argv.slice(2);
const [provider, ...rest] = full.split("/");
const model = rest.join("/");
const api = model.startsWith("cc/") ? "anthropic-messages" : "openai-responses";
const reply = readFileSync(replyPath, "utf8");
const ts = new Date().toISOString();
const id = () => Math.random().toString(16).slice(2, 10);
const ids = [id(), id(), id(), id(), id()];
const lines = [
  { type: "session", version: 3, id: "synthetic-" + id(), timestamp: ts, cwd },
  { type: "model_change", id: ids[0], parentId: null, timestamp: ts, model: full, resolvedModelIsFallback: false },
  { type: "thinking_level_change", id: ids[1], parentId: ids[0], timestamp: ts, thinkingLevel: level, configured: null },
  { type: "message", id: ids[2], parentId: ids[1], timestamp: ts, message: { role: "user", content: [{ type: "text", text: "SYNTHETIC QA payload: implementation-audit brief (verbatim brief is in the session's brief file)" }] } },
  { type: "message", id: ids[3], parentId: ids[2], timestamp: ts, message: { role: "assistant", api, provider, model, stopReason: "stop", content: [{ type: "text", text: reply }], timestamp: Date.now() } },
];
writeFileSync(out, lines.map(l => JSON.stringify(l)).join("\n") + "\n");
