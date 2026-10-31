# Gate

- **Mandatory class**: none
- **Risk tier**: internal-tooling
- **Author's risk assessment**: Spec text only: one scenario line of `openspec-plan-review` is aligned with the review instruction's existing behaviour. Nothing that runs changes; the worst outcome is a wrong spec sentence that misleads a later reviewer, fixable by another edit. Class `none` because no behaviour, state machine, wire contract or credential path changes; `internal-tooling` because it is review-process documentation that reaches no protected asset.
- **Whole-diff review**: not needed (one spec delta, no code)
- **Accepted residual risks**: none (no behaviour changes)
- **Out of scope for blocking**: other mismatches between the `openspec-plan-review` spec and the schema; the review-strictness changes planned separately.
