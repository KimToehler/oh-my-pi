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

	// Exact bytes `openspec new change` (1.15.0, schema omp-gated) writes, plus the appended `skip_specs: true`; `openspec validate --strict` accepts it without specs.
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
	it("accepts a risky Depth with a mandatory class", async () => {
		const fields = { ...VALID, "Mandatory class": "auth-secrets-pii", Depth: "risky (the change reads a credential)" };
		expect(run(await withGate(fields)).exitCode).toBe(0);
	});
	it("rejects a standard Depth under a mandatory class, naming Depth", async () => {
		const fields = { ...VALID, "Mandatory class": "auth-secrets-pii", Depth: "standard (one file)" };
		const result = run(await withGate(fields));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Depth:");
	});
	it("rejects a Depth value that is neither standard nor risky", async () => {
		const result = run(await withGate({ ...VALID, Depth: "medium (a few files)" }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Depth:");
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

	// consultation.md fixtures: the shipped template with its slots filled in.
	const SKILL_DIR = path.join(import.meta.dir, "..");
	const CONSULTATION_TEMPLATE = path.join(SKILL_DIR, "openspec", "schemas", "omp-gated", "templates", "consultation.md");
	const ORACLE_DEFINITION = path.join(SKILL_DIR, "..", "..", "agents", "architecture-oracle.md");
	const COMMIT = "0123456789abcdef0123456789abcdef01234567";
	const ATTEMPT = "ArchConsult012345671";
	const FINDING = (id: string, extra: Record<string, unknown> = {}) => ({
		id,
		category: "design defect",
		locations: "design.md:3",
		trigger: "two sessions update the same row",
		consequence: "one update is lost",
		counterevidence: "the endpoint takes no lock",
		correction: "lock the row inside the transaction",
		confidence: "high; a concurrent update test would confirm it",
		...extra,
	});
	const REPORT = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
		bottom_line: { verdict: "CHANGE APPROACH", reason: "The update races. A row lock fixes it." },
		findings: [FINDING("F1"), FINDING("F2", { category: "simplification" })],
		recommended_approach: "Keep the endpoint and lock the row.",
		uncertainties: ["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],
		inspected: "proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md",
		...extra,
	});
	const reportSection = (report: unknown) => `\`\`\`json\n${JSON.stringify(report)}\n\`\`\``;
	const DISPOSITIONS =
		"### F1\n\n- **Disposition**: adopted: design.md locks the row\n\n### F2\n\n- **Disposition**: rejected: the second table carries the audit trail";
	type Record_ = Record<string, string>;
	const CONSULTED: Record_ = {
		Status: "consulted",
		"Consulted commit": COMMIT,
		Consultant: `architecture-oracle, ${ATTEMPT}`,
		Models: `${ATTEMPT} onara/cc/claude-fable-5-2`,
		"Bottom line": "CHANGE APPROACH",
		"Skip reason": "none",
		Report: reportSection(REPORT()),
		Findings: DISPOSITIONS,
	};
	const NO_FINDINGS: Record_ = {
		...CONSULTED,
		"Bottom line": "KEEP APPROACH",
		Report: reportSection(REPORT({ bottom_line: { verdict: "KEEP APPROACH", reason: "No defect found." }, findings: [] })),
		Findings: "none",
	};
	const SKIPPED: Record_ = {
		Status: "skipped",
		"Consulted commit": "none",
		Consultant: "none",
		Models: "none",
		"Bottom line": "none",
		"Skip reason": "The change is already in apply on another branch",
		Report: "none",
		Findings: "none",
	};
	const PENDING: Record_ = { ...SKIPPED, Status: "pending", "Consulted commit": COMMIT, Models: `${ATTEMPT} dispatched`, "Skip reason": "none" };
	const HEADER_FIELDS = ["Status", "Consulted commit", "Consultant", "Models", "Bottom line", "Skip reason"];

	/** The shipped template (or `template`) with every slot replaced by `values`. */
	async function consultation(values: Record_, template = CONSULTATION_TEMPLATE): Promise<string> {
		const lines = (await Bun.file(template).text()).split("\n").map(line => {
			const field = /^- \*\*(.+?)\*\*: </.exec(line)?.[1];
			return field !== undefined && field in values ? `- **${field}**: ${values[field]}` : line;
		});
		for (const section of ["Report", "Findings"]) {
			const at = lines.indexOf(`## ${section}`);
			expect(lines[at + 2]).toStartWith("<");
			lines[at + 2] = values[section];
		}
		return lines.join("\n");
	}

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

	for (const reviewer of ["plan-reviewer, LensCor1, LensVer1, LensChk1", "plan-reviewer, PlanReviewR27"]) {
		it(`accepts the reviewer list ${reviewer}`, async () => {
			const result = run("--reviewed", await reviewed({ Reviewer: reviewer }));
			expect(result.stderr).toBe("");
			expect(result.exitCode).toBe(0);
		});
	}

	for (const reviewer of [
		"plan-reviewer, LensCor1, LensCor1, LensChk1",
		"plan-reviewer, <correctness id>, LensVer1, LensChk1",
		"plan-reviewer, LensCor1,",
	]) {
		it(`refuses the reviewer list ${reviewer}`, async () => {
			const result = run("--reviewed", await reviewed({ Reviewer: reviewer }));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("review.md Reviewer:");
		});
	}

	it("refuses an OKAY whose Blockers section lists a reviewer's findings", async () => {
		const grouped = `### Scope B (ScopeB1)\n\n${REJECT_BLOCKERS}`;
		const result = run("--reviewed", await reviewed({ Reviewer: "plan-reviewer, ScopeA1, ScopeB1" }, "", grouped));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md Blockers:");
	});

	for (const [name, blockers] of [
		["none followed by a Notes section", "none\n\n## Notes\n\n1. The day-list read is unrelated."],
		["an empty Blockers section", ""],
	] as const) {
		it(`accepts an OKAY with ${name}`, async () => {
			const result = run("--reviewed", await reviewed({}, "", blockers));
			expect(result.stderr).toBe("");
			expect(result.exitCode).toBe(0);
		});
	}

	const RESIDUALS = `none\n\n## Residuals\n\n1. **Verification**\n   - Defect: the cited line does not say what the finding claims\n   - Verifier: refuted (api.ts:12 returns early, so the task's Verify command does fail)`;

	it("accepts a current OKAY whose findings all stand under Residuals", async () => {
		const fields = { Verifier: "blocker-verifier, ProbeVerify", Awaiting: "none" };
		const result = run("--reviewed", await reviewed(fields, "", RESIDUALS));
		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	});

	it("refuses an overridden REJECT whose findings stand only under Residuals", async () => {
		const fields = { Verdict: "REJECT", Override: "Tim accepts the missing load test for this internal tool" };
		const result = run("--reviewed", await reviewed(fields, "", RESIDUALS));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md Blockers:");
	});

	/** A review record over a change whose gate.md carries `class` and, unless null, `depth`. */
	async function atDepth(
		cls: string,
		depth: string | null,
		fields: Record<string, string | null>,
		record: string | null = null,
	): Promise<string> {
		const root = await changeFixture();
		const gate = path.join(root, "gate.md");
		const text = (await Bun.file(gate).text()).replace("- **Mandatory class**: none", `- **Mandatory class**: ${cls}`);
		await Bun.write(
			gate,
			depth === null
				? text
				: text.replace(`- **Mandatory class**: ${cls}`, `- **Mandatory class**: ${cls}\n- **Depth**: ${depth}`),
		);
		if (record !== null) await Bun.write(path.join(root, "consultation.md"), record);
		await Bun.write(
			path.join(root, "review.md"),
			REVIEW(
				{ Verdict: "OKAY", "Reviewed digest": digest(root), Reviewer: "plan-reviewer, ScopeA1", Round: "1", Override: "none", ...fields },
				"",
				"none",
			),
		);
		return root;
	}

	it("refuses a risky round 1 record with one reviewer id, naming Reviewer", async () => {
		const result = run("--reviewed", await atDepth("none", "risky (it changes the review mechanism)", {}));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md Reviewer:");
	});

	it("refuses a class-bearing gate.md without Depth whose round 1 record names one reviewer id", async () => {
		const result = run("--reviewed", await atDepth("concurrency-state", null, {}));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md Reviewer:");
	});

	it("refuses a risky round 2 record with one reviewer id, naming Reviewer", async () => {
		const result = run("--reviewed", await atDepth("none", "risky (it changes the review mechanism)", { Round: "2" }));
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("review.md Reviewer:");
	});

	it("accepts a risky round 3 record with one reviewer id", async () => {
		const record = await consultation(CONSULTED);
		const result = run("--reviewed", await atDepth("none", "risky (it changes the review mechanism)", { Round: "3" }, record));
		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	});

	it("accepts a class-bearing gate.md without Depth whose record names two reviewers", async () => {
		const record = await consultation(CONSULTED);
		const result = run("--reviewed", await atDepth("concurrency-state", null, { Reviewer: "plan-reviewer, ScopeA1, ScopeB1" }, record));
		expect(result.stderr).toBe("");
		expect(result.exitCode).toBe(0);
	});

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

	const RISKY = "risky (it changes the review mechanism)";
	const TWO_REVIEWERS = { Reviewer: "plan-reviewer, ScopeA1, ScopeB1" };

	/**
	 * A `risky` change (or `gate`) with `record` as consultation.md and a two-reviewer OKAY review. The review is bound to the
	 * digest `--digest` prints with the record in place, or, when the validator refuses the record, to the digest taken
	 * before it was written.
	 */
	async function consulted(record: string | null, gate: { cls: string; depth: string | null } = { cls: "none", depth: RISKY }) {
		const root = await atDepth(gate.cls, gate.depth, TWO_REVIEWERS);
		if (record === null) return root;
		await Bun.write(path.join(root, "consultation.md"), record);
		const withRecord = run("--digest", root);
		if (withRecord.exitCode === 0) {
			const review = path.join(root, "review.md");
			const text = await Bun.file(review).text();
			await Bun.write(review, text.replace(/(Reviewed digest\*\*: )[0-9a-f]{64}/, `$1${withRecord.stdout.trim()}`));
		}
		return root;
	}

	describe("presence", () => {
		for (const [name, gate] of [
			["a class auth-secrets-pii gate without Depth", { cls: "auth-secrets-pii", depth: null }],
			["Depth risky", { cls: "none", depth: RISKY }],
		] as const) {
			it(`refuses ${name} without consultation.md`, async () => {
				const result = run("--reviewed", await consulted(null, gate));
				expect(result.exitCode).toBe(1);
				expect(result.stderr).toContain("consultation.md");
			});
		}
		for (const [name, gate] of [
			["risky", { cls: "none", depth: RISKY }],
			["standard", { cls: "none", depth: "standard (one module)" }],
		] as const) {
			it(`refuses a pending record at ${name}`, async () => {
				const result = run("--reviewed", await consulted(await consultation(PENDING), gate));
				expect(result.exitCode).toBe(1);
				expect(result.stderr).toContain("consultation.md");
			});
		}
		for (const [name, values] of [
			["consulted", CONSULTED],
			["skipped", SKIPPED],
		] as const) {
			it(`accepts a ${name} record at risky`, async () => {
				const result = run("--reviewed", await consulted(await consultation(values)));
				expect(result.stderr).toBe("");
				expect(result.exitCode).toBe(0);
			});
		}
	});

	describe("digest", () => {
		it("keeps the review current when a skip is recorded and when the record is edited", async () => {
			const root = await consulted(null);
			const before = digest(root);
			await Bun.write(path.join(root, "consultation.md"), await consultation(SKIPPED));
			expect(digest(root)).toBe(before);
			expect(run("--reviewed", root).exitCode).toBe(0);
			await edit(path.join(root, "consultation.md"), "already in apply", "already merged");
			expect(digest(root)).toBe(before);
			const result = run("--reviewed", root);
			expect(result.stderr).toBe("");
			expect(result.exitCode).toBe(0);
		});
		it("refuses a review made stale by a design.md edit while a record is present", async () => {
			const root = await consulted(await consultation(CONSULTED));
			await edit(path.join(root, "design.md"), "one row", "two rows");
			const result = run("--reviewed", root);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("stale");
		});
	});

	describe("form", () => {
		const withReport = (report: Record<string, unknown>, extra: Record_ = {}): Record_ => ({ ...CONSULTED, Report: reportSection(report), ...extra });
		const findings = (...items: unknown[]) => ({ findings: items });
		const rows: [string, Record_ | (() => Promise<string>), string][] = [
			["a subsection without its Disposition bullet", { ...CONSULTED, Findings: DISPOSITIONS.replace("- **Disposition**: adopted: design.md locks the row", "") }, "consultation.md Findings"],
			["a disposition that is neither adopted nor rejected", { ...CONSULTED, Findings: DISPOSITIONS.replace("adopted:", "deferred:") }, "consultation.md Findings"],
			["a report finding without its subsection", { ...CONSULTED, Findings: DISPOSITIONS.slice(0, DISPOSITIONS.indexOf("\n\n### F2")) }, "consultation.md Findings"],
			["subsections in another order than the report", { ...CONSULTED, Findings: `${DISPOSITIONS.slice(DISPOSITIONS.indexOf("### F2"))}\n\n${DISPOSITIONS.slice(0, DISPOSITIONS.indexOf("\n\n### F2"))}` }, "consultation.md Findings"],
			["a report line that is not JSON", { ...CONSULTED, Report: "```json\n{bottom_line: KEEP}\n```" }, "consultation.md Report"],
			["a report finding without trigger", withReport(REPORT(findings(FINDING("F1", { trigger: undefined }), FINDING("F2")))), "consultation.md Report: report.findings[0].trigger: missing"],
			["a report without recommended_approach", withReport(REPORT({ recommended_approach: undefined })), "consultation.md Report: report.recommended_approach: missing"],
			["a Bottom line other than the report's verdict", { ...CONSULTED, "Bottom line": "KEEP APPROACH" }, "consultation.md Bottom line"],
			["a record without ## Report", async () => (await consultation(CONSULTED)).replace("## Report\n", ""), "consultation.md Report"],
			["a consulted record whose Models holds a dispatched entry", { ...CONSULTED, Models: `${ATTEMPT} onara/cc/claude-fable-5-2; ArchConsult012345672 dispatched` }, "consultation.md Models"],
			["a pending record with Models none", { ...PENDING, Models: "none" }, "consultation.md Models"],
			...HEADER_FIELDS.map((field): [string, () => Promise<string>, string] => [
				`${field} twice`,
				async () => (await consultation(CONSULTED)).replace("\n\n## Report", `\n- **${field}**: ${CONSULTED[field]}\n\n## Report`),
				`consultation.md ${field}`,
			]),
			...["Report", "Findings"].map((section): [string, () => Promise<string>, string] => [
				`## ${section} twice`,
				async () => `${await consultation(CONSULTED)}\n## ${section}\n\nnone\n`,
				`consultation.md ${section}`,
			]),
			["two report findings with the same id", withReport(REPORT(findings(FINDING("F1"), FINDING("F1"))), { Findings: DISPOSITIONS.replace("### F2", "### F1") }), "consultation.md Report: report.findings[1].id: duplicate id F1"],
			["six report findings", withReport(REPORT(findings(...["F1", "F2", "F3", "F4", "F5", "F6"].map(id => FINDING(id))))), "consultation.md Report: report.findings: at most 5 elements"],
			["four uncertainties", withReport(REPORT({ uncertainties: ["a", "b", "c", "d"] })), "consultation.md Report: report.uncertainties: at most 3 elements"],
			["a category outside its enum", withReport(REPORT(findings(FINDING("F1", { category: "style" }), FINDING("F2")))), "consultation.md Report: report.findings[0].category"],
			["a verdict outside its enum", withReport(REPORT({ bottom_line: { verdict: "APPROVE", reason: "fine" } }), { "Bottom line": "APPROVE" }), "consultation.md Report: report.bottom_line.verdict"],
			["a confidence that is a number", withReport(REPORT(findings(FINDING("F1", { confidence: 0.9 }), FINDING("F2")))), "consultation.md Report: report.findings[0].confidence: expected a string"],
			["findings that are an object", withReport(REPORT({ findings: { F1: FINDING("F1") } }), { Findings: "none" }), "consultation.md Report: report.findings: expected an array"],
			["a finding with an empty id", withReport(REPORT(findings(FINDING(""), FINDING("F2"))), { Findings: DISPOSITIONS.replace("### F1", "### ") }), "consultation.md Report: report.findings[0].id"],
			["Status drafted", { ...CONSULTED, Status: "drafted" }, "consultation.md Status"],
			["a skipped record with Skip reason none", { ...SKIPPED, "Skip reason": "none" }, "consultation.md Skip reason"],
			["Consultant oracle, X1", { ...CONSULTED, Consultant: "oracle, X1" }, "consultation.md Consultant"],
			["a 39-hex consulted commit", { ...CONSULTED, "Consulted commit": COMMIT.slice(1) }, "consultation.md Consulted commit"],
			["the shipped template copied unfilled", async () => Bun.file(CONSULTATION_TEMPLATE).text(), "consultation.md Status"],
		];
		for (const [name, record, field] of rows) {
			it(`refuses ${name} in the plain run and under --reviewed, naming ${field}`, async () => {
				const root = await consulted(typeof record === "function" ? await record() : await consultation(record));
				for (const result of [run(root), run("--reviewed", root)]) {
					expect(result.exitCode).toBe(1);
					expect(result.stderr).toContain(field);
				}
			});
		}

		it("accepts a consulted record without findings", async () => {
			const root = await consulted(await consultation(NO_FINDINGS));
			expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
			expect(run("--reviewed", root).exitCode).toBe(0);
		});
		it("accepts a pending record in the plain run", async () => {
			expect(run(await consulted(await consultation(PENDING)))).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
		});
		it("keeps text that looks like a slot verbatim", async () => {
			const skipped = await consulted(await consultation({ ...SKIPPED, "Skip reason": "This only changes the TODO scanner; skip the consultation" }));
			expect(run(skipped)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
			const report = REPORT(
				findings(
					FINDING("F1", { correction: "```sh\nomp review --original-reply <file>\n```\nthen re-run the round" }),
					FINDING("F2"),
				),
			);
			report.recommended_approach = "## Approach\n\nKeep it.\n\n```ts\nconst x = 1;\n```";
			const verbatim = await consulted(await consultation(withReport(report)));
			expect(run(verbatim)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
			expect(run("--reviewed", verbatim).exitCode).toBe(0);
		});
	});

	describe("report check", () => {
		type Turn = { model?: string; yield?: { id: string; type?: unknown; data?: unknown; result?: "accepted" | "refused" | "none" } };
		/** A session file of one attempt: the brief naming `changeDir`, then one assistant turn per entry with its tool result. */
		async function attempt(root: string, changeDir: string, turns: Turn[]): Promise<string> {
			const lines: unknown[] = [
				{ type: "session", version: 3, id: "attempt", timestamp: "2026-11-12T00:00:00.000Z", cwd: root },
				{
					type: "message",
					message: {
						role: "user",
						content: [{ type: "text", text: `Complete assignment thoroughly:\n\nRepository root: ${root}\nChange directory: ${changeDir}\n\nReview this proposed change.` }],
					},
				},
			];
			for (const [index, turn] of turns.entries()) {
				const [provider, ...model] = (turn.model ?? "onara/cc/claude-fable-5-2").split("/");
				const call = turn.yield
					? { type: "toolCall", id: turn.yield.id, name: "yield", arguments: { type: turn.yield.type ?? "result", data: turn.yield.data ?? null, error: null } }
					: { type: "toolCall", id: `read${index}`, name: "read", arguments: { path: "design.md" } };
				lines.push({ type: "message", message: { role: "assistant", provider, model: model.join("/"), content: [call] } });
				const result = turn.yield?.result ?? "accepted";
				if (result !== "none")
					lines.push({ type: "message", message: { role: "toolResult", toolCallId: call.id, toolName: call.name, isError: result === "refused", content: [{ type: "text", text: "ok" }] } });
			}
			const file = path.join(root, "attempt.jsonl");
			await Bun.write(file, `${lines.map(line => JSON.stringify(line)).join("\n")}\n`);
			return file;
		}
		const ACCEPTED = REPORT({ findings: [FINDING("F1", { counterevidence: "" })] });

		it("prints the report of an accepted terminal yield, and a record holding it passes", async () => {
			const root = await changeFixture();
			const file = await attempt(root, root, [{}, { yield: { id: "y1", data: ACCEPTED } }]);
			const result = run("--consultation-report", file, root);
			expect(result.stderr).toBe("");
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe(`${JSON.stringify(ACCEPTED)}\n`);
			const record = await consultation({ ...CONSULTED, Report: `\`\`\`json\n${result.stdout.trim()}\n\`\`\``, Findings: DISPOSITIONS.slice(0, DISPOSITIONS.indexOf("\n\n### F2")) });
			await Bun.write(path.join(root, "consultation.md"), record);
			expect(run(root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
		});
		it("prints the decoded report when the final yield's data is a JSON-encoded string, as the runtime delivers it", async () => {
			const root = await changeFixture();
			const file = await attempt(root, root, [{ yield: { id: "y1", data: JSON.stringify(ACCEPTED) } }]);
			expect(run("--consultation-report", file, root)).toEqual({ exitCode: 0, stdout: `${JSON.stringify(ACCEPTED)}\n`, stderr: "" });
		});
		for (const [name, turns, other, reason] of [
			["a brief naming another change directory", [{ yield: { id: "y1", data: ACCEPTED } }], true, "change directory"],
			["a turn on onara/cx/gpt-6.1-sol", [{ model: "onara/cx/gpt-6.1-sol" }, { yield: { id: "y1", data: ACCEPTED } }], false, "onara/cx/gpt-6.1-sol"],
			["a refused final yield after an accepted one", [{ yield: { id: "y1", data: ACCEPTED } }, { yield: { id: "y2", data: ACCEPTED, result: "refused" } }], false, "refused"],
			["a final yield without a tool result", [{ yield: { id: "y1", data: ACCEPTED, result: "none" } }], false, "no tool result"],
			["a final yield carrying section labels", [{ yield: { id: "y1", type: ["findings"], data: ACCEPTED } }], false, "incremental section"],
			["a data-less terminal yield", [{ yield: { id: "y1" } }], false, "no data"],
			["a data string that is not JSON", [{ yield: { id: "y1", data: "{bottom_line: KEEP}" } }], false, "not JSON"],
			["a data string encoding null", [{ yield: { id: "y1", data: "null" } }], false, "no data"],
			["two findings with the same id", [{ yield: { id: "y1", data: REPORT({ findings: [FINDING("F1"), FINDING("F1")] }) } }], false, "duplicate"],
		] as const) {
			it(`refuses ${name}`, async () => {
				const root = await changeFixture();
				const file = await attempt(root, other ? `${root}-other` : root, turns as unknown as Turn[]);
				const result = run("--consultation-report", file, root);
				expect(result.stdout).toBe("");
				expect(result.exitCode).toBe(1);
				expect(result.stderr).toContain(reason);
			});
		}
	});

	/** A copy of the scripts, the template and the agent definition in the deployed layout, for source changes. */
	async function skillCopy(): Promise<{ script: string; template: string; definition: string }> {
		const home = await fs.mkdtemp(path.join(os.tmpdir(), "consultation-skill-"));
		roots.push(home);
		const scripts = path.join(home, "skills", "review-work", "scripts");
		for (const name of ["validate-openspec-change.mjs", "folder-plan.mjs", "plan-contract.mjs"])
			await fs.cp(path.join(import.meta.dir, name), path.join(scripts, name));
		const template = path.join(home, "skills", "review-work", "openspec", "schemas", "omp-gated", "templates", "consultation.md");
		await fs.cp(CONSULTATION_TEMPLATE, template);
		const definition = path.join(home, "agents", "architecture-oracle.md");
		await fs.cp(ORACLE_DEFINITION, definition);
		return { script: path.join(scripts, "validate-openspec-change.mjs"), template, definition };
	}
	const runCopy = (script: string, ...args: string[]) => {
		const result = Bun.spawnSync(["node", script, ...args]);
		return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
	};
	/** Rewrites the copied definition's `output` JSON, its last frontmatter key. */
	async function changeSchema(definition: string, change: (schema: Record<string, any>) => void): Promise<void> {
		const [, front, ...body] = (await Bun.file(definition).text()).split(/^---$/m);
		const at = front.indexOf("\noutput:") + "\noutput:".length;
		const schema = JSON.parse(front.slice(at));
		change(schema);
		await Bun.write(definition, `---${front.slice(0, at)} ${JSON.stringify(schema)}\n---${body.join("---")}`);
	}

	describe("contract sources", () => {
		it("reads the slot texts from the shipped template", async () => {
			const copy = await skillCopy();
			const oldSlot = "<none, or the user's reason in their words>";
			const newSlot = "<none, or the user's reason, verbatim>";
			await edit(copy.template, oldSlot, newSlot);
			const stale = await consulted(await consultation({ ...SKIPPED, "Skip reason": newSlot }, copy.template));
			const refused = runCopy(copy.script, stale);
			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toContain("consultation.md Skip reason");
			const verbatim = await consulted(await consultation({ ...SKIPPED, "Skip reason": oldSlot }, copy.template));
			expect(runCopy(copy.script, verbatim)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
		});
		it("reads the report schema from the agent definition", async () => {
			const copy = await skillCopy();
			const root = await consulted(await consultation(CONSULTED));
			expect(runCopy(copy.script, root)).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
			await changeSchema(copy.definition, schema => {
				schema.properties.risk_summary = { type: "string" };
			});
			const missing = runCopy(copy.script, root);
			expect(missing.exitCode).toBe(1);
			expect(missing.stderr).toContain("report.risk_summary: missing");
		});
		it("applies the definition's maxElements", async () => {
			const copy = await skillCopy();
			await changeSchema(copy.definition, schema => {
				schema.properties.findings.metadata.maxElements = 1;
			});
			const result = runCopy(copy.script, await consulted(await consultation(CONSULTED)));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("report.findings: at most 1 elements, got 2");
		});
		it("refuses a JTD form outside the supported subset, naming it", async () => {
			const copy = await skillCopy();
			await changeSchema(copy.definition, schema => {
				schema.optionalProperties = { note: { type: "string" } };
			});
			const result = runCopy(copy.script, await consulted(await consultation(CONSULTED)));
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("unsupported JTD form optionalProperties");
		});
	});
});
