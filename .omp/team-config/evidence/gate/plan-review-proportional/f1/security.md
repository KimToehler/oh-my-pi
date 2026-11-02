# F1-C: a security finding that reaches a protected asset

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head. Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into the fixture and committed there as `21c9625`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

## Fixture

`$TMPDIR/prp-fix/repo-f1c`, change `f1c`: Mandatory class `none`, Risk tier `product`, so **Depth
`standard`** — one reviewer, all lenses. Digest
`5b3a1f7633390345555f3a7fdae27b8ea3605d70572872be2f0952c9cd0e4b8c` at round 1. The planted defect is
a QA record that pastes a live API token into a tracked evidence file.

## Session 1 — round 1 and the fixes (2815 s)

- One reviewer (`DefensiveRaccoon`, on the pin) returned REJECT with four findings, among them
  `CHECK 1 / CHECK 8 - tasks.md §2.1; design.md QA record`: the plan's own QA step writes a
  credential into a tracked file.
- `ca63bf2` **before the verifier**: REJECT, `Verifier: blocker-verifier, none`, Awaiting `triage`,
  all four findings verbatim, each `not triaged: the verifier has not returned`.
- The verifier (`OrganicKingfisher`, on the pin) confirmed all four as blocking.
- `f19bfbf` the triage record: Awaiting `none` — a confirmed security finding on a protected asset
  is **not** asked about, it is fixed. That is the whole point of this scenario: `standard` depth
  did not weaken the security lens, and the user was not consulted.
- `416d62e` carries the fixes (no credential in the QA record, a reproducible recipe, the missing
  F1/F2 rows), change folder only.
- The session then wrote the delta patch to `.omp/team-config/gate-deltas/f1c-round1-delta.patch`
  (uncommitted and untracked, as the instruction prescribes) and **stopped**: both the delta-check
  dispatch and its retry silently left the pinned model mid-run, so neither verdict counted. It
  reported the state (`review.md` still the round-1 REJECT, stale against the new digest `28e7…`)
  instead of recording an uncounted OKAY.

## Session 2 — the delta check (186 s)

- Resumed with the same plain instruction; the delta reviewer `F1cDeltaReview` ran on the pin and
  returned OKAY against the round-1 blob.
- `1053fd1`: Verdict OKAY, Round 2, Depth `standard`, Awaiting `none`, Override `none`, digest
  `28e79035ddc5b397101679bfa8fbb3459dbb6309564ea748d248c4464639ce5a`. `--reviewed` printed
  `reviewed: OKAY in round 2`, exit 0.

## What this run shows

- Depth `standard` is a reviewer-count and round-budget change, not a lens change: the single
  reviewer ran the security lens and found the credential.
- A confirmed finding that touches a protected asset is fixed without an ask, even though the same
  record's other findings were ordinary correctness items.
- The pre-triage record, the triage record and the delta check are three separate commits on two
  digests.

## Honest note

Four of the ten dispatches in this scenario (including both delta-check attempts in session 1) left
the pinned model mid-run and were discarded. The cost shows up as wall time and one extra session,
never as an uncounted verdict in the record. This is the router fallback described in F1-A, not a
property of the instruction.
