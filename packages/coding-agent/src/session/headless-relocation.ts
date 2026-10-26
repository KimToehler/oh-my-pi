import { setProjectDir } from "@oh-my-pi/pi-utils";
import type { Settings } from "../config/settings";
import { clearClaudePluginRootsCache } from "../discovery/helpers";
import { rebindMemoryBackendForCwd } from "../hindsight/backend";
import { discoverTitleSystemPromptFile, resolvePromptInput } from "../system-prompt";
import type { AgentSession } from "./agent-session";
import type { SessionManager } from "./session-manager";

/** What a host supplies to relocate a headless (non-TUI) session. */
export interface HeadlessRelocationDeps {
	settings: Settings;
	sessionManager: SessionManager;
	session: AgentSession;
	refreshCommands?: () => Promise<void> | void;
	reloadPlugins: () => Promise<void>;
	notifyConfigChanged?: () => Promise<void> | void;
	notifyTitleChanged?: () => Promise<void> | void;
}

export type HeadlessRelocationResult =
	| { ok: true }
	| {
			ok: false;
			reason: string;
			/** Rollback re-alignment failed: the process and session disagree; the caller must dispose the session. */
			fatal?: true;
	  };

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Re-scope process-level state (project dir, settings, memory, plugins, commands) to `cwd`. */
export async function rescopeHeadlessToCwd(deps: HeadlessRelocationDeps, cwd: string): Promise<void> {
	setProjectDir(cwd);
	await deps.settings.reloadForCwd(cwd);
	await rebindMemoryBackendForCwd(deps.session);
	clearClaudePluginRootsCache();
	const src = discoverTitleSystemPromptFile(cwd);
	const p = await resolvePromptInput(src, "title system prompt");
	deps.session.setTitleSystemPrompt(p);
	await deps.session.refreshSkillsAndCommands();
	await deps.refreshCommands?.();
	await deps.reloadPlugins();
}

/** A move rollback failed: re-align the workspace to wherever the session ended up and report it. */
async function failedRollback(deps: HeadlessRelocationDeps, rollbackError: unknown): Promise<HeadlessRelocationResult> {
	const actual = deps.sessionManager.getCwd();
	try {
		await rescopeHeadlessToCwd(deps, actual);
	} catch {
		return {
			ok: false,
			fatal: true,
			reason: `Move failed and rollback failed: ${errorText(rollbackError)} (failed to re-align workspace to ${actual}; process remains at source while session is at ${actual})`,
		};
	}
	return {
		ok: false,
		reason: `Move failed and rollback failed: ${errorText(rollbackError)} (workspace remains at ${actual})`,
	};
}

/**
 * Relocate the headless session to `resolvedPath` (an existing directory):
 * flush settings, move the session file, re-scope the process, rolling back
 * on failure. The session tree's relocation admission is held throughout
 * (relocation-admission-lease, design D3), so peer messages and revivals for
 * the tree wait until the relocation, rollback included, has settled.
 */
export async function relocateHeadlessSession(
	deps: HeadlessRelocationDeps,
	resolvedPath: string,
): Promise<HeadlessRelocationResult> {
	using admission = deps.session.holdRelocationAdmission();
	await admission.ready;
	try {
		await deps.settings.flush();
	} catch (err) {
		return { ok: false, reason: `Failed to save pending settings: ${errorText(err)}` };
	}
	const previousState = deps.sessionManager.captureState();
	try {
		await deps.session.moveSession(resolvedPath);
	} catch (err) {
		return { ok: false, reason: `Move failed: ${errorText(err)}` };
	}
	try {
		setProjectDir(resolvedPath);
	} catch (err) {
		try {
			await deps.sessionManager.rollbackMove(previousState);
		} catch (rollbackError) {
			return failedRollback(deps, rollbackError);
		}
		return { ok: false, reason: `Move failed: ${errorText(err)}` };
	}
	try {
		await rescopeHeadlessToCwd(deps, resolvedPath);
	} catch (err) {
		try {
			await deps.sessionManager.rollbackMove(previousState);
			await rescopeHeadlessToCwd(deps, previousState.cwd);
		} catch (rollbackError) {
			return failedRollback(deps, rollbackError);
		}
		return { ok: false, reason: `Move failed: ${errorText(err)}` };
	}
	await deps.notifyConfigChanged?.();
	await deps.notifyTitleChanged?.();
	return { ok: true };
}
