# QA row P6: Plan review: Negative control (instruction review)

Carried from F1. Per capture:

- `nc-review`: Captured on `4f92bdb783`, the last code commit; `ee392ff25d` changes no instruction text (tasks.md checkboxes, README follow-ups list, F1 evidence).

## Observed

### nc-review

The delivered plan-review instruction: none for all three controls. SKILL.md: one listed route, Fix waves step 5b-5e (the F2 fix-delta `plan-reviewer` dispatch has no model check, so `GC delta` records a verdict from a substituted model). That step is unchanged from `main` and no spec delta of this change covers it.

Disposition (user decision, 2026-11-18): recorded as a follow-up in `team-config/README.md` `## Follow-ups`, not fixed in this change; the row is ticked with this one listed route carried as that follow-up.

Note: the one listed route (Fix waves step 5b-5e, the F2 fix-delta `plan-reviewer` dispatch without a model check) is not this change's plan-review instruction or the F2 `auditor` gate; it is unchanged from `main`, and the user chose to carry it as a follow-up (`team-config/README.md` `## Follow-ups`).

## Cited captures (tracked at the reviewed SHA)

- `7125fd1e8c14abd94d0c118aec143142def24bcfe2a511c78e6bc521d264ae4c`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/nc-review.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
