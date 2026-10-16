/** Pure normalization of an omp `--mode json` transcript into viewer entries. */
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";

export type TraceEntry = Record<string, unknown>;

function textOf(content: unknown[]): string {
	return content
		.filter(isRecord)
		.filter(block => block.type === "text")
		.map(block => String(block.text ?? ""))
		.join("\n");
}

/** Turn transcript text (JSONL events mixed with stderr lines) into normalized entries, oldest first. */
export function normalizeOmpTranscript(lines: readonly string[]): TraceEntry[] {
	const entries: TraceEntry[] = [];
	for (const line of lines) {
		let event: unknown;
		try {
			event = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isRecord(event)) continue;
		if (event.type === "message_end") {
			const message = event.message;
			if (!isRecord(message)) continue;
			const content = Array.isArray(message.content) ? message.content : [];
			const body = textOf(content);
			if (message.role === "assistant") {
				const tools = content
					.filter(isRecord)
					.filter(block => block.type === "toolCall")
					.map(block => String(block.name ?? "?"));
				entries.push({ kind: "assistant", model: message.model ?? "", text: body, tools });
			} else if (message.role === "toolResult") {
				entries.push({
					kind: "toolResult",
					tool: message.toolName ?? "?",
					isError: message.isError === true,
					text: body.length > 1600 ? `${body.slice(0, 1600)}…` : body,
				});
			}
		} else if (event.type === "notice") {
			entries.push({ kind: "notice", text: event.message ?? "" });
		}
	}
	return entries;
}
