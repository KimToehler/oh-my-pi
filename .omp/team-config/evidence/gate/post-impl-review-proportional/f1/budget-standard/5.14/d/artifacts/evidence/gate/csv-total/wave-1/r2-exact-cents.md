# F2 wave 1, row 2: Requirement "Totals are exact in cents"

Head: 63687cd82a15a6c50d600ea3217a360e42f1d9ab
Run from the review worktree; `$QA_TMP` is a disposable temp directory holding synthetic input.

Scenarios of the requirement, one row:

- Cents add exactly (`a,0.10`, `b,0.20` print `0.30`): new capture below (F1 had no capture of this scenario).
- Empty file: `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (tracked at reviewed head). stdout `0.00`, exit 0. Carried from F1 (captured at 5b0f706): `git diff --name-only 5b0f706 63687cd` lists only the five F1 evidence files and openspec/changes/csv-total/tasks.md, none of which the CLI reads, so the observed behaviour cannot change.
- Negative control (ten lines of `x,0.10` print `1.00`, never `0.9999999999999999` or `1`): `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (tracked at reviewed head). stdout `1.00`, exit 0. Carried from F1 (captured at 5b0f706): `git diff --name-only 5b0f706 63687cd` lists only the five F1 evidence files and openspec/changes/csv-total/tasks.md, none of which the CLI reads, so the observed behaviour cannot change.
- Exactly two decimals on a large total: `.omp/team-config/evidence/gate/csv-total/f1/s5-large.md` (tracked at reviewed head). stdout `1,234.50`, exit 0; two decimals, digits `1234.50` with a grouping separator, which tasks.md 3.1 admits. Carried from F1 (captured at 5b0f706): `git diff --name-only 5b0f706 63687cd` lists only the five F1 evidence files and openspec/changes/csv-total/tasks.md, none of which the CLI reads, so the observed behaviour cannot change.

### Capture: cents add exactly

Input (`$QA_TMP/cents.csv`, `\r` shown literally where present):
```
a,0.10
b,0.20
```

Command: `bun src/cli.ts total $QA_TMP/cents.csv`

stdout: `0.30`

stderr: ``

exit: 0

Expected: `0.30`, exit 0.
Verdict: PASS. Observed `0.30`, exit 0.
