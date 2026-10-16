/** Single parser/validator for the fixed evo `models.yml`: apiKey may only name an environment variable. */
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { EvoHttpError } from "./boundary";

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function fail(detail: string): EvoHttpError {
	return new EvoHttpError(422, `models.yml ${detail}`);
}

/** Walk `node`, collecting env names from every `apiKey`; messages never echo the offending value. */
function collect(node: unknown, where: string, names: Set<string>): void {
	if (Array.isArray(node)) {
		node.forEach((item, i) => collect(item, `${where}[${i}]`, names));
		return;
	}
	if (!isRecord(node)) return;
	for (const [key, value] of Object.entries(node)) {
		const here = where ? `${where}.${key}` : key;
		if (key !== "apiKey") {
			collect(value, here, names);
			continue;
		}
		if (value === undefined || value === null) continue;
		if (typeof value !== "string" || !ENV_NAME.test(value)) {
			throw fail(`${here} must be an environment variable name (literal keys, commands and URLs are not allowed)`);
		}
		names.add(value);
	}
}

/** Parse models.yml text and return the sorted env var names its apiKeys reference. */
export function referencedEnvNamesFromText(text: string): string[] {
	let parsed: unknown;
	try {
		parsed = Bun.YAML.parse(text);
	} catch {
		throw fail("is not valid YAML");
	}
	const names = new Set<string>();
	collect(parsed, "", names);
	return [...names].sort();
}

/** Read and validate a models file; 422 when missing, malformed, or carrying a non-env-name apiKey. */
export async function readModelsEnvNames(file: string): Promise<string[]> {
	const handle = Bun.file(file);
	if (!(await handle.exists())) throw new EvoHttpError(422, `models file not found: ${file}`);
	return referencedEnvNamesFromText(await handle.text());
}
