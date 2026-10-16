import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

/** Plan constraint: no module under src/evo above this many pure lines. */
const CEILING = 250;
const EVO_DIR = path.join(import.meta.dir, "..", "src", "evo");

// Pure LOC: non-blank lines, excluding line comments, block comments, and `*` continuation lines.
function pureLoc(source: string): number {
	let count = 0;
	let inBlock = false;
	for (const raw of source.split("\n")) {
		const line = raw.trim();
		if (inBlock) {
			if (line.includes("*/")) inBlock = false;
			continue;
		}
		if (line === "" || line.startsWith("//") || line.startsWith("*")) continue;
		if (line.startsWith("/*")) {
			if (!line.includes("*/")) inBlock = true;
			continue;
		}
		count++;
	}
	return count;
}

describe("evo module size ceiling", () => {
	it(`keeps every src/evo/*.ts at or under ${CEILING} pure LOC`, () => {
		const sizes = fs
			.readdirSync(EVO_DIR)
			.filter(name => name.endsWith(".ts"))
			.map(name => ({ name, loc: pureLoc(fs.readFileSync(path.join(EVO_DIR, name), "utf8")) }));
		expect(sizes.length).toBeGreaterThan(0);
		const over = sizes.filter(s => s.loc > CEILING).map(s => `${s.name} (${s.loc})`);
		expect(over).toEqual([]);
	});
});
