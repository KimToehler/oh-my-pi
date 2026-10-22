import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { isEnoent } from "@oh-my-pi/pi-utils";

const RECORD_SCHEMA = "omo.merge-gate/v2";
const REVIEWED_SHA_PATTERN = /^\s*reviewed_sha\s+([0-9a-f]{40})\b/gim;
const RECORD_PATTERN =
	/^\s*record\s+`?([^`\n]+?\.json)`?\s+·\s+validate-gate-record\.mjs exit 0 at [0-9a-f]{7,40}\b/gim;

export interface GateBinding {
	readonly record: string;
	readonly reviewedSha: string;
}

export interface GateRecordRef extends GateBinding {
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

function recordAt(repo: string, binding: GateBinding): GateRecordRef | undefined {
	const file = path.resolve(repo, binding.record);
	const relative = path.relative(repo, file);
	if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		return undefined;
	}
	let value: unknown;
	try {
		value = JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		if (error instanceof SyntaxError || isEnoent(error)) return undefined;
		throw error;
	}
	if (
		typeof value !== "object" ||
		value === null ||
		Array.isArray(value) ||
		!("schema" in value) ||
		!("plan" in value) ||
		!("reviewed_sha" in value) ||
		value.schema !== RECORD_SCHEMA ||
		typeof value.plan !== "string" ||
		value.reviewed_sha !== binding.reviewedSha
	) {
		return undefined;
	}
	return { ...binding, plan: value.plan, repo };
}

async function worktreeRoots(pi: Pick<ExtensionAPI, "exec">, repo: string): Promise<readonly string[]> {
	const listed = await pi.exec("git", ["worktree", "list", "--porcelain"], { cwd: repo, timeout: 10_000 });
	if (listed.code !== 0) return [repo];
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
): Promise<readonly GateRecordRef[]> {
	const records: GateRecordRef[] = [];
	for (const root of await worktreeRoots(pi, repo)) {
		const record = recordAt(root, binding);
		if (record !== undefined) records.push(record);
	}
	return records;
}

export async function recordIsSettled(
	pi: Pick<ExtensionAPI, "exec">,
	repo: string,
	record: GateRecordRef,
): Promise<boolean> {
	const tracked = await pi.exec("git", ["ls-files", "--error-unmatch", "--", record.record], {
		cwd: record.repo,
		timeout: 10_000,
	});
	if (tracked.code !== 0) return false;
	const remoteHead = await pi.exec("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], {
		cwd: repo,
		timeout: 10_000,
	});
	const refs = new Set(["refs/heads/main", "refs/heads/master"]);
	if (remoteHead.code === 0) {
		const remote = remoteHead.stdout.trim();
		refs.add(remote);
		const slash = remote.indexOf("/");
		if (slash >= 0 && slash < remote.length - 1) refs.add(`refs/heads/${remote.slice(slash + 1)}`);
	}
	for (const ref of refs) {
		const merged = await pi.exec("git", ["merge-base", "--is-ancestor", record.reviewedSha, ref], {
			cwd: repo,
			timeout: 10_000,
		});
		if (merged.code === 0) return true;
	}
	return false;
}
