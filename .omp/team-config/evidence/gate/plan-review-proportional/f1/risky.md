# F1-B: a `risky` review end to end

Date: 2026-11-01. Same deployment as F1-A (`.../f1/standard.md`, "Deployment deviation"): the
branch installed into the disposable profile `prp`, every session run as `omp --profile prp`.

## Fixture

`$TMPDIR/prp-fix/repo-f1b`, the same repository. Change `f1b` plans a `TotalsStore` with a refresh
generation and a `idle -> refreshing -> ready` state machine. `gate.md`: Mandatory class
`concurrency-state`, Depth `risky`, Risk tier `product`. Planted defect: task 1.2's Verify is
`test -f test/totals-store.test.ts`.

## Observed run

Session: `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1b/2026-11-01T09-35-32-386Z_01a19676-d422-7209-a6d5-954aa96b64e0`.

Commits, in order:

```
c2222c3 review(f1b): record round 1 (REJECT, awaiting scope)   <- record before any edit
0b0fb93 review(f1b): record scope answer for round 1 blocker 1
f526e63 plan(f1b): fix round 1 blockers (failure contract, verification, F1/F2)
61a31cc review(f1b): record round 2 (OKAY)
```

Resolved models, from each child's session file:

| child | role | model | effort |
|---|---|---|---|
| `ReviewScopeA`, `ReviewScopeB` | round 1 reviewers, one batch | `onara/cx/gpt-6.1-sol` | high |
| `VerifyBlockers` | round 1 verifier | `onara/cx/gpt-6.1-sol` | medium |
| `ReviewR2ScopeA`, `ReviewR2ScopeB` | round 2 reviewers, new ids | `onara/cx/gpt-6.1-sol` | high |
| `VerifyR2Blockers`, `VerifyR2BlockersRetry` | round 2 verifier plus its one retry | `onara/cx/gpt-6.1-sol` | medium |

**Round 1** (digest `102212f2…62ac`): depth `risky` read from `gate.md`, two reviewers dispatched
in one batch, two blockers each. The verifier confirmed all four as blocking, none protected.
`review.md` was written and committed as REJECT, Round 1, Awaiting `scope`, **before** any
artifact edit; `--reviewed` failed. The session then asked one scope question, quoting the
finding's area, defect, evidence and the verifier's reason verbatim, with Fix (three named
contracts), keep-as-residual and Stop. The QA lane answered Fix, option a.

**Fixes**: the answer was recorded (`0b0fb93`), then all four findings were fixed in the plan
files only and committed (`f526e63`).

**Round 2** (digest `c7383c4a…3a4b`): two fresh reviewers with new subagent ids on the new digest.
Scope B OKAY; scope A returned one blocker, which the verifier refuted (the spec already requires
`ready` after any earlier publication). It is recorded under `## Residuals` with the verifier's
reason. Final record: Verdict OKAY, Depth `risky`, Round 2, Awaiting `none`; `--reviewed` exits 0.

The round-2 verifier's first dispatch was cut off by a session deadline; the instruction's one
fresh retry (`VerifyR2BlockersRetry`) returned a usable result, and the session did not re-dispatch
the reviewers it already had.

## Acceptance

| criterion | result |
|---|---|
| depth `risky` read from `gate.md` | yes |
| scope A and scope B in one batch | yes (round 1 and round 2) |
| confirmed finding fixed and committed after the REJECT record | yes: `c2222c3` then `f526e63` |
| round 2 dispatches two fresh reviewers with new ids on the new digest | yes |
| at most two full rounds | yes, two |
| exhaustion ask only with a confirmed blocking finding open after round 2 | none open, no ask |
