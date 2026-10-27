---
name: context-review
description: Measure and trim what a repository or the agent dir keeps in omp's always-on context (AGENTS.md, rules, skills, learned lessons). Use monthly per repo, after AGENTS.md grew or a burst of lessons, or when rules feel noisy, fire nowhere, or fire in the wrong repo.
---

# Context review

Always-on text is paid on every request and dilutes every other instruction. This review measures it, decides
per item whether it must stay always on, and moves or deletes the rest. It changes nothing without the
user's go-ahead.

## 1. Measure

```sh
bun ~/.omp/agent/skills/context-review/scripts/measure-context.ts --repo <repo>   # add --json for raw numbers
```

No model call: it reads omp's own system prompt over RPC (`get_state`) in the repository and in an empty git
directory with the same agent dir. The difference is the project share, attributed to:

- context files (`AGENTS.md`, `CLAUDE.md`, ...) with every `##` section;
- rules and skills the project adds to the lists (name and description only);
- other project-dependent text, usually `Memory Guidance` = the learned lessons in
  `~/.omp/agent/memories/<encoded cwd>/learned.md` (one file per working directory, worktrees included).

The agent-dir lists (team and personal rules and skills) are printed too. Token figures are estimates;
write the numbers down, the result is compared against them.

Measuring in a worktree nested in the main checkout (`<repo>/.worktrees/<name>`): omp walks up past the
git root, so it also loads the main checkout's `AGENTS.md` and drops it only when the worktree's copy
contains it unchanged. After editing `AGENTS.md` in such a worktree, both copies show up as context files;
subtract the main checkout's copy for the after figure. The same double load hits every agent working in
that worktree until the change is merged.

Findings on project rule files: `ALWAYS_APPLY` (body in every request), `NOT_LISTED` (no description and no
`alwaysApply`: omp never offers it), `LONG_DESCRIPTION` (over 250 characters, listed every request),
`DEAD_GLOB` (no tracked file matches its globs, so the model never has a reason to read it). A finding is a
reason to look, not a verdict.

## 2. Classify every always-on item

One line each, in a table with its token estimate:

| Verdict | When | Action |
|---|---|---|
| keep | needed for almost every task in this repo and stated nowhere else | stays; tighten wording |
| on demand | needed only for some files or tasks | rule with `description` (+ `globs`) in the repo's rules directory (`.omp/rules/` or `.agents/rules/`, whichever it uses); a multi-step procedure becomes a skill |
| duplicate | omp's system prompt, the team config or another loaded file already says it | delete |
| stale | names paths, tools, commands or workflows that no longer exist (check with `grep`/`git log`) | delete or correct |
| contradiction | conflicts with another loaded instruction | resolve with the user; never keep both |

- An on-demand rule needs a description that names its trigger ("Read before ...", "Use when editing ...");
  the model reads the body only when the description fits the work.
- Learned lessons: one that applies to a whole repo or the team becomes a rule (`rule://lesson-scope`
  says where); an obsolete one is deleted from `learned.md`. Lessons stranded in a removed worktree's
  memory directory are moved or dropped.
- Ownership decides the route: `git log --format=%an -- <file> | sort | uniq -c`. A file maintained
  upstream (the repo has an `upstream` remote and most commits are not ours) is changed through an
  upstream PR, never trimmed in the fork; follow the repository's rules for posting to GitHub.

## 3. Propose, then apply

Show the table, the before/after numbers and the full text of every new or rewritten rule. Wait for approval.
Apply in a worktree of that repository and commit there per its workflow.

## 4. Verify

- Re-run step 1: the project share dropped by what was promised, no new findings you did not accept.
- For every item moved to on demand, one headless check that the model still reads it when the work fits:
  run `omp -p --mode json --no-session "<a request that needs it>"` in the repository and confirm a `read` of
  `rule://<name>` (or `skill://<name>`) in the events. A rule that is never read is deleted or its
  description rewritten, not kept as a silent stub.
