/** Tool/skill/rule/agent evidence read from structural fields of a `tool_execution_start` event. */
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";

function readSignalPath(signals: Set<string>, pathArg: unknown): void {
	if (typeof pathArg !== "string") return;
	for (const scheme of ["skill", "rule"] as const) {
		const prefix = `${scheme}://`;
		if (!pathArg.startsWith(prefix)) continue;
		const name = pathArg.slice(prefix.length).split(/[/?#]/, 1)[0];
		if (name) signals.add(`${scheme}:${name}`);
	}
}

function taskAgentSignals(signals: Set<string>, args: Record<string, unknown>): void {
	const agents: unknown[] = [args.agent];
	if (Array.isArray(args.tasks)) for (const item of args.tasks) agents.push(isRecord(item) ? item.agent : undefined);
	for (const agent of agents) if (typeof agent === "string" && agent) signals.add(`agent:${agent}`);
}

export function recordToolSignals(signals: Set<string>, event: Record<string, unknown>): void {
	if (typeof event.toolName !== "string" || !event.toolName) return;
	signals.add(`tool:${event.toolName}`);
	const args = isRecord(event.args) ? event.args : undefined;
	if (!args) return;
	if (event.toolName === "read") readSignalPath(signals, args.path);
	else if (event.toolName === "task") taskAgentSignals(signals, args);
}
