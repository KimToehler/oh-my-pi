# Q1 requirement: Price lines are parsed strictly

Head: ecd418fce4a870f089788aa2102397d42c8ea37c (F2 wave 1 snapshot)
Channel: `bun src/cli.ts` subprocess from the repo root, stdout and stderr captured separately; synthetic data in a temp dir shown as `$QA_TMP`.

Carried scenario captures (tracked, head 4e5e75b; ecd418f changes only evidence and tasks.md, so no observed behaviour can change):
- Valid lines are summed: `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (stdout `25.00`, exit 0)
- Malformed price rejected with line number: `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (stderr `error: line 1: malformed price`, no stdout, exit 2)

New captures:

## Negative control: malformed lines among valid ones are neither zeroed nor skipped

Input bytes (Python-escaped): `widget,19.99\nbad,abc\ngadget,5.01\nworse,\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: stderr names lines 2 and 4, no total on stdout, exit 2

stdout: ``

stderr: `error: lines 2, 4: malformed price`

exit: 2

## Blank lines are ignored

Input bytes (Python-escaped): `a,1.00\n\n   \nb,2.00\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 3.00, exit 0

stdout: `3.00`

stderr: ``

exit: 0

## Line without a comma is malformed

Input bytes (Python-escaped): `widget 19.99\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: stderr names line 1, no total, exit 2

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2

