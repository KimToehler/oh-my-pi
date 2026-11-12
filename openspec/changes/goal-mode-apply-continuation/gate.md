# Gate

- **Mandatory class**: none
- **Depth**: risky (the change alters the planning boundary, the owner-authorization point that decides when a proposed change may be implemented)
- **Risk tier**: internal-tooling
- **Author's risk assessment**: One command text and the README of the team config, deployed to every omp profile. Worst cases: an agent applies a change the owner did not authorize (a user-started turn or a planning-only objective read as authorization), applies over an owner objection, or applies an unreviewed change; or it keeps stopping as today. An unauthorized apply edits source only in a task-owned worktree, and merging still requires the F2 gate record, so it costs review time and model spend but reaches no protected asset; git shows and reverts every edit. Internal-tooling because it is dev workflow tooling; class `none` because no auth path, schema, external contract or state-machine transition changes.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: Compliance is the agent's judgement from instruction text; F1 shows each scenario in fresh sessions on fixtures, not a compliance rate. A user message sent after a continuation turn has already started reaches the agent only during or after that turn, so that turn may apply before reading it; the owner then stops the goal or reverts the worktree.
- **Out of scope for blocking**: goal-mode runtime code and prompts; `opsx-apply.md` and the validator; the generated parts of `opsx-propose.md` outside the added paragraph and the four one-sentence additions; plan-mode plans, which have no propose step.
