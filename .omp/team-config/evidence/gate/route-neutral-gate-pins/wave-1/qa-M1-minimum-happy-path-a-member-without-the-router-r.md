# QA row M1: Minimum: happy path, a member without the router reaches all three reviews with overrides alone

Carried from F1. Per capture:

- `direct-plan-review`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The plan-review model check still covers `plan-reviewer` with the same name-only comparison; the schema edits add which agents it covers, the delta reviewer and the exception rewrite, none of which this row reaches (it ends at round 1's count or before any dispatch counts).
- `direct-consultation`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The consultation is decided by step 2a's report check (`validate-openspec-change.mjs --consultation-report`, unchanged since the capture); the schema edit only states that step 3's check never applies to it, which can remove a check but not change the one this row observed.
- `direct-audit`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. `e40e449cfc` makes the trailer's `model_id` subordinate to the Phase 3 route binding, which this row's trailer already met; `2fcb711078` governs only replies that do not count; the pre-dispatch override check (SKILL.md Phase 3 first bullet) is unchanged.

## Observed

### direct-plan-review

PASS. One `standard` round 1; `PlanReviewAddReset` recorded only `openai-codex/gpt-6.1-sol` at `high`, its OKAY counted, review.md `- **Models**: PlanReviewAddReset openai-codex/gpt-6.1-sol`, `V --reviewed` passed.

### direct-consultation

PASS. One `risky` consultation; `ArchConsulte33435031` recorded only `anthropic/claude-fable-5-2`, `--consultation-report` exited 0, record Status `consulted` with Models `ArchConsulte33435031 anthropic/claude-fable-5-2`.

### direct-audit

PASS. The gate dispatched despite the `openai-codex/gpt-6.1-sol:high` override; `ImplementationAudit` recorded only `openai-codex/gpt-6.1-sol` at `high`, trailer `model_id: openai-codex/gpt-6.1-sol`, record `resolution[0].model` `openai-codex/gpt-6.1-sol`, and the record validates (above).

## Cited captures (tracked at the reviewed SHA)

- `5d34fc6aeecb6bb6f413331af05f7ba0a6fb954e24cf0b21586a99bf03733a23`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-plan-review.md`
- `2c69963f51c4a54c9fdba2bcd203418326228cc1b24c23f8afd8f1d3521a81bf`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-consultation.md`
- `994441c871838821a946110970204e7e0f3202c96c78eeb3f42b522aed734df3`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-audit.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
