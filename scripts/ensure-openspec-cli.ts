#!/usr/bin/env bun
/**
 * Check that the OpenSpec CLI on PATH is the version pinned in `team-config/openspec-version`, then
 * persist `telemetry.enabled false` in the global OpenSpec config of this environment.
 *
 * Every `openspec` call runs with `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`, so the check itself never
 * sends an event. The variables only gate sending: `openspec config get` still reports the persisted
 * value with them set, so the read-back proves the setting outlives this process. The opt-out covers
 * the config file OpenSpec reads here (printed below); a different `XDG_CONFIG_HOME` reads another one.
 *
 * Exit 1 with the install command when the CLI is missing or differs from the pin.
 *
 * Usage: bun scripts/ensure-openspec-cli.ts   (scripts/deploy-local.sh runs it before building)
 */
import * as path from "node:path";
import { $ } from "bun";

const PIN_FILE = path.join(import.meta.dir, "..", "team-config", "openspec-version");
const OPT_OUT = { DO_NOT_TRACK: "1", OPENSPEC_TELEMETRY: "0" };

const pin = (await Bun.file(PIN_FILE).text()).trim();
const install = `npm install -g @fission-ai/openspec@${pin}`;

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

async function openspec(...args: string[]): Promise<string> {
	const result = await $`openspec ${args}`
		.env({ ...process.env, ...OPT_OUT })
		.quiet()
		.nothrow();
	if (result.exitCode !== 0) {
		fail(`openspec ${args.join(" ")} failed (exit ${result.exitCode}): ${result.stderr.toString().trim()}`);
	}
	return result.stdout.toString().trim();
}

if (!Bun.which("openspec")) fail(`OpenSpec CLI not found on PATH. Install the pinned version:\n  ${install}`);

const version = await openspec("--version");
if (version !== pin)
	fail(`OpenSpec CLI is ${version}, the team pins ${pin}. Install the pinned version:\n  ${install}`);

await openspec("config", "set", "telemetry.enabled", "false");
const persisted = await openspec("config", "get", "telemetry.enabled");
if (persisted !== "false")
	fail(`openspec config get telemetry.enabled printed "${persisted}" after setting it to false`);

const configPath = await openspec("config", "path");
console.log(`OpenSpec ${version}; telemetry disabled in ${configPath}`);
