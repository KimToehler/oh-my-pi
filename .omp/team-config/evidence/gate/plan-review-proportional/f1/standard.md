# F1-A: a `standard` review end to end

Date: 2026-11-01, re-run after the F2 wave-1 fixes (rows 5.1-5.3). Delivered branch deployed with
`bun scripts/install-team-config.ts`; the schema installed into the fixture repository with
`install-openspec-workflow.mjs`.

## Deployment deviation from the task text (and why)

The task prescribed `PI_CODING_AGENT_DIR=$TMPDIR/prp-agent`. That variable does not redirect
**subagent discovery**: `getConfigDirs` builds its user-level roots from
`path.join(os.homedir(), getConfigAgentDirName())`
(`packages/coding-agent/src/config.ts:84-88`), so a session started with the variable still looked
only in `~/.omp/agent/agents` and failed with
`Unknown agent "blocker-verifier". … Searched: ~/.omp/agent/agents` (first F1-A attempt, 20 min,
no record written — the instruction's incomplete-round rule held and nothing was fixed).

`getConfigAgentDirName()` is profile-aware (`packages/utils/src/dirs.ts:334-337`), so the runs use
a disposable **profile** instead: the branch was installed with
`PI_CODING_AGENT_DIR=$HOME/.omp/profiles/prp/agent bun scripts/install-team-config.ts`, and every
session ran as `omp --profile prp` with `PI_PROFILE`/`OMP_PROFILE` unset. That agent directory is
disposable and separate from the user's own; the user's `~/.omp/agent` was never written to.

## Fixture

`$TMPDIR/prp-fix/repo-f1a`, a git repository with `src/day-list.ts`, `test/day-list.test.ts`,
`package.json` (a `format` script) and `README.md`. Change `f1a` plans a documentation change: add
`docs/glossary.md` defining `entry`, `day total` and `minutes`, linked from `README.md`.
`gate.md`: Mandatory class `none`, Depth `standard`, Risk tier `product`.

One defect is planted and nothing else: task 1.1's Verify is `test -f docs/glossary.md`, which
passes when the glossary is empty, and no other task checks the glossary's content — task 2.1's
manual QA follows the README link only. The spec's requirement and its Negative control scenario
state that the three terms must be defined, but no task executes them.

### Fixture correction between the two runs (honest record)

The first fixture's task 2.1 also had the QA lane read the glossary and judge all three
definitions. That is a check the plan runs (`Change verification` in `skill://review-work` counts a
planned real-session run with retained outputs), so the planted Verify gap was in fact covered, and
the verifier's refutation of it was defensible. The fixture now limits that QA to the README link,
which leaves the glossary's content genuinely unchecked. Commit `60a6764` in the fixture repository.

## Observed run

Session: `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1a/2026-11-01T10-45-35-708Z_01a196b6-f75c-716a-9353-2798de8802cd`.

Tool-call order (from the session file):

```
 1     read skill://openspec
 2-3   openspec instructions review --change f1a --json
 6     validate-openspec-change.mjs openspec/changes/f1a        -> passed
 7     git status --porcelain -- openspec/changes/f1a (empty) + --digest
 8     task plan-reviewer/F1aPlanReview                          (one item, all-scopes brief)
11     task blocker-verifier/F1aBlockerTriage                    (the one finding, numbered)
13     write  openspec/changes/f1a/review.md                     <- record
14-17  read   tasks.md, spec.md, design.md, src/day-list.ts      (reads only)
18     git commit review.md  "record review round 1 (REJECT)"    <- record before any artifact edit
22-30  edit   design.md, specs/timesheet-glossary/spec.md, tasks.md   <- the fix
32     validate + digest
34     task plan-reviewer/F1aDeltaReview                          (fix-delta brief)
37-38  write + git commit review.md  "record review round 2 (OKAY, fix-delta check)"
```

Resolved models, from each child's session file (`model_change` + `thinking_level_change`):

| child | model | effort |
|---|---|---|
| `F1aPlanReview` | `onara/cx/gpt-6.1-sol` | high |
| `F1aDeltaReview` | `onara/cx/gpt-6.1-sol` | high |
| `F1aBlockerTriage` | `onara/cx/gpt-6.1-sol` | medium |

Depth `standard` was read from `gate.md` and dispatched exactly one reviewer per round; the delta
check diffed `openspec/changes/f1a` against the commit that recorded round 1 (`c97116e`), with the
patch under `.omp/team-config/gate-deltas/` and uncommitted.

Round 1: the reviewer returned one finding — "Task 1.1 checks only file existence, and F1 checks
only navigation. Neither establishes that the glossary defines any of the three terms", citing
`tasks.md:5`, `:6`, `:10` against `spec.md:7-8` and `spec.md:14-16`. That is the planted defect.

Verifier result (one entry for the one index): **confirmed, blocking true, protected false** —
"Condition 1: concrete scenario — an empty or partially written docs/glossary.md with the correct
README link passes every planned check while violating the change's sole requirement. Condition 2:
evidence verified … Condition 3 … tasks.md:10 (F1) scopes manual QA to following the README link".

Record of round 1 (`c97116e`): Verdict REJECT, Depth `standard`, Round 1, Awaiting `none`, the
finding under `## Blockers` with the verifier's result and reason, `## Residuals` none.
Written and committed before the first artifact edit.

Fix (`f370f7f`, plan files only): `design.md` fixes the glossary's format and adds an `awk`
glossary check; `spec.md` requires the definitions to match `src/day-list.ts` and adds a second
negative control for a partial glossary; task 1.1's Verify now runs that check on the real file and
requires it to fail on a no-definitions and on a partial file; a new task 2.2 has the QA lane read
each definition against the code. The session ran the new check against fixtures (full glossary
passes; missing, empty, title-only, partial and heading-without-text all fail).

Round 2: one fresh delta reviewer (`F1aDeltaReview`) on the new digest, OKAY with no blockers.
Final record (`1e8eba1`): Verdict OKAY, Round 2, Awaiting `none`, Blockers none, Residuals none.
`validate-openspec-change.mjs --reviewed` prints `reviewed: OKAY in round 2`. No ask was raised.

## Acceptance

| criterion | result |
|---|---|
| depth `standard` | yes, from `gate.md` |
| one `plan-reviewer` at `gpt-6.1-sol` high | yes, per round |
| one verifier at `gpt-6.1-sol` medium | yes |
| REJECT `review.md` written before the first artifact edit | yes: commit 18 precedes edit 22 |
| the planted finding confirmed and fixed | yes: confirmed blocking, fixed in `f370f7f` |
| one delta check | yes, based on the recording commit `c97116e` |
| `review.md` OKAY with any refuted findings under Residuals | yes; this round produced none |
| no ask | yes |

## Observation for the QA lane

Before the wave-1 fix the verifier refuted this finding class by citing the spec's own Negative
control scenario as if it were a check. Condition 3 of `blocker-verifier.md` now counts only checks
the plan runs, and the same finding class is confirmed here and in the isolated probe recorded in
`seeded.md`. The depth/budget mechanics and the record discipline were stable across every run,
before and after the fix.
