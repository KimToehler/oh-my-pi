## Must-fix

### Incomplete source enumeration can be treated as a deletion

**High — `scripts/install-team-config.ts:60–66, 262–263, 316–325`.** The source walker silently skips entries that are neither regular files nor directories, including symlinks, while the managed-file removal pass treats the resulting list as authoritative. For example, if an installed source directory is replaced by a symlink before a deploy, its previously installed descendants are removed; installer-owned files are removed without backup, even though the subtree was not explicitly deleted from the source.

**Why it matters:** This leaves the prior partial-enumeration defect class open and can silently remove working configuration. The same walker also silently omits such entries from the seed list.

**Fix:** Reject unsupported source entry types before planning any mutations, with the offending path in the error. Add filesystem tests for a managed file and directory replaced by symlinks, and for an unsupported seed entry.

**class:** Incomplete source enumeration interpreted as authoritative absence.  
**sites:** The shared walker serves both `managedRoot` and `seedRoot`; only the managed list feeds the destructive removal pass. Whole-tree `functions.grep` search: `listFiles\(managedRoot\)|listFiles\(seedRoot|entry\.isDirectory\(\).*walk|SKIPPED_NAMES` over `/Users/tim/git/oh-my-pi/.worktrees/review-team-config`.

## Should-fix

None established.

## Nit

None.

## Checked

- **Previous review classes:** Exclusive temporary creation addresses both reported temp paths; destination parent containment and per-backup rechecks are present; backup directories are run-unique and copies exclusive; mode-only updates are planned; the scrub criterion now targets metadata lines; both personal-context documentation sites describe the loading conditions. The prior **partial-enumeration** class remains open as reported above.
- **Duplication across slices/files:** No actionable instance established in the inspected installer, deploy, and extension surfaces.
- **Naming inconsistency:** Checked *agent directory*, *manifest*, and *seed*; no actionable inconsistency established.
- **Uneven API surface:** No instance established in the inspected installer options and report.
- **Mixed conventions:** No instance established in the inspected implementation.
- **Missing abstractions:** No cross-slice candidate established.
- **Dead code:** No instance established in the inspected installer; an exhaustive consumer search for every copied-skill symbol was not completed.
- **Doc drift:** The earlier personal-context documentation issue is addressed; no additional instance established.
- **Surprise scope and plan walks:** The file inventory is broadly consistent with the plan. No per-slice file lists or i18n changes are specified. Skill and rule content quality and the pre-existing TS6307 errors are explicitly out of scope for blocking.
- **Verification checklist:** The latest available verification artifact reports 247 passing tests and oxlint exit 0. I found no mutation-check output. The four real-surface QA artifacts identify an earlier head, `d4b1be1354`, and binary, `90e3e77e68`; they do not establish the plan’s required F1 on the head after F3’s last code commit. F1 remains a subsequent gate step, not a finding against the current F3 review.
- **Seven seams:** Inspected deploy invocation and skip flag; installer/manifest/backups; seeded router key and earlier real-binary evidence; custom-context discovery; validator path and shipped skill; test-command wiring; and setup documentation. The finding affects the installer/source and manifest seam.
- **Simplification pass:** No additional substantiated candidate found.
- **Review limitation:** The supplied skills patch is approximately 4.2 MB, and the reader returned only portions of it; the large primary-patch reads were also compacted. I therefore cannot claim an end-to-end reading of every supplied diff line. No checks were run in this read-only review.

FAIL
