## Must-fix

None found.

## Should-fix

1. **`team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs:100` — Valid quoted YAML schema values are refused.** For example, `schema: "omp-gated"` selects the same schema but fails the literal comparison. This is non-blocking because it is an alternative input spelling and the local config can be changed to the documented plain form.  
   **Fix:** Parse the supported YAML scalar forms, or explicitly document that the installer requires the plain spelling.  
   **Class:** schema-value spelling. **Single instance:** whole-tree `grep` for `schema:\[|schema:.*omp-gated|which\.error` found this installer comparison as the relevant project-config check.

2. **`team-config/README.md:103-115` and `install-openspec-workflow.mjs:90,207-215` — A fresh install can create ignored workflow files but the documented `git add` cannot add them normally.** An existing ignore rule can match paths that do not yet exist, so preflight is clean; after installation, Git reports `!!` paths and the README’s add command fails. This is non-blocking because the files remain local and the user can adjust the ignore rule or force-add them.  
   **Fix:** Detect ignored destinations before writing or explain the `!!` output and the appropriate recovery, including `git add -f` where intentional.  
   **Class:** newly created ignored workflow paths. **Single instance:** whole-tree `grep` for `--ignored|COPYFILE_EXCL|git add -f` identified this installer and its README as the new workflow’s relevant sites.

3. **`team-config/agent/skills/review-work/scripts/install-openspec-workflow.test.ts:118-123` — The test named as proving OpenSpec resolves the installed schema silently skips that assertion when the CLI cannot be spawned.** A green suite in such an environment therefore does not establish the stated integration behavior. This is non-blocking because real-surface verification is separately planned in F1.  
   **Fix:** Make the integration prerequisite explicit and fail or mark the check skipped visibly; assert the command’s exit status as well as its output.  
   **Class:** silently skipped CLI integration assertion. **Single instance:** whole-tree `grep` for `schema:\[|schema:.*omp-gated|which\.error` found this conditional assertion.

## Nit

None.

## Checked

- **Duplication:** Production and test code both have `listFiles` helpers, but they enumerate different trees with different entry handling; no cross-slice duplication requiring extraction found.
- **Naming:** `schema`, `config`, and `installer` are used consistently across the implementation and docs; no instance found.
- **Uneven API surface:** No sibling public APIs requiring uniformity found.
- **Mixed conventions:** The installer uses Node `spawnSync` while the Bun CLI check uses Bun Shell; this matches the plan’s separate runtime constraints. No problematic instance found.
- **Missing abstractions:** No cross-slice abstraction or simplification candidate found.
- **Dead code:** Searched the new installer helpers and their consumers; no unused production helper found.
- **Doc drift:** The ignored-path recovery omission is noted above.
- **Surprise scope and plan:** The changed-file list fits the pinned plan’s file groups, including its plan update and tests. No implementation of the listed out-of-scope CLI installation, config-rule merging, open-change rewriting, non-git support, or Windows-shell support found.
- **Verification checklist:** Tests and their specified cases were inspected, but execution results and RED evidence were not supplied. The distribution evidence directory is empty; F1 and F2 remain unchecked in the pinned plan. No checks were run in this read-only review.
- **i18n:** No i18n keys were changed.
- **Seams:** Inspected the pin/check/deploy ordering; canonical schema and deployment enumeration; project config; shared parser use; test-suite wiring; and README/SKILL descriptions. Deployed bytes and real CLI behavior remain F1 verification items.
- **Simplification pass:** No additional cross-slice candidate found.

PASS
