# F1-E digest rows

Generated 2026-11-12T21:35:27.527Z on worktree HEAD 833d26ad26b643915f9de7be626b2157a1b46ed0; validator `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` run with `node` (v25.9.0). Every folder is built from the shipped `templates/gate.md`, `templates/review.md` and `templates/consultation.md` with their slots filled; the other plan files are fixed fixture text.

## Row: Skip recorded after an OKAY review (expect the same digest before and after, then --reviewed pass)

`review.md` records digest `96d5e2426f5cb6cc3dadb3f6f93e068e78313803b47850001c6fa0b0649f516d`.

Folder `/tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update`:

```
    38  .openspec.yaml
    43  design.md
   964  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

Before the record (the review was written without one; risky so `--reviewed` refuses the missing record):

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --digest /tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update
96d5e2426f5cb6cc3dadb3f6f93e068e78313803b47850001c6fa0b0649f516d
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
exit=1
```

## Row: Skip recorded after an OKAY review: after the skipped record was added, nothing else changed

Folder `/tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   237  consultation.md
    43  design.md
   964  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

`consultation.md`:

````markdown
# Consultation

- **Status**: skipped
- **Consulted commit**: none
- **Consultant**: none
- **Models**: none
- **Bottom line**: none
- **Skip reason**: The change is already in apply on another branch

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --digest /tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update
96d5e2426f5cb6cc3dadb3f6f93e068e78313803b47850001c6fa0b0649f516d
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/08-digest/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Negative control, setup: current OKAY review with a consulted record (passes)

Folder `/tmp/pac-f1e/fixtures/09-digest/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1412  consultation.md
    43  design.md
   964  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/09-digest/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Negative control: one line of design.md edited (expect --reviewed fail as stale)

`design.md` line 3 changed from `Update one row in a transaction.` to `Update one row in a transaction under a row lock.`

Folder `/tmp/pac-f1e/fixtures/09-digest/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1412  consultation.md
    60  design.md
   964  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/09-digest/openspec/changes/safe-update
review.md: stale: the change changed after review (reviewed 96d5e2426f5cb6cc3dadb3f6f93e068e78313803b47850001c6fa0b0649f516d, current c5032791a50d7102a1b4cf56d3e285be829467f8392b74b7d76d36ad0a5d55fa); re-run the review
exit=1
```
