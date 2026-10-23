import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const SCRIPT = path.join(import.meta.dir, "validate-openspec-change.mjs");
const PROPOSAL_TEMPLATE = path.join(import.meta.dir, "..", "openspec", "schemas", "omp-gated", "templates", "proposal.md");
const roots: string[] = [];

async function fixture(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "openspec-change-"));
	roots.push(root);
	await fs.mkdir(path.join(root, "specs", "feature"), { recursive: true });
	await Bun.write(
		path.join(root, "proposal.md"),
		`# Proposal

## Why

Records can only be replaced whole, so concurrent edits overwrite each other.

## What Changes

- Add a safe single-record update.

## Capabilities

### New Capabilities
- \`feature\`: safe record updates

### Modified Capabilities

## Impact

The update endpoint and its tests.
`,
	);
	await Bun.write(
		path.join(root, "specs", "feature", "spec.md"),
		`# Spec Delta

## ADDED Requirements

### Requirement: Safe update
The system SHALL update one record.

#### Scenario: Successful update
- **WHEN** a valid record is submitted
- **THEN** the record is updated

#### Scenario: Negative control
- **WHEN** an invalid record is submitted
- **THEN** the update MUST fail
`,
	);
	await Bun.write(
		path.join(root, "gate.md"),
		`# Gate

- **Mandatory class**: none
- **Risk tier**: product
- **Author's risk assessment**: a wrong update overwrites a record, so the update path is covered by requirements
- **Whole-diff review**: not needed (one module)
- **Accepted residual risks**: none (all specified paths are covered)
- **Out of scope for blocking**: none (the change is self-contained)
`,
	);
	await Bun.write(
		path.join(root, "tasks.md"),
		"# Tasks\n\n- [ ] 1.1 Implement safe update. Verify: `bun test test/update.test.ts`\n",
	);
	return root;
}

// A change without requirements carries its review criteria in gate.md.
const GATE_CRITERIA = `
- Feature-specific criteria:
  - Invariant: a pure tooling change keeps the pinned command output byte-identical
    Positive witness: the command prints the same bytes before and after the change
    Negative control: a changed byte in the command output MUST fail the comparison
    Observable: the diff of the two outputs
    Boundary: the command invoked as a process
`;

async function withGateCriteria(root: string): Promise<void> {
	await fs.appendFile(path.join(root, "gate.md"), GATE_CRITERIA);
}

function run(...args: string[]): { exitCode: number; stdout: string; stderr: string } {
	const result = Bun.spawnSync(["node", SCRIPT, ...args]);
	return {
		exitCode: result.exitCode,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
	};
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("validate-openspec-change", () => {
	it("accepts a complete change", async () => {
		const result = run(await fixture());
		expect(result).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});
	it("still validates when started through a symlinked directory", async () => {
		const root = await fixture();
		await fs.rm(path.join(root, "gate.md"));
		const link = path.join(root, "linked-scripts");
		await fs.symlink(import.meta.dir, link);
		const result = Bun.spawnSync(["node", path.join(link, "validate-openspec-change.mjs"), root]);
		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toBe("");
	});
	for (const marker of ["~", "-", "", " x"]) {
		it(`rejects an unnumbered tracked ${marker} task among valid tasks`, async () => {
			const root = await fixture();
			await fs.appendFile(path.join(root, "tasks.md"), `- [${marker}] Remove data\n`);
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("task: expected numbered tracked task");
		});
	}

	it("accepts every tracked checkbox state when numbered with one Verify contract", async () => {
		const root = await fixture();
		await fs.appendFile(
			path.join(root, "tasks.md"),
			[
				"- [~] 1.2 Partly done. Verify: `bun test a`",
				"* [x] 1.3 Done. Verify: `bun test b`",
				"  + [] 1.4 Nested. Verify: `bun test c`",
				"1. [ ] 2 Ordered. Verify: `bun test d`",
				"",
			].join("\n"),
		);
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	for (const [name, line, diagnostic] of [
		["a missing Verify contract", "- [~] 1.2 No contract", "task 1.2: expected trailing Verify"],
		["two Verify contracts", "- [ ] 1.2 Twice. Verify: `a` Verify: `b`", "task 1.2: expected trailing Verify"],
		["an unnumbered ordered task", "1. [ ] Unnumbered. Verify: `a`", "task: expected numbered tracked task"],
	]) {
		it(`rejects ${name} among valid tasks`, async () => {
			const root = await fixture();
			await fs.appendFile(path.join(root, "tasks.md"), `${line}\n`);
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(diagnostic);
		});
	}

	it("does not treat link bullets as tracked tasks", async () => {
		const root = await fixture();
		await fs.appendFile(path.join(root, "tasks.md"), "- [Docs](./docs.md)\n");
		expect(run(root).exitCode).toBe(0);
	});

	for (const field of [
		"Mandatory class",
		"Risk tier",
		"Author's risk assessment",
		"Whole-diff review",
		"Accepted residual risks",
		"Out of scope for blocking",
	]) {
		it(`rejects an empty ${field} without capturing an adjacent line`, async () => {
			const root = await fixture();
			const gate = path.join(root, "gate.md");
			await Bun.write(
				gate,
				(await Bun.file(gate).text()).replace(new RegExp(`(\\*\\*${field}\\*\\*:)[^\\n]*`), "$1"),
			);
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`${field}:`);
		});
	}

	// Exact bytes `openspec new change` (1.14.3, schema omp-gated) writes, plus the appended `skip_specs: true`; `openspec validate --strict` accepts it without specs.
	const GENERATED_METADATA = "schema: omp-gated\ncreated: 2026-10-22\nskip_specs: true\n";

	async function skippedSpecsFixture(metadata: string): Promise<string> {
		const root = await fixture();
		await fs.rm(path.join(root, "specs"), { recursive: true });
		await Bun.write(path.join(root, ".openspec.yaml"), metadata);
		await withGateCriteria(root);
		return root;
	}

	for (const [name, metadata] of [
		["the generated metadata with skip_specs true", GENERATED_METADATA],
		["skip_specs true with a trailing comment", "schema: omp-gated\nskip_specs: true # no behaviour\n"],
		["comments and blank lines around flat keys", "# note\n\nschema: omp-gated\nskip_specs: true\n"],
	] as const) {
		it(`accepts explicit skipped specs: ${name}`, async () => {
			expect(run(await skippedSpecsFixture(metadata))).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
		});
	}

	it("treats skip_specs false as not skipped and keeps specs validated", async () => {
		const root = await fixture();
		await Bun.write(path.join(root, ".openspec.yaml"), "schema: omp-gated\nskip_specs: false\n");
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	it("does not inspect metadata that never mentions skip_specs", async () => {
		const root = await fixture();
		await Bun.write(path.join(root, ".openspec.yaml"), "owner:\n  broken: [\n");
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	it("keeps specs required when metadata without skip_specs is unparsable", async () => {
		const root = await skippedSpecsFixture("owner:\n  broken: [\n");
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("specs: at least one Markdown spec is required");
	});

	for (const [name, metadata] of [
		[
			"a nested map after skip_specs and an unterminated flow value",
			"schema: omp-gated\nskip_specs: true\nowner:\n  broken: [\n",
		],
		["a nested map", "skip_specs: true\nowner:\n  name: x\n"],
		["a block list", "skip_specs: true\nowners:\n- a\n"],
		["a flow list", "skip_specs: true\nowners: [a, b]\n"],
		["a flow map", "skip_specs: true\nowner: {a: b}\n"],
		["a quoted value on another key", 'skip_specs: true\nowner: "x"\n'],
		["a duplicate non-skip key", "skip_specs: true\nowner: a\nowner: b\n"],
		["a document marker", "---\nskip_specs: true\n"],
		["a tab-indented line", "skip_specs: true\n\towner: x\n"],
		["a tab separator", "skip_specs:\ttrue\n"],
		["a colon-space inside a value", "skip_specs: true\nowner: a: b\n"],
		["an anchor", "skip_specs: true\nowner: &a x\n"],
		["a tag", "skip_specs: true\nowner: !!str x\n"],
		["a block scalar", "skip_specs: true\nowner: |\n  x\n"],
		["a flow collection mentioning skip_specs", "meta: {skip_specs: true}\n"],
		["duplicate skip_specs", "skip_specs: true\nskip_specs: false\n"],
		["a quoted duplicate key", 'skip_specs: true\n"skip_specs": true\n'],
		["a quoted key", '"skip_specs": true\n'],
		["a quoted value", 'skip_specs: "true"\n'],
		["a yes value", "skip_specs: yes\n"],
		["a capitalised value", "skip_specs: True\n"],
		["an indented declaration", " skip_specs: true\n"],
		["a nested declaration", "meta:\n  skip_specs: true\n"],
		["a list declaration", "- skip_specs: true\n"],
		["a non-mapping line", "skip_specs: true\n[true\n"],
	] as const) {
		it(`rejects skip_specs metadata with ${name}`, async () => {
			const result = run(await skippedSpecsFixture(metadata));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(".openspec.yaml: skip_specs requires flat");
		});
	}

	it("accepts a rename-only delta", async () => {
		const root = await fixture();
		await Bun.write(
			path.join(root, "specs/feature/spec.md"),
			"## RENAMED Requirements\n\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: New`\n",
		);
		await withGateCriteria(root);
		expect(run(root).exitCode).toBe(0);
	});

	it("requires gate.md criteria for a rename-only delta that also holds an empty requirement heading", async () => {
		const root = await fixture();
		await Bun.write(
			path.join(root, "specs/feature/spec.md"),
			"## RENAMED Requirements\n\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: New`\n\n### Requirement:\nstray text\n",
		);
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("gate.md criteria");
	});

	for (const field of ["Positive witness", "Boundary"]) {
		it(`rejects gate.md criteria whose ${field} is a placeholder`, async () => {
			const root = await skippedSpecsFixture(GENERATED_METADATA);
			const gate = path.join(root, "gate.md");
			const text = await Bun.file(gate).text();
			await Bun.write(gate, text.replace(new RegExp(`(${field}:)[^\\n]*`), "$1 <to be written>"));
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`gate.md criteria.0.${field}`);
		});
	}

	for (const operation of ["MODIFIED", "REMOVED"]) {
		it(`accepts ${operation} requirements with negative controls`, async () => {
			const root = await fixture();
			const spec = path.join(root, "specs/feature/spec.md");
			await Bun.write(
				spec,
				(await Bun.file(spec).text()).replace("ADDED Requirements", `${operation} Requirements`),
			);
			expect(run(root).exitCode).toBe(0);
		});
	}

	it("rejects skipped specs when delta files still exist", async () => {
		const root = await fixture();
		await Bun.write(path.join(root, ".openspec.yaml"), "skip_specs: true\n");
		expect(run(root).exitCode).toBe(1);
	});

	for (const [relative, diagnostic] of [
		["proposal.md", "proposal.md: required regular file is missing"],
		["gate.md", "gate.md: required regular file is missing"],
		["tasks.md", "tasks.md: required regular file is missing"],
		["specs/feature/spec.md", "specs: at least one Markdown spec is required"],
	] as const) {
		it(`rejects a missing ${relative}`, async () => {
			const root = await fixture();
			await fs.rm(path.join(root, relative));
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(diagnostic);
		});
	}

	for (const section of ["Why", "What Changes", "Capabilities", "Impact"]) {
		it(`rejects a proposal without its ${section} section`, async () => {
			const root = await fixture();
			const proposal = path.join(root, "proposal.md");
			await Bun.write(proposal, (await Bun.file(proposal).text()).replace(`## ${section}\n`, ""));
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`proposal ${section}: expected exactly one ## ${section} section`);
		});
	}

	it("rejects required proposal headings that appear only inside a fenced block", async () => {
		const root = await fixture();
		const proposal = path.join(root, "proposal.md");
		await Bun.write(proposal, `# Proposal\n\n\`\`\`markdown\n${await Bun.file(proposal).text()}\`\`\`\n`);
		const result = run(root);
		expect(result.exitCode).toBe(1);
		for (const section of ["Why", "What Changes", "Capabilities", "Impact"])
			expect(result.stderr).toContain(`proposal ${section}: expected exactly one ## ${section} section`);
	});

	for (const [label, content] of [
		["a subheading", "### Details"],
		["an indented subheading", "  ### Details ##"],
		["an unclosed HTML comment", "<!-- explained later"],
	]) {
		it(`rejects a required proposal section that holds only ${label}`, async () => {
			const root = await fixture();
			const proposal = path.join(root, "proposal.md");
			await Bun.write(
				proposal,
				(await Bun.file(proposal).text()).replace(
					"Records can only be replaced whole, so concurrent edits overwrite each other.",
					content,
				),
			);
			const result = run(root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("proposal Why: section needs content");
		});
	}

	it("ignores HTML comment markers inside a fenced example", async () => {
		const root = await fixture();
		const proposal = path.join(root, "proposal.md");
		await Bun.write(
			proposal,
			`# Proposal\n\n\`\`\`html\n<!-- banner\n\`\`\`\n\n${(await Bun.file(proposal).text()).replace("# Proposal\n", "")}\n-->\n`,
		);
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	it("accepts a fenced example with a section heading inside What Changes", async () => {
		const root = await fixture();
		const proposal = path.join(root, "proposal.md");
		await Bun.write(
			proposal,
			(await Bun.file(proposal).text()).replace(
				"- Add a safe single-record update.\n",
				"- Add a safe single-record update.\n\n~~~markdown\n## Impact\n~~~\n",
			),
		);
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	it("rejects the unfilled schema proposal template", async () => {
		const root = await fixture();
		await Bun.write(path.join(root, "proposal.md"), Bun.file(PROPOSAL_TEMPLATE));
		const result = run(root);
		expect(result.exitCode).toBe(1);
		for (const diagnostic of [
			"proposal Why: section needs content",
			"proposal What Changes: section needs content",
			"proposal Capabilities: placeholder text is forbidden",
			"proposal Impact: section needs content",
		])
			expect(result.stderr).toContain(diagnostic);
	});

	it("rejects a requirement without its negative control", async () => {
		const root = await fixture();
		const spec = path.join(root, "specs", "feature", "spec.md");
		await Bun.write(spec, (await Bun.file(spec).text()).replace(/\n#### Scenario: Negative control[\s\S]*$/, "\n"));
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Safe update: exactly one Scenario: Negative control is required");
	});

	it("rejects a tracked task without an executable verification command", async () => {
		const root = await fixture();
		await Bun.write(path.join(root, "tasks.md"), "# Tasks\n\n- [ ] 1.1 Implement safe update.\n");
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("task 1.1: expected trailing Verify: `<deterministic command>`");
	});

	it("rejects an unknown mandatory class", async () => {
		const root = await fixture();
		const gate = path.join(root, "gate.md");
		await Bun.write(gate, (await Bun.file(gate).text()).replace("**: none\n", "**: filesystem\n"));
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Mandatory class: unsupported value filesystem");
	});

	it("rejects unfilled gate placeholders", async () => {
		const root = await fixture();
		const gate = path.join(root, "gate.md");
		await Bun.write(gate, (await Bun.file(gate).text()).replace("one module", "<concrete reason>"));
		const result = run(root);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Whole-diff review: placeholder text is forbidden");
	});
});

describe("validate-openspec-change gate.md under the Risk tier", () => {
	const GATE = (fields: Record<string, string | null>) =>
		`# Gate\n\n${Object.entries(fields)
			.filter(([, value]) => value !== null)
			.map(([label, value]) => `- **${label}**: ${value}`)
			.join("\n")}\n`;
	const VALID = {
		"Mandatory class": "none",
		"Risk tier": "product",
		"Author's risk assessment": "a wrong update overwrites a record, so the update path is covered by requirements",
		"Whole-diff review": "not needed (one module)",
		"Accepted residual risks": "none (all specified paths are covered)",
		"Out of scope for blocking": "none (the change is self-contained)",
	};
	async function withGate(fields: Record<string, string | null>): Promise<string> {
		const root = await fixture();
		await Bun.write(path.join(root, "gate.md"), GATE(fields));
		return root;
	}

	it("accepts a Risk tier gate.md with a bare none class", async () => {
		expect(run(await withGate(VALID))).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});
	it("accepts internal-tooling with class none", async () => {
		expect(run(await withGate({ ...VALID, "Risk tier": "internal-tooling" })).exitCode).toBe(0);
	});
	it("accepts a mandatory class under the product tier", async () => {
		expect(run(await withGate({ ...VALID, "Mandatory class": "wire-contract-api" })).exitCode).toBe(0);
	});
	it("rejects a Review tier bullet with an error naming Risk tier", async () => {
		const result = run(await withGate({ ...VALID, "Review tier": "standard" }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toMatch(/Review tier[^\n]*Risk tier/);
	});
	it("rejects internal-tooling with a mandatory class", async () => {
		const result = run(await withGate({ ...VALID, "Risk tier": "internal-tooling", "Mandatory class": "wire-contract-api" }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Risk tier");
	});
	it("rejects a Risk tier other than product or internal-tooling", async () => {
		const result = run(await withGate({ ...VALID, "Risk tier": "personal" }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Risk tier");
	});
	it("rejects a missing Risk tier", async () => {
		const result = run(await withGate({ ...VALID, "Risk tier": null }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Risk tier:");
	});
	it("rejects a missing Author's risk assessment", async () => {
		const result = run(await withGate({ ...VALID, "Author's risk assessment": null }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Author's risk assessment:");
	});
	for (const [name, value] of [
		["a placeholder", "<what could break>"],
		["TBD", "TBD"],
		["no substance", "-"],
	]) {
		it(`rejects ${name} as the Author's risk assessment`, async () => {
			const result = run(await withGate({ ...VALID, "Author's risk assessment": value }));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("Author's risk assessment:");
		});
	}
	it("accepts a bare none for the abort fields only with a reason", async () => {
		const bare = run(await withGate({ ...VALID, "Accepted residual risks": "none" }));
		expect(bare.exitCode).toBe(1);
		expect(bare.stderr).toContain("Accepted residual risks:");
	});
});

describe("validate-openspec-change review record", () => {
	const SPEC = `# Spec Delta

## ADDED Requirements

### Requirement: Batch export
The system SHALL export records in batches.

#### Scenario: Export
- **WHEN** an export is requested
- **THEN** the records are written

#### Scenario: Negative control
- **WHEN** the target is not writable
- **THEN** the export MUST fail
`;
	const REVIEW = (fields: Record<string, string | null>, extra: string, blockers: string | null) =>
		`# Review\n\n${Object.entries(fields)
			.filter(([, value]) => value !== null)
			.map(([label, value]) => `- **${label}**: ${value}`)
			.join("\n")}\n${extra}\n${blockers === null ? "" : `## Blockers\n\n${blockers}\n`}`;
	const REJECT_BLOCKERS = "1. **Verification**\n   - Defect: task 1.1's Verify passes before implementation";

	/** A complete change with design.md, .openspec.yaml and two tasks, so every artifact kind can be edited after review. */
	async function changeFixture(): Promise<string> {
		const root = await fixture();
		await Bun.write(path.join(root, "design.md"), "# Design\n\nUpdate one row in a transaction.\n");
		await Bun.write(path.join(root, ".openspec.yaml"), "schema: omp-gated\ncreated: 2026-10-22\n");
		await fs.appendFile(path.join(root, "tasks.md"), "- [ ] 1.2 Document the update. Verify: `bun run docs:check`\n");
		return root;
	}

	function digest(root: string): string {
		const result = run("--digest", root);
		expect(result.exitCode).toBe(0);
		return result.stdout.trim();
	}

	async function reviewed(fields: Record<string, string | null> = {}, extra = "", blockers: string | null = "none"): Promise<string> {
		const root = await changeFixture();
		const current = digest(root);
		await Bun.write(
			path.join(root, "review.md"),
			REVIEW(
				{
					Verdict: "OKAY",
					"Reviewed digest": current,
					Reviewer: "plan-reviewer, OpenSpecReview",
					Round: "1",
					Override: "none",
					...fields,
				},
				extra,
				blockers,
			),
		);
		return root;
	}

	async function edit(file: string, from: string, to: string): Promise<void> {
		const text = await Bun.file(file).text();
		expect(text).toContain(from);
		await Bun.write(file, text.replace(from, to));
	}

	it("prints a 64-hex digest for a valid change and nothing for an invalid one", async () => {
		const root = await changeFixture();
		expect(digest(root)).toMatch(/^[0-9a-f]{64}$/);
		await fs.rm(path.join(root, "gate.md"));
		const invalid = run("--digest", root);
		expect(invalid.exitCode).toBe(1);
		expect(invalid.stdout).toBe("");
		expect(invalid.stderr).toContain("gate.md: required regular file is missing");
	});

	it("accepts an OKAY review of the current artifacts", async () => {
		const result = run("--reviewed", await reviewed());
		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
	});

	it("keeps an OKAY review valid after every task is ticked", async () => {
		const root = await reviewed();
		await edit(path.join(root, "tasks.md"), "- [ ] 1.1", "- [x] 1.1");
		await edit(path.join(root, "tasks.md"), "- [ ] 1.2", "- [ X ] 1.2");
		expect(run("--reviewed", root).exitCode).toBe(0);
	});

	it("leaves the plain mode independent of the review record", async () => {
		const root = await reviewed({ Verdict: "REJECT" });
		expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
	});

	it("refuses a change without review.md", async () => {
		const result = run("--reviewed", await changeFixture());
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md: required regular file is missing");
	});

	for (const field of ["Verdict", "Reviewed digest", "Reviewer", "Round", "Override"]) {
		it(`refuses a review without ${field}`, async () => {
			const result = run("--reviewed", await reviewed({ [field]: null }));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`review.md ${field}:`);
		});
		it(`refuses a review with ${field} twice`, async () => {
			const result = run("--reviewed", await reviewed({}, `- **${field}**: again\n`));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`review.md ${field}:`);
		});
	}

	for (const [field, value] of [
		["Verdict", "PASS"],
		["Reviewed digest", "abc123"],
		["Reviewer", "me"],
		["Reviewer", "plan-reviewer, <subagent id>"],
		["Round", "0"],
	] as const) {
		it(`refuses a malformed ${field}: ${value}`, async () => {
			const result = run("--reviewed", await reviewed({ [field]: value }));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(`review.md ${field}:`);
		});
	}

	it("refuses a REJECT without a user override", async () => {
		const result = run("--reviewed", await reviewed({ Verdict: "REJECT" }, "", REJECT_BLOCKERS));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("REJECT");
	});

	it("accepts a REJECT the user overrode and prints the override", async () => {
		const reason = "Tim accepts the missing load test for this internal tool";
		const result = run("--reviewed", await reviewed({ Verdict: "REJECT", Override: reason }, "", REJECT_BLOCKERS));
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(reason);
	});

	const OVERRIDDEN = { Verdict: "REJECT", Override: "Tim accepts the missing load test for this internal tool" };
	for (const [name, fields, extra, blockers] of [
		["no Blockers section", {}, "", null],
		["two Blockers sections", {}, "\n## Blockers\n\nnone\n", "none"],
		["the template placeholder as Blockers", {}, "", "<the reviewer's blockers verbatim, or none>"],
		["an overridden REJECT whose Blockers are none", OVERRIDDEN, "", "none"],
		["an overridden REJECT with an empty Blockers section", OVERRIDDEN, "", ""],
	] as const) {
		it(`refuses ${name}`, async () => {
			const result = run("--reviewed", await reviewed(fields, extra, blockers));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("review.md Blockers:");
		});
	}

	for (const [name, change] of [
		["proposal.md", (root: string) => edit(path.join(root, "proposal.md"), "single-record update", "batch update")],
		["a spec", (root: string) => edit(path.join(root, "specs", "feature", "spec.md"), "one record", "two records")],
		["design.md", (root: string) => edit(path.join(root, "design.md"), "one row", "two rows")],
		["gate.md", (root: string) => edit(path.join(root, "gate.md"), "overwrites a record", "overwrites every record")],
		[".openspec.yaml", (root: string) => edit(path.join(root, ".openspec.yaml"), "2026-10-22", "2026-10-23")],
		["a task's text", (root: string) => edit(path.join(root, "tasks.md"), "Document the update", "Document the batch")],
		["an added spec", (root: string) => Bun.write(path.join(root, "specs", "export", "spec.md"), SPEC)],
		["a deleted design.md", (root: string) => fs.rm(path.join(root, "design.md"))],
	] as const) {
		it(`refuses a review made stale by a change to ${name}`, async () => {
			const root = await reviewed();
			await change(root);
			expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
			const result = run("--reviewed", root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("stale");
		});
	}
});
