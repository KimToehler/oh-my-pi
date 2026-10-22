---
description: Before spawning subagents with the task tool - pick the agent by reasoning difficulty, serialize overlapping file-sets, isolate concurrent editing tasks, never touch files a running subagent owns, keep reviews small and fresh
condition: ".*"
scope: ["tool:task"]
agents: [main]
interruptMode: always
---

# Delegation and Parallel Dispatch (omp)

**Pick the agent by reasoning difficulty, not diff size.** `scout`/`sonic` run on the cheap
`@smol` model: give them only lookups and mechanical edits. A one-line change that needs an
evidence document cross-checked, a serialization format preserved, or git history reasoned
about goes to `task` (or stays with you). `oracle` is for architecture calls and debugging
after two failed attempts; `auditor`/`reviewer` are for finished diffs; `plan-reviewer` for plans and fix deltas.

**Overlapping tasks never run in the same batch.** Derive each item's file-set from the plan's
`Files:` lines or the scope. Items overlap when their sets intersect, including shared barrels,
i18n, tokens, and config. Overlapping items go in separate `task` calls, one after the other;
disjoint items may share a batch. An unknown file-set overlaps everything.

**Two or more concurrent editing tasks run isolated.** Pass `isolated: true` on the task item
(or enable `task.isolation.enabled`), so each child edits its own APFS clone and its changes
come back as a patch. A real collision then surfaces as a failed apply, not a silent interleave.

**A running subagent owns its files.** Do not edit them until its result arrives (`wait`, or the
delivered `task-result`). A staged-but-uncommitted tree looks the same as finished work.

**Reviews stay small and start fresh.** Split a large review by shared files into 2-3 reviewer
tasks, not one per angle. Put the `file:line` inventory and only the relevant plan excerpt in the
brief; ask for blockers with `file:line`, at most 5 notes, and one verdict line. A re-review
after fixes is a new task with the delta and the open blockers, never a follow-up message to the
old reviewer (`write agent://...`).

**After every editing subagent:** check `git reflog <default-branch> -3` and `git worktree list`.
Unexpected movement of the default branch is an incident to report.
