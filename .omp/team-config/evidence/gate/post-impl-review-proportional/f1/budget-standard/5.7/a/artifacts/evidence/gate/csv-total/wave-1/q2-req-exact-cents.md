# Q2 requirement: Totals are exact in cents

Head: ecd418fce4a870f089788aa2102397d42c8ea37c (F2 wave 1 snapshot)
Channel: `bun src/cli.ts` subprocess from the repo root, stdout and stderr captured separately; synthetic data in a temp dir shown as `$QA_TMP`.

Carried scenario captures (tracked, head 4e5e75b; ecd418f changes only evidence and tasks.md):
- Negative control, ten lines of x,0.10: `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (stdout `1.00`)
- Empty file: `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (stdout `0.00`, exit 0)

New captures:

## Cents add exactly (spec scenario, not in F1)

Input bytes (Python-escaped): `a,0.10\nb,0.20\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 0.30, exit 0

stdout: `0.30`

stderr: ``

exit: 0

## Float-drift probe: three lines of 0.1

Input bytes (Python-escaped): `a,0.1\nb,0.1\nc,0.1\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 0.30, never 0.30000000000000004

stdout: `0.30`

stderr: ``

exit: 0

