import { describe, expect, it } from "bun:test";
import { publishDataset } from "./plan-review-replay/publish";
import type { Dataset } from "./plan-review-replay/types";
import { base } from "./plan-review-replay-input-fixtures";

/** The approved annotated-row sentence, verbatim as the frozen run carries it. */
const TEMPLATE =
	"Historical target annotation reproduced as descriptive reference; not inherited by fresh findings or asserted current-threshold truth.";

/** One public item (`i1`, from the fixture) and one private item with its own trial and finding. */
function dataset(): Dataset {
	const d = base();
	return {
		...d,
		sources: [
			{ id: "s-provided", path: "fixtures/a.md", sha256: "a", provided: true, provenance: "frozen" },
			{ id: "s-session", path: null, sha256: "b", provided: false, provenance: '{"session":"/Users/x/a.jsonl"}' },
		],
		items: [...d.items, { id: "priv", revision: "r", tree: "t", snapshot: "s" }],
		targets: [
			...d.targets,
			{
				id: "p1",
				item: "priv",
				mechanism: "m-private",
				blocking: "blocking",
				evidence: [
					"openspec/changes/priv/design.md:12",
					"backend/src/main/kotlin/Secret.kt:64-70",
					"backend/src/main/kotlin/Other.kt:3",
					"backend/src/main/kotlin/Secret.kt:90",
					"openspec/changes/other-private-change/design.md:7",
				],
				reason: "The private plan quotes SecretService.load",
			},
		],
		trials: [
			...d.trials,
			{
				id: "t-priv",
				arm: "S",
				item: "priv",
				repeat: 1,
				status: "completed",
				reviewAttempts: [],
				verifierAttempt: null,
				triage: "unavailable",
				reason: "not triaged",
			},
		],
		findings: [
			...d.findings,
			{ id: "f-priv", trial: "t-priv", index: 1, description: "SecretService.load leaks" },
			{ id: "h-priv", trial: "t-priv", index: 2, description: "Historical annotated finding h-priv." },
			{ id: "h-priv2", trial: "t-priv", index: 3, description: "Historical annotated finding h-priv2." },
		],
		adjudications: [
			...d.adjudications,
			{
				finding: "f-priv",
				targets: ["p1"],
				mechanism: "m-private",
				validity: "valid",
				blocking: "blocking",
				kind: "known-target",
				evidence: ["annotation:x", "backend/src/main/kotlin/Secret.kt:64-70"],
				reason: "SecretService.load is the trigger",
			},
			{
				finding: "h-priv",
				targets: ["p1"],
				mechanism: "historical-annotation/h-priv",
				validity: "annotated",
				blocking: "unresolved",
				kind: "known-target",
				evidence: ["annotation:h1"],
				reason: TEMPLATE,
			},
			{
				finding: "h-priv2",
				targets: ["p1"],
				mechanism: "historical-annotation/h-priv2",
				validity: "annotated",
				blocking: "unresolved",
				kind: "known-target",
				evidence: ["annotation:h2"],
				reason: `${TEMPLATE} SecretService.load exposes customer records.`,
			},
		],
	};
}

const OPTIONS = { privateItems: ["priv"], itemCodes: { priv: "Prv", i1: "Pub" } };

describe("publication sanitizer", () => {
	const out = publishDataset(dataset(), OPTIONS);
	const target = (id: string) => {
		const found = out.targets.find(t => t.id === id);
		if (found === undefined) throw new Error(id);
		return found;
	};

	it("keeps private coordinates distinguishable without naming private files", () => {
		const evidence = target("p1").evidence;
		// The item's own plan file is published: the change name is already in the item list.
		expect(evidence[0]).toBe("openspec/changes/priv/design.md:12");
		// Two distinct source files differ, the same file repeats identically, and line ranges survive.
		expect(evidence[1]).toMatch(/^private-source:kt#[0-9a-f]{8}:64-70$/);
		expect(evidence[2]).not.toBe(evidence[1]);
		expect(evidence[3]?.split(":")[1]).toBe(evidence[1]?.split(":")[1]);
		expect(evidence.join(" ")).not.toContain("Secret.kt");
		// Another change's plan is not this item's own plan, so it is pseudonymized like any other path.
		expect(evidence[4]).toMatch(/^private-source:md#[0-9a-f]{8}:7$/);
	});

	it("publishes public coordinates, descriptions and reasons unchanged", () => {
		expect(target("g1").evidence).toEqual(["plan.md:3"]);
		expect(target("g1").reason).toBe("r");
		const pub = out.findings.find(f => f.id === "f1");
		expect(pub?.description).toBe(dataset().findings[0]?.description);
	});

	it("withholds private claim text and reasoning", () => {
		expect(out.findings.find(f => f.id === "f-priv")?.description).toBe(
			"Fresh finding f-priv (item Prv); claim text retained locally.",
		);
		expect(target("p1").reason).not.toContain("SecretService");
		const adj = out.adjudications.find(a => a.finding === "f-priv");
		expect(adj?.reason).not.toContain("SecretService");
		// The experiment's own references stay readable even on a private item.
		expect(adj?.evidence[0]).toBe("annotation:x");
	});

	it("publishes only the complete annotation template, never prose appended to it", () => {
		// The annotated template quotes nothing; withholding it would hide an experiment decision.
		const annotated = out.adjudications.find(a => a.finding === "h-priv");
		expect(annotated?.reason).toBe(TEMPLATE);
		expect(annotated?.evidence).toEqual(["annotation:h1"]);
		// The template followed by reviewer prose is not the template: the whole reason stays withheld.
		const extended = out.adjudications.find(a => a.finding === "h-priv2");
		expect(extended?.reason).not.toContain("SecretService");
	});

	it("drops local paths from source metadata and never ships supplied bytes", () => {
		expect(out.sources.map(s => s.path)).toEqual([null, null]);
		expect(out.sources.every(s => !s.provided)).toBe(true);
		expect(out.sources[0]?.provenance).toStartWith("Local frozen input;");
		// A source whose bytes were never supplied keeps its own provenance sentence, with paths redacted.
		expect(out.sources[1]?.provenance).toBe('{"session":"local-path-redacted"}');
		expect(JSON.stringify(out)).not.toContain("/Users/");
	});

	it("never changes a scoring input", () => {
		const d = dataset();
		const strip = (data: Dataset) => ({ ...data, sources: [], targets: [], findings: [], adjudications: [] });
		expect(strip(out)).toEqual(strip(d));
		expect(out.targets.map(t => [t.id, t.item, t.mechanism, t.blocking])).toEqual(
			d.targets.map(t => [t.id, t.item, t.mechanism, t.blocking]),
		);
		expect(out.adjudications.map(a => [a.finding, a.validity, a.blocking, a.kind])).toEqual(
			d.adjudications.map(a => [a.finding, a.validity, a.blocking, a.kind]),
		);
	});
});
