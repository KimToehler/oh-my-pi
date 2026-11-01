# F1-G: a failed triage and its resume

Date: 2026-11-01. Same deployment as F1-A (`.../f1/standard.md`, "Deployment deviation"): the
branch installed into the disposable profile `prp`
(`PI_CODING_AGENT_DIR=$HOME/.omp/profiles/prp/agent bun scripts/install-team-config.ts`), every
session run as `env -u PI_PROFILE -u OMP_PROFILE omp --profile prp` in the fixture repository.

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs` and
committed there as `e99b389`:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

That is `git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`
in this repository, so the runs observe the delivered text of this change, rows 5.12-5.26 included.
A first set of runs (18:22-18:27) ran on a fixture that still carried the pre-5.12 schema
(`b3a84a09`); they were discarded and every run below was re-run after the install.

## Fixture

`$TMPDIR/prp-fix/repo-f1g`, change `f1g`: the `risky` refresh-store plan of F1-B (class
`concurrency-state`, Depth `risky` in `gate.md`), digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`. Commit `66d1594` carries a
**current OKAY record** on exactly that digest (Round 2, Blockers none, Residuals none,
`--reviewed` exits 0). Both scenarios start from `e99b389`, which is that state plus the schema
install.

Payloads: `payloads/f1g-round1.json` (scope A `SeedG1ScopeA`, scope B `SeedG1ScopeB`, each REJECT
with one blocking finding: the plan's evidence paths name another change's folder; no requirement
states `state` before the first refresh) and `payloads/f1g-verifier-incomplete.json` (a verifier
result holding **only index 1** of the two findings).

## (a) Triage fails twice, the record replaces the OKAY, a fresh session resumes it

### Session 1 — both verifier attempts from the incomplete payload

`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1g/2026-11-01T18-31-42-310Z_01a19861-b3e6-7066-a476-e7c8c36f3742`,
68.52 s. Tool calls in order:

```
 1-2  bash  openspec instructions review --change f1g --json  (second run writes it to a file)
 3-8  read  the delivered instruction and the record template
 9    bash  ls + cat review.md + grep Depth/Mandatory gate.md + git log + git status --porcelain
10    bash  cat f1g-round1.json; cat f1g-verifier-incomplete.json      <- the two substitutions
11    bash  validate-openspec-change.mjs openspec/changes/f1g + --digest
12    read  history://SeedG1ScopeA                                     (no session: payload id)
13    bash  grep the validator for Models/Awaiting/not triaged
14    write openspec/changes/f1g/review.md                             <- the record
15    bash  git commit review.md  "record review round 1 (REJECT, awaiting triage: verifier failed twice)"
```

No `task` call: no reviewer and no verifier was dispatched, both verifier attempts came from the
payload as instructed. No artifact was edited and no ask was printed.

Record after session 1 (commit `9d040aa`):

```
- **Verdict**: REJECT
- **Reviewed digest**: a20fa81a…0ce29
- **Depth**: risky
- **Reviewer**: plan-reviewer, SeedG1ScopeA, SeedG1ScopeB
- **Verifier**: blocker-verifier, SeedG1Verify2
- **Models**: SeedG1ScopeA …, SeedG1ScopeB …, SeedG1Verify1 … (no verdict), SeedG1Verify2 … (no verdict)
- **Round**: 1
- **Awaiting**: triage
```

Both findings stand verbatim under `## Blockers`, each grouped under its reviewer and each ending
`**Verifier**: not triaged: the verifier failed twice`; Residuals `none`. The earlier OKAY record
is gone: `--reviewed` now fails with

```
review.md Verdict: REJECT without a user override
```

and the session's answer named the triage failure and that apply stays blocked.

### Session 2 — resume with the verifier running for real

`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1g/2026-11-01T18-32-56-420Z_01a19862-d564-7743-902e-79d37c0b63a7`,
128.94 s, prompt without any substitution. Tool calls in order:

```
 1-9   read skill://openspec, the instruction and the template
10     bash  git status + git log + cat review.md
11     bash  validate-openspec-change.mjs + --digest        (digest equals the record's)
12-13  bash  omp config get task.agentModelOverrides; read the blocker-verifier agent file
14     read  agent://SeedG1ScopeA                           (gone: findings copied from the record)
15     task  blocker-verifier/F1gVerify3                    <- the only dispatch of the session
16     wait
17-18  read  history://F1gVerify3 + jq the child session for its model
19     bash  read tasks.md and spec.md to check the verifier's citations
20     write openspec/changes/f1g/review.md
21     bash  --digest + git commit review.md
```

**Exactly one verifier dispatch, no reviewer dispatch.** The brief carried exactly the two recorded
findings, copied verbatim from `review.md` because the payload reviewers have no session. The
verifier ran on `onara/cx/gpt-6.1-sol` and returned one entry per index.

Record after session 2 (commit `921a080`): Verdict OKAY, same digest, Round still 1, Awaiting
`none`, Verifier `F1gVerify3`, `## Blockers` none, and both findings under `## Residuals` with the
verifier's result and reason (`refuted (blocking false, protected false): …`). `--reviewed` prints
`reviewed: OKAY in round 1`. Only `review.md` changed.

## (b) Retry recovery — the first attempt fails, the retry runs for real

Fixture reset to `e99b389`. Prompt: round-1 reviewer results from the payload, **the first**
verifier attempt from `f1g-verifier-incomplete.json` with id `SeedG1Verify1`, every further attempt
dispatched for real.

`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1g/2026-11-01T18-35-10-167Z_01a19864-dfd7-7344-bc8d-b7bba9817923`,
130.29 s. Tool calls in order:

```
 1-4   bash/eval  openspec instructions review --change f1g --json, written to a file
 5     bash  ls + cat review.md + git status + git log + grep Depth gate.md
 6     bash  validate + --digest + --reviewed + cat gate.md
 7     bash  git log/show on the change folder + omp config get task.agentModelOverrides
 8-9   read  history://SeedG1ScopeA, history://SeedG1Verify1   (no session: payload ids)
10     bash  the blocker-verifier agent file and its model
11     eval  the two findings prepared for the brief
12     task  blocker-verifier/F1gVerifyRetry                   <- the retry, dispatched for real
13     wait
14-15  read/bash  history://F1gVerifyRetry + jq its session for the model
16-19  bash/eval  check the verifier's citations, write review.md
20     bash  git commit review.md
```

Record after session 3 (commit `1147351`):

```
- **Verdict**: OKAY
- **Verifier**: blocker-verifier, F1gVerifyRetry
- **Models**: SeedG1ScopeA …, SeedG1ScopeB …, SeedG1Verify1 … (no verdict), F1gVerifyRetry onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: none
```

The `Verifier` line names the **retry's** subagent id, and the failed first attempt appears on the
`Models` line with `(no verdict)` — the rule row 2.5 added. Both findings are residuals with the
retry's result and reason; `--reviewed` exits 0.

## What the QA lane judges

- A triage that fails twice produces a committed REJECT record with Awaiting `triage` and both
  findings untriaged under `## Blockers`, and it replaces a current OKAY on the same digest.
- Nothing else happens in that session: no fix, no ask, no reviewer or verifier dispatch beyond the
  two failed attempts.
- A fresh session resumes that record with exactly one verifier dispatch carrying exactly the
  recorded findings, no reviewer dispatch, and rewrites the record with the verifier's results.
- A first attempt that fails and a retry that succeeds leaves the retry's id as `Verifier` and the
  failed attempt on the `Models` line with `(no verdict)`.

## Honest notes

- The reviewer ids of the payloads have no session file, so each session wrote the pinned model for
  them on the `Models` line and said so in its answer. The pin itself
  (`task.agentModelOverrides.plan-reviewer: onara/cx/gpt-6.1-sol:high`) was read back from the
  profile in sessions 2 and 3; the verifier's own model was read from its child session file.
- Session 2 and session 3 both numbered the run `Round: 1` rather than continuing the earlier
  OKAY's round 2, and both said so. The instruction's round rule counts the rounds of *this*
  review; the earlier record was a finished review with nothing open.
- Both findings were refuted, so neither scenario reached a fix or an ask. That is the point of the
  row: it observes the triage-failure and resume paths, not the fix path, which F1-A, F1-B and
  F1-E cover.
