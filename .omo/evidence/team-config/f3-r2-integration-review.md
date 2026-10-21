## Must-fix

### 1. Backup destinations can overwrite existing files or follow a symlink

**High — `scripts/install-team-config.ts:185, 202, 220, 231–236`.** The backup helper writes or renames to a timestamp-derived destination without requiring that the final destination be absent; `assertContained` checks only its parent components. A pre-existing backup file can therefore be overwritten, and a symlink at the backup leaf can make the copy write outside the agent directory. Reusing a timestamp can also destroy an earlier backup, violating the content-preservation invariant.

**Fix:** Create a run-unique backup directory exclusively, and ensure each backup destination cannot replace or follow an existing entry. Add filesystem tests for an existing backup file and a backup-leaf symlink.

**class:** Unowned backup-destination clobbering and traversal.  
**sites:** Both backup operations, `fs.rename(src, dst)` and `fs.copyFile(src, dst)`, in the installer’s single `backup` helper. Whole-tree search: `functions.grep` pattern `team-config-\$\{|backupDir|team-config-manifest` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config`; operation search: `functions.grep` pattern `fs\.(copyFile|rename|writeFile|rm|mkdir|lstat)\(` over `scripts/install-team-config.ts`.

### 2. Permission-only changes to managed scripts are not installed

**Medium — `scripts/install-team-config.ts:176–179, 192–198`.** The installer records the source mode but skips a managed file whenever its content hash matches, even if its executable bits differ. A deploy that fixes a script’s executable bit without changing its bytes—or reinstalls after the bit was removed locally—leaves that script non-executable.

**Fix:** Include relevant permission bits in the comparison and apply a mode-only update when bytes match. Add a test that changes only the source executable bit between installs.

**class:** Managed file metadata omitted from synchronization.  
**single instance:** The installer’s managed-file loop has the only `current === wanted` short-circuit before `replaceFile`; search: `functions.grep` pattern `replaceFile\(|current === wanted|chmod\(|COPYFILE_EXCL` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config`.

## Should-fix

None.

## Nit

None.

## Checked

- **Previous-round classes:** M1’s two temporary writes now use unique exclusive creation. M2’s managed, removal, seed, and backup *parent* checks are present, but backup-leaf traversal remains as finding 1. M3’s managed and optional seed walks now propagate nested enumeration errors. M4’s plan criterion is narrowed to `^Learned in:` metadata lines; the tree search found none. S1’s two documentation sites now describe the existing-config and project-override conditions.
- **Duplication across slices/files:** No actionable instance found in the inspected installer, deployment, and extension surfaces.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*; no actionable inconsistency found.
- **Uneven API surface:** No instance found in the inspected installer options/report and extension wiring.
- **Mixed conventions:** No actionable instance found.
- **Missing abstractions:** No cross-slice abstraction candidate established.
- **Dead code:** No instance established in the inspected installer helpers. An exhaustive search of every symbol in the copied skills was not completed; skill content is out of scope for blocking.
- **Doc drift:** The previous personal-context documentation issue is closed. No additional substantiated instance found.
- **Surprise scope and plan:** The changed-file inventory matches the stated deployment, installer, configuration, tests, and documentation surface. The plan has no per-slice file lists or i18n changes. Skill/rule content quality and pre-existing TS6307 errors are listed as out of scope and are not raised as blockers.
- **Verification checklist:** The four F1 evidence files were inspected; they show a fresh install, an authenticated real-binary run, merge-gate refusal, and reinstall transitions. The supplied artifacts do not independently establish the test-suite, mutation-check, or oxlint results; no checks were run in this review.
- **Seven seams:** Inspected deploy invocation and skip flag; agent-dir, manifest, and backup handling; seeded router key and fresh-run evidence; context discovery; validator-relative path and test import; test command wiring; and setup documentation. Finding 1 affects the backup seam.
- **Simplification pass:** No additional substantiated candidate found.
- **Review limitation:** The supplied `/tmp/ir/team-config.patch` itself contains a `more changes truncated` marker, so it was not possible to read the complete diff end to end from that artifact. The changed-file inventory and targeted tree reads were used, but this is not an exhaustive review of every changed symbol.

FAIL
