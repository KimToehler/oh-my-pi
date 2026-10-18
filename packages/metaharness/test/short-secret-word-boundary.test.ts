import { describe, expect, it } from "bun:test";
import { assertGenomeClean } from "../src/evo/credential-scan";
import { containsHostValue, findCredentialLeaks } from "../src/launch-args";

const enc = new TextEncoder();
const clean =
	(rel: string, body: string, secret = "abc") =>
	() =>
		assertGenomeClean([{ rel, bytes: enc.encode(body) } as never], "", [secret]);

describe("short host values match on word boundaries, not an enumerated separator list", () => {
	it("rejects a hyphenated filename", () => {
		expect(clean("rules/abc-backup.md", "clean")).toThrow(/path/);
	});
	it("rejects a patch header", () => {
		expect(clean("rules/x.md", "--- a/src/abc-fix.ts")).toThrow(/embeds/);
	});
	it("rejects a YAML scalar with a hyphen", () => {
		expect(clean("rules/x.md", "note: abc-value")).toThrow(/embeds/);
	});
	it("rejects an assignment followed by &", () => {
		expect(clean("rules/x.md", "TOKEN=abc&scope=read")).toThrow(/embeds/);
		expect(findCredentialLeaks({ a: "TOKEN=abc&scope=read" }, [], ["abc"])).toEqual(["<host value>"]);
	});
	it("rejects a #-prefixed comment and arbitrary punctuation", () => {
		expect(clean("rules/x.md", "# comment abc")).toThrow(/embeds/);
		for (const p of ["-", "&", "#", "|", "@", "%", "!", "~", "^", "*", "+", "?", "\\"]) {
			expect(containsHostValue(`x${p}abc${p}y`, "abc")).toBe(true);
		}
	});
	it("treats a secret whose own edge is punctuation as bounded on that side", () => {
		expect(containsHostValue("xa.b y", "a.b")).toBe(false);
		expect(containsHostValue("x a.", "a.")).toBe(true);
		expect(containsHostValue("x.by", ".by")).toBe(true);
		expect(containsHostValue("xa.", "a.")).toBe(false);
		expect(containsHostValue("xa.by", "a.b")).toBe(false);
		expect(containsHostValue("a.bc", "a.b")).toBe(false);
	});
	it("does not match superstrings flanked by word characters", () => {
		expect(containsHostValue("abcdef", "abc")).toBe(false);
		expect(containsHostValue("fooabc", "abc")).toBe(false);
		expect(containsHostValue("xabcx", "abc")).toBe(false);
		expect(containsHostValue("a_abc_b", "abc")).toBe(false);
		expect(containsHostValue("abc9", "abc")).toBe(false);
	});
	it("keeps substring matching for long secrets", () => {
		expect(containsHostValue("prefixsk-leak-sentinel-R46suffix", "sk-leak-sentinel-R46")).toBe(true);
	});
});
