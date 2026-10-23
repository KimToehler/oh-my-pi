import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const SCRIPT = path.join(import.meta.dir, "ensure-openspec-cli.ts");
const PIN = (await Bun.file(path.join(import.meta.dir, "..", "team-config", "openspec-version")).text()).trim();
const INSTALL_LINE = `npm install -g @fission-ai/openspec@${PIN}`;

// A fake `openspec` that logs every call (argv plus the two opt-out variables) and keeps
// `telemetry.enabled` in a state file, the way the real CLI persists it in its global config.
const FAKE = `#!/bin/sh
printf '%s|DNT=%s|OT=%s\\n' "$*" "\${DO_NOT_TRACK-unset}" "\${OPENSPEC_TELEMETRY-unset}" >> "$FAKE_DIR/calls.log"
case "$*" in
  --version) echo "$FAKE_VERSION" ;;
  "config set telemetry.enabled false") [ "$FAKE_IGNORE_SET" = 1 ] || echo false > "$FAKE_DIR/telemetry" ;;
  "config get telemetry.enabled") cat "$FAKE_DIR/telemetry" ;;
  "config path") echo "$FAKE_DIR/openspec/config.json" ;;
  *) echo "unexpected: $*" >&2; exit 2 ;;
esac
`;

const dirs: string[] = [];
afterEach(async () => {
	await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

interface Run {
	exitCode: number;
	stdout: string;
	stderr: string;
	calls: string[];
	telemetry: string;
	configPath: string;
}

const PROTECTED = (args: string) => `${args}|DNT=1|OT=0`;

async function run(opts: { version?: string; withFake?: boolean; ignoreSet?: boolean; env?: Record<string, string> } = {}): Promise<Run> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ensure-openspec-"));
	dirs.push(dir);
	const bin = path.join(dir, "bin");
	await fs.mkdir(bin);
	await Bun.write(path.join(dir, "telemetry"), "true\n");
	if (opts.withFake !== false) {
		await Bun.write(path.join(bin, "openspec"), FAKE);
		await fs.chmod(path.join(bin, "openspec"), 0o755);
	}
	const proc = Bun.spawn([process.execPath, SCRIPT], {
		env: {
			PATH: `${bin}:/usr/bin:/bin`,
			HOME: dir,
			FAKE_DIR: dir,
			FAKE_VERSION: opts.version ?? PIN,
			FAKE_IGNORE_SET: opts.ignoreSet ? "1" : "0",
			...opts.env,
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const log = await Bun.file(path.join(dir, "calls.log"))
		.text()
		.catch(() => "");
	return {
		exitCode,
		stdout,
		stderr,
		calls: log.split("\n").filter(Boolean),
		telemetry: (await Bun.file(path.join(dir, "telemetry")).text()).trim(),
		configPath: path.join(dir, "openspec", "config.json"),
	};
}

describe("ensure-openspec-cli", () => {
	test("pinned version: telemetry is persisted off, every call carries both opt-outs, the config path is reported", async () => {
		// A caller that explicitly allows telemetry must not make the check send an event, not even on the read-back.
		const r = await run({ env: { DO_NOT_TRACK: "0", OPENSPEC_TELEMETRY: "1" } });
		expect(r.exitCode).toBe(0);
		expect(r.telemetry).toBe("false");
		expect(r.calls).toEqual([
			PROTECTED("--version"),
			PROTECTED("config set telemetry.enabled false"),
			PROTECTED("config get telemetry.enabled"),
			PROTECTED("config path"),
		]);
		expect(r.stdout).toContain(r.configPath);
	});

	test("a different version stops with the install command and changes nothing", async () => {
		const r = await run({ version: "1.14.2" });
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toContain("1.14.2");
		expect(r.stderr).toContain(INSTALL_LINE);
		expect(r.calls).toEqual([PROTECTED("--version")]);
		expect(r.telemetry).toBe("true");
	});

	test("no openspec on PATH stops with the install command", async () => {
		const r = await run({ withFake: false });
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toContain(INSTALL_LINE);
	});

	test("a set that does not persist fails the check without an unprotected call", async () => {
		const r = await run({ ignoreSet: true });
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toContain("telemetry.enabled");
		expect(r.telemetry).toBe("true");
		expect(r.calls.every(call => call.endsWith("|DNT=1|OT=0"))).toBe(true);
	});
});
