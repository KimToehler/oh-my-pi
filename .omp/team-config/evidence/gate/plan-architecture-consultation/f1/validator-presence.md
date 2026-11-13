# F1-E validator presence rows

Requirement "Risky changes need the consultation record" (spec plan-architecture-consultation). Each fixture is a change folder filled from the shipped templates (proposal, spec, design, tasks, gate, review, consultation) with a two-reviewer OKAY review.md bound to the digest `--digest` printed (one-reviewer at standard).

All commands ran on the real CLI `/Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` (node). Fixtures are under `/tmp/pac-f1-ValidatorRowsF1E/`.

## Row: Consulted risky change

**Expected (per scenario):** a risky change with a well-formed `consulted` record and a valid, current OKAY review.md: `--reviewed` passes (exit 0).

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-consulted/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-consulted/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-consulted/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 1 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Skipped risky change

**Expected (per scenario):** a risky change with a well-formed `skipped` record (user's reason) and a valid, current OKAY review.md: `--reviewed` passes (exit 0).

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-skipped/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-skipped/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-skipped/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 1 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Standard change

**Expected (per scenario):** a standard change without consultation.md and a valid, current OKAY review.md: `--reviewed` passes (exit 0).

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-standard/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-standard/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-standard/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 1 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: class auth-secrets-pii, no Depth bullet, no consultation.md

**Expected (per scenario):** `--reviewed` MUST fail (exit 1) and name `consultation.md` on stderr, although review.md is a valid current OKAY.

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-nc-3/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-nc-3/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-nc-3/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: Depth risky, no consultation.md

**Expected (per scenario):** `--reviewed` MUST fail (exit 1) and name `consultation.md` on stderr, although review.md is a valid current OKAY.

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-nc-4/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-nc-4/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-nc-4/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: pending record at risky

**Expected (per scenario):** `--reviewed` MUST fail (exit 1) and name `consultation.md` on stderr, although review.md is a valid current OKAY.

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-nc-5/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-nc-5/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-nc-5/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md: the consultation is still pending; finish the consultation step of the review
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: pending record at standard

**Expected (per scenario):** `--reviewed` MUST fail (exit 1) and name `consultation.md` on stderr, although review.md is a valid current OKAY.

### Step 1

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/pres-nc-6/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/pres-nc-6/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/pres-nc-6/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md: the consultation is still pending; finish the consultation step of the review
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Summary

| Row | Result |
|---|---|
| Consulted risky change | MATCH |
| Skipped risky change | MATCH |
| Standard change | MATCH |
| Negative control: class auth-secrets-pii, no Depth bullet, no consultation.md | MATCH |
| Negative control: Depth risky, no consultation.md | MATCH |
| Negative control: pending record at risky | MATCH |
| Negative control: pending record at standard | MATCH |

Overall: PASS
