---
description: review-work gate traps that cost a whole wave - trailer shape, re-waves, evidence-only commits, merging main mid-gate, measurement harnesses, counted captures, brief building, blocker triage order, elided patch reads, unverified library claims; read before a GC wave, a fix round or a reviewer dispatch
globs:
  - "**/.omp/plans/**"
  - "**/openspec/changes/**"
  - "**/.omp/team-config/evidence/**"
---

# review-work gate mechanics

Each item cost at least one wave. OpenSpec-specific pitfalls (tasks.md row syntax, whole-reply trailers, brief
size) are in `lesson-openspec-gate-pitfalls`; its "Validate every tasks.md edit at once" applies to plan-file fix rows too.

## Formats the validators enforce late

- **Trailers:** before `GC wave`, check a stored trailer's whole shape at once: `REVIEW-TRAILER-v1`, `invocation`,
  `sections_covered`, `model_id`, `verdict`, `blockers`, an `adversarial_criteria:` block with all five fields,
  `END-REVIEW-TRAILER`. `validate-gate-record.mjs` refuses a drifted one (a singular `adversarial_criterion:`) only
  at Phase 5, after the ledger recorded the wave; trailers are never edited, and the re-run may need a new fix row
  and a whole wave.
- Piping a validator through `tail` hides its exit code: `set -o pipefail` before chaining a commit on it.

## Waves and commits

- **Re-wave after a committed record:** store the new wave's trailer at a new path (`...-wave2.txt`) and run
  `GC wave` before touching the tracked record or trailer; otherwise GC refuses with "tracked files differ from the
  snapshot".
- **Evidence-only commits after a PASS** (record, trailer, F1 captures or harness) block `GC ready` as unreviewed fix
  commits. Record `gate-convergence.mjs exempt --sha <full 40-hex sha> --reason ...` per commit (a short sha fails
  with "unknown commit"). A plan-reviewer delta over such commits aborts under `ui-automation-credentials` once the
  brief names QA skills or evidence patches, and a retry aborts the same way: exempt instead of dispatching.
- **Bound evidence is never edited** once the record binds it by sha256, not even in a post-merge commit; put
  corrections in a new file the record binds, or in unbound notes.
- **Main moves:** run `git merge-base --is-ancestor main HEAD` before `GC baseline`. Merging main after the baseline
  puts every main commit into the next delta (`GC patch` writes `git show` per commit of base..head); when that diff
  is large and disjoint from the plan, run the wave on the unmerged branch and merge the reviewed tree as it stands.
  Size it first with `git diff --stat $(git merge-base main HEAD) main`.
- **A fix that only needs a measurement** keeps its harness as evidence next to its captures and re-runs from there;
  a reusable runner (image, launcher under `scripts/`, a documented command) is rejected as a new subsystem.
- **Counted capture runs:** never edit, check out or create a file in the worktree while one captures. Bash reads
  scripts lazily (a half-edited script runs), and a capture that stamps the worktree state records `(dirty)` for an
  unrelated edit. Draft F1 tooling outside the worktree and commit harness changes between runs.

## Reviewers

- **Build every brief in one eval cell from its source text** and pass that variable as the task; never a literal
  placeholder. Extract instruction paragraphs by their opening and closing text and print their first and last 60
  characters before dispatch: fixed line ranges silently cut first lines. Kill a misdispatched reviewer and redispatch
  under a new name.
- **Never edit the change folder while a blocker-verifier triages.** It reads the working tree, so a fix written
  meanwhile makes it refute the blocker. Per round: commit the pre-triage record, dispatch, wait, commit the triaged
  record, then edit and commit fixes and cut the delta patch from the triage commit.
- **Elided patch reads:** a router can compress a reviewer's read of a long delta patch to "... diff body omitted",
  and the reviewer rejects an incomplete delta. Check the patch on disk; if it is complete, do not record that
  verdict: re-run `GC patch` into a new directory and re-dispatch telling the reviewer to read elided patches in
  ~40-line ranges.
- **Library-default claims are hypotheses.** Verify each against the dependency's cached `-sources.jar` (or source)
  and run the candidate control on the old code before fixing or keeping a test.
