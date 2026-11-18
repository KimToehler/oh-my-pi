# QA row C3: Consultation: Same model through another provider

Carried from F1. Per capture:

- `direct-consultation`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The consultation is decided by step 2a's report check (`validate-openspec-change.mjs --consultation-report`, unchanged since the capture); the schema edit only states that step 3's check never applies to it, which can remove a check but not change the one this row observed.

## Observed

### direct-consultation

PASS. One `risky` consultation; `ArchConsulte33435031` recorded only `anthropic/claude-fable-5-2`, `--consultation-report` exited 0, record Status `consulted` with Models `ArchConsulte33435031 anthropic/claude-fable-5-2`.

## Cited captures (tracked at the reviewed SHA)

- `2c69963f51c4a54c9fdba2bcd203418326228cc1b24c23f8afd8f1d3521a81bf`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-consultation.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
