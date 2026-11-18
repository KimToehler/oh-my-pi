# QA row A8: F2: Negative control (provider-only override dispatches, trailer route held to the session, instruction review)

Carried from F1. Per capture:

- `direct-audit`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. `e40e449cfc` makes the trailer's `model_id` subordinate to the Phase 3 route binding, which this row's trailer already met; `2fcb711078` governs only replies that do not count; the pre-dispatch override check (SKILL.md Phase 3 first bullet) is unchanged.
- `auditor-conflict`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. `e40e449cfc` makes the trailer's `model_id` subordinate to the Phase 3 route binding, which this row's trailer already met; `2fcb711078` governs only replies that do not count; the pre-dispatch override check (SKILL.md Phase 3 first bullet) is unchanged.
- `seeded-trailer-route`: Captured on `2fcb711078`. Later: `4f92bdb783` changes `SKILL.md` line 15 (the record's `model_id` now points to Phase 3's route binding, which this row applied) and plan-review text in `schema.yaml` that this F2 row does not read; `ee392ff25d` changes no instruction text.
- `nc-review`: Captured on `4f92bdb783`, the last code commit; `ee392ff25d` changes no instruction text (tasks.md checkboxes, README follow-ups list, F1 evidence).

## Observed

### direct-audit

PASS. The gate dispatched despite the `openai-codex/gpt-6.1-sol:high` override; `ImplementationAudit` recorded only `openai-codex/gpt-6.1-sol` at `high`, trailer `model_id: openai-codex/gpt-6.1-sol`, record `resolution[0].model` `openai-codex/gpt-6.1-sol`, and the record validates (above).

### auditor-conflict

PASS. `auditor` overridden to `onara/cx/gpt-6.1-sol:medium`; the gate dispatched nothing (no dispatch session) and named the setting and both ways to resolve it.

### seeded-trailer-route

PASS. The session ran only on `openai-codex/gpt-6.1-sol` at `high`, the trailer names `onara/cx/gpt-6.1-sol`; the dispatch does not count, its PASS is kept as evidence, no repair applies, and one fresh retry follows.

### nc-review

The delivered plan-review instruction: none for all three controls. SKILL.md: one listed route, Fix waves step 5b-5e (the F2 fix-delta `plan-reviewer` dispatch has no model check, so `GC delta` records a verdict from a substituted model). That step is unchanged from `main` and no spec delta of this change covers it.

Disposition (user decision, 2026-11-18): recorded as a follow-up in `team-config/README.md` `## Follow-ups`, not fixed in this change; the row is ticked with this one listed route carried as that follow-up.

Note: the one listed route (Fix waves step 5b-5e, the F2 fix-delta `plan-reviewer` dispatch without a model check) is not this change's plan-review instruction or the F2 `auditor` gate; it is unchanged from `main`, and the user chose to carry it as a follow-up (`team-config/README.md` `## Follow-ups`).

## Cited captures (tracked at the reviewed SHA)

- `994441c871838821a946110970204e7e0f3202c96c78eeb3f42b522aed734df3`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-audit.md`
- `82ba04f94ac7bf98c2c4ce935e47c40a4364fe383a0f7f5f1a6c9f0e7ac322fa`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/auditor-conflict.md`
- `a3a30d46971443b2df3ba442c2ea01c72050a8302985f0edc314c2b6cab30ac6`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-trailer-route.md`
- `3d8d8c4802fdef058d2072a992c9a5a7553e227186afd77682585e02de3808b2`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/trailer-route/ImplementationAudit.jsonl`
- `7125fd1e8c14abd94d0c118aec143142def24bcfe2a511c78e6bc521d264ae4c`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/nc-review.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
