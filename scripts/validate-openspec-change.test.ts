import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const SCRIPT = path.join(import.meta.dir, "validate-openspec-change.mjs");
const PROPOSAL_TEMPLATE = path.join(
	import.meta.dir,
	"..",
	"openspec",
	"schemas",
	"omp-gated",
	"templates",
	"proposal.md",
);
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

- **Mandatory class**: none (local reversible behaviour)
- **Review tier**: standard
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

function run(root: string): { exitCode: number; stdout: string; stderr: string } {
	const result = Bun.spawnSync(["node", SCRIPT, root]);
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
		"Review tier",
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
		expect(run(root).exitCode).toBe(0);
	});

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
		await Bun.write(gate, (await Bun.file(gate).text()).replace("none (local reversible behaviour)", "filesystem"));
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
