import { describe, expect, it } from "bun:test";
import { type PromptFile, seedPool } from "../../../scripts/gen-prompt-perturbation";

const line = "- `@upstream` pins an aggregator route and is part of the model identity.";
const pooled = { source: `  ${line}`, origin: "tools/task.md", variants: [`  - variant of the pinned route line`] };

// The same line as prose in one prompt, deeper-indented prose in another, and inside a fence in a third.
const files: PromptFile[] = [
	{ relative: "tools/task.md", text: `# Task\n  ${line}\n` },
	{ relative: "tools/deep.md", text: `Intro\n      ${line}\n` },
	{ relative: "tools/eval-agents.md", text: `\`\`\`\nagent(prompt)\n    ${line}\n\`\`\`\n` },
];

function seedWith(order: readonly PromptFile[]) {
	const pool = { version: 1, generatedWith: "test", entries: [{ ...pooled }] };
	const added = seedPool(pool, order);
	return { added, entries: pool.entries };
}

describe("gen-prompt-perturbation seed", () => {
	it("keeps the pooled least-indented prose form of a line whatever order the prompts are scanned in", () => {
		for (const order of [files, [...files].reverse(), [files[2], files[0], files[1]]]) {
			const { added, entries } = seedWith(order);
			expect(added).toEqual([]);
			expect(entries).toEqual([pooled]);
		}
	});

	it("adds a new line once, in its least-indented prose form, and drops an entry left only in fenced code", () => {
		const fencedOnly = "Fenced-only signature line that no prose prompt carries anymore.";
		const pool = {
			version: 1,
			generatedWith: "test",
			entries: [{ source: fencedOnly, origin: "tools/old.md", variants: ["Fenced-only line, reworded."] }],
		};
		const added = seedPool(pool, [...files, { relative: "tools/sig.md", text: `\`\`\`\n${fencedOnly}\n\`\`\`\n` }]);
		expect(added).toEqual([{ source: `  ${line}`, origin: "tools/task.md", variants: [] }]);
		expect(pool.entries).toEqual(added);
	});
});
