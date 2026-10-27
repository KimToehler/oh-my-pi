INTEGRATION-REVIEW-REPORT-v1
## Must-fix

None.

## Should-fix

- **Ignore-policy documentation overstates what is addable** — `openspec/changes/gate-durable-qa-evidence/specs/gate-workspace-layout/spec.md:6`; `team-config/agent/skills/review-work/SKILL.md:14,456`. The spec and guidance describe all filenames containing `trailer` under `evidence/` as addable, but `.gitignore:56–58` only unignores matching `.txt` and `.md` files and separately ignores `gate-deltas/` directories; the spec also omits that directory exception below `evidence/gate/`. This can mislead an author choosing a trailer or QA path, although the validator fails closed and the path can be renamed. **Fix:** qualify the spec and guidance with the actual extensions and directory exception, and add representative ignore-policy scenarios.
  - **class:** inaccurate ignore-policy description. **sites:** the spec delta and the two review-work passages above; the historical base spec has the same trailer-extension overstatement. Repository search: `functions.grep(path=".", pattern="QA output are local|whose name contains \`trailer\`|\\*trailer\\*.*addable|trailer\\*\\.txt", case=false, gitignore=true)`; `.gitignore` was read directly to check rule ordering.

## Nit

None.

## Checked

- **Duplication across slices/files:** no instance found requiring consolidation; QA verification reuses the existing artifact verifier.
- **Naming consistency:** “QA artifact,” “record’s evidence directory,” and `artifact_sha256` are consistent across the validator and changed guidance; no naming drift found.
- **Uneven API surface:** no instance found; the new QA digest field is consistently supplied by the migrated fixture and scratch-record producers.
- **Mixed conventions:** no instance found; QA uses the existing pinning and tracked-byte comparison mechanism.
- **Missing or premature abstractions:** no instance found requiring a change; `absentAtReviewedSha` serves both report and QA admission.
- **Dead code:** searches found consumers for the new helpers and test utilities; no instance found.
- **Doc drift:** the ignore-policy wording issue is noted above. The QA location, digest, publication and staging guidance otherwise follows the reviewed contract.
- **Surprise scope:** the changed-file list and touched symbols fit the validator, fixtures, guidance, OpenSpec delta and RED-evidence surface described by the plan. No out-of-scope implementation found.
- **Plan walks:** no change to the excluded convergence script, ledger or `.gitignore`, and no migration of historical records or claim to prove QA execution. No i18n keys or locale changes appear in the diff. The pinned plan marks implementation tasks complete; F3 is this review, while F1 and the final full-suite run remain unchecked. The supplied materials do not independently prove every completed task’s verification command ran; no checks were run in this read-only review.
- **Seams:** traced QA row production through digest validation, conditional pinning and the commit scan; reviewed fixtures, the 19 scenario tests, guidance, ignore rules and all 22 RED capture headers. The outside-repository test uses its own temporary directory. The captures consistently name one test-file digest, but I did not independently compute it.
- **Simplification pass:** no cross-slice simplification candidate found beyond the non-blocking documentation correction above.

PASS
