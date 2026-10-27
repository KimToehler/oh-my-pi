# Tasks

## 1. Validator binds QA artifacts

- [ ] 1.1 In `validate-gate-record.mjs` Phase 2, pass every `qa[]` row through `verifyAndPinArtifact`, with path field `qa.N.artifact` and digest field `qa.N.artifact_sha256` for row N. Its `admit` callback is true only when the file is absent from the `reviewed_sha` tree and lies below the record path without `.json`. Replace the line-393 "`qa[].artifact` is deliberately NOT exempt" comment with the rule as it now stands. Add one test per scenario of the two ADDED requirements and the new MODIFIED scenario, each titled with the prefix `QA artifact` and each seen failing against the unchanged validator first. Verify: `bun test team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs -t "QA artifact"`
- [ ] 1.2 Migrate every fixture under `scripts/fixtures/` and every scratch record built in `validate-gate-record.test.mjs` to a tracked QA file with its `artifact_sha256`. Keep the existing case where a QA row names the file its QA exercised as a blocking case. Verify: `bun test team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs`

## 2. Guidance names the durable QA location

- [ ] 2.1 In `review-work/SKILL.md`, update five places: the opening notes on addable paths; Fix waves step 2, which now sends wave QA to `.omp/team-config/evidence/gate/` plus the plan basename and `wave-N/`, addable and unstaged until Phase 5; the Phase 5 record template, whose `qa` rows carry `artifact_sha256` and whose cited files are staged with the record; the field rules paragraph; and the "`qa[].artifact` is **not** exempt" paragraph, rewritten to the new exemption. Verify: `f=team-config/agent/skills/review-work/SKILL.md; grep -qE 'evidence/gate/.plan basename./wave-.n./' $f && grep -q '"artifact_sha256"' $f && ! grep -qE 'QA artifacts go under .\.omp/team-config/evidence/.plan basename./wave-' $f`
- [ ] 2.2 Bring the other locations in line: the `team-config/README.md` layout lines, so that QA artifacts a record cites live under `evidence/gate/` plus the plan basename; the `EVIDENCE_DIR` comment in `gate-layout.mjs`; and the gate evidence path in `visual-qa/SKILL.md`, which moves below `.omp/team-config/evidence/gate/`. Verify: `grep -qE 'evidence/gate/.plan basename./' team-config/README.md && grep -qE 'evidence/gate/.slug./tui-web-terminal/' team-config/agent/skills/visual-qa/SKILL.md`

## 3. Final verification

- [ ] 3.1 F1. Manual QA on the real validator and `gate-convergence.mjs` CLI in scratch repositories, on the head after the last code commit. Each scenario gets its own `.md` evidence file under `.omp/team-config/evidence/gate/gate-durable-qa-evidence/f1/` with commands, exit codes, stdout/stderr and a final `RESULT PASS` or `RESULT FAIL` line. (a) The new guidance end to end: QA is written untracked to `evidence/gate/demo/wave-1/`, `GC snapshot` succeeds, and the record plus its QA files committed on top of `reviewed_sha` print `passed`. (b) The old ignored path `evidence/demo/wave-1/` prints `blocked` with a `qa.0.artifact` finding. (c) A post-review edit of a file that existed at `reviewed_sha` below `evidence/gate/demo/`, cited with its new digest, prints `blocked` with a `reviewed_sha` finding. (d) An onara-shaped record, whose QA files were committed under `docs/evidence/demo/f1/` before `reviewed_sha`, prints `passed`. Verify: `test "$(grep -l '^RESULT PASS' .omp/team-config/evidence/gate/gate-durable-qa-evidence/f1/*.md | wc -l | tr -d ' ')" = 4`
- [ ] 3.2 Run the full team-config suite once after the last code commit. Verify: `bun run test:team-config`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.2 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot. The F2 record cites this change's own QA artifacts under the new rule, with digests and below `.omp/team-config/evidence/gate/gate-durable-qa-evidence/`.
- Merge only after the F2 record validates.
- Deploy as in design.md, Migration Plan: `scripts/deploy-local.sh`, then every profile or `PI_CODING_AGENT_DIR` root, then restart the running sessions.
- Archive the change after the merge.
