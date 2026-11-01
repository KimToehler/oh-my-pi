# F1-B: a `risky` review, two full rounds, then the exhaustion ask

Date: 2026-11-01, re-run for row 4.11 on the delivered text of this head. Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into the fixture and committed there as `54d539e`:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`.)

## Fixture

`$TMPDIR/prp-fix/repo-f1b`, change `f1b`: the refresh-store plan, **Mandatory class
`concurrency-state`, Depth `risky`** in `gate.md`, digest
`102212f2bd367462037dd99c5b7abf5c62b4e1b7fe2a44fef5aae628634162ac` at round 1. The planted gaps are
real: the plan's tests never drive a superseded refresh that settles while the newest is pending,
task 1.2's Verify only checks that the test file exists, and there is no F1/F2 final verification.

## Session 1 — round 1 is incomplete

`…/sessions/-tmp-prp-fix-repo-f1b/2026-11-01T19-26-22-268Z…`, 1602 s.

```
13  task plan-reviewer/F1bScopeA, plan-reviewer/F1bScopeB     <- scope A and B in ONE batch
14  wait
17  wait
20  task plan-reviewer/F1bScopeARetry
21  wait
```

Depth `risky` was read from `gate.md`. Scope A ran partly on `onara/cc/claude-opus-5` → no verdict;
its retry hit the provider's output size limit six times (17727 tokens against a 16384 cap) and
returned nothing. Scope B, on its pin, returned REJECT with three blockers.

Record `1195dcf`: REJECT, Round 1, **Awaiting `incomplete`**, Verifier `none`, scope B's three
blockers verbatim with `not triaged: the round is incomplete`, and a `Models` line carrying
`(no verdict)` on both failed scope A attempts. No verifier ran; `--reviewed` exits 1.

## Session 2 — the resume re-runs round 1 and asks a scope question

`…T19-53-15-824Z…`, 381 s.

```
17  task plan-reviewer/F1bRerunScopeA, plan-reviewer/F1bRerunScopeB    <- one batch again
18,21 wait
23-28 eval/wait   -> blocker-verifier F1bTriage (dispatched from an eval cell with the fixed brief)
```

Same round number, fresh reviewers, both on their pins, both REJECT. The verifier took **all seven
findings** — the three carried from the incomplete round plus one from scope A and three from scope
B — and confirmed every one as blocking, none protected.

Record `7da60ca`: REJECT, **Round 1** (not 2: the re-run is the same round), Awaiting `scope`,
Verifier `F1bTriage`, `Models` listing all six dispatches of both attempts with their `(no verdict)`
marks. Finding 4 needs a decision the artifacts leave open (what the store does when the newest
refresh fails), so the session printed the **scope ask**: the finding verbatim with the verifier's
reason, two named alternatives and Stop — **and no "keep as a residual" option**, because the
finding is confirmed. Nothing was edited.

## Session 3 — the answer, the fix, round 2, the exhaustion ask

`…T19-59-52-376Z…`, 2979 s. The QA lane answered the scope ask with alternative 1 (add an `error`
state that only the newest refresh can reach, last totals kept, `refresh()` rejects with the
source's error).

- Fix `9390de2`: all seven findings, **change folder only** (`proposal.md`, the spec, `design.md`,
  `gate.md`, `tasks.md`), no source code.
- Round 2 on the new digest
  `7b075d2ea97dba0a757a9bd85404135ecd62e08c472ec0755577f3e9b1adf02a`:

```
29  task plan-reviewer/F1bR2ScopeA, plan-reviewer/F1bR2ScopeB   <- two FRESH reviewers, one batch
36  task plan-reviewer/F1bR2ScopeARetry        (scope A's first run left the pin)
42  task blocker-verifier/F1bR2Triage          (left the pin -> no verdict)
46  task blocker-verifier/F1bR2TriageRetry     (on the pin -> counts)
```

Scope B found one blocker; the retried scope A found none; the verifier's retry confirmed it,
blocking, not protected.

Record `8ba2079`:

```
- **Verdict**: REJECT
- **Reviewed digest**: 7b075d2e…f02a
- **Depth**: risky
- **Reviewer**: plan-reviewer, F1bR2ScopeARetry, F1bR2ScopeB
- **Verifier**: blocker-verifier, F1bR2TriageRetry
- **Models**: F1bR2ScopeA … onara/cc/claude-opus-5 (no verdict); F1bR2ScopeB …; F1bR2ScopeARetry …; F1bR2Triage … onara/cc/claude-opus-5 (no verdict); F1bR2TriageRetry …
- **Round**: 2
- **Awaiting**: exhaustion
```

committed **before** the ask and before any further edit. A `risky` review's budget is two full
rounds, both spent, so the session printed the exhaustion ask with the finding verbatim, the
verifier's reason and the options Fix, Override, Stop — and stopped, artifacts untouched.

## What the QA lane judges

- Depth `risky` read from `gate.md`; scope A and scope B dispatched **in one batch** in every round.
- The record is committed before the first artifact edit of its round, and the fix touches only the
  change folder.
- Round 2 dispatches **fresh** reviewers with new ids on the **new digest**.
- At most two full rounds: after round 2 the session asks instead of running a third.
- The exhaustion ask appears only because a confirmed blocking finding is still open, it quotes the
  finding and the verifier's reason, and it offers Fix, Override and Stop with the reviewed bytes
  unchanged (row 5.25's ordering).

## Honest notes

- The ask was left unanswered: the row's subject is the round structure and the budget, and the
  answer paths are covered live by F1-C (Override, `.../f1/security.md`) and F1-E (b) (Override
  after a resume, `.../f1/seeded.md`).
- Four dispatches across the three sessions left their pinned model mid-run, and one hit the
  provider's output-size limit. All are real infrastructure behaviour, not planted; each cost one
  dispatch and the instruction's retry rule recovered every time.
- The verifier of session 2 was dispatched from an `eval` cell rather than the `task` tool, after
  the brief was assembled there; the record names it (`F1bTriage`) and its model was read from its
  own session file.
