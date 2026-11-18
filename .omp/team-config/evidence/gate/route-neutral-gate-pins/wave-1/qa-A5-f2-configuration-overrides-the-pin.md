# QA row A5: F2: Configuration overrides the pin

Carried from F1. Per capture:

- `auditor-conflict`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. `e40e449cfc` makes the trailer's `model_id` subordinate to the Phase 3 route binding, which this row's trailer already met; `2fcb711078` governs only replies that do not count; the pre-dispatch override check (SKILL.md Phase 3 first bullet) is unchanged.

## Observed

### auditor-conflict

PASS. `auditor` overridden to `onara/cx/gpt-6.1-sol:medium`; the gate dispatched nothing (no dispatch session) and named the setting and both ways to resolve it.

## Cited captures (tracked at the reviewed SHA)

- `82ba04f94ac7bf98c2c4ce935e47c40a4364fe383a0f7f5f1a6c9f0e7ac322fa`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/auditor-conflict.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
