# QA row M3: Minimum: adjacent regression, router members unchanged and the team-config suite on the reviewed head

## Team-config suite (run for this wave)

Command, in /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins: `bun run test:team-config` (package.json `test:team-config`: team-config/tests, validate-gate-record, gate-convergence, install-team-config, validate-openspec-change, model-name, install-openspec-workflow, ensure-openspec-cli, measure-context, app-qa-drivers qa.test.mjs). Head: `ee392ff25dc3f826a2c3bfe13badb5de4ef5e643`.

```text
 996 pass
 0 fail
 1217 expect() calls
Ran 996 tests across 11 files. [452.19s]
exit=0
```

Failing tests: 0.

## Router installation rows (carried from F1)

- `router-plan-review`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The plan-review model check still covers `plan-reviewer` with the same name-only comparison; the schema edits add which agents it covers, the delta reviewer and the exception rewrite, none of which this row reaches (it ends at round 1's count or before any dispatch counts).
- `router-consultation`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The consultation is decided by step 2a's report check (`validate-openspec-change.mjs --consultation-report`, unchanged since the capture); the schema edit only states that step 3's check never applies to it, which can remove a check but not change the one this row observed.

### router-plan-review

PASS. `plan-reviewer` resolved to `onara/cx/gpt-6.1-sol` at `high`; the OKAY counted and review.md Models names `onara/cx/gpt-6.1-sol`.

### router-consultation

PASS. The attempt recorded only `onara/cc/claude-fable-5-2`, `--consultation-report` exited 0, record `consulted`.

## Cited captures (tracked at the reviewed SHA)

- `07493d6bcacc163137d3da6490b804d7ca22b63b9ee84092145b3b5a33e7cc2f`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/router-plan-review.md`
- `b0570d8caf1acaf65c408867cebdfb393e98f177bfaa1a902a279671965c27ef`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/router-consultation.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
