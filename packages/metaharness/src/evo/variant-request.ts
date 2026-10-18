/** Variant proposal request shape and boundary parsing. */
import {
	badRequest,
	enumValue,
	expectObject,
	optionalString,
	rejectUnknownKeys,
	requiredString,
	stringArray,
} from "./boundary";
import { optionalPlainPath as optionalPath } from "./path-guard";
import { MUTATIONS, type Mutation } from "./variant-types";

const REQUEST_FIELDS = [
	"parentId",
	"mutation",
	"donorVariantId",
	"strategy",
	"directive",
	"expectedSignals",
	"configDir",
	"sourceWorktree",
] as const;
const SIGNAL_PATTERN = /^(tool|skill|rule|agent|mark):\S+$/;

export interface VariantRequest {
	parentId: string | null;
	mutation: Mutation;
	donorVariantId: string | null;
	strategy: string;
	directive: string;
	expectedSignals: string[];
	/** Agent dir to snapshot; omitted children inherit the parent's config. */
	configDir: string | null;
	/** Clean git worktree providing the source genome. */
	sourceWorktree: string | null;
}

export function parseVariantRequest(raw: unknown): VariantRequest {
	const obj = expectObject(raw, "variant");
	rejectUnknownKeys(obj, REQUEST_FIELDS, "variant");
	const mutation = enumValue(obj, "mutation", "variant", MUTATIONS);
	const parentId = optionalString(obj, "parentId", "variant");
	const donorVariantId = optionalString(obj, "donorVariantId", "variant");
	const configDir = optionalPath(obj, "configDir");
	if (mutation === "root") {
		if (parentId) throw badRequest("variant.parentId must be omitted for a root variant");
		if (!configDir) throw badRequest("variant.configDir is required for a root variant");
	} else if (!parentId) throw badRequest(`variant.parentId is required for a ${mutation} variant`);
	if (mutation === "crossover" && !donorVariantId)
		throw badRequest("variant.donorVariantId is required for a crossover variant");
	if (mutation !== "crossover" && donorVariantId)
		throw badRequest("variant.donorVariantId is only valid for a crossover variant");
	const expectedSignals = stringArray(obj, "expectedSignals", "variant") ?? [];
	for (const signal of expectedSignals) {
		if (!SIGNAL_PATTERN.test(signal))
			throw badRequest(
				`variant.expectedSignals entry '${signal}' must look like tool:<name>|skill:<name>|rule:<name>|agent:<name>|mark:<id>`,
			);
	}
	return {
		parentId,
		mutation,
		donorVariantId,
		strategy: obj.strategy === undefined ? "" : requiredString(obj, "strategy", "variant"),
		directive: obj.directive === undefined ? "" : requiredString(obj, "directive", "variant"),
		expectedSignals: [...new Set(expectedSignals)].sort(),
		configDir,
		sourceWorktree: optionalPath(obj, "sourceWorktree"),
	};
}
