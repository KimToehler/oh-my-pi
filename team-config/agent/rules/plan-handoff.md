---
description: Plan handoff and status reporting - settle approach-deciding gates before handoff, state artifact status, offer the high-accuracy review, lead with unmet goals and pending gates, verify blockers and agent activity before reporting them
globs:
  - "**/.omo/plans/**/*.md"
  - "**/.omo/drafts/**/*.md"
  - "**/.omo/handover-*.md"
  - "**/openspec/changes/**/*.md"
---

# Plan Handoff and Status Reporting

## Before the plan ships

**Settle every approach-deciding unknown during planning.** Scan the todos for a
"prove X, else fallback Y" gate, an unverified assumption later todos build on, or a branch
point the plan names. Settle each with the actual tool and write the result in as a decided
fact. Ordering it first and marking it blocking only defers the decision into execution.
Expect the plan to grow: a probe often exposes second-order consequences. A gate whose
outcome cannot change the approach (a QA step, a verification wave) may stay where it is.

**State the artifact status plainly:** draft created or not, plan file written or not, and
the exact action the user must take next.

**Offer the high-accuracy review at handoff.** On the clear-intent path without an explicit
accuracy request, present both options: start execution, or review first. A correction
round by the same plan session is author self-checking; the review needs independent cold
readers (`plan-reviewer` plus an `oracle` task). If your own correction round found defects, say so.

## While reporting

**Lead with what is not done.** Ticked checkboxes are not completion while a reviewer, gate,
or merge is pending; never open with a banner like "ORCHESTRATION COMPLETE" in that state. Before asking
for merge approval, compare the plan's headline promise with the reviewers' verdicts; if the
headline goal is not reached, open with that, name what still blocks it, and ask whether to
merge as an intermediate step.

**Verify before reporting a blocker.** Inspect the exact path and the precedent the task
names. When the user says a prerequisite is merged, read the cited lines in the current
worktree and continue. A delegated agent lacking a tool is not a blocker when you have it.

**Check timestamps before saying an agent "is running" or "is writing".** Compare the
current time, the agent's last activity, and the artifact mtime. Use `read proc://` to
list jobs/agents with status and `read proc://<id>` to inspect one. Report historical
progress as historical; on a stall, cancel (`write proc://<id>/kill`) or re-dispatch deliberately.
