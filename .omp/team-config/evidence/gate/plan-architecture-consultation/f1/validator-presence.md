# F1-E presence rows

Generated 2026-11-12T21:35:27.264Z on worktree HEAD 833d26ad26b643915f9de7be626b2157a1b46ed0; validator `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` run with `node` (v25.9.0). Every folder is built from the shipped `templates/gate.md`, `templates/review.md` and `templates/consultation.md` with their slots filled; the other plan files are fixed fixture text.

## Row: Consulted risky change (expect --reviewed pass)

Folder `/tmp/pac-f1e/fixtures/01-presence/openspec/changes/safe-update`:

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

`consultation.md`:

````markdown
# Consultation

- **Status**: consulted
- **Consulted commit**: 0123456789abcdef0123456789abcdef01234567
- **Consultant**: architecture-oracle, ArchConsult012345671
- **Models**: ArchConsult012345671 onara/cc/claude-fable-5-2
- **Bottom line**: CHANGE APPROACH
- **Skip reason**: none

## Report

```json
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/01-presence/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Skipped risky change (expect --reviewed pass)

Folder `/tmp/pac-f1e/fixtures/02-presence/openspec/changes/safe-update`:

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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/02-presence/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Standard change without consultation.md (expect --reviewed pass)

Folder `/tmp/pac-f1e/fixtures/03-presence/openspec/changes/safe-update`:

```
    38  .openspec.yaml
    43  design.md
  1002  gate.md
   297  proposal.md
   353  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/03-presence/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Negative control: class auth-secrets-pii, no Depth bullet, no consultation.md (expect fail naming consultation.md)

Folder `/tmp/pac-f1e/fixtures/04-presence/openspec/changes/safe-update`:

```
    38  .openspec.yaml
    43  design.md
   923  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/04-presence/openspec/changes/safe-update
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
exit=1
```

## Row: Negative control: Depth risky, no consultation.md (expect fail naming consultation.md)

Folder `/tmp/pac-f1e/fixtures/05-presence/openspec/changes/safe-update`:

```
    38  .openspec.yaml
    43  design.md
   964  gate.md
   297  proposal.md
   393  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/05-presence/openspec/changes/safe-update
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
exit=1
```

## Row: Negative control: pending record at risky (expect fail naming consultation.md)

Folder `/tmp/pac-f1e/fixtures/06-presence/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   256  consultation.md
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

- **Status**: pending
- **Consulted commit**: 0123456789abcdef0123456789abcdef01234567
- **Consultant**: none
- **Models**: ArchConsult012345671 dispatched
- **Bottom line**: none
- **Skip reason**: none

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/06-presence/openspec/changes/safe-update
consultation.md: the consultation is still pending; finish the consultation step of the review
exit=1
```

## Row: Negative control: pending record at standard (expect fail naming consultation.md)

Folder `/tmp/pac-f1e/fixtures/07-presence/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   256  consultation.md
    43  design.md
  1002  gate.md
   297  proposal.md
   353  review.md
   315  specs/feature/spec.md
   141  tasks.md
```

`consultation.md`:

````markdown
# Consultation

- **Status**: pending
- **Consulted commit**: 0123456789abcdef0123456789abcdef01234567
- **Consultant**: none
- **Models**: ArchConsult012345671 dispatched
- **Bottom line**: none
- **Skip reason**: none

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/07-presence/openspec/changes/safe-update
consultation.md: the consultation is still pending; finish the consultation step of the review
exit=1
```
