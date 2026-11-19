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
Items that are read-only reviewers over the same committed inputs (the `review-work` gate lanes, the `omp-gated` plan-review scopes) do not overlap and may share a batch; editing items keep this rule.

**Two or more concurrent editing tasks run isolated.** Pass `isolated: true` on the task item
(or enable `task.isolation.enabled`), so each child edits its own APFS clone and its changes
come back as a patch. A real collision then surfaces as a failed apply, not a silent interleave.
A `task` subagent's tool cwd is the main checkout, even when the brief names a worktree. A
non-isolated editing brief says so: every read, edit, write and bash call uses the worktree's
absolute path (or `cwd:` set to it). After each lane returns, run `git status --short` in the
main checkout.
`isolated: true` forks each child from the session's own cwd checkout and applies its patch back
there, not into the worktree the brief names. Before isolated lanes for a worktree, move the
session into it (`session_move`, refused while a background job runs); if a job blocks the move,
run non-isolated lanes with absolute paths, disjoint files and no git writes.

**A running subagent owns its files.** Do not edit them until its result arrives (`wait`, or the
delivered `task-result`). A staged-but-uncommitted tree looks the same as finished work.

**Reviews stay small and start fresh.** Split a large review by shared files into 2-3 reviewer
tasks, not one per angle. Put the `file:line` inventory and only the relevant plan excerpt in the
brief; ask for blockers with `file:line`, at most 5 notes, and one verdict line. A re-review
after fixes is a new task with the delta and the open blockers, never a follow-up message to the
old reviewer (`write agent://...`). The review-work TRAILER REPAIR. message is not a re-review: it
goes to the same reviewer by design. A procedure that prescribes its own brief overrides this
paragraph: review-work and integration-review dispatch their verbatim briefs, and the OpenSpec
`omp-gated` review artifact dispatches its fixed brief for every round, and its architecture
consultation step its fixed consultation brief, each with the two paths filled in and nothing
added.

**After every editing subagent:** check `git reflog <default-branch> -3` and `git worktree list`.
Unexpected movement of the default branch is an incident to report.
