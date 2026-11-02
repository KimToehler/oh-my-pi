# F2 wave 4 — manual QA

Date: 2026-11-02. Snapshot `a1d8ad7ab43c` (`F2-fcc6b298d658-wave-4.snapshot.json`), worktree
`/Users/tim/git/oh-my-pi/.worktrees/plan-review-proportional`. Rows 1 and 2 are re-runs of the
wave-3 rows after fix rows 5.30-5.37; rows 3-7 are this plan's final-verification evidence, all
re-captured on the delivered text of this head (schema blob
`b0f3c2009a7bd3d89e60438b34011efdbdbaff0b`).

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | Every `Verify:` command of the plan's task rows runs as written, from the worktree root | `bun -e 'for each "- [x] <id> … Verify: `<cmd>`" in tasks.md run bash -lc <cmd>'` | every row exits 0 | `rows=59 failures=0` | PASS | this file, "Verify sweep" |
| 2 | The three test suites covering the changed scripts | `bun test validate-openspec-change.test.ts install-openspec-workflow.test.ts`; `node --test validate-gate-record.test.mjs`; `node --test gate-convergence.test.mjs` | all pass | 166 / 313 / 61 pass, 0 fail | PASS | this file, "Suites" |
| 3 | The `standard` happy path end to end on a fixture whose planted defect no check in the plan can catch | row 4.1 re-run for rows 5.32 and 5.33 | the defect confirmed blocking, fixed, one delta check, OKAY without an ask | `d68c668` pre-triage, `5c44d1c` triage (both findings confirmed), `cfa573b` fix, `a1d457f` OKAY round 2, `--reviewed` exit 0 | PASS | `../f1/standard.md` |
| 4 | Real sessions on the delivered instruction: `risky`, security scope, lanes, seeded rounds, instruction review | rows 4.2-4.6, re-run for row 5.33 | depth, reviewer count, verifier triage, record and asks as the spec requires | as recorded per scenario, honest deviations named | PASS | `../f1/risky.md`, `../f1/security.md`, `../f1/lanes.md`, `../f1/seeded.md`, `../f1/instruction-review.md` |
| 5 | Failure paths: a triage that fails twice and its resume, a retry that recovers, a partly failed round with both resumes and its control, a dispatch off its pinned model | rows 4.8-4.10, re-run for rows 5.33-5.35 | REJECT with `Awaiting: triage`; the retry's id as Verifier; an `incomplete` round with no verifier and a same-number resume; the control leaves `review.md` untouched; `(no verdict)` for a substituted dispatch | as recorded; the control's `git diff --exit-code` and `git status --porcelain` both exit 0 | PASS | `../f1/failed-triage.md`, `../f1/partial-round.md`, `../f1/substitution.md` |
| 6 | The two new state transitions of rows 5.30 and 5.31 | F1-E legs (b) and (d), F1-G, F1-H | the round's REJECT is committed before the verifier dispatch; a Fix answer on a spent budget edits the artifacts and buys exactly one delta check | `778e92c`/`02fbb36`/`4fd2d8b`/`7be739b` are pre-dispatch records; `90ce052` + one delta check → `f0788f2` OKAY round 3; `b926c55` + one delta check → the ask again | PASS | `../f1/seeded.md`, `../f1/failed-triage.md`, `../f1/partial-round.md` |
| 7 | The exhaustion ask survives the session that put it | row 4.5 (b), re-run for row 5.36 | a fresh session re-asks from the record with no dispatch and no edit, then Override records the reason and `--reviewed` passes | 10-call re-ask session, change folder `git diff --exit-code` exit 0; `dc67dcf` Override, `review.md` the only changed file, `--reviewed` exit 0 | PASS | `../f1/seeded.md` |

No failing row.

## Verify sweep

```
$ bun -e 'for each "- [x] <id> … Verify: `<cmd>`" in tasks.md run bash -lc <cmd> from the worktree root'
rows=59 failures=0
```

## Suites

```
$ bun test team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts \
           team-config/agent/skills/review-work/scripts/install-openspec-workflow.test.ts
 0 fail
 465 expect() calls
Ran 166 tests across 2 files. [11.62s]

$ node --test team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
ℹ tests 313
ℹ pass 313
ℹ fail 0

$ node --test team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
ℹ tests 61
ℹ pass 61
ℹ fail 0
```

## Change validity

```
$ DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec validate plan-review-proportional --strict --no-interactive
Change 'plan-review-proportional' is valid

$ node team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs openspec/changes/plan-review-proportional
passed
```
