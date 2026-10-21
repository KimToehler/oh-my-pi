#!/usr/bin/env bun
/**
 * Read-only resource audit: machine memory, the processes holding it, long-lived dev
 * processes (language servers, build daemons), and repo-level causes of oversized
 * tool scopes (TypeScript projects that sweep in gitignored bulk data, large ignored
 * directories IntelliJ still indexes, worktree piles).
 *
 * Usage: bun workspace-health.ts [repo-dir ...]   (default: the git root of the cwd)
 * Env:   WH_TS_FILE_LIMIT (default 20000), WH_IGNORED_MB (default 500)
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { $ } from "bun";

const TS_FILE_LIMIT = Number(process.env.WH_TS_FILE_LIMIT ?? 20_000);
const TS_IGNORED_LIMIT = Number(process.env.WH_TS_IGNORED_LIMIT ?? 1_000);
const IGNORED_MB = Number(process.env.WH_IGNORED_MB ?? 500);
const DU_TIMEOUT_MS = 90_000;
const DEV_PROCESS =
	/--lsp\b|language-server|tsserver|GradleDaemon|KotlinCompileDaemon|jdtls|rust-analyzer|gopls|pyright/;
const isMac = process.platform === "darwin";

interface Footprint {
	mem: number;
	compressed: number;
}

function warn(text: string): void {
	console.log(`  WARN  ${text}`);
}

function mb(value: number): string {
	return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`;
}

/** Parses macOS `top` sizes such as `131G`, `4468M+`, `0B` into MB. */
function topSize(raw: string): number {
	const match = /^([\d.]+)([BKMGT])/.exec(raw);
	if (!match) return 0;
	const factor = { B: 1 / 1048576, K: 1 / 1024, M: 1, G: 1024, T: 1048576 }[match[2] as "B" | "K" | "M" | "G" | "T"];
	return Number(match[1]) * factor;
}

/** Physical footprint per pid. macOS `top` includes compressed/swapped pages, which RSS hides. */
async function footprints(): Promise<Map<number, Footprint & { command: string }>> {
	const result = new Map<number, Footprint & { command: string }>();
	if (isMac) {
		const out = await $`/usr/bin/top -l 1 -o mem -stats pid,mem,cmprs,command`.quiet().nothrow().text();
		let inTable = false;
		for (const line of out.split("\n")) {
			if (line.startsWith("PID")) {
				inTable = true;
				continue;
			}
			if (!inTable) continue;
			const match = /^(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(line.trim());
			if (match) {
				result.set(Number(match[1]), {
					mem: topSize(match[2]),
					compressed: topSize(match[3]),
					command: match[4].trim(),
				});
			}
		}
	} else {
		const out = await $`ps -eo pid=,rss=,comm=`.quiet().nothrow().text();
		for (const line of out.split("\n")) {
			const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
			if (match) result.set(Number(match[1]), { mem: Number(match[2]) / 1024, compressed: 0, command: match[3] });
		}
	}
	return result;
}

async function memorySection(fp: Map<number, Footprint & { command: string }>): Promise<void> {
	console.log("## Memory");
	if (isMac) {
		const total = Number((await $`sysctl -n hw.memsize`.quiet().nothrow().text()).trim()) / 1048576;
		const swap = (await $`sysctl -n vm.swapusage`.quiet().nothrow().text()).trim();
		const pressure = (await $`memory_pressure`.quiet().nothrow().text()).match(/free percentage: (\d+)%/)?.[1];
		console.log(`  RAM ${mb(total)}, free ${pressure ?? "?"}%, swap: ${swap}`);
		// macOS grows swap files on demand and keeps stale pages there, so swap use alone is no alarm;
		// the kernel's free percentage is the signal that the machine is actually short.
		if (pressure !== undefined && Number(pressure) < 25) {
			warn(`only ${pressure}% memory free: a process below holds far more than its RSS shows`);
		}
	} else {
		const info = await Bun.file("/proc/meminfo").text();
		const kb = (key: string) => Number(new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(info)?.[1] ?? 0) / 1024;
		console.log(
			`  RAM ${mb(kb("MemTotal"))}, available ${mb(kb("MemAvailable"))}, swap used ${mb(kb("SwapTotal") - kb("SwapFree"))}`,
		);
	}
	const top = [...fp.entries()].sort((a, b) => b[1].mem - a[1].mem).slice(0, 12);
	console.log(`  Top processes by footprint${isMac ? " (incl. compressed/swapped)" : " (RSS)"}:`);
	for (const [pid, entry] of top) {
		const extra = entry.compressed > 0 ? `  (${mb(entry.compressed)} compressed/swapped)` : "";
		console.log(`    ${mb(entry.mem).padStart(9)}  pid ${String(pid).padEnd(6)} ${entry.command}${extra}`);
	}
}

async function devProcessSection(fp: Map<number, Footprint & { command: string }>): Promise<void> {
	console.log("\n## Language servers and build daemons");
	const out = await $`ps ax -o pid=,etime=,command=`.quiet().nothrow().text();
	let found = 0;
	for (const line of out.split("\n")) {
		const match = /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line);
		if (!match || !DEV_PROCESS.test(match[3])) continue;
		const pid = Number(match[1]);
		const size = fp.get(pid)?.mem ?? 0;
		found++;
		console.log(
			`    ${mb(size).padStart(9)}  pid ${String(pid).padEnd(6)} up ${match[2].padEnd(12)} ${match[3].slice(0, 140)}`,
		);
		if (size > 8192) warn(`pid ${pid} uses ${mb(size)}: check which project it loaded (repo section below)`);
	}
	if (found === 0) console.log("    none running");
}

/** Returns the subset of repo-relative paths that git ignores. */
async function ignoredPaths(root: string, rels: string[]): Promise<Set<string>> {
	if (rels.length === 0) return new Set();
	const input = new Response(rels.join("\n"));
	const out = await $`git -C ${root} check-ignore --stdin < ${input}`.quiet().nothrow().text();
	return new Set(out.split("\n").filter(Boolean));
}

async function findTsc(root: string, configDir: string): Promise<string | null> {
	for (let dir = configDir; dir.startsWith(root); dir = path.dirname(dir)) {
		const candidate = path.join(dir, "node_modules", ".bin", "tsc");
		if (await Bun.file(candidate).exists()) return candidate;
		if (dir === root) break;
	}
	return Bun.which("tsc");
}

/**
 * Audits the TypeScript projects a language server can load: every tracked `tsconfig.json` /
 * `jsconfig.json` (the names editors discover) plus, transitively, the projects they reference.
 * Base configs reached only through `extends` or `-p` are never loaded on their own and are skipped.
 * Returns the repo-relative source files of all audited projects.
 */
async function tsconfigSection(root: string): Promise<string[]> {
	const tsFiles: string[] = [];
	const listed = await $`git -C ${root} ls-files -- ${"*tsconfig.json"} ${"*jsconfig.json"}`.quiet().nothrow().text();
	const queue = listed.split("\n").filter(Boolean);
	if (queue.length === 0) return tsFiles;
	const audited = new Set<string>();
	console.log("  TypeScript projects a language server can load (files after include/exclude expansion):");
	while (queue.length > 0) {
		const rel = queue.shift() as string;
		if (audited.has(rel)) continue;
		audited.add(rel);
		const configPath = path.join(root, rel);
		const tsc = await findTsc(root, path.dirname(configPath));
		if (!tsc) {
			console.log(`           ?  ${rel} (no tsc found)`);
			continue;
		}
		const out = await $`${tsc} -p ${configPath} --showConfig`.quiet().nothrow().text();
		let parsed: { files?: string[]; references?: { path: string }[] };
		try {
			parsed = Bun.JSONC.parse(out) as { files?: string[]; references?: { path: string }[] };
		} catch {
			console.log(`           ?  ${rel} (--showConfig failed)`);
			continue;
		}
		for (const ref of parsed.references ?? []) {
			const target = path.resolve(path.dirname(configPath), ref.path);
			queue.push(path.relative(root, target.endsWith(".json") ? target : path.join(target, "tsconfig.json")));
		}
		const files = parsed.files ?? [];
		const byPrefix = new Map<string, number>();
		for (const file of files) {
			const repoRel = path.relative(root, path.resolve(path.dirname(configPath), file));
			tsFiles.push(repoRel);
			const parts = repoRel.split(path.sep);
			const prefix = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
			byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
		}
		console.log(`    ${String(files.length).padStart(8)}  ${rel}`);
		const ignored = await ignoredPaths(
			root,
			[...byPrefix.keys()].filter(p => !p.includes("node_modules")),
		);
		const sweptCount = [...ignored].reduce((sum, p) => sum + (byPrefix.get(p) ?? 0), 0);
		const swept = [...ignored].map(p => `${p} (${byPrefix.get(p)})`).join(", ");
		if (sweptCount >= TS_IGNORED_LIMIT) {
			warn(`${rel} sweeps in ${sweptCount} gitignored files: ${swept}`);
			console.log(`          fix: add them to "exclude", or "files": [] for a references-only config`);
		} else if (sweptCount > 0) {
			console.log(`          note: includes gitignored ${swept} (usually intended generated code)`);
		} else if (files.length > TS_FILE_LIMIT) {
			warn(`${rel} has ${files.length} files (> ${TS_FILE_LIMIT}); a language server loads all of them`);
		}
	}
	return tsFiles;
}

async function duMb(dir: string): Promise<number | null> {
	const proc = Bun.spawn(["du", "-sk", dir], { stdout: "pipe", stderr: "ignore" });
	const timer = setTimeout(() => proc.kill(), DU_TIMEOUT_MS);
	const out = await new Response(proc.stdout).text();
	clearTimeout(timer);
	const kb = Number(out.split("\t")[0]);
	return Number.isFinite(kb) && kb > 0 ? kb / 1024 : null;
}

async function intellijExcludes(root: string): Promise<Set<string> | null> {
	const ideaDir = path.join(root, ".idea");
	let entries: string[];
	try {
		entries = (await fs.readdir(ideaDir, { recursive: true })) as string[];
	} catch {
		return null;
	}
	const excluded = new Set<string>();
	for (const entry of entries.filter(e => e.endsWith(".iml"))) {
		const text = await Bun.file(path.join(ideaDir, entry)).text();
		for (const match of text.matchAll(/excludeFolder url="file:\/\/\$MODULE_DIR\$\/([^"]+)"/g)) {
			excluded.add(match[1].replace(/^\.\.\//, ""));
		}
	}
	return excluded;
}

async function ignoredDirSection(root: string, tsFiles: string[]): Promise<void> {
	const out = await $`git -C ${root} status --ignored --porcelain=v1 -z`.quiet().nothrow().text();
	const dirs = out
		.split("\0")
		.filter(entry => entry.startsWith("!! ") && entry.endsWith("/"))
		.map(entry => entry.slice(3, -1))
		.filter(dir => !dir.split("/").includes("node_modules"));
	const sizes = await Promise.all(dirs.map(async dir => [dir, await duMb(path.join(root, dir))] as const));
	const large = sizes
		.filter(([, size]) => size === null || size >= IGNORED_MB)
		.sort((a, b) => (b[1] ?? 1e12) - (a[1] ?? 1e12));
	if (large.length === 0) return;
	const excluded = await intellijExcludes(root);
	console.log(`  Gitignored directories >= ${IGNORED_MB} MB (tsc, LSPs and IntelliJ do not read .gitignore):`);
	for (const [dir, size] of large) {
		const notes: string[] = [];
		const inTs = tsFiles.filter(file => file.startsWith(`${dir}/`)).length;
		if (inTs > 0) notes.push(`${inTs} files in language-server TS projects`);
		if (excluded && !excluded.has(dir)) notes.push("not excluded in IntelliJ");
		console.log(
			`    ${(size === null ? `> ${DU_TIMEOUT_MS / 1000}s du` : mb(size)).padStart(9)}  ${dir}${notes.length ? `  [${notes.join("; ")}]` : ""}`,
		);
	}
}

async function worktreeSection(root: string): Promise<void> {
	const out = await $`git -C ${root} worktree list --porcelain`.quiet().nothrow().text();
	const worktrees = out.split("\n").filter(line => line.startsWith("worktree ")).length - 1;
	const prunable = out.split("\n").filter(line => line.startsWith("prunable")).length;
	console.log(`  Worktrees: ${worktrees} linked${prunable ? `, ${prunable} prunable (git worktree prune)` : ""}`);
	if (worktrees > 10)
		warn(`${worktrees} worktrees: each carries its own node_modules/build output; remove merged ones`);
}

async function repoSection(dir: string): Promise<void> {
	const rootResult = await $`git -C ${dir} rev-parse --show-toplevel`.quiet().nothrow();
	const root = rootResult.exitCode === 0 ? rootResult.text().trim() : null;
	if (!root) {
		console.log(`\n## ${dir}\n  not a git repository, skipped`);
		return;
	}
	console.log(`\n## Repo ${root}`);
	const tsFiles = await tsconfigSection(root);
	await ignoredDirSection(root, tsFiles);
	await worktreeSection(root);
}

const fp = await footprints();
await memorySection(fp);
await devProcessSection(fp);
const repos = process.argv.slice(2);
for (const dir of repos.length > 0 ? repos : [process.cwd()]) await repoSection(path.resolve(dir));
