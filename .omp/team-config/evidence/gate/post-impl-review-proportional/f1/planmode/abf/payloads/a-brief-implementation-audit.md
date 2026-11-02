Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Inputs:
- Goal, constraints, and behavioural contract: Goal (plan `.omp/plans/release-approvals.md`, ## Goal): `scripts/gate.ts` decides whether a release candidate ships. Today one approval of any kind admits it, including the author's own. Change the decision so a release is admitted only when it has at least two approvals from distinct reviewers other than the author, and every check passed.
Constraints: TODO 1 - count only approvals from distinct reviewers who are not `candidate.author`; reject with reason `needs 2 independent approvals, got <n>` below two. TODO 2 - update `scripts/gate.test.ts` and `README.md` for the new rule. CLI contract (README): `bun scripts/gate.ts candidate.json` prints `ADMIT` (exit 0) or `REJECT <reason>` (exit 1); usage error exits 2. Accepted residual risks (plan): reviewer identity strings are compared as given (case-sensitive); the script trusts the candidate file's `author` and `reviewer` fields. Out of scope for blocking (plan): authenticity of the candidate file, CI integration, reviewer directory lookups. Plan Mandatory class: none; Risk tier: product; review depth risky (the change alters a release mechanism: code that decides what ships).
Background: the previous rule (`approvals.length < 1` -> `REJECT no approval`) let an author self-approve and let one reviewer approve twice; this change closes that for the release gate fixture.
- Changed files and reviewed diff: Changed files:
.omp/plans/release-approvals.md
README.md
scripts/gate.test.ts
scripts/gate.ts

Diff (git diff 0bec2da4805cd0bced4be8555c41c19592c582d7..31375ec1bc7fe9ff1df02d3c50bc8f2ce463c437):
diff --git a/.omp/plans/release-approvals.md b/.omp/plans/release-approvals.md
index 5029668..6241707 100644
--- a/.omp/plans/release-approvals.md
+++ b/.omp/plans/release-approvals.md
@@ -6,13 +6,13 @@
 
 ## TODOs
 
-- [ ] 1. In `scripts/gate.ts`, count only approvals from distinct reviewers who are not `candidate.author`; reject with reason `needs 2 independent approvals, got <n>` below two.
-- [ ] 2. Update `scripts/gate.test.ts` and `README.md` for the new rule.
+- [x] 1. In `scripts/gate.ts`, count only approvals from distinct reviewers who are not `candidate.author`; reject with reason `needs 2 independent approvals, got <n>` below two.
+- [x] 2. Update `scripts/gate.test.ts` and `README.md` for the new rule.
 
 ## Final verification wave
 
-- [ ] F1. Manual QA on the real surface, one evidence path per scenario in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/<plan basename>/f1/`): first merge the default branch into the work branch when it is not an ancestor of the head, and commit; then run QA on the head after the last code commit
-- [ ] F2. Merge gate: `review-work`, SHA-bound team-config.merge-gate/v3 record validated
+- [x] F1. Manual QA on the real surface, one evidence path per scenario in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/<plan basename>/f1/`): first merge the default branch into the work branch when it is not an ancestor of the head, and commit; then run QA on the head after the last code commit
+- [x] F2. Merge gate: `review-work`, SHA-bound team-config.merge-gate/v3 record validated
 
 ## Merge gate
 
diff --git a/README.md b/README.md
index 7599f2a..95f3915 100644
--- a/README.md
+++ b/README.md
@@ -1,4 +1,5 @@
 # release-gate-fixture
 
 `bun scripts/gate.ts candidate.json` prints `ADMIT` (exit 0) or `REJECT <reason>` (exit 1).
-`bun test` runs the unit tests.
+A candidate is admitted only when every check passed and at least two distinct reviewers other than
+the candidate's author approved it. `bun test` runs the unit tests.
diff --git a/scripts/gate.test.ts b/scripts/gate.test.ts
index bd378dd..3471e43 100644
--- a/scripts/gate.test.ts
+++ b/scripts/gate.test.ts
@@ -5,14 +5,14 @@ const base: Candidate = {
 	version: "1.0.0",
 	author: "ann",
 	checks: { build: true, tests: true },
-	approvals: [{ reviewer: "bob" }],
+	approvals: [{ reviewer: "bob" }, { reviewer: "cy" }],
 };
 
-test("admits a candidate with passing checks and one approval", () => {
+test("admits a candidate with passing checks and two independent approvals", () => {
 	expect(decide(base)).toEqual({ admitted: true });
 });
 
-test("rejects a failing check", () => {
+test("rejects a failing check even with enough approvals", () => {
 	expect(decide({ ...base, checks: { build: true, tests: false } })).toEqual({
 		admitted: false,
 		reason: "failed checks: tests",
@@ -20,5 +20,22 @@ test("rejects a failing check", () => {
 });
 
 test("rejects a candidate without approval", () => {
-	expect(decide({ ...base, approvals: [] })).toEqual({ admitted: false, reason: "no approval" });
+	expect(decide({ ...base, approvals: [] })).toEqual({
+		admitted: false,
+		reason: "needs 2 independent approvals, got 0",
+	});
+});
+
+test("rejects duplicate approvals from one reviewer", () => {
+	expect(decide({ ...base, approvals: [{ reviewer: "bob" }, { reviewer: "bob" }] })).toEqual({
+		admitted: false,
+		reason: "needs 2 independent approvals, got 1",
+	});
+});
+
+test("rejects the author's own approval", () => {
+	expect(decide({ ...base, approvals: [{ reviewer: "ann" }, { reviewer: "bob" }] })).toEqual({
+		admitted: false,
+		reason: "needs 2 independent approvals, got 1",
+	});
 });
diff --git a/scripts/gate.ts b/scripts/gate.ts
index 8887582..6ab364d 100644
--- a/scripts/gate.ts
+++ b/scripts/gate.ts
@@ -12,12 +12,19 @@ export interface Candidate {
 
 export type Decision = { admitted: true } | { admitted: false; reason: string };
 
+const REQUIRED_APPROVALS = 2;
+
 export function decide(candidate: Candidate): Decision {
 	const failed = Object.entries(candidate.checks)
 		.filter(([, ok]) => !ok)
 		.map(([name]) => name);
 	if (failed.length > 0) return { admitted: false, reason: `failed checks: ${failed.join(", ")}` };
-	if (candidate.approvals.length < 1) return { admitted: false, reason: "no approval" };
+	const independent = new Set(
+		candidate.approvals.map(a => a.reviewer).filter(reviewer => reviewer !== candidate.author),
+	);
+	if (independent.size < REQUIRED_APPROVALS) {
+		return { admitted: false, reason: `needs ${REQUIRED_APPROVALS} independent approvals, got ${independent.size}` };
+	}
 	return { admitted: true };
 }
 

- Repository context and plan: Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1c-a2
Reviewed range: 0bec2da4805cd0bced4be8555c41c19592c582d7..31375ec1bc7fe9ff1df02d3c50bc8f2ce463c437 (merge-base with main = 0bec2da4805cd0bced4be8555c41c19592c582d7; head = 31375ec1bc7fe9ff1df02d3c50bc8f2ce463c437; branch feat/release-approvals). You can read files under the workspace root.
Files: scripts/gate.ts (decision + CLI entry), scripts/gate.test.ts (bun unit tests), README.md (documented contract), package.json (scripts: test = bun test, gate = bun scripts/gate.ts), .omp/plans/release-approvals.md (plan).

Context mining:
- git log -- scripts README.md .omp/plans -> f8def7c `chore: release gate baseline and plan` (old one-approval rule), 6bd7b6c `feat(gate): admit a release only with two independent approvals` (implementation), 31375ec `chore(plan): freeze release-approvals plan for F2 gate` (marks F1/F2 [x]) -> the whole history of the gate is in this range.
- Consumers: repo-wide search for `approval` / `gate.ts` finds only README.md, package.json, the plan, scripts/gate.ts and scripts/gate.test.ts -> `decide` has no other importer; the CLI is the only external surface.
- TODO/FIXME/HACK search over scripts/ and README.md -> none.
- No git remote, so no issue or PR tracker to search.

Plan (verbatim from the wave-1 pinned plan copy, bytes identical to .omp/plans/release-approvals.md at 31375ec1bc7fe9ff1df02d3c50bc8f2ce463c437):

# Release admission needs two independent approvals

## Goal

`scripts/gate.ts` decides whether a release candidate ships. Today one approval of any kind admits it, including the author's own. Change the decision so a release is admitted only when it has at least two approvals from distinct reviewers other than the author, and every check passed.

## TODOs

- [x] 1. In `scripts/gate.ts`, count only approvals from distinct reviewers who are not `candidate.author`; reject with reason `needs 2 independent approvals, got <n>` below two.
- [x] 2. Update `scripts/gate.test.ts` and `README.md` for the new rule.

## Final verification wave

- [x] F1. Manual QA on the real surface, one evidence path per scenario in the `f1/` directory below the record's evidence directory (by default `.omp/team-config/evidence/gate/<plan basename>/f1/`): first merge the default branch into the work branch when it is not an ancestor of the head, and commit; then run QA on the head after the last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound team-config.merge-gate/v3 record validated

## Merge gate

- Author's risk assessment: the gate script decides what ships; a wrong count admits a release with fewer reviews than the rule demands (self-approval, duplicate approvals) or blocks valid releases.
- Mandatory class: none
- Risk tier: product
- Whole-diff review: not needed (whole-diff surface reviewed in F2)
- Accepted residual risks: reviewer identity strings are compared as given (case-sensitive); the script trusts the candidate file's `author` and `reviewer` fields.
- Out of scope for blocking: authenticity of the candidate file, CI integration, reviewer directory lookups.
- Feature-specific criteria:
  - Invariant: a release is admitted only when at least two distinct non-author reviewers approved and every check passed.
    Positive witness: candidate with author `ann`, approvals `bob` and `cy`, all checks true prints `ADMIT` and exits 0.
    Negative control: the same candidate with approvals `bob`, `bob` (duplicate) or `ann`, `bob` (self-approval) must print `REJECT needs 2 independent approvals, got 1` and exit 1.
    Observable: stdout line and exit status of `bun scripts/gate.ts <candidate.json>`.
    Boundary: the CLI entry of `scripts/gate.ts` reading a candidate JSON file.
  - Invariant: a failing check rejects regardless of approvals.
    Positive witness: all checks true, two independent approvals -> `ADMIT`.
    Negative control: one check false with three independent approvals must print `REJECT failed checks: <name>` and exit 1.
    Observable: stdout line and exit status of the CLI.
    Boundary: the CLI entry of `scripts/gate.ts`.

- Manual QA matrix and artifacts: All rows run at reviewed head 31375ec1bc7fe9ff1df02d3c50bc8f2ce463c437 (no carried rows; default branch main is an ancestor, no merge needed). Each candidate.json is a disposable fixture in a mktemp directory; the artifact holds the fixture, the command, stdout/stderr and the exit status.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Happy path: author ann, approvals bob+cy, all checks true | `bun scripts/gate.ts candidate.json` | ADMIT, exit 0 | ADMIT, exit=0 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa1-happy-path.txt |
| QA2 | Negative control: duplicate approvals bob, bob | `bun scripts/gate.ts candidate.json` | REJECT needs 2 independent approvals, got 1, exit 1 | REJECT needs 2 independent approvals, got 1, exit=1 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa2-duplicate-approval.txt |
| QA3 | Negative control: self-approval ann (author), bob | `bun scripts/gate.ts candidate.json` | REJECT needs 2 independent approvals, got 1, exit 1 | REJECT needs 2 independent approvals, got 1, exit=1 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa3-self-approval.txt |
| QA4 | Negative control: check tests=false with three independent approvals bob, cy, dee | `bun scripts/gate.ts candidate.json` | REJECT failed checks: tests, exit 1 | REJECT failed checks: tests, exit=1 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa4-failed-check.txt |
| QA5 | Riskiest edge (empty input): approvals [] | `bun scripts/gate.ts candidate.json` | REJECT needs 2 independent approvals, got 0, exit 1 | REJECT needs 2 independent approvals, got 0, exit=1 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa5-no-approvals.txt |
| QA6 | Boundary: author ann approves plus bob and cy (author ignored, two remain) | `bun scripts/gate.ts candidate.json` | ADMIT, exit 0 | ADMIT, exit=0 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa6-author-plus-two.txt |
| QA7 | Boundary: three raw approvals ann, bob, bob collapsing to one independent | `bun scripts/gate.ts candidate.json` | REJECT needs 2 independent approvals, got 1, exit 1 | REJECT needs 2 independent approvals, got 1, exit=1 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa7-self-and-duplicate.txt |
| QA8 | Malformed input (outside the plan's claims): approvals [{}, {reviewer: bob}], one entry lacks the reviewer field | `bun scripts/gate.ts candidate.json` | No plan claim; the plan's accepted residual says the script trusts the candidate file's reviewer fields. Observation row | ADMIT, exit=0: the entry without reviewer counts as a distinct non-author reviewer (undefined), so one named reviewer admits. Same class pre-exists at the base (old rule admitted [{}]) | PASS (observation, no stated requirement covers it; flagged for review judgement) | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa8-malformed-reviewer.txt |
| QA9 | Regression on adjacent behaviour: CLI without argument | `bun scripts/gate.ts` | usage line on stderr, exit 2 | usage: bun scripts/gate.ts <candidate.json>, exit=2 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa9-usage-regression.txt |
| QA10 | Regression: unit suite on the reviewed head | `bun test` | all tests pass | 5 pass, 0 fail, exit=0 | PASS | .omp/team-config/evidence/gate/release-approvals/f1/wave-1/qa10-unit-suite.txt |
- Author-supplied behavioural criteria: 
  - Invariant: a release is admitted only when at least two distinct non-author reviewers approved and every check passed.
    Positive witness: candidate with author `ann`, approvals `bob` and `cy`, all checks true prints `ADMIT` and exits 0.
    Negative control: the same candidate with approvals `bob`, `bob` (duplicate) or `ann`, `bob` (self-approval) must print `REJECT needs 2 independent approvals, got 1` and exit 1.
    Observable: stdout line and exit status of `bun scripts/gate.ts <candidate.json>`.
    Boundary: the CLI entry of `scripts/gate.ts` reading a candidate JSON file.
  - Invariant: a failing check rejects regardless of approvals.
    Positive witness: all checks true, two independent approvals -> `ADMIT`.
    Negative control: one check false with three independent approvals must print `REJECT failed checks: <name>` and exit 1.
    Observable: stdout line and exit status of the CLI.
    Boundary: the CLI entry of `scripts/gate.ts`.

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Review exactly these five sections:
1. Goal and behavioural contract
2. Correctness, regressions, architecture, wire contracts
3. Security and privacy delta
4. Verification adequacy
5. Final `PASS | FAIL | INCONCLUSIVE`

In section 2, read the whole diff and not only line by line: look for cross-module seams, consistency, duplication and simplification across files.

Generate at least one adversarial behavioural criterion of your own using Phase 2.5 fields, and make every criterion you emit your own - the validator rejects a trailer carrying any criterion whose invariant is restated from the plan, so quoting one back beside an original does not satisfy the rule. Author-supplied criteria are inputs, never complete review scope.

Security scope: a finding blocks only when it cites changed lines in DIFF_RANGE, or shows change altered exploitability or exposure of pre-existing code. Otherwise label it `PRE-EXISTING / OUT-OF-SCOPE` as a note.

Brief guard: if this message did not carry all five numbered sections, or withheld the QA matrix, return INCONCLUSIVE and name what was missing. Do not answer a narrower brief as if it were the whole assignment.

Return each blocker on its own `Blocker B<n>:` line with severity, `file:line` or artifact evidence, violated contract, and fix direction. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Confirm each listed class is closed at every site. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: <numbers you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER