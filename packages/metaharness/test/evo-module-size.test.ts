import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

/** Plan constraint: no module under src/evo above this many pure lines. */
const CEILING = 250;
const EVO_DIR = path.join(import.meta.dir, "..", "src", "evo");

// Pure LOC = executable text, not lines that merely look like code. Comments are stripped
// first (block comments anywhere on a line, `//` to end of line, never inside a string or
// template literal), then each remaining non-blank line counts 1 plus one for every `;`
// beyond the first outside strings, so `a(); b(); c();` reads as 3 and cannot be hidden by
// reformatting. `for (;;)` over-counts, which errs toward the ceiling. Regex literals are not
// tokenized; a quote inside one could skew a count.
function pureLoc(source: string): number {
	let count = 0;
	let inBlock = false;
	let quote: string | null = null;
	for (const raw of source.split("\n")) {
		let hasCode = false;
		let semis = 0;
		for (let i = 0; i < raw.length; i++) {
			const ch = raw[i];
			const next = raw[i + 1];
			if (inBlock) {
				if (ch === "*" && next === "/") {
					inBlock = false;
					i++;
				}
				continue;
			}
			if (quote) {
				hasCode = true;
				if (ch === "\\") i++;
				else if (ch === quote) quote = null;
				continue;
			}
			if (ch === "/" && next === "*") {
				inBlock = true;
				i++;
				continue;
			}
			if (ch === "/" && next === "/") break;
			if (ch === " " || ch === "\t" || ch === "\r") continue;
			hasCode = true;
			if (ch === '"' || ch === "'" || ch === "`") quote = ch;
			else if (ch === ";") semis++;
		}
		// Unterminated ' or " cannot span lines; only template literals do.
		if (quote && quote !== "`") quote = null;
		if (hasCode) count += Math.max(1, semis);
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

describe("pureLoc adversarial fixtures", () => {
	it("counts code that follows a closed block comment on the same line", () => {
		expect(pureLoc("/* c */ const a = 1;")).toBe(1);
	});
	it("counts every statement packed onto one line", () => {
		expect(pureLoc("a(); b(); c();")).toBe(3);
	});
	it("does not count a long block comment", () => {
		expect(pureLoc(["/**", " * doc", " * more", " */", "const a = 1;"].join("\n"))).toBe(1);
	});
	it("counts code before and after a mid-line block comment", () => {
		expect(pureLoc("const a = 1; /* x */ const b = 2;")).toBe(2);
	});
	it("does not treat // inside a string as a comment", () => {
		expect(pureLoc('const u = "http://x"; a(); b();')).toBe(3);
		expect(pureLoc("const u = `//x`; a();")).toBe(2);
	});
	it("does not count trailing // comments", () => {
		expect(pureLoc("a(); // note; more;")).toBe(1);
	});
	it("does not treat /* inside a string as a comment", () => {
		expect(pureLoc('const g = "/*"; a(); // */\nb();')).toBe(3);
	});
	it("ignores semicolons inside strings", () => {
		expect(pureLoc('const s = "a;b;c;d";')).toBe(1);
	});
});
