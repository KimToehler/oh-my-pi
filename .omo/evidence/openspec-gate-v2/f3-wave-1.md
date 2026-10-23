## Must-fix

None found.

## Should-fix

- **`team-config/agent/skills/review-work/SKILL.md:361` — The instructions say to take `plan_sha256` from `GC snapshot` output, but stdout does not print the digest.** The digest is in the snapshot JSON (`gate-convergence.mjs:371`); stdout prints its path and the `PLAN` copy path. This can delay record creation, though the value is recoverable and the issue does not block validation.  
  **Fix:** Say to read `plan_sha256` from the snapshot JSON, or hash the printed `PLAN` copy.  
  **class:** digest-retrieval documentation drift. **sites:** `SKILL.md:361`; searched the whole worktree with `grep` for `take it from the \`GC snapshot\`|SNAPSHOT .*wave|PLAN \$\{planCopy\}|plan_sha256: ctx.planSha256`.

- **`team-config/agent/skills/review-work/scripts/folder-plan.mjs:67–69` — `writeBundleFile` has no consumer.** It adds an unused filesystem-writing API beside the convergence script’s existing snapshot writer; this is dead code, not a behavioural blocker.  
  **Fix:** Remove the export and its now-unused `writeFileSync` import.  
  **class:** unused bundle writer. **sites:** `folder-plan.mjs:67–69` is the sole site; searched the whole worktree with `grep` for `writeBundleFile|writeFileSync\(.*bundle`.

- **`team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs:316` — Requirement detection can count an empty heading followed by another nonblank line, while `validateSpecs` counts requirements line by line.** In a rename-only spec containing such a heading, that disagreement can bypass the fallback-criteria check; it is non-blocking under the requested threshold because it requires malformed local plan content.  
  **Fix:** Derive `hasRequirements` from the same per-line requirement parsing used by `validateSpecs`, and add a rename-only negative case.  
  **class:** inconsistent requirement detection. **sites:** `validate-openspec-change.mjs:82–84,316`; searched the scripts tree with `grep` for `hasRequirements|requirementCount|Requirement:\\s\*`.

- **`team-config/agent/skills/review-work/scripts/plan-contract.mjs:209–216` — Fallback validation checks `Invariant`, `Negative control`, and `Observable`, but not `Positive witness` or `Boundary`, although the schema asks authors to fill all five.** An incomplete local criterion can therefore pass the checker; this follows the pinned plan’s specified three-field content check and is a non-blocking authoring-quality risk.  
  **Fix:** Either enforce the other two fields or explicitly document that their completeness is reviewer-enforced.  
  **class:** fallback-criterion enforcement/documentation mismatch. **sites:** `plan-contract.mjs:209–216`, `schema.yaml:224–226`, and `templates/gate.md:15–19`; searched with `grep` for `substantiveCriteriaDefects|Positive witness|Boundary` in the scripts and schema trees.

## Nit

None.

## Checked

- **Duplication across slices/files:** No production duplicate found. The two independent test bundle builders are intentional independent expected-value calculations.
- **Naming inconsistency:** Checked *folder*, *bundle*, and *Risk tier* across producer, consumers, and docs; no instance found.
- **Uneven API surface:** No instance found among snapshot, bundle, and checker consumers.
- **Mixed conventions:** No instance found in folder digest and risk-tier parsing; both gate consumers use the shared modules.
- **Missing abstractions:** No cross-slice abstraction needed; the unused bundle writer is the simplification candidate above.
- **Dead code:** `writeBundleFile`, above.
- **Doc drift:** Snapshot digest retrieval and fallback-field enforcement, above.
- **Surprise scope:** The supplied changed-file list includes `.omo/plans/openspec-gate.md`, but the supplied patch contains no hunk for it, so its change could not be inspected from this diff. The remaining listed files match the pinned plan’s feature surface.
- **Plan walks:** No implementation of the named out-of-scope core plan mode/hash binding, CLI pin/installer, OmO state, or folder smoke/freezing work was found in the patch. The plan has no i18n keys or per-slice “Files modified” lists. The mechanical evidence reports identical outcomes for nine records, although two comparisons block on missing plan files; the pinned plan leaves F3, F1, and F2 unchecked. I could not independently establish the RED run or team-config test run from the supplied review artifacts.
- **Seams:** Reviewed snapshot/bundle/digest consumers, shared criteria and tier parsers, checker CLI and pure entry point, gate format documentation, and the file-plan extraction. The digest retrieval documentation mismatch is noted above.
- **Simplification pass:** Remove the unused bundle writer; no other cross-slice simplification found.
- **Verification:** Read-only review; no tests or commands were run.

PASS