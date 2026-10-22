---
description: Plan-review process checks from the Evo2 branch - abort rule, decided assumptions, cut at two subsystems, fix deltas
agents: [plan-reviewer]
alwaysApply: true
---

# Process checks

Labels are PROCESS 1-4. Same form as CHECK n: each fires only on its trigger; a triggered check without the required answer is a blocker under the blocking threshold of the reviewer's <decision> (otherwise a note), naming the label and the plan slot. Among equal severity, PROCESS blockers follow CHECK 1-8.

Opt-out first: before any PROCESS check, look for a top-level bullet `- Merge gate: not applicable (<reason>)` outside code fences. If the plan has one, you MUST NOT report PROCESS 1, 2 or 3 for it, not even as a lower-severity blocker; PROCESS 4 is never skipped; an undecided contingency in such a plan is out of PROCESS scope. CHECK and DOMAIN rules still apply on their own triggers. A quoted or nested opt-out line is not an opt-out.

- **PROCESS 1, abort rule.** Trigger: a `## Merge gate` section with feature-specific criteria. Required: every criterion is decidable, meaning its invariant names an observable property of a named component and its negative control names an input or state that must fail ("the system is secure" is not decidable); `Accepted residual risks` and `Out of scope for blocking` name concrete risks or areas, or `none` with a reason that holds against the plan; no accepted residual risk or out-of-scope area contradicts a criterion's invariant.
- **PROCESS 2, decided assumptions.** Trigger: an assumption or contingency whose acceptance is open ("if not acceptable", "otherwise", "if reality is X", "falls nicht", "sonst"). Required: the decision and who made it; a fallback that adds a subsystem (proxy, staging tree, daemon, store, endpoint) is designed in this plan or named as a separate plan before implementation.
- **PROCESS 3, cut.** Trigger: the plan changes more than two subsystems (packages, services, or independently testable mechanisms). Required: a cut into plans with their own gates, or evidence that the parts cannot ship separately.
- **PROCESS 4, fix delta.** Trigger: the assignment is a fix delta (fix entries plus their diff). Check the diff before any table. Required: (a) the delta adds no subsystem (process, proxy, store, staging tree, daemon, endpoint, or another independently testable mechanism); one that does is a blocker: it becomes its own plan; (b) every removed or weakened line that protected something (a `DELETE`, cleanup, reset, guard, check, validation, refusal) has a named replacement in the delta or a reason the protection is obsolete; a removal without either is a correctness blocker that quotes the removed line and names the scenario it now breaks; (c) the delta fixes what its fix entries name; CHECK 1-8 and triggered DOMAIN checks apply to what the delta adds, changes or removes and to defects it causes or exposes in unchanged code, under the blocking threshold, against the plan invariants in the assignment. A missing table is a separate blocker ranked below (b).
