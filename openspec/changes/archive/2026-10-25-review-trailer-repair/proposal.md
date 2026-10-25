# Proposal

## Why

When a reviewer's merge-gate reply has a missing or malformed `REVIEW-TRAILER-v1` block, review-work today prescribes a full re-dispatch (`SKILL.md` Phase 3, "A reply carrying no trailer is the same case", and `rules/merge-gate-proof.md`: "Never trim or edit a trailer; re-run the invocation"). In one gate run on a ~535k-character brief this happened three times in the implementation-audit lane: a foreign trailer layout, `adversarial_criterion` instead of `adversarial_criteria`, and no trailer at all. Each re-run repeated a full review (minutes and a full input pass) only to obtain a form block, and gave a new random sample instead of the verdict already reached. The defect also surfaced late: `gate-convergence.mjs wave` records reviewer outcomes without reading any trailer, so a wave stood as PASS in the ledger while its trailer could never validate, and only `validate-gate-record.mjs` at Phase 5 noticed.

## What Changes

- `validate-gate-record.mjs` gains a trailer check that runs on one stored reviewer reply without a gate record: `--trailer <file> --invocation <name> --verdict <token> --plan <plan>`. It applies the record check's trailer rules (except the model binding to the record) and requires the trailer's verdict to equal `--verdict`.
- `gate-convergence.mjs wave` in lane F2 requires a `--trailer <invocation>=<path>` for every reviewer outcome that is PASS or FAIL and refuses to record the wave unless each trailer passes the same check with that outcome as its verdict. **BREAKING** for callers of `GC wave` that pass a reviewer PASS/FAIL outcome without a trailer (only the review-work skill does).
- review-work guidance: a reply that states a verdict but whose trailer is missing or fails the check is first repaired by one fixed message to the same, still-addressable reviewer (`write agent://<id>`), asking for its `Blocker B<n>:` lines and the trailer of the review it already did. The repair reply is stored unedited as the trailer artifact. A fresh re-dispatch remains for a failed repair and for replies without a usable review. `rules/merge-gate-proof.md` states the same order, and `rules/delegation.md` names the repair message as allowed.
- Both reviewer briefs gain one line at the top that points to the trailer block at their end.

## Capabilities

### New Capabilities
- `review-trailer`: checking a stored reviewer reply's trailer before the gate record exists, refusing a gate wave whose reviewer outcomes lack a passing trailer, and repairing a malformed trailer through the same reviewer before re-dispatching.

### Modified Capabilities

## Impact

- `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs`, `gate-convergence.mjs`, a new shared trailer module beside them, and their tests (`validate-gate-record.test.mjs`, `gate-convergence.test.mjs`).
- `team-config/agent/skills/review-work/SKILL.md` (both briefs, Phase 3, Fix waves step 3), `team-config/agent/rules/merge-gate-proof.md` and `team-config/agent/rules/delegation.md` (the repair message is named as allowed, so runtime rule enforcement does not interrupt it).
- The gate record schema (`team-config.merge-gate/v3`), the record check's trailer rules, the ledger event shapes and the merge-gate stop hook are unchanged.
- Deployed copies under each agent directory pick the change up only after `scripts/deploy-local.sh` or `scripts/install-team-config.ts` runs there.
