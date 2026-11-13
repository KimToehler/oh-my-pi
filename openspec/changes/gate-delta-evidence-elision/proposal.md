# Proposal

## Why

A fix-delta review (`review-work` Fix waves step 5) gets one patch per commit from `GC patch`, and its brief says to read
every patch completely. When a fix round carries its F1 and probe evidence, almost all of those bytes are captures the
delta reviewer does not judge: QA rows are judged in the wave's QA matrix, and carried rows by their one-line reasons.
On weaver's `m5-app-design-workspace` gate (2026-11-12) the range of one fix round, `3e180e65..32dc8c5d`, is 60 commits
and 10 MB of patches. Code, plan and spec changes are 251 KB of that; the rest are 2555 changed files under
`.omp/team-config/evidence/`, among them one commit of 4.8 MB that mixes a logcat with the `WebViewEngine.kt` fix. Two
fresh `plan-reviewer` runs on that range returned no verdict because they could not read the patches completely, so
Fix waves step 5e stopped the gate. Splitting the range does not help: a reviewer that sees a test without its fix, or
a fix without its later correction, rejects it, and the second REJECT is a user ask. `GC exempt` does not help either:
the range must still be reviewed as a whole once a commit in it has a REJECT, and the 4.8 MB commit is not exemptible
because it changes code.

## What Changes

- `GC patch` leaves out the hunks of every file under `.omp/team-config/evidence/` (the evidence directory of
  `gate-layout.mjs`). Each patch keeps its commit header and every other hunk. At its end it names the left-out files
  by directory, with the file count and the added and removed lines per directory, and how to show one
  (`git show <sha> -- <path>`). A commit that changes only evidence becomes its header plus that listing.
- The manifest records the left-out directory. `GC delta` recomputes each patch the way its manifest says: a manifest
  without the field gets full patches, so delta directories written before this change still verify; a manifest that
  names any other directory is refused, so a manifest cannot hide code from the reviewer.
- The delta brief in `review-work` (Fix waves step 5a and the brief text) says that evidence hunks are left out, where
  the listing is and how to read a file from it.
- The commit list of a range does not change: every commit of `<base>..<head>` keeps its patch file and is decided by
  the delta verdict, as today. No ledger event, record field or validator rule changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `post-implementation-review`: the content of fix-delta patches and the check of a delta directory against its
  manifest.

## Impact

- `team-config/agent/skills/review-work/scripts/gate-convergence.mjs`: `showPatch`, `patch`, `verifyDeltaDir`.
- `team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs`: patch content, old-manifest and
  foreign-directory cases.
- `team-config/agent/skills/review-work/SKILL.md`: Fix waves step 5a and the delta brief.
- Installed through `scripts/deploy-local.sh`; running sessions read the new brief after a restart. A gate in flight
  keeps its ledger; its delta directories written before the deploy still verify, and its next `GC patch` writes the
  new form.
- No ADR or roadmap of this repository is touched.
