# QA row C4: Consultation: User skips

Carried from F1. Per capture:

- `no-fable`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The consultation is decided by step 2a's report check (`validate-openspec-change.mjs --consultation-report`, unchanged since the capture); the schema edit only states that step 3's check never applies to it, which can remove a check but not change the one this row observed.

## Observed

### no-fable

PASS. Without `cc/claude-fable-5-2` in `models.yml` both attempts stopped with `No model selected` (no assistant turn, so their models are `none`), the report check refused both, and the ask offered skip or stop quoting both attempts. The resumed session (run 2) answered skip with a reason; consultation.md is `skipped`, the reason verbatim, both attempts under Models, consulted commit kept. Same shape as the archived F1 5.4 row of plan-architecture-consultation on `main` (`missing-model.md`: Models `none (no report)`).

## Cited captures (tracked at the reviewed SHA)

- `4058bbbded71d4d4e8b510fc62924a095e967147b7003a9321954a49785f582e`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/no-fable.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
