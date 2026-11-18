# QA row A6: F2: Retry also substituted

Carried from F1. Per capture:

- `seeded-retry-substituted`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-retry-substituted

PASS (run 2). Both dispatches end on `onara/cc/claude-opus-5-5`; `implementation-audit` stays INCONCLUSIVE, `GC wave` records it with `--outcome implementation-audit=INCONCLUSIVE` and no `--trailer`, both replies are kept verbatim in their own files (`implementation-audit-ImplementationAudit-reply.md`, `implementation-audit-ImplementationAudit2-reply.md`), the gate does not pass, and the user is told which model and effort ran. Run 1 (on `acaf0ea77f`) showed both replies mapped to one `<invocation>-reply.md` path, so the second would overwrite the first; fixed in `2fcb711078`.

## Cited captures (tracked at the reviewed SHA)

- `3e25a21ba98bbe470cdae059e2b951362ed9bb3573ab76eac45300d8424bc173`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-retry-substituted.md`
- `3d40f51ba9e53fcfe588ed1ca84a56f030bbe2dcfa80cff27e20ca63b77503c6`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/retry-substituted/ImplementationAudit.jsonl`
- `df7a8499ffbcc8e7f93ed2f81fa702e9640962e81408e8bd98cb2747b69d8fe5`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/retry-substituted/ImplementationAudit2.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
