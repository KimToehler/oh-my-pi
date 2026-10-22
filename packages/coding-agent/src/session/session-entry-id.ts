import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

/**
 * Carrier for the session entry id a message was persisted under. A symbol key
 * keeps it out of JSONL and provider payloads; it is stamped non-enumerable so it
 * never shows in structural equality or object spreads of the message.
 */
export const kPersistedSessionEntryId = Symbol("persistedSessionEntryId");

type EntryIdCarrier = { [kPersistedSessionEntryId]?: string };

export function stampSessionEntryId(message: AgentMessage, entryId: string): void {
	Object.defineProperty(message, kPersistedSessionEntryId, {
		value: entryId,
		enumerable: false,
		writable: true,
		configurable: true,
	});
}

/** Session entry id this message was persisted under (live append or reload), if any. */
export function sessionEntryIdOf(message: AgentMessage): string | undefined {
	return (message as EntryIdCarrier)[kPersistedSessionEntryId];
}
