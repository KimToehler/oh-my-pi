# F1-E validator definition rows

Requirement "The consultation record is well formed", scenario "Definition changed after the record". The skill is copied to `<tmp>/def-*/home/{skills/review-work/{scripts,openspec/schemas/omp-gated/templates},agents}`; the copy's `validate-openspec-change.mjs` is run (cwd = the fixture change folder; the listing shown is of that folder).

All commands ran on the real CLI `/Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` (node). Fixtures are under `/tmp/pac-f1-ValidatorRowsF1E/`.

## Row: Definition changed after the record: output schema gains required field risk_summary

**Expected (per scenario):** definition `output` gains required property `risk_summary` (JSON edit of the copy's last frontmatter key) after the records were written. Plain run and `--reviewed` still pass the `consulted` and the `skipped` record (exit 0); `--consultation-report` exits 1 naming `report.risk_summary: missing`.

### Step 1: baseline, unchanged definition: consulted record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change
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

### Step 2: baseline, unchanged definition: --consultation-report of the same report

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change
```

Exit code: **0**

stdout:

```
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

stderr:

```
```

Step 2 judgment: expected exit 0, stdout "{\"bottom_line\":{\"verdict\":\"CHANGE APPROACH\",\"reason\":\"The update races. A row lock fixes it.\"},\"findings\":[{\"id\":\"F1\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F2\",\"category\":\"simplification\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"}],\"recommended_approach\":\"Keep the endpoint and lock the row.\",\"uncertainties\":[\"Whether the ORM issues SELECT FOR UPDATE; its query log settles it.\"],\"inspected\":\"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md\"}\n"; observed exit 0. **MATCH**

### Step 3: AFTER the definition change (applied to the copy now): consulted record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change
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

### Step 4: consulted record, --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change
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

### Step 5: skipped record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-field-skipped/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 5 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 6: skipped record, --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/def-field-skipped/change
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

### Step 7: --consultation-report of an attempt whose report lacks risk_summary / with the definition gone

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-field/home/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/def-field-consulted/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: report.risk_summary: missing
```

Step 7 judgment: expected exit 1, stderr contains "report.risk_summary: missing", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Row: Definition changed after the record: architecture-oracle.md missing

**Expected (per scenario):** definition file removed from the copy. Plain run and `--reviewed` still pass the `consulted` and the `skipped` record (exit 0); `--consultation-report` exits 1 naming `agents/architecture-oracle.md`.

### Step 1: baseline, unchanged definition: consulted record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change
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

### Step 2: baseline, unchanged definition: --consultation-report of the same report

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change
```

Exit code: **0**

stdout:

```
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

stderr:

```
```

Step 2 judgment: expected exit 0, stdout "{\"bottom_line\":{\"verdict\":\"CHANGE APPROACH\",\"reason\":\"The update races. A row lock fixes it.\"},\"findings\":[{\"id\":\"F1\",\"category\":\"design defect\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"},{\"id\":\"F2\",\"category\":\"simplification\",\"locations\":\"design.md:3\",\"trigger\":\"two sessions update the same row\",\"consequence\":\"one update is lost\",\"counterevidence\":\"the endpoint takes no lock\",\"correction\":\"lock the row inside the transaction\",\"confidence\":\"high; a concurrent update test would confirm it\"}],\"recommended_approach\":\"Keep the endpoint and lock the row.\",\"uncertainties\":[\"Whether the ORM issues SELECT FOR UPDATE; its query log settles it.\"],\"inspected\":\"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md\"}\n"; observed exit 0. **MATCH**

### Step 3: AFTER the definition change (applied to the copy now): consulted record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change
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

### Step 4: consulted record, --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change
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

### Step 5: skipped record, plain run

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1-ValidatorRowsF1E/def-missing-skipped/change
```

Exit code: **0**

stdout:

```
passed
```

stderr:

```
```

Step 5 judgment: expected exit 0, stdout "passed\n"; observed exit 0. **MATCH**

### Step 6: skipped record, --reviewed

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1-ValidatorRowsF1E/def-missing-skipped/change
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

### Step 7: --consultation-report of an attempt whose report lacks risk_summary / with the definition gone

Folder listing (`cd /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change && find . -type f | sort`):

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

Command (cwd `/tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change`):

```
node /tmp/pac-f1-ValidatorRowsF1E/def-missing/home/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/attempt.jsonl /tmp/pac-f1-ValidatorRowsF1E/def-missing-consulted/change
```

Exit code: **1**

stdout:

```
```

stderr:

```
consultation report: consultation.md: cannot read /private/tmp/pac-f1-ValidatorRowsF1E/def-missing/home/agents/architecture-oracle.md: ENOENT: no such file or directory, open '/private/tmp/pac-f1-ValidatorRowsF1E/def-missing/home/agents/architecture-oracle.md'
```

Step 7 judgment: expected exit 1, stderr contains "agents/architecture-oracle.md", stdout ""; observed exit 1. **MATCH**

Row judgment: **MATCH** (observed matches expected)

## Summary

| Row | Result |
|---|---|
| Definition changed after the record: output schema gains required field risk_summary | MATCH |
| Definition changed after the record: architecture-oracle.md missing | MATCH |

Overall: PASS
