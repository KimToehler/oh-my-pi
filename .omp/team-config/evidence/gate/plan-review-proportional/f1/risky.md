# F1-B: a `risky` review end to end

Date: 2026-11-01, re-run after the F2 wave-1 fixes (rows 5.1-5.3). Same deployment as F1-A
(`.../f1/standard.md`, "Deployment deviation"): the branch installed into the disposable profile
`prp`, every session run as `omp --profile prp`.

## Fixture

`$TMPDIR/prp-fix/repo-f1b`, rebuilt from the fixture base, change `f1b`: a `TotalsStore` with a
`#generation` counter so only the newest refresh publishes. `gate.md`: Mandatory class
`concurrency-state`, Depth `risky`, Risk tier `product`. The planted defect is a state machine with
no failure transition: `design.md` specifies `idle -> refreshing -> ready` only, so a rejecting
source leaves the store `refreshing` forever.

## Observed run

Session: `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1b/2026-11-01T12-18-19-880Z_01a1970b-de68-7450-b1f6-dfc71a1e6066`,
continued twice with the QA lane's answers. Every child resolved to `onara/cx/gpt-6.1-sol`:
reviewers (`EquivalentTahr`, `FriendlyTakin`, `LevelLeopon`, `HandicappedWhale`, `AwfulFowl`) at
effort `high`, verifiers (`FaintBass`, `ImplicitGoose`) at `medium`.

**Round 1.** Depth `risky` read from `gate.md`; two fresh reviewers dispatched in one batch, scope A
(`EquivalentTahr`, 1 blocker) and scope B (`FriendlyTakin`, 5 blockers). One verifier (`FaintBass`)
returned one result per index across all six: five confirmed blocking, one **refuted** (task 1.1's
Verify runs a test file task 1.2 creates later) and recorded as a residual. None protected.
Record committed as `6e8e6e7` before any edit: REJECT, Round 1, Awaiting `scope`; `--reviewed`
fails.

Blocker 1 (the missing failure transition) needed a scope decision the artifacts leave open, so the
session asked one question quoting the finding and the verifier's reason, offering two named scope
alternatives — an `error` state, or reverting to the previous settled state — and Stop. **No "keep
as a residual" option**, which is the wave-1 fix (row 5.2) on a confirmed blocking finding.

**After the answer** (alternative 1): fixes in the artifacts only, commit `d1e4de4` — the `error`
state with its scenarios, a readable `totals` surface, one named test per scenario, a task running
the tests against deliberately broken stores, the F1 group and the follow-up section.

**Round 2** — a full fresh two-reviewer round on the new digest, new subagent ids
(`LevelLeopon` OKAY, `HandicappedWhale` REJECT with 1 blocker). Verifier `ImplicitGoose` confirmed
it blocking and `protected` true. Record `b8a9ab0`: REJECT, Round 2, Awaiting `exhaustion`.
The budget for `risky` is now spent, so the exhaustion ask ran — and because the open finding is
`protected`, it offered **only Fix and Stop**, no Override.

**After Fix**: commit `27858b6` adds the missing interval (a superseded refresh settling while the
newest is still pending) as two spec scenarios, two named tests, a fourth broken-store control and
a two-order F1 observation. One delta check (`AwfulFowl`) against the round-2 recording commit
`b8a9ab0` returned OKAY with no blockers, so no triage was needed. Final record `8bdac42`: Verdict
OKAY, Depth `risky`, Round 3, Awaiting `none`, Override `none`.
`--reviewed` prints `reviewed: OKAY in round 3`.

## Acceptance

| criterion | result |
|---|---|
| depth `risky` read from `gate.md` | yes |
| scope A and scope B dispatched in one batch | yes, rounds 1 and 2 |
| the confirmed findings fixed and committed after the REJECT record | yes: `6e8e6e7` precedes `d1e4de4` |
| round 2 dispatches two fresh reviewers with new ids on the new digest | yes: `LevelLeopon`, `HandicappedWhale` |
| at most two full rounds | yes, two; round 3 is the single delta check the user's Fix at the exhaustion ask authorizes |
| exhaustion ask only with a confirmed blocking finding open after round 2 | yes, one finding open |

## Observations for the QA lane

- Override was correctly withheld at the exhaustion ask because the open finding carried
  `protected` true. The verifier marked a verification-coverage finding as protected, which is
  conservative — the rule makes `protected` true for a security or privacy path, a credential,
  another protected asset, or review_scope item 4 / CHECK 1. Erring this way only removes an
  acceptance option; it never lets a finding through.
- The verifier still refutes under the stricter condition 3 when there is a real reason: it refuted
  the "task 1.1's Verify runs a later file" finding in round 1 and recorded it as a residual.
- The post-exhaustion delta check used one reviewer on a `risky` change. That is the path the plan
  specifies for a user-authorized Fix after the budget is spent, and `F1-F`'s route-2 note records
  the same judgement.
