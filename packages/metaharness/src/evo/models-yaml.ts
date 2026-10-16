/** Single parser/validator for the fixed evo `models.yml`: apiKey may only name an environment variable. */
import * as fs from "node:fs";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { EvoHttpError } from "./boundary";

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function fail(detail: string): EvoHttpError {
	return new EvoHttpError(422, `models.yml ${detail}`);
}

/** Why a URL string may not appear in models.yml, or undefined when acceptable. A base URL legitimately has none of these. */
function urlCredentialPlacement(value: string): string | undefined {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	if (url.username !== "" || url.password !== "") return "embed credentials in the URL userinfo";
	if (url.search !== "") return "carry a query string (literal credentials are not allowed)";
	if (url.hash !== "") return "carry a fragment (literal credentials are not allowed)";
	return undefined;
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
		if (key === "headers" && isRecord(value)) {
			for (const [header, headerValue] of Object.entries(value)) {
				if (typeof headerValue !== "string" || !ENV_NAME.test(headerValue)) {
					throw fail(
						`${here}.${header} must be an environment variable name (literal credentials are not allowed)`,
					);
				}
				names.add(headerValue);
			}
			continue;
		}
		if ((key === "baseUrl" || key === "url") && typeof value === "string") {
			const problem = urlCredentialPlacement(value);
			if (problem) throw fail(`${here} must not ${problem}`);
			continue;
		}
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

/** Synchronously read and validate a models file for launch-time request validation. */
export function readModelsEnvNamesSync(file: string): string[] {
	let text: string;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		throw new EvoHttpError(422, `models file not found: ${file}`);
	}
	return referencedEnvNamesFromText(text);
}
