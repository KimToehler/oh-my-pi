# F1-E validator form rows

Requirements "The consultation record is well formed", "Record text is kept verbatim" and "One report check decides whether an attempt counts" (spec plan-architecture-consultation); task 2.2 duplicate and id rows, task 2.3 record-invariant rows. Each record is the shipped consultation template with slots filled (reports written with JSON.stringify) inside a risky change with a two-reviewer OKAY review.md.

All commands ran on the real CLI `/Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` (node). Fixtures are under `/tmp/pac-f1-ValidatorRowsF1E/`.

## Row: Consulted without findings

**Expected (per scenario):** a `consulted` record with bottom line `KEEP APPROACH` and `## Findings` `none` passes this check: plain run exit 0 `passed`, `--reviewed` exit 0.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-1/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-1/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-1/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-1/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-1/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-1/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Verbatim text that looks like a slot

**Expected (per scenario):** a `skipped` record whose reason reads `This only changes the TODO scanner; skip the consultation` passes, and a `consulted` record whose report (JSON.stringify) has a correction starting with a multiline fenced shell example quoting `--original-reply <file>` and a recommended approach with Markdown headings and a fence passes: plain exit 0 and `--reviewed` exit 0 for both.

### Step 1: skipped record: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-2/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-2/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-2/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: skipped record: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-2/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-2/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-2/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

### Step 3: consulted record with fenced report text: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-3/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-3/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-3/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 3 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 4: consulted record with fenced report text: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-3/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-3/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-3/change
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

Row judgment: **MATCH** (observed matches expected)

## Row: Pending record

**Expected (per scenario):** a `pending` record naming one dispatched attempt: the plain run passes (exit 0) and `--reviewed` fails (exit 1) naming `consultation.md`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-4/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-4/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-4/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-4/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-4/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-4/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md: the consultation is still pending; finish the consultation step of the review
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a subsection without its Disposition bullet

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-5/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-5/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-5/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: ### F1: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-5/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-5/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-5/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: ### F1: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a disposition that is neither adopted nor rejected

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-6/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-6/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-6/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: ### F1: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-6/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-6/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-6/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: ### F1: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report finding without its ### subsection

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-7/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-7/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-7/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F1)
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-7/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-7/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-7/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F1)
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: subsections in another order than the report

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-8/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-8/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-8/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F2, F1)
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-8/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-8/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-8/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F2, F1)
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report line that is not JSON

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-9/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-9/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-9/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: the report line is not JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-9/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-9/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-9/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: the report line is not JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report that lacks `findings`

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-10/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-10/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-10/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings: expected an array
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-10/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-10/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-10/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings: expected an array
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a Bottom line other than the report's verdict

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Bottom line`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-11/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-11/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-11/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: expected the report's verdict CHANGE APPROACH
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-11/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-11/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-11/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: expected the report's verdict CHANGE APPROACH
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a record without the ## Report heading

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-12/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-12/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-12/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: expected exactly one "## Report" section, found 0
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-12/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-12/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-12/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: expected exactly one "## Report" section, found 0
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a consulted record whose Models holds a dispatched entry

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Models`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-13/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-13/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-13/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: expected every attempt with its models and no dispatched entry
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-13/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-13/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-13/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: expected every attempt with its models and no dispatched entry
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a pending record with no attempt (Models none)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Models`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-14/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-14/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-14/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: a pending record names every attempt so far
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-14/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-14/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-14/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: a pending record names every attempt so far
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: Status drafted

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Status`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-15/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-15/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-15/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: expected consulted, skipped or pending, got drafted
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-15/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-15/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-15/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: expected consulted, skipped or pending, got drafted
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a skipped record with Skip reason none

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Skip reason`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-16/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-16/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-16/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: a skipped record needs the user's reason in their words
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-16/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-16/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-16/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: a skipped record needs the user's reason in their words
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: Consultant naming another agent (oracle, X1)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consultant`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-17/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-17/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-17/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: expected architecture-oracle, <subagent id of the counted attempt>
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-17/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-17/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-17/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: expected architecture-oracle, <subagent id of the counted attempt>
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a 39-hex consulted commit

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consulted commit`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-18/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-18/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-18/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: expected the 40-hex commit whose change folder the consultant read
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-18/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-18/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-18/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: expected the 40-hex commit whose change folder the consultant read
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Status twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Status`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-19/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-19/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-19/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-19/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-19/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-19/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Consulted commit twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consulted commit`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-20/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-20/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-20/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-20/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-20/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-20/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Consultant twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consultant`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-21/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-21/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-21/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-21/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-21/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-21/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Models twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Models`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-22/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-22/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-22/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-22/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-22/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-22/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Bottom line twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Bottom line`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-23/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-23/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-23/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-23/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-23/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-23/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: header field Skip reason twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Skip reason`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-24/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-24/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-24/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: expected exactly one top-level bullet, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-24/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-24/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-24/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: expected exactly one top-level bullet, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: section ## Report twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-25/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-25/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-25/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: expected exactly one "## Report" section, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-25/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-25/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-25/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: expected exactly one "## Report" section, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: section ## Findings twice (task 2.2 duplicate row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-26/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-26/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-26/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected exactly one "## Findings" section, found 2
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-26/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-26/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-26/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: expected exactly one "## Findings" section, found 2
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: two report findings with the same id (task 2.2 id row / 2.3 invariant)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report.findings[1].id: duplicate id F1`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-27/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-27/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-27/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[1].id: duplicate id F1
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[1].id: duplicate id F1"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-27/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-27/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-27/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[1].id: duplicate id F1
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[1].id: duplicate id F1"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a finding with an empty id (task 2.2 id row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report.findings[0].id`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-28/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-28/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-28/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[0].id"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-28/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-28/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-28/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[0].id"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a finding id spanning two lines (task 2.2 id row)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report.findings[0].id`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-29/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-29/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-29/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1
F1b, F2); found (F1 F1b, F2)
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[0].id"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-29/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-29/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-29/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1
F1b, F2); found (F1 F1b, F2)
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings[0].id"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report line that is a JSON array (2.3 invariant)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report: expected an object`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-30/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-30/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-30/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report: expected an object
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report: expected an object"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-30/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-30/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-30/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report: expected an object
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report: expected an object"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report without bottom_line.verdict (2.3 invariant)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report.bottom_line.verdict: expected a string`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-31/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-31/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-31/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.bottom_line.verdict: expected a string
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report.bottom_line.verdict: expected a string"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-31/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-31/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-31/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.bottom_line.verdict: expected a string
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report.bottom_line.verdict: expected a string"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: a report whose findings is an object (2.3 invariant)

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report: report.findings: expected an array`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-32/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-32/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-32/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings: expected an array
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings: expected an array"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-32/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-32/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-32/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: report.findings: expected an array
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report: report.findings: expected an array"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Status left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Status`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-33/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-33/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-33/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-33/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-33/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-33/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Consulted commit left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consulted commit`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-34/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-34/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-34/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-34/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-34/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-34/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consulted commit: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consulted commit"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Consultant left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Consultant`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-35/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-35/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-35/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-35/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-35/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-35/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Consultant: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Consultant"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Models left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Models`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-36/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-36/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-36/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-36/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-36/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-36/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Models: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Models"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Bottom line left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Bottom line`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-37/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-37/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-37/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-37/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-37/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-37/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Bottom line: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Bottom line"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: field Skip reason left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Skip reason`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-38/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-38/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-38/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-38/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-38/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-38/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Skip reason: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Skip reason"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: section ## Report left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Report`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-39/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-39/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-39/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-39/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-39/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-39/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Report: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Report"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: section ## Findings left at its template slot text

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Findings`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-40/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-40/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-40/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-40/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-40/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-40/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Findings: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Findings"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Negative control: the shipped template copied unfilled

**Expected (per scenario):** plain run MUST fail (exit 1) and `--reviewed` MUST fail (exit 1), each naming `consultation.md Status`.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-41/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-41/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-41/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: still holds the template's slot text
consultation.md Consulted commit: still holds the template's slot text
consultation.md Consultant: still holds the template's slot text
consultation.md Models: still holds the template's slot text
consultation.md Bottom line: still holds the template's slot text
consultation.md Skip reason: still holds the template's slot text
consultation.md Report: still holds the template's slot text
consultation.md Findings: still holds the template's slot text
```

Step 1 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-41/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-41/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-41/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation.md Status: still holds the template's slot text
consultation.md Consulted commit: still holds the template's slot text
consultation.md Consultant: still holds the template's slot text
consultation.md Models: still holds the template's slot text
consultation.md Bottom line: still holds the template's slot text
consultation.md Skip reason: still holds the template's slot text
consultation.md Report: still holds the template's slot text
consultation.md Findings: still holds the template's slot text
```

Step 2 judgment: expected exit 1, stderr contains "consultation.md Status"; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Record invariant (passes the record check): a report lacking `trigger`

**Expected (per scenario):** the record check does not validate those report fields: plain run exit 0 `passed` and `--reviewed` exit 0.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-42/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-42/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-42/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-42/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-42/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-42/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Record invariant (passes the record check): a report lacking `recommended_approach`

**Expected (per scenario):** the record check does not validate those report fields: plain run exit 0 `passed` and `--reviewed` exit 0.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-43/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-43/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-43/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-43/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-43/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-43/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Record invariant (passes the record check): a `category` outside its enum

**Expected (per scenario):** the record check does not validate those report fields: plain run exit 0 `passed` and `--reviewed` exit 0.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-44/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-44/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-44/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-44/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-44/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-44/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Record invariant (passes the record check): a number as `confidence`

**Expected (per scenario):** the record check does not validate those report fields: plain run exit 0 `passed` and `--reviewed` exit 0.

### Step 1: plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-45/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-45/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/form-45/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 2: --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/form-45/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/form-45/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/form-45/change
```

Exit code: **0**

stdout:

```
reviewed: OKAY in round 1
```

stderr:

```
```

Step 2 judgment: expected exit 0; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Accepted report (--consultation-report)

**Expected (per scenario):** an accepted terminal yield for this change on the pinned model whose data has a finding with an empty `counterevidence`: exit 0, prints the report as one JSON line; a record holding that line passes the plain run.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-46/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-46/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-46/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-46/change
```

Exit code: **0**

stdout:

```
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "{\"bottom_line\":{\"verdict\":\"CHANGE APPROACH\",\"reason\":\"The update races. A row lock fixes it.\"},\"findings\":[{\"id\":\"F1\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"}],\"recommended_approach\":\"Keep the endpoint and lock the row.\",\"uncertainties\":[\"Whether the ORM issues SELECT FOR UPDATE; its query log settles it.\"],\"inspected\":\"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md\"}\n"; observed exit 0. **MATCH**

### Step 2: record holding the printed line

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-46/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-46/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/rep-46/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 2 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: a finding without trigger (2.2 row moved to the report check)

**Expected (per scenario):** exit 1 naming `report.findings[0].trigger: missing`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-47/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-47/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-47/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-47/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.findings[0].trigger: missing
```

Step 1 judgment: expected exit 1, stderr contains "report.findings[0].trigger: missing", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: a report without recommended_approach (2.2 row moved)

**Expected (per scenario):** exit 1 naming `report.recommended_approach: missing`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-48/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-48/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-48/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-48/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.recommended_approach: missing
```

Step 1 judgment: expected exit 1, stderr contains "report.recommended_approach: missing", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: enum - category outside its enum

**Expected (per scenario):** exit 1 naming `report.findings[0].category`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-49/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-49/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-49/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-49/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.findings[0].category: expected one of design defect, simplification, unresolved assumption, got "style"
```

Step 1 judgment: expected exit 1, stderr contains "report.findings[0].category", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: enum - verdict outside its enum

**Expected (per scenario):** exit 1 naming `report.bottom_line.verdict`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-50/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-50/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-50/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-50/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.bottom_line.verdict: expected one of KEEP APPROACH, CHANGE APPROACH, INCONCLUSIVE, got "APPROVE"
```

Step 1 judgment: expected exit 1, stderr contains "report.bottom_line.verdict", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: type - confidence is a number

**Expected (per scenario):** exit 1 naming `report.findings[0].confidence: expected a string`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-51/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-51/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-51/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-51/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.findings[0].confidence: expected a string
```

Step 1 judgment: expected exit 1, stderr contains "report.findings[0].confidence: expected a string", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: over-limit report (six findings, four uncertainties)

**Expected (per scenario):** an accepted terminal yield whose data holds six findings and four uncertainties: exit 0, prints the report; a record holding that line passes the plain run.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-52/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-52/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-52/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-52/change
```

Exit code: **0**

stdout:

```
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F3","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F4","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F5","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F6","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["a","b","c","d"],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

stderr:

```
```

Step 1 judgment: expected exit 0, stdout "{\"bottom_line\":{\"verdict\":\"CHANGE APPROACH\",\"reason\":\"The update races. A row lock fixes it.\"},\"findings\":[{\"id\":\"F1\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F2\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F3\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F4\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F5\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F6\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"}],\"recommended_approach\":\"Keep the endpoint and lock the row.\",\"uncertainties\":[\"a\",\"b\",\"c\",\"d\"],\"inspected\":\"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md\"}\n"; observed exit 0. **MATCH**

### Step 2: record holding the printed line

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-52/change && find . -type f | sort`):

```
./.openspec.yaml
./consultation.md
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-52/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/rep-52/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 2 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: --consultation-report: two findings with the same id

**Expected (per scenario):** exit 1 naming `duplicate`, stdout empty.

### Step 1: report check

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/rep-53/change && find . -type f | sort`):

```
./.openspec.yaml
./design.md
./gate.md
./proposal.md
./specs/feature/spec.md
./tasks.md
```

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/rep-53/change`):

```
node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/rep-53/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/rep-53/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.findings[1].id: duplicate id F1
```

Step 1 judgment: expected exit 1, stderr contains "duplicate", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Summary

| Row | Result |
|---|---|
| Consulted without findings | MATCH |
| Verbatim text that looks like a slot | MATCH |
| Pending record | MATCH |
| Negative control: a subsection without its Disposition bullet | MATCH |
| Negative control: a disposition that is neither adopted nor rejected | MATCH |
| Negative control: a report finding without its ### subsection | MATCH |
| Negative control: subsections in another order than the report | MATCH |
| Negative control: a report line that is not JSON | MATCH |
| Negative control: a report that lacks `findings` | MATCH |
| Negative control: a Bottom line other than the report's verdict | MATCH |
| Negative control: a record without the ## Report heading | MATCH |
| Negative control: a consulted record whose Models holds a dispatched entry | MATCH |
| Negative control: a pending record with no attempt (Models none) | MATCH |
| Negative control: Status drafted | MATCH |
| Negative control: a skipped record with Skip reason none | MATCH |
| Negative control: Consultant naming another agent (oracle, X1) | MATCH |
| Negative control: a 39-hex consulted commit | MATCH |
| Negative control: header field Status twice (task 2.2 duplicate row) | MATCH |
| Negative control: header field Consulted commit twice (task 2.2 duplicate row) | MATCH |
| Negative control: header field Consultant twice (task 2.2 duplicate row) | MATCH |
| Negative control: header field Models twice (task 2.2 duplicate row) | MATCH |
| Negative control: header field Bottom line twice (task 2.2 duplicate row) | MATCH |
| Negative control: header field Skip reason twice (task 2.2 duplicate row) | MATCH |
| Negative control: section ## Report twice (task 2.2 duplicate row) | MATCH |
| Negative control: section ## Findings twice (task 2.2 duplicate row) | MATCH |
| Negative control: two report findings with the same id (task 2.2 id row / 2.3 invariant) | MATCH |
| Negative control: a finding with an empty id (task 2.2 id row) | MATCH |
| Negative control: a finding id spanning two lines (task 2.2 id row) | MATCH |
| Negative control: a report line that is a JSON array (2.3 invariant) | MATCH |
| Negative control: a report without bottom_line.verdict (2.3 invariant) | MATCH |
| Negative control: a report whose findings is an object (2.3 invariant) | MATCH |
| Negative control: field Status left at its template slot text | MATCH |
| Negative control: field Consulted commit left at its template slot text | MATCH |
| Negative control: field Consultant left at its template slot text | MATCH |
| Negative control: field Models left at its template slot text | MATCH |
| Negative control: field Bottom line left at its template slot text | MATCH |
| Negative control: field Skip reason left at its template slot text | MATCH |
| Negative control: section ## Report left at its template slot text | MATCH |
| Negative control: section ## Findings left at its template slot text | MATCH |
| Negative control: the shipped template copied unfilled | MATCH |
| Record invariant (passes the record check): a report lacking `trigger` | MATCH |
| Record invariant (passes the record check): a report lacking `recommended_approach` | MATCH |
| Record invariant (passes the record check): a `category` outside its enum | MATCH |
| Record invariant (passes the record check): a number as `confidence` | MATCH |
| Accepted report (--consultation-report) | MATCH |
| --consultation-report: a finding without trigger (2.2 row moved to the report check) | MATCH |
| --consultation-report: a report without recommended_approach (2.2 row moved) | MATCH |
| --consultation-report: enum - category outside its enum | MATCH |
| --consultation-report: enum - verdict outside its enum | MATCH |
| --consultation-report: type - confidence is a number | MATCH |
| --consultation-report: over-limit report (six findings, four uncertainties) | MATCH |
| --consultation-report: two findings with the same id | MATCH |

Overall: PASS
