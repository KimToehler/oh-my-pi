# QA row A9: F2 requirement 'all turns on one provider/model': mixed-route session refused

Carried from F1. Per capture:

- `seeded-mixed-route`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-mixed-route

PASS. `ImplementationAudit` ran on both `onara/cx/gpt-6.1-sol` and `openai-codex/gpt-6.1-sol` at `high` with a trailer naming `onara/cx/gpt-6.1-sol`; Phase 3 refuses it, the retry `ImplementationAudit2` (only `onara/cx/gpt-6.1-sol`, `high`) counts and supplies the trailer.

## Cited captures (tracked at the reviewed SHA)

- `293c93d4500e2ef0742cac0fe89b1c7a00b796653f22fda82854a4e17588d635`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-mixed-route.md`
- `f0fa690606871631e3c8d11d3b81ec475b70f0fe28f86ee3fe7c0393eefaec13`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/mixed-route/ImplementationAudit.jsonl`
- `ed49e2312246588ce700fbd6d65d89f414b6411d8e8af2a81075af4f04b69e54`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/mixed-route/ImplementationAudit2.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
