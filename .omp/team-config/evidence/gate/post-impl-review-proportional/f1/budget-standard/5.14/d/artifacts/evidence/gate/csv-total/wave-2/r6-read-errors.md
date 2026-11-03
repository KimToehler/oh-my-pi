# F2 wave 2, row 6: Fix 4.1, read-error messages of the CLI

Head: 12d38d8843e31d29b8a7316c31f4c448c374dc91
Run from the review worktree as uid 501 (not root); `$QA_TMP` is a disposable temp directory holding synthetic input.

### Capture: Unreadable by permission (mode 000)

Setup: `printf 'widget,19.99\n' > $QA_TMP/locked.csv && chmod 000 $QA_TMP/locked.csv`

Command: `bun src/cli.ts total $QA_TMP/locked.csv`

stdout: ``

stderr: `error: cannot read $QA_TMP/locked.csv: permission denied`

exit: 2

Expected: stdout empty; stderr `error: cannot read $QA_TMP/locked.csv: permission denied`; exit 2.
Verdict: PASS. Observed matches.

### Capture: Missing file

Setup: no file created at that path

Command: `bun src/cli.ts total $QA_TMP/missing.csv`

stdout: ``

stderr: `error: cannot read $QA_TMP/missing.csv`

exit: 2

Expected: stdout empty; stderr `error: cannot read $QA_TMP/missing.csv` (the unchanged neutral branch); exit 2.
Verdict: PASS. Observed matches.
