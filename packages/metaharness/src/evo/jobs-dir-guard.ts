/** A jobs dir inside the source root would be inventoried (and staged) as source; only reserved harness roots are exempt. */
import * as fs from "node:fs";
import * as path from "node:path";
import { HARNESS_ROOTS } from "./execution-manifest";

/** realpath of the nearest existing ancestor, re-joined with the not-yet-existing remainder. */
function realpathLoose(target: string): string {
	const rest: string[] = [];
	let current = path.resolve(target);
	for (;;) {
		try {
			return path.join(fs.realpathSync(current), ...rest);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
			const parent = path.dirname(current);
			if (parent === current) return path.join(current, ...rest);
			rest.unshift(path.basename(current));
			current = parent;
		}
	}
}

/** Throw when `jobsDir` resolves inside `sourceRoot` outside the reserved roots (`runs/`, `.worktrees/`, ...). */
export function assertJobsDirOutsideSource(jobsDir: string, sourceRoot: string): void {
	const root = realpathLoose(sourceRoot);
	const rel = path.relative(root, realpathLoose(jobsDir));
	if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return;
	const top = rel.split(path.sep)[0];
	if (rel !== "" && (HARNESS_ROOTS as readonly string[]).includes(top)) return;
	throw new Error(
		`jobs dir ${jobsDir} lies inside the source root ${sourceRoot} outside the reserved roots (${HARNESS_ROOTS.join(", ")}); its output would be staged as source`,
	);
}
