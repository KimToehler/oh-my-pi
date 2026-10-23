## Must-fix

### Source-root symlinks still make incomplete enumeration authoritative

**High — `scripts/install-team-config.ts:58–85, 290–291, 347–357`.** The walker rejects symlinks among a root’s *children*, but calls `readdir` on the root itself without requiring it to be a real directory. If `team-config/agent` is already a symlink to an empty or incomplete directory when the install starts, its listing is treated as authoritative and previously installer-owned files omitted from it are removed without backup. This is a static pre-existing source condition, not the plan’s accepted same-user substitution race during a run. The optional `seed` root has the same unchecked-root behavior and can seed from an unintended tree.

**Fix:** `lstat` each source root before walking it; reject a symlink or other non-directory root, while retaining the missing-seed exception. Add real-filesystem regressions for both roots, including an installed managed file that must survive a symlinked managed root.

**class:** Incomplete source enumeration interpreted as authoritative absence.  
**sites:** Both calls to the shared walker, `listFiles(managedRoot)` and `listFiles(seedRoot, true)`. Whole-tree search: `functions.grep` pattern `listFiles\(managedRoot\)|listFiles\(seedRoot|Unsupported entry in team config source` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config`; walker search: `listFiles\(|fs\.readdir\(|fs\.lstat\(root\)` over `scripts/install-team-config.ts`.

## Should-fix

None established.

## Nit

None.

## Checked

- **Previous review classes:** Exclusive temp creation, destination-parent containment, unique backup directories and exclusive backup copies, mode-only synchronization, the narrowed scrub criterion, and the two personal-context documentation corrections are present at the reported sites. Nested unsupported source entries now fail, but the source-enumeration class remains open at the roots as reported above.
- **Duplication across slices/files:** No actionable instance found in the inspected feature surfaces.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*; no actionable inconsistency found.
- **Uneven API surface:** No instance found in the inspected installer options and report.
- **Mixed conventions:** No actionable instance found in the inspected implementation.
- **Missing abstractions:** No cross-slice candidate established.
- **Dead code:** No instance established in the inspected installer and extension. An exhaustive consumer search of every copied-skill symbol was not completed.
- **Doc drift:** The earlier conditional personal-context issue is addressed; no additional instance established.
- **Surprise scope and plan walks:** The inventory is broadly consistent with the plan. There are no per-slice “Files modified” lists or new i18n keys to compare. Skill/rule content quality and pre-existing TS6307 errors are out of scope for blocking; neither is raised here.
- **Verification checklist:** The latest supplied verification artifact reports **252 passing tests** and **oxlint exit 0**. I did not find mutation-check output. The fresh-install and authenticated-run artifacts identify head `abff4e6fe9` and binary `90e3e77e68`; the merge-gate-refusal artifact contains no refusal output, and the reinstall artifact identifies an earlier head. These artifacts do not establish the complete F1 matrix on the head after this F3 round. No checks were run in this review.
- **Seven seams:** Inspected deploy invocation and skip flag; installer, manifest and backups; router-key configuration and fresh-run evidence; context discovery; validator-relative path and shipped skill; test-command wiring; and setup documentation. The finding affects the installer/source-enumeration and manifest seam.
- **Simplification pass:** No additional substantiated candidate found.
- **Review limitation:** The main and delta patches were inspected in ranges, but the copied-skills patch was **not read end to end**; its beginning, end, file boundaries, and targeted content were inspected. Consequently this report does not establish exhaustive review of every changed skill line.

FAIL
