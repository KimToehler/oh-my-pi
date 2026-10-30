# Gate

- **Mandatory class**: none
- **Risk tier**: product
- **Author's risk assessment**: The change decides when a commit skips review, during the gate and after it. Too permissive, a comment a tool reads (a suppression, a build tag, a doctest) lands without review and can change what ships; too strict, nothing improves. It changes no executable code, validator, record, ledger, schema or wire contract, and the text is revertible. Class is `none`: the edited instruction implements no auth/PII, migration, external API or concurrency/state behaviour.
- **Whole-diff review**: not needed (one static instruction file; no independently testable module or runtime layer)
- **Accepted residual risks**: Comment kind is the orchestrator's judgement, as the user asked; a misclassified behaviour-changing comment can land unreviewed, visible only through the ledger reason between waves or the commit subject after the merge. The F1 replays are the orchestrator's own judgement: the checker binds row, expected decision, quoted sentence and evidence hash, but cannot prove the sentence entails the decision.
- **Out of scope for blocking**: a validator path admitting comment-only commits after `reviewed_sha`, automatic comment classification by script, the between-waves exemption for anything other than comments, repairing summaries already committed in other repositories, and the plan-review lane (it reviews artifacts, not commits).
