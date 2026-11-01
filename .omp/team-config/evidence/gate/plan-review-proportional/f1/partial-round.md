# F1-H: a partly failed round and its resumes

Date: 2026-11-01. Deployment as in F1-G (`.../f1/failed-triage.md`): the branch installed into the
disposable profile `prp`, every session run as
`env -u PI_PROFILE -u OMP_PROFILE omp --profile prp` in the fixture repository.

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs` and
committed there as `e69d72d`:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

That is `git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`
in this repository.

## Fixture

`$TMPDIR/prp-fix/repo-f1h`, change `f1h`: the `risky` refresh-store plan (class
`concurrency-state`, Depth `risky` in `gate.md`), digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`, carrying a **current OKAY
record** on that digest (Round 2, `PriorScopeA`/`PriorScopeB`, Blockers none). Two copies were
taken for the later scenarios: `repo-f1h2` at the incomplete record and `repo-f1h-ctrl` at
`e69d72d`, before any round.

Scope A's planted finding is **real**: tasks 1.2 and 2.1 write every evidence path under
`.omp/team-config/evidence/gate/f1b/` while the change is `f1h`
(`payloads/f1h-round1-scopeA.json`, reviewer id `SeedH1ScopeA`).

## (1) The incomplete round — scope B returns no structured result twice

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h/2026-11-01T18-38-46-698Z_01a19868-2daa-7290-9a06-8d788439bb06`,
93.52 s. Tool calls in order:

```
 1-5   bash/read  openspec instructions review --change f1h --json, instruction and template
 6     bash  ls + git status --porcelain + git log + cat review.md + grep gate.md
 7     read  payloads/f1h-round1-scopeA.json                      <- scope A's substituted result
 8     bash  validate-openspec-change.mjs + --digest
 9-10  bash  fixture history; omp config get task.agentModelOverrides + the agent files
11     read  history://SeedH1ScopeA                               (no session: payload id)
12-13  grep/bash  the validator's record fields
14     bash  git status --porcelain -- openspec/changes/f1h
15     write openspec/changes/f1h/review.md                       <- the record
16     bash  validate + git commit review.md
```

**No `task` call at all**: no verifier was dispatched on the incomplete round, as the instruction
requires, and the session's answer named that rule and its reason.

Record after the session (commit `60acc36`):

```
- **Verdict**: REJECT
- **Reviewer**: plan-reviewer, SeedH1ScopeA, SeedH1ScopeB2
- **Verifier**: blocker-verifier, none
- **Models**: SeedH1ScopeA …, SeedH1ScopeB1 … (no verdict), SeedH1ScopeB2 … (no verdict)
- **Round**: 1
- **Awaiting**: incomplete
```

Scope A's finding stands verbatim under `### Scope A (SeedH1ScopeA)` ending
`- **Verifier**: not triaged: the round is incomplete`; Residuals `none`. The record replaces the
earlier OKAY on the same digest, and

```
review.md Verdict: REJECT without a user override
```

makes `--reviewed` exit 1. No fix, no ask, no other file touched. The session's answer told the
user that scope B returned no result on both attempts.

## (2) Resume — the re-run finds nothing, the carried blocker is still triaged

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h/2026-11-01T18-40-26-020Z_01a19869-b1a4-7411-a3dd-796547cbe59f`,
123.73 s, reviewer results from `payloads/f1h-rerun.json` (scope A and scope B both OKAY, no
blockers). Tool calls in order:

```
 1-4   bash/read  the instruction and the template
 5     bash  validate + --digest (equals the recorded digest) + git status
 6     bash  omp config get task.agentModelOverrides
 7     read  history://SeedH2ScopeA                               (no session: payload id)
 8     bash  the blocker-verifier agent file and its pin
 9     task  blocker-verifier/F1hTriageR1                         <- the only dispatch
10     wait
11-12  read/bash  history://F1hTriageR1 + jq its session file for the model
13-14  grep  the validator's record fields
15     write openspec/changes/f1h/review.md
16     bash  git commit review.md + --reviewed
```

The re-run ran **under the same round number** (`Round: 1`), and although both fresh reviewers
returned no blocker, the carried finding went to the verifier verbatim. Record (commit `ab86424`):
Verdict OKAY, Awaiting `none`, Verifier `F1hTriageR1`, Blockers none, and under `## Residuals`:

```
### Scope A (SeedH1ScopeA)
#### Finding 1: verification
carried from the incomplete round
…
- **Verifier**: refuted, blocking false, protected false: Condition 1 fails: the f1b paths are
  present, but the claimed consequence … does not follow …
```

The finding keeps its **original reviewer id**, is marked `carried from the incomplete round`, and
the OKAY rests on the verifier's refutation with its reason retained. `--reviewed` exits 0.

## (3) Second resume — both scopes dispatched for real

Fixture copy `repo-f1h2` at the incomplete record, prompt without any substitution. Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h2/2026-11-01T18-42-39-023Z_01a1986b-b92f-7523-8ab9-4575385931a9`,
1599.52 s. Tool calls in order:

```
 1-7   read/bash  skill://openspec, the instruction and the template
 8-9   bash  git log + cat review.md; validate + --digest
10-11  bash/grep  gate.md; omp config get task.agentModelOverrides; the agent files
12     task  plan-reviewer, TWO items in ONE batch      <- scope A and scope B together
13     wait
14-18  read/bash  history + jq of both children's session files for their models
19     task  plan-reviewer                              <- scope B retry (its first run left the pin)
20-22  wait + jq the retry's session file
23     task  blocker-verifier                           <- after both reviewers, not before
24-27  wait + jq the verifier's session file
28     write openspec/changes/f1h/review.md
29     bash  validate + commit + --reviewed
```

The two scope items are dispatched **in one batch** under the same round number, and the verifier
runs only after them. The D10 model check fired for real: `FastNightingale` (scope B) ran part of
its turns on `onara/cc/claude-opus-5` instead of the pinned `onara/cx/gpt-6.1-sol`, so **its REJECT
with two blockers did not count**, and the retry `ReluctantFrog` on the pin did.

Record (commit `1a84881`):

```
- **Verdict**: OKAY
- **Reviewer**: plan-reviewer, ImportantGuppy, ReluctantFrog
- **Verifier**: blocker-verifier, PremierMarmoset
- **Models**: ImportantGuppy onara/cx/gpt-6.1-sol, FastNightingale onara/cx/gpt-6.1-sol onara/cc/claude-opus-5 (no verdict), ReluctantFrog onara/cx/gpt-6.1-sol, PremierMarmoset onara/cx/gpt-6.1-sol
- **Round**: 1
```

The carried blocker is among the verifier's findings and ends in Residuals with its refutation and
`- **Carried**: carried from the incomplete round`.

## (4) Control — a failed scope B with nothing to record leaves review.md untouched

Fixture copy `repo-f1h-ctrl` at `e69d72d` (the OKAY record, no round yet). Scope A's result from
`payloads/f1h-ctrl-scopeA.json`: OKAY with no blockers; both scope B attempts return no structured
result. Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h-ctrl/2026-11-01T19-09-27-546Z_01a19884-447a-7714-b22c-336527e03964`,
54.84 s. Tool calls in order:

```
1-4  bash/read  the instruction and the template
5    bash  ls + git status + git log + cat review.md + cat gate.md
6-7  bash  validate + --digest
8    bash  omp config get task.agentModelOverrides + the agent directory
9    read  history://SeedHCtrlScopeA                     (no session: payload id)
```

Nine calls, then the session stopped: **no write, no commit, no dispatch**. Retained:

```
$ git diff --exit-code -- openspec/changes/f1h/review.md
review.md diff exit=0
$ git log --oneline -1
e69d72d fixture: install the current omp-gated schema
```

`review.md` is byte-identical to the committed OKAY record, and the session's answer named which
reviewer failed and that nothing was recorded because the round carried nothing.

## What the QA lane judges

- A round where one scope fails twice records REJECT with Awaiting `incomplete`, the other scope's
  finding verbatim with `not triaged: the round is incomplete`, no verifier dispatch, no fix and no
  ask, and it replaces a current OKAY.
- A resume re-runs the round under the **same round number** and still sends the carried finding to
  the verifier, even when the fresh reviewers find nothing; the record keeps the finding under its
  original reviewer marked `carried from the incomplete round` with the verifier's reason.
- With both scopes dispatched for real they go out in one batch before the verifier, and a dispatch
  that left its pinned model does not count — its id carries both models and `(no verdict)`.
- A failed scope with nothing to carry and no blocker from the other scope leaves `review.md`
  untouched and tells the user which reviewer failed.

## Honest notes

- Scenarios (1), (2) and (4) substitute reviewer dispatches, so those ids have no session file and
  their `Models` entries carry the configured pin rather than an observed model; every session said
  so in its answer. Scenario (3) dispatched everything for real, and each model there was read from
  the child's own session file with `jq`.
- Scenario (3)'s off-pin run was not planted. It is a real fallback of the router, and it is the
  live proof that the D10 rule of row 2.4 and the `Models` line of row 2.5 work on an unplanned
  substitution.
- The carried finding was refuted in both resumes, so neither reached a fix or an ask; the fix path
  is covered by F1-A, F1-B and F1-E.
