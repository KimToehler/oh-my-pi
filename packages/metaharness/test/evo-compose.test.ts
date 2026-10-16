import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildComposeOverlay,
	type ComposeMountPlan,
	serializeComposeOverlay,
	writeComposeOverlayFile,
} from "../src/compose-overlay";
import { assertPlainPath } from "../src/evo/path-guard";
import { parseVariantRequest } from "../src/evo/variants";
import { buildMountsJson, parseArgs } from "../src/runner";

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

const NASTY = [
	"/w/with:colon",
	"/w/has # hash",
	'/w/it\'s "quoted"',
	"/w/ünïcödé-日本語-🙂",
	"/w/- leading dash",
	"/w/trailing space ",
	"/w/brace {x} [y] & *z !tag %pct @at",
	"/w/tilde~ and ? question | pipe > gt",
	"/w/yes",
	"/w/123",
];

function plan(overrides: Partial<ComposeMountPlan> = {}): ComposeMountPlan {
	return {
		hostNetwork: false,
		source: {
			root: "/w/src",
			target: "/opt/omp/src",
			depsDir: "/w/deps",
			nodeModules: ["node_modules", "packages/a/node_modules"],
			binTarget: "/opt/omp/bin",
		},
		agentOverlay: { host: "/w/overlay", target: "/opt/omp/agent-overlay" },
		...overrides,
	};
}

function roundTrip(p: ComposeMountPlan): {
	services: { main: { network_mode?: string; volumes?: Array<Record<string, unknown>> } };
} {
	return Bun.YAML.parse(serializeComposeOverlay(buildComposeOverlay(p)!)) as never;
}

describe("compose overlay serialization", () => {
	it("emits exactly the intended read-only mounts for ordinary paths", () => {
		const volumes = roundTrip(plan()).services.main.volumes!;
		expect(volumes).toEqual([
			{ type: "bind", source: "/w/src", target: "/opt/omp/src", read_only: true },
			{ type: "bind", source: "/w/deps/node_modules", target: "/opt/omp/src/node_modules", read_only: true },
			{
				type: "bind",
				source: "/w/deps/packages/a/node_modules",
				target: "/opt/omp/src/packages/a/node_modules",
				read_only: true,
			},
			{ type: "bind", source: "/w/deps/bin", target: "/opt/omp/bin", read_only: true },
			{ type: "bind", source: "/w/overlay", target: "/opt/omp/agent-overlay", read_only: true },
		]);
	});

	it("round-trips colon, #, quote, unicode and YAML-special paths at every mount site with no injected entry", () => {
		for (const nasty of NASTY) {
			const parsed = roundTrip(
				plan({
					source: {
						root: nasty,
						target: "/opt/omp/src",
						depsDir: `${nasty}/deps`,
						nodeModules: ["node_modules"],
						binTarget: "/opt/omp/bin",
					},
					agentOverlay: { host: `${nasty}/ov`, target: "/opt/omp/agent-overlay" },
				}),
			);
			const volumes = parsed.services.main.volumes!;
			expect(volumes.map(v => v.source)).toEqual([
				nasty,
				`${nasty}/deps/node_modules`,
				`${nasty}/deps/bin`,
				`${nasty}/ov`,
			]);
			expect(volumes.map(v => v.target)).toEqual([
				"/opt/omp/src",
				"/opt/omp/src/node_modules",
				"/opt/omp/bin",
				"/opt/omp/agent-overlay",
			]);
			expect(volumes.every(v => v.read_only === true && v.type === "bind")).toBe(true);
			expect(Object.keys(parsed.services)).toEqual(["main"]);
			expect(Object.keys(parsed.services.main).sort()).toEqual(["volumes"]);
		}
	});

	it("a path that looks like a YAML injection stays one scalar", () => {
		const injected = '/w/x"\n    - /etc:/host:rw';
		expect(() =>
			buildComposeOverlay(
				plan({ source: { root: injected, target: "/t", depsDir: "/d", nodeModules: [], binTarget: "/b" } }),
			),
		).toThrow("mount source path must not contain NUL or control characters");
		// Metacharacters without control characters cannot start a new list entry.
		const safe = '/w/x", - /etc:/host:rw';
		const volumes = roundTrip(
			plan({
				source: { root: safe, target: "/t", depsDir: "/d", nodeModules: [], binTarget: "/b" },
				agentOverlay: null,
			}),
		).services.main.volumes!;
		expect(volumes).toHaveLength(2);
		expect(volumes[0].source).toBe(safe);
	});

	it("keeps host networking, omits the file when nothing is mounted, and writes valid YAML to disk", () => {
		const net = roundTrip(plan({ hostNetwork: true, source: null, agentOverlay: null }));
		expect(net.services.main).toEqual({ network_mode: "host" });
		expect(buildComposeOverlay(plan({ source: null, agentOverlay: null }))).toBeNull();
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evo-compose-"));
		cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
		expect(writeComposeOverlayFile(dir, plan({ source: null, agentOverlay: null }))).toBeNull();
		const file = writeComposeOverlayFile(dir, plan())!;
		expect(
			(Bun.YAML.parse(fs.readFileSync(file, "utf8")) as { services: { main: { volumes: unknown[] } } }).services.main
				.volumes,
		).toHaveLength(5);
	});
});

describe("path boundary", () => {
	it("rejects NUL, newline and other control characters with a stable message", () => {
		for (const bad of ["a\0b", "a\nb", "a\rb", "a\tb", "a\u001bb", "a\u007fb"]) {
			expect(() => assertPlainPath("--source-root", bad)).toThrow(
				"--source-root must not contain NUL or control characters",
			);
		}
		for (const NASTY_PATH of NASTY) expect(assertPlainPath("p", NASTY_PATH)).toBe(NASTY_PATH);
	});

	it("applies to runner path flags, mounts, and variant request paths before anything is persisted", () => {
		for (const flag of ["--agent-dir", "--source-root", "--models-yaml", "--jobs-dir", "--path"]) {
			expect(() => parseArgs([flag, "/w/bad\nline"])).toThrow(`${flag} must not contain NUL or control characters`);
		}
		const cfg = parseArgs([]);
		cfg.sourceRoot = "/w/bad\0root";
		expect(() => buildMountsJson(cfg, { arch: "arm64", depsDir: "/d", nodeModules: [] }, null)).toThrow(
			"--source-root must not contain NUL or control characters",
		);
		for (const key of ["sourceWorktree", "configDir"]) {
			expect(() => parseVariantRequest({ mutation: "root", configDir: "/ok", [key]: "/w/bad\nline" })).toThrow(
				`variant.${key} must not contain NUL or control characters`,
			);
		}
	});

	it("keeps Apple JSON mounts exact for metacharacter paths", () => {
		const cfg = parseArgs([]);
		cfg.sourceRoot = NASTY[0];
		const mounts = JSON.parse(
			buildMountsJson(cfg, { arch: "arm64", depsDir: NASTY[3], nodeModules: ["node_modules"] }, NASTY[1])!,
		) as Array<{ source: string }>;
		expect(mounts.map(m => m.source)).toEqual([NASTY[0], `${NASTY[3]}/node_modules`, `${NASTY[3]}/bin`, NASTY[1]]);
	});
});
