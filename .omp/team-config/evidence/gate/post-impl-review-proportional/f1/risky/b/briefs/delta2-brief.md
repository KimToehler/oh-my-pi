Review this fix delta. Workspace root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1b-b/.worktrees/jobq-lifecycle-review. Plan: openspec/changes/jobq-lifecycle (OpenSpec change folder: proposal.md, specs/**/spec.md, design.md, gate.md, tasks.md; review.md is the planning-review record).
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
Feature-specific criteria: not in plan (gate.md carries no Feature-specific criteria block; this OpenSpec change's criteria are the `### Requirement:` blocks of specs/job-lifecycle/spec.md with their Negative control scenarios, verbatim:)
### Requirement: A queued job is claimed by one worker
`claim(id, worker)` SHALL move a queued job to `running`, record the worker as owner and resolve `true`; it SHALL resolve `false` for a job that is not queued.

#### Scenario: Claim a queued job
- **WHEN** worker `w1` claims queued job `a`
- **THEN** `claim` resolves `true`, the job is `running` and its owner is `w1`

#### Scenario: Negative control
- **WHEN** worker `w2` claims job `a` after `w1` has claimed it
- **THEN** `claim` resolving `true` for `w2` MUST fail the check; it resolves `false`

### Requirement: Completing a running job marks it done
`complete(id)` SHALL mark a running job `done` and clear its owner; `complete` SHALL throw for an unknown id.

#### Scenario: Complete a claimed job
- **WHEN** job `a` is running and `complete("a")` is called
- **THEN** the job is `done` with no owner

#### Scenario: Negative control
- **WHEN** `complete("missing")` is called for an id that was never added
- **THEN** returning normally MUST fail the check; it throws

### Requirement: Each claim persists a snapshot
`claim` SHALL write the state of every job to the queue's snapshot path before it resolves.

#### Scenario: Snapshot written
- **WHEN** a claim resolves for job `a`
- **THEN** the snapshot file lists job `a` as `running`

#### Scenario: Negative control
- **WHEN** the snapshot path is not writable
- **THEN** `claim` resolving `true` MUST fail the check; it rejects
- **Accepted residual risks**: none (no concurrency or state defect is accepted for this change)
- **Out of scope for blocking**: none (no area is excluded from blocking)
Fix entries this delta implements, verbatim from the plan's ## TODOs:
4. F2 wave 2 fix (illegal-state-transition, src/worker.ts:6): `JobQueue.get` and `JobQueue.add` return copies of the job instead of the queue's own object, so no caller, `requeue` included, can change a job's state by assigning to it (`Object.assign`); every state change goes through the queue's checked transitions. Verify: `bun test`
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
none: every row re-run
Commit range de189bf51177ed599f0c5f90534b23007c053d4e..f0200d7e9ddff55a1ba8b678ef3ba1a50660d699, commits 426f05b4454b748466909162553fdafef59e3a9a (Add F2 wave 2 fix row), f0200d7e9ddff55a1ba8b678ef3ba1a50660d699 (Return job copies so state changes only through JobQueue).
The diff is one patch file per commit, in commit order, each with its commit header. Read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1b-b/.worktrees/jobq-lifecycle-review/.omp/team-config/gate-deltas/F2-4-f0200d7e9ddf-20261102211055/manifest.json, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
