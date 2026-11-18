# QA row A3: F2: Same model through another provider

Carried from F1. Per capture:

- `direct-audit`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. `e40e449cfc` makes the trailer's `model_id` subordinate to the Phase 3 route binding, which this row's trailer already met; `2fcb711078` governs only replies that do not count; the pre-dispatch override check (SKILL.md Phase 3 first bullet) is unchanged.

## Observed

### direct-audit

PASS. The gate dispatched despite the `openai-codex/gpt-6.1-sol:high` override; `ImplementationAudit` recorded only `openai-codex/gpt-6.1-sol` at `high`, trailer `model_id: openai-codex/gpt-6.1-sol`, record `resolution[0].model` `openai-codex/gpt-6.1-sol`, and the record validates (above).

## Cited captures (tracked at the reviewed SHA)

- `994441c871838821a946110970204e7e0f3202c96c78eeb3f42b522aed734df3`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-audit.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
