/** Credential scanning of bytes that are about to be persisted: variant genome files, source patches, models text. */
import * as fs from "node:fs";
import { containsHostValue, credentialValuesFromEnv } from "../launch-args";
import { EvoHttpError } from "./boundary";
import type { ConfigFile } from "./config-snapshot";
import type { EvoLaunchDefaults } from "./launch";
import { referencedEnvNamesFromText } from "./models-yaml";

const decoder = new TextDecoder();

/** Same length-aware rule as `containsHostValue`, applied per line so a short value is only caught as a whole token. */
function textCarriesSecret(text: string, secrets: readonly string[]): boolean {
	return secrets.some(secret =>
		secret.length >= 8
			? text.includes(secret)
			: text.split(/\r?\n/).some(line => containsHostValue(line.trim(), secret)),
	);
}

/**
 * Throw 422 when any genome file path (checked per component), file body, or the source patch carries a host
 * credential value. Messages name the file (or "source patch") only, never the matched value. Call before
 * anything is written.
 */
export function assertGenomeClean(files: readonly ConfigFile[], sourcePatch: string, values: readonly string[]): void {
	const secrets = values.filter(value => value.length > 0);
	if (secrets.length === 0) return;
	for (const file of files) {
		if (textCarriesSecret(file.rel, secrets) || file.rel.split("/").some(part => textCarriesSecret(part, secrets))) {
			const shown = secrets.reduce((rel, secret) => rel.split(secret).join("***"), file.rel);
			throw new EvoHttpError(
				422,
				`config file path ${shown} embeds a host credential value; rename it (the value must not appear in a filename)`,
			);
		}
		if (textCarriesSecret(decoder.decode(file.bytes), secrets)) {
			throw new EvoHttpError(
				422,
				`config file ${file.rel} embeds a host credential value; reference the env var name instead`,
			);
		}
	}
	if (textCarriesSecret(sourcePatch, secrets)) {
		throw new EvoHttpError(422, "source patch embeds a host credential value; reference the env var name instead");
	}
}

/** Throw 422 when the generated `diff.patch` text (which replays parent context and paths) carries a host credential value. */
export function assertDiffClean(diffText: string, values: readonly string[]): void {
	const secrets = values.filter(value => value.length > 0);
	if (secrets.length > 0 && textCarriesSecret(diffText, secrets)) {
		throw new EvoHttpError(
			422,
			"generated diff embeds a host credential value (likely from the parent snapshot); register a parent without it",
		);
	}
}

/**
 * Values the runner must scan models.yml against: host values of the referenced credential names plus every
 * value forwarded explicitly through `--env` (`cfg.env`), mirroring what the overlay later scans.
 */
export function modelsScanValues(
	credentialNames: readonly string[],
	cfgEnv: Record<string, string>,
	hostEnv: Record<string, string | undefined>,
): string[] {
	return [...new Set([...credentialValuesFromEnv(credentialNames, hostEnv), ...Object.values(cfgEnv)])];
}

/**
 * Host credential values a registered variant must never embed. The server knows the launch defaults, so this is
 * the exact set `buildEvalLaunch` forwards into containers: names referenced by the fixed models.yml (when
 * readable now; an unreadable file contributes none because launch will refuse it anyway) united with the
 * explicit `OMP_EVO_FORWARD_ENV` list. Unset variables contribute no value.
 */
export function forwardedSecretValues(defaults: EvoLaunchDefaults): string[] {
	let modelsText: string | null = null;
	try {
		modelsText = fs.readFileSync(defaults.modelsYaml, "utf8");
	} catch {}
	let names: string[];
	try {
		names = [
			...new Set([
				...(modelsText === null ? [] : referencedEnvNamesFromText(modelsText)),
				...(defaults.forwardEnv ?? []),
			]),
		];
	} catch {
		// An invalid models.yml fails launch later; scan the explicit list so registration still protects what it can.
		names = [...(defaults.forwardEnv ?? [])];
	}
	return credentialValuesFromEnv(names, process.env);
}
