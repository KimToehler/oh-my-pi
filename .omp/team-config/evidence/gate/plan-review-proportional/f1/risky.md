# F1-B: a `risky` review, two full rounds

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head (the row 4.11 run is
superseded: rows 5.30-5.31 changed step 4's record ordering and step 5's budget branch). Deployment
as in F1-A (`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into the fixture and committed there as `6108bc3`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture, the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head.)

## Fixture

`$TMPDIR/prp-fix/repo-f1b`, change `f1b`: the refresh-store plan, **Mandatory class
`concurrency-state`, Depth `risky`** in `gate.md`, digest
`102212f2bd367462037dd99c5b7abf5c62b4e1b7fe2a44fef5aae628634162ac` at round 1. The planted gaps are
real: the plan's design defines only `idle -> refreshing -> ready` with no failure transition,
task 1.2's Verify only checks that the test file exists, and there is no F1/F2 final verification.

## Session 1 — round 1 (1757 s)

- Scope A and scope B dispatched in **one batch**. The first scope-A dispatch (`WispyPartridge`)
  left its pin mid-run and was discarded `(no verdict)`; the retry `FoolishPartridge` and
  `BasicFlyingfish` both ran on the pin and both rejected.
- `6c231e0` **before the verifier was dispatched**: REJECT, `Verifier: blocker-verifier, none`,
  Awaiting `triage`, both scopes' findings verbatim under `## Blockers`, each marked
  `not triaged: the verifier has not returned` (row 5.30).
- Verifier: first attempt `WillowyMoose` off its pin `(no verdict)`, retry `PlainCricket` on the
  pin: finding 1 **confirmed, blocking**, finding 2 refuted.
- `c8f7530` the triage record on the same digest: Awaiting `scope`, finding 1 under `## Blockers`
  with the verifier's reason, finding 2 moved to `## Residuals`.
- The session printed the **scope ask** (what the store does when the current refresh's source
  rejects) with two named alternatives and Stop, and edited nothing.

## Session 2 — the answer, the fixes and round 2 (402 s)

- The QA lane answered alternative 1 (an `error` state). `64cb9b1` carries the fixes, change folder
  only: the error state, the overlap scenarios and the missing final verification.
- Round 2 is a **full fresh two-reviewer round** on the new digest
  `70b4581d7cadc8e84041d3fb0bebfeff00c4a09a63176d801223c029e117460b`: `ProductiveSailfish` and
  `MuddyNarwhal`, both on the pin, both OKAY.
- `cf011f4`: Verdict OKAY, Round 2, Awaiting `none`, Blockers none, round 1's refuted finding still
  under `## Residuals`. `--reviewed` printed `reviewed: OKAY in round 2`, exit 0.

## What this run shows

- A `risky` round dispatches both scopes in one batch, and a dispatch off its pin is discarded with
  `(no verdict)` and retried (two of six dispatches here).
- The round's rejection is committed **before** the verifier runs, and the post-triage record
  replaces it on the same digest.
- A confirmed finding whose fix needs an open scope decision produces a scope ask with named
  alternatives; the fix lands only after the answer.
- Round 2 is full and fresh, and a clean round 2 ends the review OKAY without an exhaustion ask:
  the budget was not spent on a second REJECT this time.

## Honest notes

- The round-2 reviewers left three non-blocking notes in the record (the return value of a
  superseded `refresh()`, the store's constructor shape, and that two evidence checks only prove a
  file is non-empty). The session recorded them and acted on none, because the round was OKAY.
- The earlier run of this scenario (row 4.11) ended at an exhaustion ask after a second REJECT.
  Same fixture, same text for the budget rule, different model draws: the budget rule was not
  reached here, so this file no longer witnesses the exhaustion path. F1-E (b)
  (`.../f1/seeded.md`) witnesses it on this head instead.
