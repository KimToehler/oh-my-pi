# F2 wave 1, row 1: Requirement "Price lines are parsed strictly"

Head: 63687cd82a15a6c50d600ea3217a360e42f1d9ab
Run from the review worktree; `$QA_TMP` is a disposable temp directory holding synthetic input.

Scenarios of the requirement, one row:

- Valid lines are summed: `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (tracked at reviewed head). stdout `25.00`, exit 0. Carried from F1 (captured at 5b0f706): `git diff --name-only 5b0f706 63687cd` lists only the five F1 evidence files and openspec/changes/csv-total/tasks.md, none of which the CLI reads, so the observed behaviour cannot change.
- Malformed price is rejected with its line number: `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (tracked at reviewed head). stdout empty, stderr `error: line 1: malformed price`, exit 2. Carried from F1 (captured at 5b0f706): `git diff --name-only 5b0f706 63687cd` lists only the five F1 evidence files and openspec/changes/csv-total/tasks.md, none of which the CLI reads, so the observed behaviour cannot change.
- Negative control (a malformed line is never counted as zero or skipped) and "naming each such line": new capture below, a file mixing valid lines, a blank line and two malformed lines (non-numeric price on line 3, empty price on line 5).

### Capture: mixed valid, blank and malformed lines

Input (`$QA_TMP/mixed.csv`, `\r` shown literally where present):
```
widget,19.99

bad,abc
gadget,5.01
worse,
```

Command: `bun src/cli.ts total $QA_TMP/mixed.csv`

stdout: ``

stderr: `error: lines 3, 5: malformed price`

exit: 2

Expected: no total on stdout; stderr names lines 3 and 5 (blank line 2 counted in numbering); exit 2.
Verdict: PASS. Observed matches: stdout empty, `error: lines 3, 5: malformed price`, exit 2.
