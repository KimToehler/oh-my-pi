# QA row A2: F2: Same model, lower effort

Carried from F1. Per capture:

- `seeded-effort`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-effort

PASS. Both dispatches ran `onara/cx/gpt-6.1-sol` at `medium` against the `high` pin; neither counts, `implementation-audit` is INCONCLUSIVE, the gate cannot pass, and the user is told the model and effort that ran.

## Cited captures (tracked at the reviewed SHA)

- `cf10fbb86290fb08cd5d650a009bbbec1ea1dae9bba3509458dce1b8172ee562`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-effort.md`
- `32390f901ead0b57bff35451f08eae2a9a0dbc0ce034bd9c4d9cf06a82036a8f`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/effort/ImplementationAudit.jsonl`
- `32390f901ead0b57bff35451f08eae2a9a0dbc0ce034bd9c4d9cf06a82036a8f`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/effort/ImplementationAudit2.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
