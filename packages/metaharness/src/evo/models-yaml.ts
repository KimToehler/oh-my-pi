/** Single parser/validator for the fixed evo `models.yml`: apiKey may only name an environment variable. */
import * as fs from "node:fs";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { containsHostValue } from "../launch-args";
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
		// Relative reference: resolve against a fixed dummy base so query/fragment still get checked.
		try {
			url = new URL(value, "https://models.invalid/");
		} catch {
			return undefined;
		}
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

/** Strip quotes and sentence/YAML punctuation from both ends of a raw-text token. */
function stripQuotesAndPunctuation(token: string): string {
	return token.replace(/^[\s"'`,;:.()[\]{}<>]+|[\s"'`,;:.()[\]{}<>]+$/g, "");
}

/**
 * Reject models.yml text whose scalar leaf carries one of the host credential `values` (length-aware match shared with
 * launch-args). `apiKey` and `headers` values are env names already validated by `collect`; header names are scanned. Messages name the dotted
 * path only, never the value.
 */
export function assertNoHostCredentialValues(text: string, values: readonly string[]): void {
	const secrets = values.filter(value => value.length > 0);
	if (secrets.length === 0) return;
	let parsed: unknown;
	try {
		parsed = Bun.YAML.parse(text);
	} catch {
		throw fail("is not valid YAML");
	}
	const walk = (node: unknown, where: string): void => {
		if (Array.isArray(node)) {
			node.forEach((item, i) => walk(item, `${where}[${i}]`));
			return;
		}
		if (isRecord(node)) {
			for (const [key, value] of Object.entries(node)) {
				const here = where ? `${where}.${key}` : key;
				if (secrets.some(secret => containsHostValue(key, secret))) {
					throw fail(
						`${where ? `${where}.` : ""}<key> embeds a host credential value; reference the env var name instead`,
					);
				}
				if (key === "apiKey") continue;
				if (key === "headers" && isRecord(value)) {
					// Header values are env names proven by `collect`; header names are free text and must be scanned.
					for (const header of Object.keys(value)) {
						if (secrets.some(secret => containsHostValue(header, secret))) {
							throw fail(`${here}.<key> embeds a host credential value; reference the env var name instead`);
						}
					}
					continue;
				}
				walk(value, here);
			}
			return;
		}
		if (node === null || node === undefined) return;
		const scalar = typeof node === "string" ? node : String(node);
		if (secrets.some(secret => containsHostValue(scalar, secret))) {
			throw fail(`${where} embeds a host credential value; reference the env var name instead`);
		}
	};
	walk(parsed, "");
	// Callers copy the ORIGINAL text, so comments, directives and any other non-structural text must be scanned too.
	// Short values only match a whole node, so also test each line and each whitespace-delimited token.
	for (const line of text.split(/\r?\n/)) {
		const nodes = [line, line.trim()];
		for (const token of line.split(/\s+/)) {
			nodes.push(token, stripQuotesAndPunctuation(token));
			// `key="value"`, `"value":` and `key=[value]` forms: test each assignment/mapping side on its own.
			for (const part of token.split(/[=:]/)) nodes.push(stripQuotesAndPunctuation(part));
		}
		if (secrets.some(secret => nodes.some(node => node.length > 0 && containsHostValue(node, secret)))) {
			throw fail(
				"embeds a host credential value outside the parsed structure (comment or other raw text); remove it",
			);
		}
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
