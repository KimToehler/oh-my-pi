## Must-fix

### Existing `.env` without a final newline breaks router setup

**Medium — `team-config/README.md:21`; `packages/utils/src/env.ts:265–271, 289–290`.** The setup command appends `ONARA_ROUTER_KEY=…` directly to an existing `.env` without ensuring the preceding line ends in a newline.

For example, an existing file ending in `OTHER=value` becomes `OTHER=valueONARA_ROUTER_KEY=…`; the dotenv parser does not see a separate router-key assignment, so the documented setup can leave omp unauthenticated and also changes the existing variable’s value.

**Fix:** Ensure the assignment starts on a new line while preserving existing contents and the restrictive-permission ordering. Add a setup regression using an existing `.env` without a trailing newline and check the value through omp’s dotenv parser.

**class:** Appending a dotenv assignment without a line boundary.  
**single instance:** The new-machine README is the only shipped command found that appends `ONARA_ROUTER_KEY` to `.env`. Whole-tree `functions.grep` search: `ONARA_ROUTER_KEY|chmod 600.*\.env|>>.*\.env`.

## Should-fix

### Rollback guidance implies backups contain a complete prior configuration

**`scripts/deploy-local.sh:14–16`; `scripts/install-team-config.ts:344–345, 357–361`; `scripts/install-team-config.test.ts:38–44`.** The rollback comment directs users to restore team config from reported backup directories, but clean installer-owned files are updated or removed without backup.

A normal update can therefore produce no backup directory at all, or one containing only locally edited files, and restoring it cannot reconstruct the prior managed configuration. This remains a limitation of the revised rollback guidance, distinct from the previous finding about pre-feature refs.

**Fix:** Explain that backups preserve local content rather than a complete config snapshot; for a ref containing team config, document redeploying that ref, and distinguish the pre-feature case.

**class:** Incomplete backup presented as configuration rollback.  
**single instance:** The deploy-script comment is the only rollback instruction found making this claim. Whole-tree `functions.grep` search: `OMP_SKIP_TEAM_CONFIG|backups/team-config|omp\.prev`.

## Nit

None.

## Checked

- **Previous review classes:** The reported temp writes use exclusive unique paths; destination parents and backup locations are checked; backup directories are unique and copies exclusive; mode-only updates are applied; unsupported nested entries and non-directory source roots are rejected. The scrub criterion now targets metadata lines, and both personal-context documentation sites state the loading conditions. The intent manifest addresses the reported failed-final and failed-partial persistence scenarios, and the credential instructions restrict permissions before writing. The pre-feature-ref limitation is now mentioned, subject to the rollback-doc finding above.
- **Duplication across slices/files:** No actionable instance found.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*; no actionable instance found.
- **Uneven API surface:** No instance found.
- **Mixed conventions:** No actionable instance found.
- **Missing abstractions:** No cross-slice candidate established.
- **Dead code:** Searched the installer’s new helpers, types, constants and entry point; no dead installer symbol established. Copied skills were assessed only through the permitted inventory, scrub evidence and validator seam.
- **Doc drift:** The `.env` append and rollback guidance issues are reported above.
- **Surprise scope and plan walks:** The changed-file inventory matches the stated feature surface. The plan has no per-slice “Files modified” lists or new i18n keys; skill/rule content quality and pre-existing TS6307 errors are out of scope for blocking.
- **Verification checklist:** `verification-1b44c1d23a.txt` reports 259 passing tests and oxlint exit 0. I found no mutation-check output. The current-head fresh-run evidence shows router authentication, but the current-head merge-gate-refusal artifact contains no refusal output; reinstall and v1-migration evidence identifies an earlier head. F1 remains a subsequent gate step, not a finding against this F3 review. No checks were run in this read-only review.
- **Seven seams:** Inspected deploy invocation and skip flag; installer, v1/v2 manifest and backups; router key and dotenv resolution; context-file discovery; validator-relative path and shipped validator; test-command wiring; and setup documentation.
- **Simplification pass:** No additional candidate established.
- **Residual risk:** Same-user path substitution during installation is expressly accepted by the plan. The copied-skill content was not independently reviewed beyond the brief’s permitted evidence and targeted validator read.

FAIL
