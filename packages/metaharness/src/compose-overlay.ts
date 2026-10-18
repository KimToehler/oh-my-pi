/** Docker compose overlay for benchmark trials, built as data and serialized by a real YAML writer. */
import * as fs from "node:fs";
import * as path from "node:path";
import { assertPlainPath } from "./evo/path-guard";

export interface ComposeMountPlan {
	hostNetwork: boolean;
	/** Host repo/worktree mounted read-only at `sourceTarget`, with linux dependency shadow mounts. */
	source: {
		root: string;
		target: string;
		depsDir: string;
		nodeModules: readonly string[];
		binTarget: string;
	} | null;
	agentOverlay: { host: string; target: string } | null;
}

interface BindVolume {
	type: "bind";
	source: string;
	target: string;
	read_only: true;
}

export interface ComposeOverlay {
	services: { main: { network_mode?: "host"; volumes?: BindVolume[] } };
}

const bind = (source: string, target: string): BindVolume => ({
	type: "bind",
	source: assertPlainPath("mount source path", source),
	target,
	read_only: true,
});

/**
 * Compose service-volume entries use the long form: the short `src:dst:ro` syntax cannot represent
 * a host path that contains `:`. Returns null when nothing needs overlaying.
 */
export function buildComposeOverlay(plan: ComposeMountPlan): ComposeOverlay | null {
	const main: ComposeOverlay["services"]["main"] = {};
	if (plan.hostNetwork) main.network_mode = "host";
	const volumes: BindVolume[] = [];
	if (plan.source) {
		const { root, target, depsDir, nodeModules, binTarget } = plan.source;
		volumes.push(bind(root, target));
		for (const rel of nodeModules) volumes.push(bind(path.join(depsDir, rel), `${target}/${rel}`));
		volumes.push(bind(path.join(depsDir, "bin"), binTarget));
	}
	if (plan.agentOverlay) volumes.push(bind(plan.agentOverlay.host, plan.agentOverlay.target));
	if (volumes.length > 0) main.volumes = volumes;
	return Object.keys(main).length === 0 ? null : { services: { main } };
}

export function serializeComposeOverlay(overlay: ComposeOverlay): string {
	return `${Bun.YAML.stringify(overlay, null, 2)}\n`;
}

/** Write the overlay file under `benchDir`; returns its path, or null when there is nothing to overlay. */
export function writeComposeOverlayFile(benchDir: string, plan: ComposeMountPlan): string | null {
	const overlay = buildComposeOverlay(plan);
	if (!overlay) return null;
	const file = path.join(benchDir, "omp-compose-overlay.yaml");
	fs.writeFileSync(file, serializeComposeOverlay(overlay));
	return file;
}
