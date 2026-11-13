# F1-E validator digest rows

Requirement "The record is outside the review digest" (spec plan-architecture-consultation).

All commands ran on the real CLI `/Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` (node). Fixtures are under `/tmp/pac-f1-ValidatorRowsF1E/`.

## Row: Skip recorded after an OKAY review

**Expected (per scenario):** a risky change with a current OKAY review.md gets a well-formed `skipped` record and nothing else changes: `--digest` prints the digest recorded in review.md and `--reviewed` passes; a further edit of the record keeps both.

### Step 1: reviewed before the record exists (baseline: refused, names consultation.md)

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./review.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
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

### Step 2: record the skip

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --digest /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
```

Exit code: **0**

stdout:

```
7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71
```

stderr:

```
```

Step 2 judgment: expected exit 0, stdout "7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71\n"; observed exit 0. **MATCH**

### Step 3: digest recorded in review.md

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --digest /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
```

Exit code: **0**

stdout:

```
7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71
```

stderr:

```
```

Step 3 judgment: expected exit 0, stdout as described; observed exit 0. **MATCH**

### Step 4: --reviewed with the skip recorded

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 4 judgment: expected exit 0; observed exit 0. **MATCH**

### Step 5: edit the record (reason text), digest and review unchanged

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --digest /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
```

Exit code: **0**

stdout:

```
7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71
```

stderr:

```
```

Step 5 judgment: expected exit 0, stdout "7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71\n"; observed exit 0. **MATCH**

### Step 6: --reviewed after the record edit

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-skip/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/dig-skip/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 6 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: one line of design.md edited while a record is present

**Expected (per scenario):** a change with a current OKAY review.md and a consultation.md has one line of design.md edited: `--reviewed` MUST fail (exit 1) as stale; the plain run still passes.

### Step 1: before the edit

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-nc/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-nc/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/dig-nc/change
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

### Step 2: edit design.md ("one row" -> "two rows")

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/dig-nc/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/dig-nc/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/dig-nc/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
review.md: stale: the change changed after review (reviewed 7f13728d36d085b16244b5ea9e93e558c6ddc6c01916b9c8eb7f80728394cc71, current f04c2b5ea43b9d1e745791af948561115c5acdb2e6a75dc662e83726872bef64); re-run the review
```

Step 2 judgment: expected exit 1, stderr contains "stale"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Summary

| Row | Result |
|---|---|
| Skip recorded after an OKAY review | MATCH |
| Negative control: one line of design.md edited while a record is present | MATCH |

Overall: PASS
