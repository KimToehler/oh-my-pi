## Must-fix

### 1. Failed manifest persistence can cause a later local edit to be lost

**High — `scripts/install-team-config.ts:331–345, 349–357, 427–465`.** Both a failed final manifest write and a failed partial-manifest write can leave applied file changes on disk while the old manifest still records those files as installer-owned.

For example, an owned file starts at `v1`; the installer writes `v2`, but its manifest write fails. If the user then edits the file back to `v1`, a later update or removal sees the old owned `v1` hash and destroys that edit without a backup. Reporting the original failure does not prevent this subsequent violation of the plan’s content-preservation invariant.

**Fix:** Make interrupted ownership state recoverable or conservatively untrusted before any later destructive operation—for example, with durable transaction state established before applying changes. Add real-filesystem regressions for both final and partial manifest-write failures, followed by an edit matching the stale hash and a retry.

**class:** Stale ownership after failed manifest persistence.  
**sites:** Both persistence-failure paths at `scripts/install-team-config.ts:449–465`; the unsafe ownership decisions are the replacement and removal branches at `:344` and `:356`. Whole-tree `functions.grep` search: `writeManifest\(|current\.hash !== prior|current\.hash === prior|applied\[|manifest was not updated`.

### 2. New-machine instructions expose the router key before restricting permissions

**Medium — `team-config/README.md:17–18`.** The instructions append the key to `.env` before running `chmod 600`; a newly created file inherits the caller’s umask, and an existing permissive file remains permissive during the write.

Other local users can read the key during that interval on a system where the directory and file permissions permit access; interruption before `chmod` leaves it exposed.

**Fix:** Instruct users to restrict the existing file before adding the key and create a missing file with restrictive permissions from the outset, without overwriting existing contents. Avoid putting the literal secret in shell history.

**class:** Credential written before access is restricted.  
**single instance:** The new-machine README contains the only shipped command that writes `ONARA_ROUTER_KEY` into `.env`; the installer’s message merely names the destination. Whole-tree `functions.grep` search: `ONARA_ROUTER_KEY|chmod 600.*\.env|>>.*\.env`.

## Should-fix

### Rollback guidance does not cover refs predating the installer

**`scripts/deploy-local.sh:14–15, 77–79`.** The comment recommends redeploying the old ref to restore team config, but a ref before the feature has no `scripts/install-team-config.ts`; the current deploy script swaps in its binary and then fails at the installer invocation.

This makes the advertised rollback incomplete for precisely the pre-feature rollback case and leaves the newly installed binary paired with the existing config.

**Fix:** Document the pre-feature case and its binary-only/backup recovery procedure, or explicitly handle refs that do not contain team config before swapping the binary.

**class:** Rollback guidance assumes the target ref contains the new deployment component.  
**single instance:** The deploy script has one installer invocation and one redeploy-old-ref recommendation. Whole-tree `functions.grep` search: `deploy-local\.sh|OMP_SKIP_TEAM_CONFIG|omp\.prev`.

## Nit

None.

## Checked

- **Previous review classes:** The two temporary writes use exclusive unique names; managed, seed, removal, and backup parents are checked for containment; backup directories are unique and copy destinations exclusive; mode-only changes are synchronized; nested unsupported entries and non-directory source roots are rejected. The scrub criterion is narrowed to metadata lines, and both personal-context documentation sites explain conditional loading. These closures do not resolve the separate stale-ownership failure above.
- **Duplication across slices/files:** No actionable instance found in the feature surfaces.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*; no inconsistency found.
- **Uneven API surface:** No instance found in the installer options/report or extension wiring.
- **Mixed conventions:** No actionable instance found.
- **Missing abstractions:** No cross-slice candidate established.
- **Dead code:** Searched installer helper, type, constant, and entry-point names across the worktree; no dead installer symbol established. Copied-skill content was reviewed only through the brief’s permitted inventory, scrub evidence, and validator seam.
- **Doc drift:** The pre-feature rollback guidance is reported above; personal-context documentation matches the inspected discovery behavior.
- **Surprise scope and plan walks:** The inventory matches the stated feature surface; no per-slice “Files modified” lists or new i18n keys are specified. Skill/rule content quality and pre-existing TS6307 errors are explicitly out of scope for blocking.
- **Verification checklist:** `verification-244b2e64b5.txt` reports 254 passing tests and oxlint exit 0. No mutation-check output was found. The F1 artifacts show fresh installation, a router-authenticated run, a merge-gate refusal, reinstall transitions, and v1-manifest migration at the recorded head; they identify a binary built from `90e3e77e68`, not independently demonstrate a fresh deploy-script build at the recorded head. No checks were run in this review.
- **Seven seams:** Inspected deploy invocation and skip flag; installer/manifest/backups; router-key configuration and fresh-run evidence; context discovery; validator-relative path and shipped validator; test-command wiring; and setup documentation.
- **Simplification pass:** No additional candidate established.
- **Residual risk:** Same-user path substitution during installation is expressly accepted by the plan. The stale-manifest finding is a subsequent recovery failure, not that accepted check-to-use race.

FAIL
