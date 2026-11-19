---
description: omp-gated OpenSpec change pitfalls the validators catch late — tasks.md row syntax, trailer artifacts, auditor brief size, evidence Verify design, changes owned by another lane; read before editing tasks.md, storing a reviewer reply or touching another change's artifacts
globs:
  - "**/openspec/changes/**"
---

# omp-gated change pitfalls

- **Validate every tasks.md edit at once.** After adding or editing any row (fix rows included), run `node ~/.omp/agent/skills/review-work/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <change-dir>` before committing or taking a GC snapshot. Each row ends in exactly one trailing `Verify: <command>` code span without backticks ("Verify: as 9.1." blocks; write a sed pattern for it as `Verif[y]:`); `...` and angle-bracket text are placeholders even inside backticks (quote assertion text as `expected 1, was null`). `openspec validate` and the GC snapshot catch none of it; found at Phase 5 it voids the bound plan hash and forces a delta review plus another wave.
- **Store the whole reviewer reply** (findings plus the REVIEW-TRAILER-v1 block) as the `trailer_artifact`: `/opsx-archive` collects follow-ups only from those files, so a file holding just the trailer routes zero follow-ups. A trailer with `security_delta: yes` blocks a record whose `mandatory_class` (equal to gate.md's) is `none`; reclassify gate.md in a fix row.
- **Auditor briefs stay under about 450K characters**: task input is truncated at 500,000 characters in session persistence, and a 1 MB inline diff made both invocations INCONCLUSIVE. Keep the production diff, plan and QA matrix inline; move new files to workspace pointers and modified test files to per-file patches with an explicit "read every patch completely" list.
- **Evidence Verify commands** that only grep for markers are rejected. Plan the check as a checker script in the change folder with a selftest mode on negative fixtures, and have Verify run `selftest && check`.
- **Another change's artifacts** belong to its lane when it has a `.worktrees/<change>` worktree, commits on its branch or ticked tasks: check `git worktree list`, `git log --oneline -3 -- openspec/changes/<change>` and its tasks.md before editing or reviewing it, and plan dependent changes against what `main` holds.
