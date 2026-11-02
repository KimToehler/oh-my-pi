INTEGRATION-REVIEW-REPORT-v1

F3 wave 4, auditor `F3IntegrationReview5`, reviewed `main...HEAD` at 9b60b07a6c6e, snapshot `.omp/team-config/gate-deltas/F3-fcc6b298d658-wave-4.snapshot.json`. Waves 1 and 3 returned FAIL; wave 2 PASS. Their fixes are TODO rows 5.12-5.26.

## Must-fix

None.

## Should-fix

- **`team-config/agent/agents/blocker-verifier.md:20,43–50` — The verifier says confirmation requires all four conditions, but also says the fourth condition only determines `blocking` for a confirmed finding.** A substantiated finding below the threshold can therefore be classified either as `refuted` or as `confirmed` with `blocking: false`, making the recorded result and explanation dependent on which instruction the verifier follows. This does not block: both routes become residuals, and the schema separately requires an ask for protected findings that were not confirmed as blocking.  
  **Fix:** State consistently that conditions 1–3 determine confirmation and condition 4 determines the `blocking` flag; update the output-schema description and task description to match.  
  **class:** verifier-confirmation-threshold-ambiguity  
  **sites:** `blocker-verifier.md:20,43–50`; `openspec/changes/plan-review-proportional/tasks.md:5`. Repository-wide `functions.grep`, path `.`, pattern `only when all four|Conditions 1-3 decide|confirmed.*blocking.*false`.

- **`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:533–544` — The post-exhaustion Fix branch names a delta check but does not explicitly route it through the clean-folder, validation, and fresh-digest preparation spelled out for the standard first-round successor.** A literal reader must infer that the earlier preparation also applies after exhaustion; recording the pre-fix digest would make the resulting review stale. This is a non-blocking ambiguity: the instruction does require a delta check on the fixed artifacts, and the previous live evidence reports successful post-exhaustion checks.  
  **Fix:** Point the post-exhaustion successor explicitly to the same commit, clean-status, validation, digest, and delta-dispatch procedure.  
  **class:** post-exhaustion-delta-preparation-ambiguity  
  **sites:** `schema.yaml:533–544,568–570`. Repository-wide `functions.grep`, path `.`, pattern `After an exhaustion Fix|one more delta check|Budget spent|the exhaustion ask answered Fix`.

## Nit

None.

## Checked

- **Duplication across slices/files:** The verifier repeats the reviewer’s threshold; the pinned design explicitly accepts the resulting drift risk.
- **Naming inconsistency:** Checked *depth*, *blocker*, and *residual* across the schema, verifier, templates, checker, and prose; no additional instance found.
- **Uneven API surface:** No additional instance found in the verifier result fields and their instruction consumers.
- **Mixed conventions:** The verifier’s conflicting confirmation descriptions are noted above; no additional instance found.
- **Missing abstractions:** No cross-slice abstraction candidate found.
- **Dead code:** No unused new production helper found in the changed checker surface.
- **Doc drift:** The verifier confirmation ambiguity is noted above. The base OpenSpec specs retain the old contract pending the planned archive.
- **Surprise scope:** Compared the changed-file list and diff with the proposal and tasks. The gate-record test change adapts its fixture to the changed template; no unexpected production surface found.
- **Plan walks:** The pinned plan excludes changes to the bundled reviewer, post-implementation disposition behavior, small-change routing, and corpus measurement; none was identified in the changed production surfaces. It has no i18n keys or per-slice “Files modified” lists; its proposal and tasks name the affected surfaces. Task 4.7 is this in-progress review, and 4.8–4.11 remain pending. The caller reports the other task/TODO Verify commands, strict validation, and the 697-test team-config suite passed; I did not run them.
- **Seams:** Read the schema instruction and templates, verifier, checker and changed tests, README, review-work disposition changes, process rule, and plan/spec deltas. The two ambiguities above are the additional issues found.
- **Simplification pass:** No additional cross-slice simplification candidate found.
- **`detection-substituted-for-defect-resolution`:** Closed at the verifier and mirrored plan/spec sites; the old refutation in the review record is historical evidence.
- **`seed-only-configuration-migration`:** Closed at the missing-pin stop, spec scenario, and README hand-merge instruction.
- **`ask-option documentation drift`:** Closed for the exception, scope, and exhaustion option shapes.
- **`repeated-incomplete-round recovery ambiguity`:** Closed at the instruction and specification sites; carried findings survive another incomplete run.
- **Missing `V --digest` recomputation:** Closed on the standard fix-delta path and record consumer; the separate post-exhaustion wording ambiguity is noted above.
- **`snapshot-before-depth-update`:** Closed at initial dispatch and the raised-depth successor path.
- **`workflow-summary documentation drift`:** Closed for the previously identified residual, undecided, and repeated-incomplete claims.
- **`round-counter terminology ambiguity`:** Closed in the instruction and template.
- **`exhaustion-fix-before-decision`:** Closed at the reviewed ordering sites: the budget is checked before edits, and only Fix authorizes edits after exhaustion.
- **`security-exception-summary-drift`:** Closed in the README summary for refuted and confirmed-below-threshold protected findings.
- **Evidence limitation:** Read-only review; no tests or commands were run. The supplied patch display abbreviated some long lines, supplemented by reads of the delivered files and pinned plan.

PASS