# F1-A: a `standard` review end to end

Date: 2026-11-01. Delivered branch deployed with `bun scripts/install-team-config.ts`; the schema
installed into the fixture repository with `install-openspec-workflow.mjs`.

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
`PI_CODING_AGENT_DIR=~/.omp/profiles/prp/agent bun scripts/install-team-config.ts`, and every
session ran as `omp --profile prp` with `PI_PROFILE`/`OMP_PROFILE` unset. That agent directory is
disposable and separate from the user's own; the user's `~/.omp/agent` was never written to.

## Fixture

`$TMPDIR/prp-fix/repo-f1a`, a git repository with `src/day-list.ts`, `test/day-list.test.ts`,
`package.json` (a `format` script) and `README.md`. Change `f1a` plans a documentation change: add
`docs/glossary.md` defining `entry`, `day total` and `minutes`, linked from `README.md`.
`gate.md`: Mandatory class `none`, Depth `standard`, Risk tier `product`.
One defect was planted and nothing else: task 1.1's Verify is `test -f docs/glossary.md`, which
passes when the glossary is empty.

## Observed run

Session: `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1a/2026-11-01T09-50-31-355Z_01a19684-8bbb-75ff-af02-0c11d7c6702d`.

Tool-call order (from the session file):

```
 1 read skill://openspec
 2-3 openspec instructions review --change f1a --json
 6 validate-openspec-change.mjs openspec/changes/f1a        -> passed
 7 git status --porcelain -- openspec/changes/f1a (empty) + --digest
 8 task plan-reviewer/PlanReviewF1aR1                        (one item, all-scopes brief)
12 task blocker-verifier/BlockerVerifyF1aR1                  (both findings, numbered)
18 git commit review.md  "record round 1 (REJECT)"           <- record before any artifact edit
19 edit  specs/timesheet-glossary/spec.md                    <- the fix
20 git commit the fix
21 validate + digest
22 task plan-reviewer/PlanReviewF1aR2Delta                   (fix-delta brief)
25 git commit review.md  "record round 2 delta check"
```

Resolved models, from each child's session file (`model_change` + `thinking_level_change`):

| child | model | effort |
|---|---|---|
| `PlanReviewF1aR1` | `onara/cx/gpt-6.1-sol` | high |
| `PlanReviewF1aR2Delta` | `onara/cx/gpt-6.1-sol` | high |
| `BlockerVerifyF1aR1` | `onara/cx/gpt-6.1-sol` | medium |

Depth `standard` was read from `gate.md` and dispatched exactly one reviewer per round; the delta
check diffed `openspec/changes/f1a` against the commit that recorded round 1 (`7741b61`), with the
patch under `.omp/team-config/gate-deltas/` and uncommitted.

Verifier results, round 1 (two findings, one entry per index):

1. "task 1.1's `test -f docs/glossary.md` cannot fail when the task is broken" — **refuted**,
   non-blocking: the verifier held that task 2.1's manual QA would catch a missing term.
2. "the new capability's spec has no `## Purpose` section" — **confirmed, blocking**.

Final record (`openspec/changes/f1a/review.md`, commit `fbc4b26`): Verdict OKAY, Round 2,
Awaiting `none`, Blockers none, the refuted finding under `## Residuals` with the verifier's
reason. `validate-openspec-change.mjs --reviewed` exits 0. No ask was raised.

## Acceptance

| criterion | result |
|---|---|
| depth `standard` | yes, from `gate.md` |
| one `plan-reviewer` at `gpt-6.1-sol` high | yes |
| one verifier at `gpt-6.1-sol` medium | yes |
| REJECT `review.md` written before the first artifact edit | yes: commit 18 precedes edit 19 |
| the confirmed finding fixed | yes |
| one delta check | yes, based on the recording commit |
| `review.md` OKAY with refuted findings under Residuals | yes |
| no ask | yes |

## Observation for the QA lane

The planted "Verify cannot fail" defect was **refuted** here and again in F1-E-b's first attempt,
while a different verifier run confirmed the same class of finding. On this finding class the
verifier's judgement is not stable between runs, and it leans on written criteria (negative-control
scenarios, manual QA tasks) as if they were executable checks. The session itself flagged the
refutation as weak in its final report and did not re-triage it, which is what the instruction
requires. The depth/budget mechanics and the record discipline were stable across every run.
