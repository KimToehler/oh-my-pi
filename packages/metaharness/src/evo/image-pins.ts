/**
 * Base-image identity of generated tasks. A Dockerfile `FROM repo:tag` is a mutable name: identical text can build
 * different images on different days. A generated task's FROM lines must carry `@sha256:<digest>`, so the Dockerfile
 * bytes (already inside the task hash) name the exact image and a moved tag changes the identity instead of hiding.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { EvoHttpError } from "./boundary";
import { META_FILE } from "./calibration";

export const DIGEST_PINNED_IMAGE = /@sha256:[0-9a-f]{64}$/;

/** Image references a Dockerfile builds from: every `FROM` except `scratch` and earlier stage aliases. */
export function dockerfileBaseImages(text: string): string[] {
	const stages = new Set<string>(["scratch"]);
	const images: string[] = [];
	for (const line of text.split("\n")) {
		const match = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
		if (!match) continue;
		if (!stages.has(match[1].toLowerCase())) images.push(match[1]);
		if (match[2]) stages.add(match[2].toLowerCase());
	}
	return images;
}

/**
 * Digest-pinned base images of every generated task in `root` (entries holding evo-task.json), sorted and unique.
 * 422 when a generated task builds from a mutable reference.
 */
export function generatedTaskImages(root: string, tasks: readonly string[]): string[] {
	const images = new Set<string>();
	for (const task of tasks) {
		const dir = path.join(root, task);
		if (!fs.existsSync(path.join(dir, META_FILE))) continue;
		let text: string;
		try {
			text = fs.readFileSync(path.join(dir, "environment", "Dockerfile"), "utf8");
		} catch {
			throw new EvoHttpError(422, `task '${task}' has no readable environment/Dockerfile`);
		}
		for (const image of dockerfileBaseImages(text)) {
			if (!DIGEST_PINNED_IMAGE.test(image)) {
				throw new EvoHttpError(
					422,
					`task '${task}' builds from mutable image '${image}'; regenerate it with evo-task make so the base image is pinned to @sha256:<digest>`,
				);
			}
			images.add(image);
		}
	}
	return [...images].sort();
}
