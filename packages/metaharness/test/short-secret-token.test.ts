import { describe, expect, it } from "bun:test";
import { assertGenomeClean } from "../src/evo/credential-scan";
import { assertNoHostCredentialValues } from "../src/evo/models-yaml";
import { containsHostValue, findCredentialLeaks } from "../src/launch-args";

const enc = new TextEncoder();
const clean =
	(rel: string, body: string, secret = "abc") =>
	() =>
		assertGenomeClean([{ rel, bytes: enc.encode(body) } as never], "", [secret]);

describe("short host values match on token boundaries", () => {
	it("rejects a short secret as a filename component with an extension", () => {
		expect(clean("rules/abc.md", "clean body")).toThrow(/path/);
		expect(clean("rules/abc", "clean body")).toThrow(/path/);
	});
	it("rejects a short secret inside a body line", () => {
		expect(clean("rules/x.md", "token abc here")).toThrow(/embeds/);
		expect(clean("rules/x.md", "first\nsecond (abc)\n")).toThrow(/embeds/);
	});
	it("rejects a short secret as the value half of KEY=VALUE", () => {
		expect(clean("rules/x.md", "TOKEN=abc")).toThrow(/embeds/);
		expect(findCredentialLeaks({ a: "FOO=abc" }, [], ["abc"])).toEqual(["<host value>"]);
	});
	it("does not reject a longer word that merely contains the short secret", () => {
		expect(clean("rules/abcdef.md", "fooabc abcdef xabcx")).not.toThrow();
		expect(containsHostValue("abcdef", "abc")).toBe(false);
		expect(containsHostValue("fooabc", "abc")).toBe(false);
		expect(containsHostValue("a b c", "abc")).toBe(false);
	});
	it("still matches whole strings and delimiter-bearing short secrets", () => {
		expect(containsHostValue("abc", "abc")).toBe(true);
		expect(containsHostValue("x a.b y", "a.b")).toBe(true);
		expect(containsHostValue("xa.by", "a.b")).toBe(false);
	});
	it("keeps plain substring matching for long secrets", () => {
		const long = "sk-leak-sentinel-R45";
		expect(containsHostValue(`prefix${long}suffix`, long)).toBe(true);
		expect(clean("rules/x.md", `zz${long}zz`, long)).toThrow(/embeds/);
		expect(clean(`rules/${long}.md`, "ok", long)).toThrow(/path/);
	});
	it("models.yml scan keeps short-secret behaviour and avoids superstring false positives", () => {
		expect(() => assertNoHostCredentialValues("# note abc\nfoo: bar\n", ["abc"])).toThrow(/embeds/);
		expect(() => assertNoHostCredentialValues("foo: abcdef\n# fooabc\n", ["abc"])).not.toThrow();
	});
});
