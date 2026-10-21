## Must-fix

### 1. Unmanaged temporary files can be overwritten without backup

**Severity: high — `scripts/install-team-config.ts:89-92, 162-164`.** The installer writes to predictable sibling paths, including `<managed-file>.team-config-tmp` and `.team-config-manifest.json.tmp`, without checking whether they already contain user data. This contradicts the promise that files outside the manifest are never touched and can destroy an unrelated file, or follow a pre-existing temporary-file symlink.

**Fix:** Create uniquely named temporary files exclusively, without following symlinks, and clean up only temporary files created by that invocation. Add regression coverage for both managed-file and manifest temporary-path collisions.

**Class:** Unowned temporary-path clobbering.  
**Sites:** Both writes above. Whole-tree search: `functions.grep` with pattern `team-config-tmp|tmpManifest|team-config-\$\{options.timestamp\}|copyFile\(src, dst\)` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config`.

### 2. Symlinked destination directories escape the agent directory

**Severity: high — `scripts/install-team-config.ts:118-148`.** Destination and backup paths are constructed lexically and filesystem operations follow symlinked parent directories; for example, an existing `agentDir/rules` symlink makes updates and removals operate in its external target. This violates the plan’s agent-directory boundary and can replace or delete external files, including files whose hashes happen to match the manifest.

**Fix:** Reject symlinked path components or use directory-relative, no-follow operations that enforce containment for managed files, backups, and seeds. Add real-filesystem tests for symlinked managed and backup parents.

**Class:** Uncontained filesystem traversal through destination symlinks.  
**Sites:** Managed update/removal, backup, and seed operations at `scripts/install-team-config.ts:118-157`. Searches: `functions.grep` pattern `realpath|lstat|O_NOFOLLOW|symlink` over `scripts/install-team-config.ts;scripts/install-team-config.test.ts`, and pattern `team-config-tmp|tmpManifest|team-config-\$\{options.timestamp\}|copyFile\(src, dst\)` over the whole worktree.

### 3. An incomplete source traversal is treated as an intentional removal

**Severity: high — `scripts/install-team-config.ts:45-61, 128-148`.** `listFiles` catches `ENOENT` from *any* recursive read and returns the partial list accumulated so far; the removal pass then treats every omitted previously managed file as deleted from the repository. A missing source root or a directory disappearing during traversal can therefore remove otherwise valid installed configuration and save an incomplete manifest.

**Fix:** Fail the install before any removal when the managed source tree cannot be traversed completely; distinguish an intentionally empty tree from an absent or interrupted one. Test both a missing managed root and a failed nested traversal.

**Class:** Partial enumeration interpreted as authoritative deletion.  
**Sites:** `listFiles(managedRoot)` feeds the removal pass; `listFiles(seedRoot)` also suppresses traversal failure, silently omitting seeds. Search: `functions.grep` pattern `listFiles\(|isEnoent\(err\)|pruneEmptyDirs` over `scripts/install-team-config.ts`.

### 4. The plan’s mechanical scrub criterion is not met

**Severity: medium — `team-config/agent/rules/lesson-scope.md:12, 21, 66, 87`.** The committed team tree still contains literal `Learned in:` strings, although the plan’s mechanical invariant requires a search of `team-config/` to find none. These occurrences are explanatory prose rather than established private metadata, but they nevertheless fail the stated deterministic equality check.

**Fix:** Either rewrite these references without the prohibited literal or obtain an explicit plan change narrowing the invariant to actual metadata fields.

**Class:** Prohibited scrub token remains in shipped content.  
**Sites:** All four occurrences are in `lesson-scope.md`. Search: `functions.grep` pattern `/Users/[^/\s]+/|~/git/9router|nutritrain|Learned in:` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config/team-config`.

## Should-fix

### 1. Personal-instruction documentation omits existing-config and project-override cases

**`team-config/agent/AGENTS.md:3; team-config/README.md:41-42`.** The instructions say `AGENTS.local.md` loads beside the team file, but the installer preserves an existing `config.yml` without adding `contextFiles.extra`, and project-provenance settings explicitly prevent reading the agent-directory extra file. Users in either case can place personal instructions where the documentation directs and have them silently omitted.

**Fix:** Document the required `contextFiles.extra` setting for existing configurations and the project-override limitation; describe the active agent directory rather than assuming `~/.omp/agent`.

**Class:** Unconditional documentation of conditional context loading.  
**Sites:** Both statements above; the conditions are in `scripts/install-team-config.ts:151-158` and `packages/coding-agent/src/discovery/custom-context-files.ts:27-29, 93-108`. Search: `functions.grep` pattern `AGENTS\.local\.md|contextFiles\.extra|models\.yml.*only|seeded once` over `team-config/README.md;team-config/agent/AGENTS.md;team-config/seed/config.yml`.

## Nit

None.

## Checked

- **Duplication across slices/files:** No actionable instance found in the installer and extension surfaces inspected.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*: names are generally consistent; the documentation’s fixed home-directory assumption is noted above.
- **Uneven API surface:** No instance found among the installer report/options and extension wiring inspected.
- **Mixed conventions:** No actionable instance found.
- **Missing abstractions / abstraction gravity:** No cross-slice simplification candidate found in the inspected implementation.
- **Dead code:** No instance established. The requested exhaustive search of every new symbol in the copied skills was not completed.
- **Doc drift:** Personal context loading has conditional behavior not stated in the shipped instructions, as reported above.
- **Surprise scope:** The supplied changed-file inventory is broadly consistent with the plan’s team configuration, installer, deploy, tests, and documentation scope. The copied skills dominate the diff.
- **Plan walks:** The plan specifies skill/rule content quality and pre-existing TS6307 errors as out of scope for blocking; neither is raised as a content-quality finding. No i18n changes or per-slice file lists were specified. The four verification items are stated in the plan, but their historical execution could not be independently confirmed from the supplied materials; I did not run checks. The mechanical scrub criterion has the exception reported above.
- **Seven seams:** Inspected deploy invocation and skip flag; agent-dir/manifest/backup handling; router key and `.env` documentation; personal-context discovery; validator-relative path; test command wiring; and the setup documentation. The filesystem and documentation defects above affect those contracts.
- **Simplification pass:** No additional substantiated candidate found.
- **Review limitation:** The supplied skills patch is approximately 4.2 MB and the reader returned only its opening portion; the primary patch output was also compacted. Consequently, this is **not a verified end-to-end reading of the whole supplied diff**, and uninspected skill content remains a residual review risk.

FAIL
