/** CLI presentation and explicit-path Git worktree creation. */
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import chalk from "@oh-my-pi/pi-utils/chalk";
import { Settings } from "../config/settings";
import type { RepoWorktreeCheckout } from "../session/session-worktree";
import { addRepoWorktree } from "../session/session-worktree";
import { formatIsolationBackend } from "../task/worktree";
import type { ManagedWorktree } from "../worktree/backend";
import { managedWorktrees } from "../worktree/worktrees";

export interface AddWorktreeOptions {
	cwd?: string;
	path: string;
	commit?: string;
	branch?: string;
	forceBranch?: string;
	detach: boolean;
	quiet: boolean;
}

export interface ListWorktreesOptions {
	json: boolean;
}

export interface ClearWorktreesOptions {
	/** Remove all managed entries, including live Git and ovnfs worktrees. */
	all: boolean;
	/** Print what would be removed without touching the filesystem. */
	dryRun: boolean;
	json: boolean;
}
export async function addWorktree(options: AddWorktreeOptions): Promise<void> {
	if (options.branch && options.forceBranch) {
		throw new Error("fatal: options '-b' and '-B' cannot be used together");
	}
	const cwd = path.resolve(options.cwd ?? process.cwd());
	const repository = vcs.requireGit(cwd);
	const worktreePath = path.resolve(cwd, options.path);
	const settings = await Settings.init({ cwd });
	let checkout: RepoWorktreeCheckout;
	if (options.branch || options.forceBranch) {
		const branch = options.branch ?? options.forceBranch;
		if (!branch) throw new Error("branch name is required");
		checkout = {
			kind: "new-branch",
			name: branch,
			from: options.commit ?? "HEAD",
			force: Boolean(options.forceBranch),
		};
	} else if (options.detach) {
		checkout = { kind: "ref", ref: options.commit ?? "HEAD", detach: true };
	} else if (options.commit) {
		checkout = {
			kind: "ref",
			ref: options.commit,
			detach: !(await repository.refExists(`refs/heads/${options.commit}`)),
		};
	} else {
		const branch = path.basename(worktreePath);
		checkout = (await repository.refExists(`refs/heads/${branch}`))
			? { kind: "ref", ref: branch, detach: false }
			: { kind: "new-branch", name: branch, from: "HEAD", force: false };
	}

	const result = await addRepoWorktree({ repository, path: worktreePath, checkout, settings });
	if (!options.quiet) {
		const shortSha = result.commit.sha.slice(0, 7);
		const preparation = result.createdBranch
			? `new branch '${result.createdBranch}'`
			: result.detached
				? `detached HEAD ${shortSha}`
				: `checking out '${result.ref}'`;
		console.log(`Preparing worktree (${preparation})`);
		console.log(`HEAD is now at ${shortSha} ${result.commit.message.split("\n", 1)[0]}`);
		if (result.clonedWith != null) {
			console.log(
				`Cloned from ${repository.info().repoRoot} via ${formatIsolationBackend(result.clonedWith)}, leaving out .git, other worktrees, and untracked .env files`,
			);
		}
	}
	if (result.cloneError) {
		console.error(chalk.dim(`warning: worktree clone fell back to plain checkout: ${result.cloneError}`));
	}
	process.stderr.write(result.hook.stdout);
	process.stderr.write(result.hook.stderr);
	if (result.hook.exitCode !== 0) process.exitCode = result.hook.exitCode;
}

export async function listWorktrees(options: ListWorktreesOptions): Promise<void> {
	const entries = await managedWorktrees();
	if (options.json) {
		console.log(JSON.stringify(entries, null, 2));
		return;
	}
	if (entries.length === 0) {
		console.log(chalk.dim("No agent-managed worktrees found."));
		return;
	}
	let live = 0;
	let orphaned = 0;
	for (const entry of entries) {
		const tag = entry.orphanReason ? chalk.yellow("orphaned") : chalk.green("live    ");
		const detail = formatEntryDetail(entry);
		console.log(`${tag}  ${entry.path}`);
		if (detail) console.log(`          ${chalk.dim(detail)}`);
		if (entry.orphanReason) orphaned += 1;
		else live += 1;
	}
	console.log(chalk.dim(`\n${live} live · ${orphaned} orphaned · ${entries.length} total`));
}

export async function clearWorktrees(options: ClearWorktreesOptions): Promise<{ removed: number; failed: number }> {
	const entries = await managedWorktrees();
	const targets = options.all ? entries : entries.filter(entry => entry.orphanReason !== undefined);

	if (targets.length === 0) {
		if (options.json) {
			console.log(JSON.stringify({ removed: 0, kept: entries.length }));
		} else {
			console.log(chalk.dim(options.all ? "No worktrees to remove." : "No orphaned worktrees to remove."));
		}
		return { removed: 0, failed: 0 };
	}

	if (options.dryRun) {
		if (options.json) {
			console.log(JSON.stringify({ wouldRemove: targets.map(t => t.path) }, null, 2));
		} else {
			for (const target of targets) {
				console.log(`${chalk.yellow("would remove")}  ${target.path}`);
			}
			console.log(chalk.dim(`\n${targets.length} dir${targets.length === 1 ? "" : "s"} would be removed.`));
		}
		return { removed: 0, failed: 0 };
	}

	const results: { path: string; ok: boolean; error?: string }[] = [];
	for (const target of targets) {
		try {
			await target.remove();
			results.push({ path: target.path, ok: true });
		} catch (err) {
			results.push({ path: target.path, ok: false, error: err instanceof Error ? err.message : String(err) });
		}
	}

	const succeeded = results.filter(r => r.ok).length;
	const failed = results.length - succeeded;

	if (options.json) {
		console.log(JSON.stringify({ removed: succeeded, failed, results }, null, 2));
		return { removed: succeeded, failed };
	}

	for (const result of results) {
		if (result.ok) {
			console.log(`${chalk.green("removed")}  ${result.path}`);
		} else {
			console.log(`${chalk.red("failed ")}  ${result.path}`);
			if (result.error) console.log(`          ${chalk.dim(result.error)}`);
		}
	}
	console.log(chalk.dim(`\n${succeeded} removed${failed > 0 ? ` · ${chalk.red(`${failed} failed`)}` : ""}`));
	return { removed: succeeded, failed };
}

function formatEntryDetail(entry: ManagedWorktree): string {
	const parts: string[] = [];
	if (entry.kind === "pr-checkout") {
		const repo = entry.parentRepo ? path.basename(entry.parentRepo) : "unknown repo";
		const branch = entry.branch ?? "unknown branch";
		parts.push(`${repo} · ${branch}`);
	} else if (entry.kind === "ovnfs") {
		parts.push(`ovnfs · ${entry.parentRepo ?? "unknown source"}${entry.branch ? ` · ${entry.branch}` : ""}`);
	} else if (entry.kind === "task-isolation") {
		parts.push("task-isolation sandbox");
	} else if (entry.kind === "empty") {
		parts.push("legacy project shell");
	} else {
		parts.push("unrecognized contents");
	}
	if (entry.orphanReason) parts.push(entry.orphanReason);
	return parts.join(" — ");
}
