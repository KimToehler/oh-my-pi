# F1-E form rows

Generated 2026-11-12T21:35:30.854Z on worktree HEAD 833d26ad26b643915f9de7be626b2157a1b46ed0; validator `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` run with `node` (v25.9.0). Every folder is built from the shipped `templates/gate.md`, `templates/review.md` and `templates/consultation.md` with their slots filled; the other plan files are fixed fixture text.

## Row: Consulted without findings: bottom line KEEP APPROACH, Findings none (expect both pass)

Folder `/tmp/pac-f1e/fixtures/10-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   640  consultation.md
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
- **Bottom line**: KEEP APPROACH
- **Skip reason**: none

## Report

```json
{"bottom_line":{"verdict":"KEEP APPROACH","reason":"No defect found."},"findings":[],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/10-form/openspec/changes/safe-update
passed
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/10-form/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Verbatim text that looks like a slot: consulted record (report written with JSON.stringify; correction opens with a multiline fenced example) (expect both pass)

Folder `/tmp/pac-f1e/fixtures/11-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1204  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"```sh\nnode review-work/scripts/repair.mjs \\\n  --original-reply <file>\n```\nRun the repair with `--original-reply <file>` before the retry.","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"## Approach\n\nKeep the endpoint.\n\n### Lock\n\n```sql\nSELECT * FROM rows WHERE id = $1 FOR UPDATE;\n```","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/11-form/openspec/changes/safe-update
passed
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/11-form/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Verbatim text that looks like a slot: skipped record with TODO in the reason (expect both pass)

Folder `/tmp/pac-f1e/fixtures/12-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   246  consultation.md
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
- **Skip reason**: This only changes the TODO scanner; skip the consultation

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/12-form/openspec/changes/safe-update
passed
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/12-form/openspec/changes/safe-update
reviewed: OKAY in round 1
exit=0
```

## Row: Pending record naming one dispatched attempt (expect plain pass, --reviewed fail naming consultation.md)

Folder `/tmp/pac-f1e/fixtures/13-form/openspec/changes/safe-update`:

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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/13-form/openspec/changes/safe-update
passed
exit=0
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/13-form/openspec/changes/safe-update
consultation.md: the consultation is still pending; finish the consultation step of the review
exit=1
```

## Row: Negative control: a report finding without its subsection (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/14-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1333  consultation.md
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

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/14-form/openspec/changes/safe-update
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F1)
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/14-form/openspec/changes/safe-update
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F1)
exit=1
```

## Row: Negative control: a subsection without a Disposition bullet (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/15-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1384  consultation.md
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

The second table carries the audit trail.

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/15-form/openspec/changes/safe-update
consultation.md Findings: ### F2: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/15-form/openspec/changes/safe-update
consultation.md Findings: ### F2: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
exit=1
```

## Row: Negative control: a disposition that is neither adopted: nor rejected: (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/16-form/openspec/changes/safe-update`:

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

- **Disposition**: deferred: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/16-form/openspec/changes/safe-update
consultation.md Findings: ### F2: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/16-form/openspec/changes/safe-update
consultation.md Findings: ### F2: expected exactly one "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>" bullet
exit=1
```

## Row: Negative control: subsections in another order than the report's findings (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/17-form/openspec/changes/safe-update`:

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

### F2

- **Disposition**: rejected: the second table carries the audit trail

### F1

- **Disposition**: adopted: design.md locks the row

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/17-form/openspec/changes/safe-update
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F2, F1)
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/17-form/openspec/changes/safe-update
consultation.md Findings: expected one ### subsection per report finding, in the report's order (F1, F2); found (F2, F1)
exit=1
```

## Row: Negative control: a report line that is not JSON (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/18-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   482  consultation.md
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
{bottom_line: KEEP}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/18-form/openspec/changes/safe-update
consultation.md Report: the report line is not JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/18-form/openspec/changes/safe-update
consultation.md Report: the report line is not JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)
exit=1
```

## Row: Negative control: a report finding without trigger (lacks a report field) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/19-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1366  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/19-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].trigger: missing
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/19-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].trigger: missing
exit=1
```

## Row: Negative control: a report without recommended_approach (lacks a report field) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/20-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1351  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/20-form/openspec/changes/safe-update
consultation.md Report: report.recommended_approach: missing
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/20-form/openspec/changes/safe-update
consultation.md Report: report.recommended_approach: missing
exit=1
```

## Row: Negative control: a Bottom line other than the report's verdict (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/21-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1410  consultation.md
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
- **Bottom line**: KEEP APPROACH
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/21-form/openspec/changes/safe-update
consultation.md Bottom line: expected the report's verdict CHANGE APPROACH
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/21-form/openspec/changes/safe-update
consultation.md Bottom line: expected the report's verdict CHANGE APPROACH
exit=1
```

## Row: Negative control: a record without ## Report (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/22-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   438  consultation.md
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

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/22-form/openspec/changes/safe-update
consultation.md Report: expected exactly one "## Report" section, found 0
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/22-form/openspec/changes/safe-update
consultation.md Report: expected exactly one "## Report" section, found 0
exit=1
```

## Row: Negative control: a consulted record whose Models holds a dispatched entry (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/23-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1397  consultation.md
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
- **Models**: ArchConsult012345671 dispatched
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/23-form/openspec/changes/safe-update
consultation.md Models: expected every attempt with its models and no dispatched entry
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/23-form/openspec/changes/safe-update
consultation.md Models: expected every attempt with its models and no dispatched entry
exit=1
```

## Row: Negative control: Status drafted (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/24-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1410  consultation.md
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

- **Status**: drafted
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/24-form/openspec/changes/safe-update
consultation.md Status: expected consulted, skipped or pending, got drafted
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/24-form/openspec/changes/safe-update
consultation.md Status: expected consulted, skipped or pending, got drafted
exit=1
```

## Row: Negative control: a skipped record with Skip reason none (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/25-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   193  consultation.md
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
- **Skip reason**: none

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/25-form/openspec/changes/safe-update
consultation.md Skip reason: a skipped record needs the user's reason in their words
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/25-form/openspec/changes/safe-update
consultation.md Skip reason: a skipped record needs the user's reason in their words
exit=1
```

## Row: Negative control: a pending record with no attempt (Models none) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/26-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   229  consultation.md
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
- **Models**: none
- **Bottom line**: none
- **Skip reason**: none

## Report

none

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/26-form/openspec/changes/safe-update
consultation.md Models: a pending record names every attempt so far
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/26-form/openspec/changes/safe-update
consultation.md Models: a pending record names every attempt so far
exit=1
```

## Row: Negative control: Consultant oracle, X1 (an agent other than architecture-oracle) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/27-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1381  consultation.md
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
- **Consultant**: oracle, X1
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/27-form/openspec/changes/safe-update
consultation.md Consultant: expected architecture-oracle, <subagent id of the counted attempt>
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/27-form/openspec/changes/safe-update
consultation.md Consultant: expected architecture-oracle, <subagent id of the counted attempt>
exit=1
```

## Row: Negative control: a 39-hex consulted commit (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/28-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1411  consultation.md
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
- **Consulted commit**: 123456789abcdef0123456789abcdef01234567
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/28-form/openspec/changes/safe-update
consultation.md Consulted commit: expected the 40-hex commit whose change folder the consultant read
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/28-form/openspec/changes/safe-update
consultation.md Consulted commit: expected the 40-hex commit whose change folder the consultant read
exit=1
```

## Row: Negative control: the shipped template copied unfilled (fields still hold their slot text) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/29-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1090  consultation.md
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

- **Status**: <consulted, skipped or pending>
- **Consulted commit**: <40-hex commit whose change folder the consultant read, or none when skipped before any dispatch>
- **Consultant**: <architecture-oracle, then the subagent id of the counted attempt; none when pending or skipped>
- **Models**: <one entry per attempt, "<subagent id> <provider/model>", further models appended, "(no report)" after an attempt that did not count, "<subagent id> dispatched" with its session file once known for an attempt not yet resolved; none when skipped before any dispatch>
- **Bottom line**: <the report's verdict; none when pending or skipped>
- **Skip reason**: <none, or the user's reason in their words>

## Report

<none, or a json fence holding the counted attempt's structured result on one line, written by the report command of the review instruction>

## Findings

<none, or one "### <finding id>" subsection per finding of the report, in the report's order, holding only "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>">

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/29-form/openspec/changes/safe-update
consultation.md Status: still holds the template's slot text
consultation.md Consulted commit: still holds the template's slot text
consultation.md Consultant: still holds the template's slot text
consultation.md Models: still holds the template's slot text
consultation.md Bottom line: still holds the template's slot text
consultation.md Skip reason: still holds the template's slot text
consultation.md Report: still holds the template's slot text
consultation.md Findings: still holds the template's slot text
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/29-form/openspec/changes/safe-update
consultation.md Status: still holds the template's slot text
consultation.md Consulted commit: still holds the template's slot text
consultation.md Consultant: still holds the template's slot text
consultation.md Models: still holds the template's slot text
consultation.md Bottom line: still holds the template's slot text
consultation.md Skip reason: still holds the template's slot text
consultation.md Report: still holds the template's slot text
consultation.md Findings: still holds the template's slot text
exit=1
```

## Row: Negative control: header field Status duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/30-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1436  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/30-form/openspec/changes/safe-update
consultation.md Status: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/30-form/openspec/changes/safe-update
consultation.md Status: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: header field Consulted commit duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/31-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1477  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/31-form/openspec/changes/safe-update
consultation.md Consulted commit: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/31-form/openspec/changes/safe-update
consultation.md Consulted commit: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: header field Consultant duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/32-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1472  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/32-form/openspec/changes/safe-update
consultation.md Consultant: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/32-form/openspec/changes/safe-update
consultation.md Consultant: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: header field Models duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/33-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1473  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/33-form/openspec/changes/safe-update
consultation.md Models: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/33-form/openspec/changes/safe-update
consultation.md Models: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: header field Bottom line duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/34-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1447  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/34-form/openspec/changes/safe-update
consultation.md Bottom line: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/34-form/openspec/changes/safe-update
consultation.md Bottom line: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: header field Skip reason duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/35-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1436  consultation.md
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
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/35-form/openspec/changes/safe-update
consultation.md Skip reason: expected exactly one top-level bullet, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/35-form/openspec/changes/safe-update
consultation.md Skip reason: expected exactly one top-level bullet, found 2
exit=1
```

## Row: Negative control: ## Report duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/36-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  2387  consultation.md
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


## Report

```json
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/36-form/openspec/changes/safe-update
consultation.md Report: expected exactly one "## Report" section, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/36-form/openspec/changes/safe-update
consultation.md Report: expected exactly one "## Report" section, found 2
exit=1
```

## Row: Negative control: ## Findings duplicated (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/37-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1432  consultation.md
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


## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/37-form/openspec/changes/safe-update
consultation.md Findings: expected exactly one "## Findings" section, found 2
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/37-form/openspec/changes/safe-update
consultation.md Findings: expected exactly one "## Findings" section, found 2
exit=1
```

## Row: Negative control: two report findings with the same id (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/38-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1411  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F1

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/38-form/openspec/changes/safe-update
consultation.md Report: report.findings[1].id: duplicate id F1
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/38-form/openspec/changes/safe-update
consultation.md Report: report.findings[1].id: duplicate id F1
exit=1
```

## Row: Negative control: a report finding with an empty id (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/39-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1409  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/39-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
consultation.md Findings: expected one ### subsection per report finding, in the report's order (, F2); found (F1, F2)
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/39-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].id: expected a nonempty single line without surrounding whitespace
consultation.md Findings: expected one ### subsection per report finding, in the report's order (, F2); found (F1, F2)
exit=1
```

## Row: Negative control: six report findings (limit 5) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/40-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  2801  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F3","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F4","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F5","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F6","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: rejected: out of scope

### F2

- **Disposition**: rejected: out of scope

### F3

- **Disposition**: rejected: out of scope

### F4

- **Disposition**: rejected: out of scope

### F5

- **Disposition**: rejected: out of scope

### F6

- **Disposition**: rejected: out of scope

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/40-form/openspec/changes/safe-update
consultation.md Report: report.findings: at most 5 elements, got 6
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/40-form/openspec/changes/safe-update
consultation.md Report: report.findings: at most 5 elements, got 6
exit=1
```

## Row: Negative control: four uncertainties (limit 3) (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/41-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1358  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["a","b","c","d"],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/41-form/openspec/changes/safe-update
consultation.md Report: report.uncertainties: at most 3 elements, got 4
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/41-form/openspec/changes/safe-update
consultation.md Report: report.uncertainties: at most 3 elements, got 4
exit=1
```

## Row: Negative control: a report category outside its enum (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/42-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1403  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"style","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/42-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].category: expected one of design defect, simplification, unresolved assumption, got "style"
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/42-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].category: expected one of design defect, simplification, unresolved assumption, got "style"
exit=1
```

## Row: Negative control: a report verdict outside its enum (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/43-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1360  consultation.md
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
- **Bottom line**: MAYBE
- **Skip reason**: none

## Report

```json
{"bottom_line":{"verdict":"MAYBE","reason":"unsure"},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"},{"id":"F2","category":"simplification","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/43-form/openspec/changes/safe-update
consultation.md Report: report.bottom_line.verdict: expected one of KEEP APPROACH, CHANGE APPROACH, INCONCLUSIVE, got "MAYBE"
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/43-form/openspec/changes/safe-update
consultation.md Report: report.bottom_line.verdict: expected one of KEEP APPROACH, CHANGE APPROACH, INCONCLUSIVE, got "MAYBE"
exit=1
```

## Row: Negative control: a report field of another type: confidence a number (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/44-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
  1365  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":[{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":0.9},{"id":"F2","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}],"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

### F1

- **Disposition**: adopted: design.md locks the row

### F2

- **Disposition**: rejected: the second table carries the audit trail

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/44-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].confidence: expected a string
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/44-form/openspec/changes/safe-update
consultation.md Report: report.findings[0].confidence: expected a string
exit=1
```

## Row: Negative control: a report field of another type: findings an object (expect both fail naming the field)

Folder `/tmp/pac-f1e/fixtures/45-form/openspec/changes/safe-update`:

```
    38  .openspec.yaml
   976  consultation.md
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
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"The update races. A row lock fixes it."},"findings":{"F1":{"id":"F1","category":"design defect","locations":"design.md:3","trigger":"two sessions update the same row","consequence":"one update is lost","counterevidence":"the endpoint takes no lock","correction":"lock the row inside the transaction","confidence":"high; a concurrent update test would confirm it"}},"recommended_approach":"Keep the endpoint and lock the row.","uncertainties":["Whether the ORM issues SELECT FOR UPDATE; its query log settles it."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/feature/spec.md"}
```

## Findings

none

````

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs /tmp/pac-f1e/fixtures/45-form/openspec/changes/safe-update
consultation.md Report: report.findings: expected an array
exit=1
```

```
$ node /Users/tim/git/oh-my-pi/.worktrees/plan-architecture-consultation/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed /tmp/pac-f1e/fixtures/45-form/openspec/changes/safe-update
consultation.md Report: report.findings: expected an array
exit=1
```
