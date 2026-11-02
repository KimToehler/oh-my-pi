# Gate

- **Mandatory class**: concurrency-state
- **Depth**: risky (a job state machine with workers claiming jobs concurrently; the class makes the review risky)
- **Risk tier**: product
- **Author's risk assessment**: a job handed to two workers runs twice, and a job moved through a wrong state can be lost or re-run; the snapshot is the only record after a restart.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: none (no concurrency or state defect is accepted for this change)
- **Out of scope for blocking**: none (no area is excluded from blocking)
