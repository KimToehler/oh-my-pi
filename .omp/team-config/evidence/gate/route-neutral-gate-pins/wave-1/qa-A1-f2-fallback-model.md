# QA row A1: F2: Fallback model

Carried from F1. Per capture:

- `seeded-fallback`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-fallback

PASS. The retry chain moved `ImplementationAudit` from `onara/cx/gpt-6.1-sol` to `onara/cc/claude-opus-5-5`; its PASS does not count, is kept as evidence and not submitted, and one fresh retry follows.

## Cited captures (tracked at the reviewed SHA)

- `e01d9213d893340e475db7b4a321f1f1737dee4d99268c3118ca8922db115934`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-fallback.md`
- `3d40f51ba9e53fcfe588ed1ca84a56f030bbe2dcfa80cff27e20ca63b77503c6`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/fallback/ImplementationAudit.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
