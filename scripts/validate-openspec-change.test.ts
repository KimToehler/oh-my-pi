import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const SCRIPT = path.join(import.meta.dir, "validate-openspec-change.mjs");
const roots: string[] = [];

async function fixture(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "openspec-change-"));
	roots.push(root);
	await fs.mkdir(path.join(root, "specs", "feature"), { recursive: true });
	await Bun.write(path.join(root, "proposal.md"), "# Proposal\n\nA concrete change.\n");
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
