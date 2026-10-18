#!/usr/bin/env bun

/**
 * Verified native-addon materializer.
 *
 *   evo-native-addon.ts install --repo R --ref B --target linux-arm64|linux-x64 [--target T…] --dest D
 *
 * Reads `packages/natives/package.json` at commit `B` of repo `R` (never the working tree), fetches the exact
 * `@oh-my-pi/pi-natives-<target>@<version>` tarball from the npm registry, verifies its sha512 SRI before
 * extraction, and copies every `pi_natives.<target>*.node` member into `<D>/packages/natives/native/`.
 * Prints the installed `NativeAddonRecord`s as JSON.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { readArchiveEntries } from "@oh-my-pi/pi-utils/ar";
import { assertSafeRef, fail } from "./evo-task-shared";

export const NATIVE_ADDON_TARGETS = ["linux-arm64", "linux-x64"] as const;
export type NativeAddonTarget = (typeof NATIVE_ADDON_TARGETS)[number];

export interface NativeAddonRecord {
	target: NativeAddonTarget;
	packageName: string;
	version: string;
	/** npm SRI (`sha512-<base64>`) of the verified tarball. */
	integrity: string;
	/** Repo-relative paths of the installed `.node` files. */
	files: string[];
}

/** Verified addon bytes, not yet written anywhere. */
export interface FetchedNativeAddon {
	record: NativeAddonRecord;
	members: Map<string, Uint8Array>;
}

export type NativeAddonFetch = (url: string) => Promise<Response>;

const REGISTRY = "https://registry.npmjs.org";
const NATIVE_DIR = "packages/natives/native";
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_ADDON_BYTES = 256 * 1024 * 1024;

let fetcher: NativeAddonFetch = url => fetch(url);

/** Test seam: replace the registry/tarball fetcher. Returns a function restoring the previous one. */
export function setNativeAddonFetch(fn: NativeAddonFetch): () => void {
	const previous = fetcher;
	fetcher = fn;
	return () => {
		fetcher = previous;
	};
}

export function isNativeAddonTarget(value: string): value is NativeAddonTarget {
	return (NATIVE_ADDON_TARGETS as readonly string[]).includes(value);
}

/** Parse a repeatable target list: every entry must be known and unique. */
export function parseNativeAddonTargets(values: readonly string[], label: string): NativeAddonTarget[] {
	const seen = new Set<NativeAddonTarget>();
	for (const v of values) {
		if (!isNativeAddonTarget(v))
			fail(`${label}: unknown target ${JSON.stringify(v)} (expected ${NATIVE_ADDON_TARGETS.join("|")})`);
		if (seen.has(v)) fail(`${label}: duplicate target ${v}`);
		seen.add(v);
	}
	return [...seen];
}

async function baseNativesVersion(repo: string, ref: string): Promise<string> {
	assertSafeRef(ref);
	const git = vcs.git(path.resolve(repo)) ?? fail(`${repo} is not a git repository`);
	const commit = (await git.resolveRef(`${ref}^{commit}`)) ?? fail(`cannot resolve ref ${ref}`);
	const blob = await git.showBlob(`${commit}:packages/natives/package.json`);
	if (blob.truncated) fail(`packages/natives/package.json at ${commit} truncated`);
	let pkg: unknown;
	try {
		pkg = JSON.parse(new TextDecoder().decode(blob.data));
	} catch {
		fail(`packages/natives/package.json at ${commit} is not valid JSON`);
	}
	const version = typeof pkg === "object" && pkg !== null && "version" in pkg ? pkg.version : undefined;
	if (typeof version !== "string" || !VERSION_RE.test(version)) {
		fail(`packages/natives/package.json at ${commit} has no valid version`);
	}
	return version;
}

async function getOk(url: string): Promise<Response> {
	const res = await fetcher(url);
	if (!res.ok) fail(`native addon fetch ${url} failed: HTTP ${res.status}`);
	return res;
}

async function readDist(packageName: string, version: string): Promise<{ tarball: string; integrity: string }> {
	const url = `${REGISTRY}/${packageName.replace("/", "%2F")}/${version}`;
	let meta: unknown;
	try {
		meta = await (await getOk(url)).json();
	} catch (err) {
		if (err instanceof SyntaxError) fail(`malformed registry metadata for ${packageName}@${version}: not JSON`);
		throw err;
	}
	const dist = typeof meta === "object" && meta !== null && "dist" in meta ? meta.dist : undefined;
	const hasDist = typeof dist === "object" && dist !== null;
	const tarball = hasDist && "tarball" in dist ? dist.tarball : undefined;
	const integrity = hasDist && "integrity" in dist ? dist.integrity : undefined;
	if (typeof tarball !== "string" || !tarball.startsWith("https://")) {
		fail(`malformed registry metadata for ${packageName}@${version}: missing https dist.tarball`);
	}
	if (typeof integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
		fail(`malformed registry metadata for ${packageName}@${version}: dist.integrity must be sha512-…`);
	}
	return { tarball, integrity };
}

/** Resolve the BASE version, download the exact package, verify SRI, and extract the matching `.node` members in memory. */
export async function fetchNativeAddon(
	repo: string,
	ref: string,
	target: NativeAddonTarget,
): Promise<FetchedNativeAddon> {
	if (!isNativeAddonTarget(target)) fail(`unknown native addon target ${JSON.stringify(target)}`);
	const version = await baseNativesVersion(repo, ref);
	const packageName = `@oh-my-pi/pi-natives-${target}`;
	const { tarball, integrity } = await readDist(packageName, version);
	const bytes = new Uint8Array(await (await getOk(tarball)).arrayBuffer());
	const actual = `sha512-${new Bun.CryptoHasher("sha512").update(bytes).digest("base64")}`;
	if (actual !== integrity) fail(`${packageName}@${version} integrity mismatch: expected ${integrity}, got ${actual}`);

	const entries = await readArchiveEntries(
		{ bytes, format: "tar.gz" },
		{ limits: { maxInMemorySize: MAX_ADDON_BYTES, maxMemberSize: MAX_ADDON_BYTES } },
	);
	const prefix = `pi_natives.${target}`;
	const members = new Map<string, Uint8Array>();
	for (const [member, data] of entries) {
		const segments = member.split("/");
		if (member.startsWith("/") || segments.includes(".."))
			fail(`${packageName}@${version}: unsafe member path ${member}`);
		const name = segments[segments.length - 1];
		if (segments[0] !== "package" || !name.startsWith(prefix) || !name.endsWith(".node")) continue;
		if (members.has(name)) fail(`${packageName}@${version}: duplicate member ${name}`);
		members.set(name, data);
	}
	if (members.size === 0) fail(`${packageName}@${version}: archive has no ${prefix}*.node member`);
	const files = [...members.keys()].sort().map(name => `${NATIVE_DIR}/${name}`);
	return { record: { target, packageName, version, integrity, files }, members };
}

/** Write already-verified addon members under `<dest>/packages/natives/native/`. */
export async function writeNativeAddon(addon: FetchedNativeAddon, dest: string): Promise<void> {
	const dir = path.join(path.resolve(dest), NATIVE_DIR);
	await fs.mkdir(dir, { recursive: true });
	for (const [name, data] of addon.members) await Bun.write(path.join(dir, name), data);
}

/** Fetch, verify, and install one target. */
export async function installNativeAddon(
	repo: string,
	ref: string,
	target: NativeAddonTarget,
	dest: string,
): Promise<NativeAddonRecord> {
	const addon = await fetchNativeAddon(repo, ref, target);
	await writeNativeAddon(addon, dest);
	return addon.record;
}

export async function main(argv: string[]): Promise<void> {
	const [cmd, ...rest] = argv;
	const usage =
		"usage: evo-native-addon.ts install --repo R --ref B --target linux-arm64|linux-x64 [--target T…] --dest D";
	if (cmd !== "install") fail(usage);
	const vals: Record<string, string> = {};
	const targets: string[] = [];
	for (let i = 0; i < rest.length; i += 2) {
		const flag = rest[i];
		const value = rest[i + 1];
		if (!flag.startsWith("--")) fail(`unexpected argument ${flag}\n${usage}`);
		if (value === undefined) fail(`${flag} requires a value`);
		if (flag === "--target") targets.push(value);
		else if (flag === "--repo" || flag === "--ref" || flag === "--dest") vals[flag] = value;
		else fail(`unknown flag ${flag}\n${usage}`);
	}
	const repo = vals["--repo"] ?? fail(`--repo is required\n${usage}`);
	const ref = vals["--ref"] ?? fail(`--ref is required\n${usage}`);
	const dest = vals["--dest"] ?? fail(`--dest is required\n${usage}`);
	if (targets.length === 0) fail(`--target is required\n${usage}`);
	const parsed = parseNativeAddonTargets(targets, "--target");
	const fetched: FetchedNativeAddon[] = [];
	for (const t of parsed) fetched.push(await fetchNativeAddon(repo, ref, t));
	for (const addon of fetched) await writeNativeAddon(addon, dest);
	console.log(
		JSON.stringify(
			fetched.map(a => a.record),
			null,
			2,
		),
	);
}

if (import.meta.main) {
	main(process.argv.slice(2)).catch(err => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}
