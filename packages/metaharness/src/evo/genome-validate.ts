/**
 * Structural pre-validation of a variant genome: reject files omp would ignore or fail to load before any trial
 * spends money on them. Reuses omp's own parsers so the verdict cannot drift from runtime discovery.
 */
import * as path from "node:path";
// Registers omp's custom Handlebars helpers so SYSTEM_TEMPLATE.md renders exactly as it would at session start.
import "@oh-my-pi/pi-coding-agent/config/prompt-templates";
import { compileRuleCondition } from "@oh-my-pi/pi-coding-agent/capability/rule";
import {
	createSourceMeta,
	discoverRuleFromMarkdown,
	parseAgentFields,
} from "@oh-my-pi/pi-coding-agent/discovery/helpers";
import { parseFrontmatter, prompt } from "@oh-my-pi/pi-utils";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import type { ConfigFile } from "./config-snapshot";
import { RESERVED_EXECUTOR_KEYS } from "./overlay";

/** Keys the overlay deletes before the run (`mergeOverlayConfig`), so a genome setting them changes nothing. */
const EXECUTOR_OWNED_KEYS: readonly string[] = [...RESERVED_EXECUTOR_KEYS, "defaultThinkingLevel"];
const PLAIN_PROMPT_FILES: Record<string, true> = {
	"AGENTS.md": true,
	"SYSTEM.md": true,
	"SYSTEM_TEMPLATE.md": true,
	"APPEND_SYSTEM.md": true,
	"PERSONALITY.md": true,
};
const EMPTY = "empty file has no effect";
const DISABLED = "disabled (enabled: false)";
const decoder = new TextDecoder();
const transpilers = {
	ts: new Bun.Transpiler({ loader: "ts" }),
	js: new Bun.Transpiler({ loader: "js" }),
};

type Report = (rel: string, reason: string) => void;

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** First path segment below `prefix/` and whether more segments follow, e.g. `skills/a/b` -> `{ head: "a", nested: true }`. */
function split(rel: string, prefix: string): { head: string; nested: boolean } {
	const rest = rel.slice(prefix.length + 1);
	const slash = rest.indexOf("/");
	return slash === -1 ? { head: rest, nested: false } : { head: rest.slice(0, slash), nested: true };
}

function frontmatterOf(rel: string, text: string, report: Report): Record<string, unknown> | null {
	try {
		return parseFrontmatter(text, { source: rel, level: "fatal" }).frontmatter;
	} catch (err) {
		report(rel, `frontmatter: ${errorText(err)}`);
		return null;
	}
}

function checkPlainPrompt(rel: string, text: string, rels: ReadonlySet<string>, report: Report): void {
	if (!text.trim()) return report(rel, EMPTY);
	if (rel !== "SYSTEM_TEMPLATE.md") return;
	if (rels.has("SYSTEM.md")) report(rel, "ignored because SYSTEM.md is present");
	try {
		prompt.render(text, {});
	} catch (err) {
		report(rel, `template does not render: ${errorText(err)}`);
	}
}

function checkStickyRules(rel: string, text: string, report: Report): void {
	if (!frontmatterOf(rel, text, report)) return;
	const rule = discoverRuleFromMarkdown("RULES.md", text, rel, createSourceMeta("native", rel, "user"));
	if (!rule) return report(rel, DISABLED);
	if (!rule.content.trim()) report(rel, EMPTY);
}

function checkConfig(rel: string, text: string, report: Report): void {
	const parsed: unknown = Bun.YAML.parse(text);
	if (!isRecord(parsed)) return;
	for (const key of EXECUTOR_OWNED_KEYS) {
		if (key in parsed) report(rel, `key '${key}' is owned by the executor and stripped before the run`);
	}
}

function checkRule(rel: string, text: string, report: Report): void {
	const { head: name, nested } = split(rel, "rules");
	if (nested) return report(rel, "nested files under rules/ are never loaded");
	if (!/\.mdc?$/.test(name)) return report(rel, "only .md and .mdc files are loaded as rules");
	const fm = frontmatterOf(rel, text, report);
	if (!fm) return;
	const rule = discoverRuleFromMarkdown(name, text, rel, createSourceMeta("native", rel, "user"));
	if (!rule) return report(rel, DISABLED);
	for (const token of rule.condition ?? []) {
		try {
			compileRuleCondition(token);
		} catch (err) {
			report(rel, `condition '${token}' is not a valid regex: ${errorText(err)}`);
		}
	}
	if (fm.interruptMode !== undefined && rule.interruptMode === undefined) {
		report(rel, "interruptMode must be never|prose-only|tool-only|always");
	}
	const triggered = (rule.condition?.length ?? 0) > 0 || (rule.astCondition?.length ?? 0) > 0 || !!rule.question;
	if (!triggered && !rule.alwaysApply && !rule.description) {
		report(rel, "inert rule: needs condition, astCondition, question, alwaysApply or description");
	}
}

function checkAgent(rel: string, text: string, report: Report): void {
	const { head: name, nested } = split(rel, "agents");
	if (nested) return report(rel, "nested files under agents/ are never loaded");
	if (!name.endsWith(".md")) return report(rel, "only .md files are loaded as agents");
	const fm = frontmatterOf(rel, text, report);
	if (!fm) return;
	const fields = parseAgentFields(fm);
	if (!fields) return report(rel, "name and description are required; name must not be main or sub");
	const rawThinking = typeof fm.thinkingLevel === "string" ? fm.thinkingLevel : fm.thinking;
	if (typeof rawThinking === "string" && fields.thinkingLevel === undefined) {
		report(rel, `thinking-level '${rawThinking}' is not a valid level`);
	}
}

/** Mirrors `scanSkillsFromDir` (coding-agent `discovery/helpers.ts`) in its check order, with native `requireDescription`. */
function checkSkillFile(rel: string, text: string, report: Report): void {
	const fm = frontmatterOf(rel, text, report);
	if (!fm) return;
	if (fm.enabled === false) return report(rel, DISABLED);
	if (!fm.description) return report(rel, "description is required");
	// Exact predicate omp uses to skip a skill name; anything else it accepts is loadable.
	if (typeof fm.name === "string" && /[\\/]/.test(fm.name.trim()))
		report(rel, "name must not contain a path separator");
}

function checkSkills(files: readonly ConfigFile[], rels: ReadonlySet<string>, report: Report): void {
	const groups = new Map<string, string>();
	for (const file of files) {
		if (!file.rel.startsWith("skills/")) continue;
		const { head, nested } = split(file.rel, "skills");
		if (!nested) {
			report(file.rel, "skills/ files must live in skills/<name>/");
			continue;
		}
		if (!groups.has(head)) groups.set(head, file.rel);
		if (file.rel === `skills/${head}/SKILL.md`) checkSkillFile(file.rel, decoder.decode(file.bytes), report);
	}
	for (const [head, first] of groups) {
		if (!rels.has(`skills/${head}/SKILL.md`)) report(first, "skill directory has no SKILL.md");
	}
}

function checkExtensionSyntax(file: ConfigFile, report: Report): void {
	const ext = path.posix.extname(file.rel);
	if (ext !== ".ts" && ext !== ".js") return;
	try {
		transpilers[ext === ".ts" ? "ts" : "js"].scan(decoder.decode(file.bytes));
	} catch (err) {
		report(file.rel, `syntax error: ${String(err)}`);
	}
}

/** Declared `omp`/`pi` manifest entries of `extensions/<sub>/package.json`, or null when it declares none. */
function declaredExtensions(pkgRel: string, bytes: Uint8Array, report: Report): string[] | null {
	let pkg: unknown;
	try {
		pkg = JSON.parse(decoder.decode(bytes));
	} catch (err) {
		report(pkgRel, `package.json: ${errorText(err)}`);
		return null;
	}
	if (!isRecord(pkg)) return null;
	const manifest = pkg.omp ?? pkg.pi;
	if (!isRecord(manifest) || !Array.isArray(manifest.extensions)) return null;
	const declared = manifest.extensions.filter((entry): entry is string => typeof entry === "string");
	return declared.length > 0 ? declared : null;
}

/** Mirrors `discoverExtensionModulePaths`: direct `*.{ts,js}`, then per subdirectory a manifest or an index. */
function checkExtensions(files: readonly ConfigFile[], rels: ReadonlySet<string>, report: Report): void {
	const groups = new Map<string, string>();
	const byRel = new Map(files.map(file => [file.rel, file]));
	for (const file of files) {
		if (!file.rel.startsWith("extensions/")) continue;
		checkExtensionSyntax(file, report);
		const { head, nested } = split(file.rel, "extensions");
		if (nested) {
			if (!groups.has(head)) groups.set(head, file.rel);
		} else if (!/\.(ts|js)$/.test(head)) {
			report(file.rel, "only .ts and .js files directly in extensions/ are loaded");
		}
	}
	for (const [sub, first] of groups) {
		const pkgRel = `extensions/${sub}/package.json`;
		const pkg = byRel.get(pkgRel);
		const target = pkg ? pkgRel : first;
		const declared = pkg ? declaredExtensions(pkgRel, pkg.bytes, report) : null;
		if (declared) {
			for (const entry of declared) {
				const p = path.posix.normalize(path.posix.join("extensions", sub, entry));
				if (!rels.has(p) && !rels.has(`${p}/index.ts`) && !rels.has(`${p}/index.js`)) {
					report(target, `declared extension '${entry}' does not resolve to a file in the genome`);
				}
			}
		} else if (!rels.has(`extensions/${sub}/index.ts`) && !rels.has(`extensions/${sub}/index.js`)) {
			report(
				target,
				'extension directory loads nothing: needs index.ts/index.js or a package.json "omp"/"pi" manifest with non-empty "extensions"',
			);
		}
	}
}

/**
 * Throw `invalid genome: <rel>: <reason>; …` (problems in file order) when any snapshot file would be ignored or fail
 * to load in omp. Validates in-memory bytes only; never executes extension code.
 */
export function assertGenomeValid(files: readonly ConfigFile[]): void {
	const problems: Array<{ rel: string; reason: string }> = [];
	const report: Report = (rel, reason) => {
		problems.push({ rel, reason });
	};
	const rels = new Set(files.map(file => file.rel));
	for (const { rel, bytes } of files) {
		if (Object.hasOwn(PLAIN_PROMPT_FILES, rel)) checkPlainPrompt(rel, decoder.decode(bytes), rels, report);
		else if (rel === "RULES.md") checkStickyRules(rel, decoder.decode(bytes), report);
		else if (rel === "config.yml") checkConfig(rel, decoder.decode(bytes), report);
		else if (rel.startsWith("rules/")) checkRule(rel, decoder.decode(bytes), report);
		else if (rel.startsWith("agents/")) checkAgent(rel, decoder.decode(bytes), report);
	}
	checkSkills(files, rels, report);
	checkExtensions(files, rels, report);
	if (problems.length === 0) return;
	const order = new Map(files.map((file, index) => [file.rel, index]));
	problems.sort((a, b) => (order.get(a.rel) ?? 0) - (order.get(b.rel) ?? 0));
	throw new Error(`invalid genome: ${problems.map(p => `${p.rel}: ${p.reason}`).join("; ")}`);
}
