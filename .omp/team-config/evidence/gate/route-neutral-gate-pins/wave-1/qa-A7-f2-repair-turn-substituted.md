# QA row A7: F2: Repair turn substituted

Carried from F1. Per capture:

- `seeded-repair`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.

## Observed

### seeded-repair

PASS (run 2). The review turns ran on the pin, the trailer repair answer came from `onara/cc/claude-opus-5-5`; the repaired trailer is not accepted, the repair answer is kept as `implementation-audit-<subagent id>-repair-reply.md` and never as a `*trailer*` file, the dispatch does not count, and the bounded fresh retry follows. Run 1 (on `acaf0ea77f`) found the repair answer was first stored as an addable `*trailer*` file before the model check failed, and that both replies shared one path; fixed in `2fcb711078`.

## Cited captures (tracked at the reviewed SHA)

- `a37af76c25412fc954cfda45fc260ac3e070fb4c11bc39faddf6227608953fb8`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-repair.md`
- `38da172e563c8e301b1fb244ec0dc650eaa48b9d0621533b6a7f993499f21fc7`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/repair/ImplementationAudit.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
