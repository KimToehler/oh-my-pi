# QA row C2: Consultation: Configured override

Carried from F1. Per capture:

- `oracle-override`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The consultation is decided by step 2a's report check (`validate-openspec-change.mjs --consultation-report`, unchanged since the capture); the schema edit only states that step 3's check never applies to it, which can remove a check but not change the one this row observed.

## Observed

### oracle-override

PASS. `architecture-oracle` overridden to `onara/cx/gpt-6.1-sol`; both attempts ran only on it, `--consultation-report` refused both (exit 1 naming the turn and the pin), the record stays `pending` with both attempts `(no report)`, and the user is asked to skip with a reason or stop.

## Cited captures (tracked at the reviewed SHA)

- `910a2c6226e7641ea4af4f0d88126cf343dfcdfb6db5f8456134c67213ddca6a`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/oracle-override.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
