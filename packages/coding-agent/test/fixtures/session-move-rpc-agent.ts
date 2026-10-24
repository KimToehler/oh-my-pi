import * as path from "node:path";
import { Agent, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { ToolCall } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { runRpcMode } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { Type } from "@sinclair/typebox";

// Real RPC dispatch over a persisted session; only model replies are scripted. A stand-in `session_move` tool
// records the move request and stops the batch exactly as the real tool does. argv: <temp root> <move target>.
const root = process.argv[2];
const target = process.argv[3];
if (!root || !target) throw new Error("session-move-rpc-agent: expected <temp root> <move target>");
process.chdir(root);
const cwd = process.cwd();
const authStorage = await AuthStorage.create(path.join(cwd, "auth.db"));
authStorage.keys.setRuntime("anthropic", "test-key");
const modelRegistry = new ModelRegistry(authStorage, path.join(cwd, "models.yml"));
const moveCall: ToolCall = { type: "toolCall", id: "move-1", name: "session_move", arguments: {} };
let calls = 0;
const mock = createMockModel({
	handler: () => (calls++ === 0 ? { content: [moveCall] } : { content: ["continued after the move"] }),
});
const sessionMove: AgentTool = {
	name: "session_move",
	label: "session_move",
	description: "move",
	parameters: Type.Object({}),
	async execute() {
		const requested = session.requestSessionMove({ path: target });
		return { content: [{ type: "text", text: requested ? "scheduled" : "no relocator" }], stopAfterBatch: true };
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
