#!/usr/bin/env bun
/**
 * Measure what a repository adds to omp's always-on context, without a model call.
 *
 * Starts `omp --mode rpc --no-session` twice and reads `get_state` (the exact system prompt, the tool
 * definitions and omp's own token count): once in the repository, once in an empty git directory. The
 * difference is the project share; it is attributed to context files (with their `##` sections), listed
 * rules and skills, and other project-dependent text (memory, always-apply rule bodies, ...). Project rule
 * files are linted for always-apply bodies, globs that match no tracked file, and long descriptions.
 *
 *   bun measure-context.ts [--repo <dir>] [--omp <bin>] [--json]
 *
 * Token figures are estimates: omp's count for the whole request, spread over characters.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface PromptState {
	systemPrompt: string;
	toolChars: number;
	tokens: number;
}

export interface Section {
	heading: string;
	chars: number;
}

export interface ContextFile {
	path: string;
	scope: "project" | "user";
	chars: number;
	sections: Section[];
}

export interface ListedEntry {
	name: string;
	chars: number;
}

export interface Attribution {
	files: ContextFile[];
	projectRules: ListedEntry[];
	projectSkills: ListedEntry[];
	/** Rules and skills listed in the empty repo too: they come from the agent dir (team or personal config). */
	userRules: ListedEntry[];
	userSkills: ListedEntry[];
	/** Project-dependent text outside files, rule and skill lists, grouped by the heading or tag it sits under. */
	otherProject: Section[];
	projectChars: number;
	totalChars: number;
}

export interface Finding {
	code: "ALWAYS_APPLY" | "DEAD_GLOB" | "LONG_DESCRIPTION" | "NOT_LISTED";
	rule: string;
	file: string;
	detail: string;
}

const FILE_BLOCK = /<file path="([^"]+)">\n([\s\S]*?)\n<\/file>/g;
const LONG_DESCRIPTION_CHARS = 250;

function isInside(child: string, parent: string): boolean {
	const rel = path.relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** `##` sections of a markdown context file; text before the first heading counts as "(preamble)". */
export function sectionsOf(body: string): Section[] {
	const sections: Section[] = [];
	let current: Section = { heading: "(preamble)", chars: 0 };
	for (const line of body.split("\n")) {
		if (line.startsWith("## ")) {
			if (current.chars > 0 || current.heading !== "(preamble)") sections.push(current);
			current = { heading: line.slice(3).trim(), chars: 0 };
		}
		current.chars += line.length + 1;
	}
	if (current.chars > 0) sections.push(current);
	return sections;
}

/** `- name ...` lines of a `<tag>` list block, keyed by name. */
function listEntries(prompt: string, tag: string, nameOf: RegExp): Map<string, string> {
	const entries = new Map<string, string>();
	const block = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(prompt);
	if (!block) return entries;
	for (const line of block[1].split("\n")) {
		const name = nameOf.exec(line)?.[1];
		if (name) entries.set(name, line);
	}
	return entries;
}

const RULE_NAME = /^- ([^\s(]+) \(/;
const SKILL_NAME = /^- ([^\s:]+):/;

/** Prompt text with context-file blocks and list blocks removed, so the remainder can be diffed line by line. */
function remainder(prompt: string): string[] {
	return prompt
		.replace(FILE_BLOCK, "")
		.replace(/<domain-rules>\n[\s\S]*?\n<\/domain-rules>/, "")
		.replace(/<skills>\n[\s\S]*?\n<\/skills>/, "")
		.split("\n");
}

/**
 * Attribute the repository prompt against the baseline prompt (same agent dir, empty git directory).
 * `repoRoot` decides which context files are project files; every other file block counts as user scope.
 */
export function attribute(repoPrompt: string, baselinePrompt: string, repoRoot: string): Attribution {
	const files: ContextFile[] = [];
	for (const match of repoPrompt.matchAll(FILE_BLOCK)) {
		const [, filePath, body] = match;
		files.push({
			path: filePath,
			scope: isInside(filePath, repoRoot) ? "project" : "user",
			chars: match[0].length + 1,
			sections: sectionsOf(body),
		});
	}

	const splitList = (tag: string, nameOf: RegExp): [ListedEntry[], ListedEntry[]] => {
		const base = listEntries(baselinePrompt, tag, nameOf);
		const entries = [...listEntries(repoPrompt, tag, nameOf)].map(([name, line]) => ({ name, chars: line.length + 1 }));
		return [entries.filter(entry => !base.has(entry.name)), entries.filter(entry => base.has(entry.name))];
	};
	const [projectRules, userRules] = splitList("domain-rules", RULE_NAME);
	const [projectSkills, userSkills] = splitList("skills", SKILL_NAME);

	// Multiset line diff of the rest: lines the baseline does not have are project-dependent.
	const baseCounts = new Map<string, number>();
	for (const line of remainder(baselinePrompt)) baseCounts.set(line, (baseCounts.get(line) ?? 0) + 1);
	const buckets = new Map<string, number>();
	let label = "(top)";
	for (const line of remainder(repoPrompt)) {
		const heading = /^#{1,3} (.+)$/.exec(line)?.[1] ?? /^<([a-z-]+)>$/.exec(line)?.[1];
		if (heading) label = heading;
		const left = baseCounts.get(line) ?? 0;
		if (left > 0) {
			baseCounts.set(line, left - 1);
			continue;
		}
		if (line.trim() === "") continue;
		buckets.set(label, (buckets.get(label) ?? 0) + line.length + 1);
	}
	const otherProject = [...buckets].map(([heading, chars]) => ({ heading, chars })).sort((a, b) => b.chars - a.chars);

	const sum = (items: { chars: number }[]) => items.reduce((n, item) => n + item.chars, 0);
	const projectChars =
		sum(files.filter(file => file.scope === "project")) + sum(projectRules) + sum(projectSkills) + sum(otherProject);
	return {
		files,
		projectRules,
		projectSkills,
		userRules,
		userSkills,
		otherProject,
		projectChars,
		totalChars: repoPrompt.length,
	};
}

interface RuleFrontmatter {
	description?: string;
	globs: string[];
	alwaysApply: boolean;
	body: string;
}

/** Minimal frontmatter reader for the fields the lint needs (`description`, `globs`, `alwaysApply`). */
export function parseRule(text: string): RuleFrontmatter {
	const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
	const head = match?.[1] ?? "";
	const body = match ? match[2] : text;
	const globs: string[] = [];
	let description: string | undefined;
	let alwaysApply = false;
	let inGlobs = false;
	for (const line of head.split("\n")) {
		const item = /^\s+-\s+["']?(.+?)["']?\s*$/.exec(line);
		if (inGlobs && item) {
			globs.push(item[1]);
			continue;
		}
		inGlobs = false;
		const field = /^([A-Za-z]+):\s*(.*)$/.exec(line);
		if (!field) continue;
		const [, key, value] = field;
		if (key === "description") description = value.replace(/^["']|["']$/g, "");
		else if (key === "alwaysApply") alwaysApply = value.trim() === "true";
		else if (key === "globs") {
			if (value.trim() === "") inGlobs = true;
			else
				for (const glob of value.replace(/^\[|\]$/g, "").split(","))
					if (glob.trim()) globs.push(glob.trim().replace(/^["']|["']$/g, ""));
		}
	}
	return { description, globs, alwaysApply, body };
}

/** Rule directories omp reads for this repository: `<cwd>/.omp/rules` and every `.agents|.agent/rules` up to the root. */
async function projectRuleDirs(cwd: string, repoRoot: string): Promise<string[]> {
	const dirs = [path.join(cwd, ".omp", "rules")];
	for (let dir = cwd; ; dir = path.dirname(dir)) {
		dirs.push(path.join(dir, ".agents", "rules"), path.join(dir, ".agent", "rules"));
		if (dir === repoRoot || dir === path.dirname(dir)) break;
	}
	const existing: string[] = [];
	for (const dir of dirs) {
		try {
			if ((await fs.stat(dir)).isDirectory()) existing.push(dir);
		} catch {
			// absent rule directory
		}
	}
	return existing;
}

export function lintRule(name: string, file: string, rule: RuleFrontmatter, tracked: string[], listed: boolean): Finding[] {
	const findings: Finding[] = [];
	if (rule.alwaysApply)
		findings.push({ code: "ALWAYS_APPLY", rule: name, file, detail: `${rule.body.length} chars in every request` });
	else if (!listed && !rule.description)
		findings.push({ code: "NOT_LISTED", rule: name, file, detail: "no description and no alwaysApply: never offered" });
	if ((rule.description?.length ?? 0) > LONG_DESCRIPTION_CHARS)
		findings.push({ code: "LONG_DESCRIPTION", rule: name, file, detail: `${rule.description?.length} chars listed every request` });
	if (rule.globs.length > 0 && !rule.globs.some(glob => tracked.some(f => new Bun.Glob(glob).match(f))))
		findings.push({ code: "DEAD_GLOB", rule: name, file, detail: `no tracked file matches ${rule.globs.join(", ")}` });
	return findings;
}

/** Start omp in RPC mode in `cwd`, read one `get_state`, stop it. */
export async function captureState(cwd: string, ompBin: string): Promise<PromptState> {
	const child = Bun.spawn([ompBin, "--mode", "rpc", "--no-session"], {
		cwd,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "ignore",
	});
	child.stdin.write(`${JSON.stringify({ id: "measure-context", type: "get_state" })}\n`);
	child.stdin.flush();
	const timer = setTimeout(() => child.kill(), 60_000);
	try {
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
			buffer += decoder.decode(chunk, { stream: true });
			for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
				const line = buffer.slice(0, nl);
				buffer = buffer.slice(nl + 1);
				if (!line.includes('"measure-context"')) continue;
				const frame: unknown = JSON.parse(line);
				if (!frame || typeof frame !== "object" || !("data" in frame)) continue;
				const data = frame.data;
				if (!data || typeof data !== "object" || !("systemPrompt" in data) || !Array.isArray(data.systemPrompt))
					throw new Error(`get_state in ${cwd} returned no systemPrompt`);
				const tools = "dumpTools" in data ? data.dumpTools : [];
				const usage = "contextUsage" in data ? data.contextUsage : undefined;
				const tokens =
					usage && typeof usage === "object" && "tokens" in usage && typeof usage.tokens === "number" ? usage.tokens : 0;
				return { systemPrompt: data.systemPrompt.join("\n"), toolChars: JSON.stringify(tools).length, tokens };
			}
		}
		throw new Error(`omp exited in ${cwd} before answering get_state`);
	} finally {
		clearTimeout(timer);
		child.kill();
	}
}

function parseArgs(argv: string[]): { repo: string; omp: string; json: boolean } {
	const args = { repo: process.cwd(), omp: "omp", json: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--json") args.json = true;
		else if (arg === "--repo" || arg === "--omp") {
			const value = argv[++i];
			if (!value) throw new Error(`${arg} needs a value`);
			if (arg === "--repo") args.repo = path.resolve(value);
			else args.omp = value;
		} else throw new Error(`unknown argument ${arg}; usage: measure-context.ts [--repo <dir>] [--omp <bin>] [--json]`);
	}
	return args;
}

const k = (tokens: number) => `${(tokens / 1000).toFixed(1)}k`;

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const cwd = await fs.realpath(args.repo);
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { cwd });
	if (top.exitCode !== 0) throw new Error(`${cwd} is not inside a git repository`);
	const repoRoot = await fs.realpath(top.stdout.toString().trim());

	const empty = await fs.mkdtemp(path.join(os.tmpdir(), "measure-context-"));
	let repoState: PromptState;
	let baseState: PromptState;
	try {
		Bun.spawnSync(["git", "init", "-q"], { cwd: empty });
		[repoState, baseState] = await Promise.all([captureState(cwd, args.omp), captureState(empty, args.omp)]);
	} finally {
		await fs.rm(empty, { recursive: true, force: true });
	}

	const attribution = attribute(repoState.systemPrompt, baseState.systemPrompt, repoRoot);
	// omp's count covers system prompt plus tool definitions; spread it evenly over their characters.
	const perChar = repoState.tokens / (repoState.systemPrompt.length + repoState.toolChars);
	const tok = (chars: number) => Math.round(chars * perChar);

	const tracked = Bun.spawnSync(["git", "ls-files"], { cwd: repoRoot }).stdout.toString().split("\n").filter(Boolean);
	const listedRules = new Set(attribution.projectRules.map(rule => rule.name));
	const findings: Finding[] = [];
	for (const dir of await projectRuleDirs(cwd, repoRoot)) {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			if (!entry.isFile() || !/\.mdc?$/.test(entry.name)) continue;
			const file = path.join(dir, entry.name);
			const name = entry.name.replace(/\.mdc?$/, "");
			findings.push(...lintRule(name, file, parseRule(await Bun.file(file).text()), tracked, listedRules.has(name)));
		}
	}

	if (args.json) {
		console.log(JSON.stringify({ repo: cwd, tokens: repoState.tokens, baselineTokens: baseState.tokens, perChar, attribution, findings }, null, 2));
		return;
	}
	const out: string[] = [];
	out.push(`Always-on context in ${cwd} (estimated, no model call)`);
	out.push(`  whole request (system prompt + tools): ${k(repoState.tokens)} tokens; same agent dir in an empty repo: ${k(baseState.tokens)}`);
	out.push(`  project share: ${k(tok(attribution.projectChars))}`);
	for (const file of attribution.files.filter(f => f.scope === "project")) {
		out.push(`    ${path.relative(repoRoot, file.path)}  ${k(tok(file.chars))}`);
		for (const section of [...file.sections].sort((a, b) => b.chars - a.chars))
			out.push(`      ${k(tok(section.chars)).padStart(6)}  ${section.heading}`);
	}
	const sum = (items: { chars: number }[]) => items.reduce((n, item) => n + item.chars, 0);
	if (attribution.projectRules.length > 0)
		out.push(`    rules listed (${attribution.projectRules.length}, description only)  ${k(tok(sum(attribution.projectRules)))}`);
	if (attribution.projectSkills.length > 0)
		out.push(`    skills listed (${attribution.projectSkills.length}, description only)  ${k(tok(sum(attribution.projectSkills)))}`);
	for (const other of attribution.otherProject.filter(o => tok(o.chars) >= 50))
		out.push(`    other project-dependent text under "${other.heading}"  ${k(tok(other.chars))}`);
	const userFiles = attribution.files.filter(f => f.scope === "user");
	if (userFiles.length > 0)
		out.push(`  user context files (agent dir): ${userFiles.map(f => `${path.basename(f.path)} ${k(tok(f.chars))}`).join(", ")}`);
	out.push(
		`  agent-dir lists: rules ${attribution.userRules.length} ${k(tok(sum(attribution.userRules)))}, skills ${attribution.userSkills.length} ${k(tok(sum(attribution.userSkills)))}`,
	);
	out.push(findings.length === 0 ? "  findings: none" : "  findings:");
	for (const finding of findings) out.push(`    ${finding.code}  ${finding.rule}  ${finding.detail}`);
	console.log(out.join("\n"));
}

if (import.meta.main) await main();
