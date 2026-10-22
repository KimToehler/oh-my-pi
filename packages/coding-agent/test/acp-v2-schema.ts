import { validateJsonSchemaValue } from "@oh-my-pi/pi-ai/utils/schema";
import schema from "./fixtures/acp-v2-schema.json";

interface SchemaDefinition {
	"x-method"?: string;
}

const definitions = (schema as { $defs: Record<string, SchemaDefinition> }).$defs;
/**
 * `SessionUpdate` is an open union: any other `sessionUpdate` string validates as the `other` branch. The mapper
 * must only emit the known variants, so the helper additionally rejects discriminators outside the known set.
 */
function knownSessionUpdateKinds(): Set<string> {
	const union = (
		definitions.SessionUpdate as { anyOf?: Array<{ properties?: { sessionUpdate?: { const?: string } } }> }
	).anyOf;
	const kinds = new Set<string>();
	for (const branch of union ?? []) {
		const kind = branch.properties?.sessionUpdate?.const;
		if (kind) kinds.add(kind);
	}
	return kinds;
}

const KNOWN_SESSION_UPDATE_KINDS = knownSessionUpdateKinds();
const DEFINITION_SUFFIX = { notification: "Notification", response: "Response", request: "Request" } as const;

/**
 * Validate a v2 wire value against the vendored schema's definition for `method`.
 * Returns human-readable issues; an empty array means the value is valid.
 */
export function validateAcpV2Frame(
	kind: "notification" | "response" | "request",
	method: string,
	value: unknown,
): string[] {
	const suffix = DEFINITION_SUFFIX[kind];
	const entry = Object.entries(definitions).find(([name, def]) => def["x-method"] === method && name.endsWith(suffix));
	if (!entry) return [`no ${kind} definition for method ${method}`];
	const result = validateJsonSchemaValue(entry[1], value, schema);
	const issues = result.issues.map(issue => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
	if (method === "session/update" && typeof value === "object" && value !== null) {
		const update = (value as { update?: { sessionUpdate?: unknown } }).update;
		const kind = update?.sessionUpdate;
		if (typeof kind === "string" && !KNOWN_SESSION_UPDATE_KINDS.has(kind)) {
			issues.push(`update.sessionUpdate: "${kind}" is not a known v2 session update`);
		}
	}
	return issues;
}
