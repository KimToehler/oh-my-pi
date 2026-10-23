# Tasks

## 1. <!-- Task Group Name -->

- [ ] 1.1 <!-- Task description --> Verify: `<deterministic command>`
- [ ] 1.2 <!-- Task description --> Verify: `<deterministic command>`

## 2. <!-- Task Group Name -->

- [ ] 2.1 <!-- Task description --> Verify: `<deterministic command>`
- [ ] 2.2 <!-- Task description --> Verify: `<deterministic command>`

## 3. Final verification

<!-- Keep this group last and renumber it. Drop 3.1 when gate.md says Whole-diff review `not needed`. -->
- [ ] 3.1 F3. Whole-diff review: `integration-review` over `<base>...HEAD` with this change folder as the plan; fixes delta-reviewed; report (first line `INTEGRATION-REVIEW-REPORT-v1`) written to `.omp/team-config/evidence/gate/<change>/f3-integration-review-report.md` and left unstaged (a staged report makes `GC snapshot` refuse); review-work Phase 5 stages it with the gate record and trailers. Verify: `test "$(head -n 1 .omp/team-config/evidence/gate/<change>/f3-integration-review-report.md)" = INTEGRATION-REVIEW-REPORT-v1`
- [ ] 3.2 F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit. Verify: `<command that checks every scenario's recorded result>`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.2 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
