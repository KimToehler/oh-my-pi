import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { directoryIsEnterable, directoryIsMissing, normalizePathForComparison } from "@oh-my-pi/pi-utils/dirs";
import * as logger from "@oh-my-pi/pi-utils/logger";
import { SessionManager } from "./session-manager";
import type { SessionInfo } from "./session-listing";

/** Where a stored session reopens when a host asks for it from another directory. */
export type ResumeLocation =
	/** Open the session at `cwd`: its recorded directory, or the request for a session without one. */
	| { readonly kind: "open"; readonly cwd: string }
	/** Its worktree of the request's repository was removed: move it from `from` into `to` first. */
	| { readonly kind: "relocate"; readonly from: string; readonly to: string }
	/** Its directory lies outside the request's repository, or no longer exists outside a removed worktree. */
	| { readonly kind: "refuse"; readonly recordedCwd: string; readonly missing: boolean };

/**
 * Resolve where `session` reopens for a host asking from `requestCwd`. An
 * existing recorded directory of the same git repository (primary checkout or
 * any linked worktree) opens in place, spelled as recorded: `switchSession`
 * compares the recorded and the live directory literally.
 * @param sessionDir `requestCwd`'s session directory; defaults to the cwd-derived one.
 */
export async function resolveResumeLocation(
	session: Pick<SessionInfo, "path" | "cwd">,
	requestCwd: string,
	sessionDir?: string,
): Promise<ResumeLocation> {
	if (!session.cwd) return { kind: "open", cwd: requestCwd };
	const recorded = path.resolve(session.cwd);
	if (await directoryIsEnterable(recorded)) {
		const sameDirectory = normalizePathForComparison(recorded) === normalizePathForComparison(requestCwd);
		const recordedCheckout = primaryCheckout(recorded);
		const sameRepository =
			sameDirectory || (recordedCheckout !== undefined && recordedCheckout === primaryCheckout(requestCwd));
		return sameRepository ? { kind: "open", cwd: recorded } : { kind: "refuse", recordedCwd: recorded, missing: false };
	}
	if (await SessionManager.isFromRemovedWorktree(session, requestCwd, sessionDir)) {
		return { kind: "relocate", from: session.cwd, to: requestCwd };
	}
	return { kind: "refuse", recordedCwd: recorded, missing: await directoryIsMissing(recorded) };
}

/** Canonical primary checkout of `dir`'s repository; undefined outside git. */
function primaryCheckout(dir: string): string | undefined {
	try {
		const root = vcs.git(dir)?.primaryRoot();
		return root ? normalizePathForComparison(root) : undefined;
	} catch (error) {
		logger.debug("Primary checkout lookup failed", { dir, error: String(error) });
		return undefined;
	}
}
