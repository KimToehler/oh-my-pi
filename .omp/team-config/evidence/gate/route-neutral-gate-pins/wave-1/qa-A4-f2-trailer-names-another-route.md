# QA row A4: F2: Trailer names another route

Carried from F1. Per capture:

- `seeded-trailer-route`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-trailer-route

PASS. The session ran only on `openai-codex/gpt-6.1-sol` at `high`, the trailer names `onara/cx/gpt-6.1-sol`; the dispatch does not count, its PASS is kept as evidence, no repair applies, and one fresh retry follows.

## Cited captures (tracked at the reviewed SHA)

- `a3a30d46971443b2df3ba442c2ea01c72050a8302985f0edc314c2b6cab30ac6`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-trailer-route.md`
- `3d8d8c4802fdef058d2072a992c9a5a7553e227186afd77682585e02de3808b2`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/trailer-route/ImplementationAudit.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
