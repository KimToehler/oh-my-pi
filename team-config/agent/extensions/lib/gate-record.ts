import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { isEnoent } from "@oh-my-pi/pi-utils";

export const RECORD_SCHEMA = "team-config.merge-gate/v3";
const REVIEWED_SHA_PATTERN = /^\s*reviewed_sha\s+([0-9a-f]{40})\b/gim;
const RECORD_PATTERN =
	/^\s*record\s+`?([^`\n]+?\.json)`?\s+·\s+validate-gate-record\.mjs exit 0 at [0-9a-f]{7,40}\b/gim;

export interface GateBinding {
	readonly record: string;
	readonly reviewedSha: string;
}

export interface GateRecordRef extends GateBinding {
	readonly content: string;
	readonly plan: string;
	readonly repo: string;
}

export function gateBinding(text: string): GateBinding | undefined {
	const shas = new Set([...text.matchAll(REVIEWED_SHA_PATTERN)].map(match => match[1]?.toLowerCase()).filter(Boolean));
	const records = new Set([...text.matchAll(RECORD_PATTERN)].map(match => match[1]?.trim()).filter(Boolean));
	if (shas.size !== 1 || records.size !== 1) return undefined;
	const reviewedSha = shas.values().next().value;
	const record = records.values().next().value;
	if (reviewedSha === undefined || record === undefined || path.isAbsolute(record)) return undefined;
	const normalized = path.normalize(record);
	if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) return undefined;
	return { record: normalized, reviewedSha };
}

export interface BindingRecords {
	/** Records carrying the current schema and the claimed reviewed_sha. */
	readonly records: readonly GateRecordRef[];
	/** Checkouts holding a file at the claimed path whose schema is not {@link RECORD_SCHEMA}. */
	readonly retired: readonly string[];
}

type RecordLookup =
	| { readonly kind: "none" }
	| { readonly kind: "retired" }
	| { readonly kind: "current"; readonly ref: GateRecordRef };

function recordAt(repo: string, binding: GateBinding): RecordLookup {
	const file = path.resolve(repo, binding.record);
	const relative = path.relative(repo, file);
	if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		return { kind: "none" };
	}
	let content: string;
	let value: unknown;
	try {
		content = fs.readFileSync(file, "utf8");
		value = JSON.parse(content);
	} catch (error) {
		if (error instanceof SyntaxError || isEnoent(error)) return { kind: "none" };
		throw error;
	}
	if (typeof value !== "object" || value === null || Array.isArray(value) || !("schema" in value)) {
		return { kind: "none" };
	}
	if (value.schema !== RECORD_SCHEMA) return { kind: "retired" };
	if (
		!("plan" in value) ||
		!("reviewed_sha" in value) ||
		typeof value.plan !== "string" ||
		value.reviewed_sha !== binding.reviewedSha
	) {
		return { kind: "none" };
	}
	return { kind: "current", ref: { ...binding, content, plan: value.plan, repo } };
}

async function worktreeRoots(pi: Pick<ExtensionAPI, "exec">, repo: string): Promise<readonly string[] | undefined> {
	const listed = await pi.exec("git", ["worktree", "list", "--porcelain"], { cwd: repo, timeout: 10_000 });
	if (listed.code !== 0) return undefined;
	const roots = new Set([repo]);
	for (const line of listed.stdout.split("\n")) {
		if (line.startsWith("worktree ")) roots.add(line.slice("worktree ".length));
	}
	return [...roots];
}

export async function recordsForBinding(
	pi: Pick<ExtensionAPI, "exec">,
	repo: string,
	binding: GateBinding,
): Promise<BindingRecords | undefined> {
	const roots = await worktreeRoots(pi, repo);
	if (roots === undefined) return undefined;
	const records: GateRecordRef[] = [];
	const retired: string[] = [];
	for (const root of roots) {
		const found = recordAt(root, binding);
		if (found.kind === "current") records.push(found.ref);
		else if (found.kind === "retired") retired.push(root);
	}
	return { records, retired };
}

export async function recordIsSettled(
	pi: Pick<ExtensionAPI, "exec">,
	repo: string,
	record: GateRecordRef,
): Promise<boolean> {
	const remoteHead = await pi.exec("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], {
		cwd: repo,
		timeout: 10_000,
	});
	if (remoteHead.code !== 0) return false;
	const remote = remoteHead.stdout.trim();
	if (remote === "") return false;
	const refs = new Set([remote]);
	const slash = remote.indexOf("/");
	if (slash >= 0 && slash < remote.length - 1) refs.add(`refs/heads/${remote.slice(slash + 1)}`);
	for (const ref of refs) {
		const resolved = await pi.exec("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
			cwd: repo,
			timeout: 10_000,
		});
		if (resolved.code !== 0) continue;
		const commit = resolved.stdout.trim();
		if (commit === "") continue;
		const merged = await pi.exec("git", ["merge-base", "--is-ancestor", record.reviewedSha, commit], {
			cwd: repo,
			timeout: 10_000,
		});
		if (merged.code !== 0) continue;
		const settledRecord = await pi.exec("git", ["show", `${commit}:${record.record}`], {
			cwd: repo,
			timeout: 10_000,
		});
		if (settledRecord.code === 0 && settledRecord.stdout === record.content) return true;
	}
	return false;
}
