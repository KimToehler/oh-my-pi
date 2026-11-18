# QA row C5: Consultation: Negative control (report check code half and instruction half)

Carried from F1. Per capture:

- `validator-report`: Captured with the deployed validator byte-identical to `acaf0ea77f`. No file under `team-config/agent/skills/review-work/scripts/` changed after `396064eeb7` (`git log -- team-config/agent/skills/review-work/scripts/`), so the report check this row ran is the reviewed one.
- `nc-review`: Captured on `4f92bdb783`, the last code commit; `ee392ff25d` changes no instruction text (tasks.md checkboxes, README follow-ups list, F1 evidence).

## Observed

### validator-report

Result: both Fable routes are accepted (exit 0, the report printed); a turn on `onara/cc/claude-opus-5-5` and a session on `openai-codex/gpt-6.1-sol` are refused (exit 1, naming the turn and the pin). The code half of the consultation Negative control holds.

### nc-review

The delivered plan-review instruction: none for all three controls. SKILL.md: one listed route, Fix waves step 5b-5e (the F2 fix-delta `plan-reviewer` dispatch has no model check, so `GC delta` records a verdict from a substituted model). That step is unchanged from `main` and no spec delta of this change covers it.

Disposition (user decision, 2026-11-18): recorded as a follow-up in `team-config/README.md` `## Follow-ups`, not fixed in this change; the row is ticked with this one listed route carried as that follow-up.

Note: the one listed route (Fix waves step 5b-5e, the F2 fix-delta `plan-reviewer` dispatch without a model check) is not this change's plan-review instruction or the F2 `auditor` gate; it is unchanged from `main`, and the user chose to carry it as a follow-up (`team-config/README.md` `## Follow-ups`).

## Cited captures (tracked at the reviewed SHA)

- `ffd652ca88a9731721152c399dbd239460ffe1937de83b14472ddf7dd054f91b`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/validator-report.md`
- `7125fd1e8c14abd94d0c118aec143142def24bcfe2a511c78e6bc521d264ae4c`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/nc-review.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
