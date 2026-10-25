import * as fs from "node:fs";
import * as path from "node:path";
import { spyOn } from "bun:test";
import { Agent, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolCall } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import * as headlessRelocation from "@oh-my-pi/pi-coding-agent/session/headless-relocation";
import { runRpcMode } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { Type } from "@sinclair/typebox";

// Real RPC dispatch over a persisted session; only model replies are scripted. A stand-in `session_move` tool
// records the move request and stops the batch exactly as the real tool does.
// argv: <temp root> <move target> [<"fatal"> <request log>]. "fatal" forces the shared headless relocation to
// report a fatal rollback failure; the log gets one `request` line per provider request and `exit` at process exit.
const root = process.argv[2];
const target = process.argv[3];
if (!root || !target) throw new Error("session-move-rpc-agent: expected <temp root> <move target>");
process.chdir(root);
const cwd = process.cwd();
const authStorage = await AuthStorage.create(path.join(cwd, "auth.db"));
authStorage.keys.setRuntime("anthropic", "test-key");
const modelRegistry = new ModelRegistry(authStorage, path.join(cwd, "models.yml"));
const moveCall: ToolCall = { type: "toolCall", id: "move-1", name: "session_move", arguments: {} };
const fatal = process.argv[4] === "fatal";
const requestLog = process.argv[5];
if (requestLog) process.on("exit", () => fs.appendFileSync(requestLog, "exit\n"));
if (fatal) {
	spyOn(headlessRelocation, "relocateHeadlessSession").mockResolvedValue({
		ok: false,
		fatal: true,
		reason: "rollback failed (forced)",
	});
}
let calls = 0;
const mock = createMockModel({
	handler: () => {
		if (requestLog) fs.appendFileSync(requestLog, "request\n");
		return calls++ === 0 ? { content: [moveCall] } : { content: ["continued after the move"] };
	},
});
const sessionMove: AgentTool = {
	name: "session_move",
	label: "session_move",
	description: "move",
	parameters: Type.Object({}),
	async execute() {
		const requested = session.reserveSessionMove()?.commit({ path: target }) ?? false;
		return { content: [{ type: "text", text: requested ? "scheduled" : "no relocator" }] };
	},
};
const session: AgentSession = new AgentSession({
	agent: new Agent({
		getApiKey: () => "test-key",
		initialState: {
			model: getBundledModel("anthropic", "claude-sonnet-4-5")!,
			systemPrompt: ["Test"],
			tools: [sessionMove],
		},
		streamFn: mock.stream,
		convertToLlm,
	}),
	sessionManager: SessionManager.create(cwd, path.join(cwd, "sessions")),
	settings: Settings.isolated({ "compaction.enabled": false, "retry.enabled": false }),
	modelRegistry,
	toolRegistry: new Map([[sessionMove.name, sessionMove]]),
});
await runRpcMode(session);
