# F2 wave 1 QA: Requirement "Totals are exact in cents"

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Scenarios of the requirement, in one row:

1. Cents add exactly (`a,0.10` and `b,0.20` print `0.30`): fresh capture `r2-cents` below (F1 did not capture this scenario).
2. Empty file prints `0.00`, exit 0: `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (tracked) observed stdout `0.00`, exit 0. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.
3. Negative control (ten lines of `x,0.10` print `1.00`, never `0.9999999999999999` or `1`): `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (tracked) observed stdout `1.00`, exit 0. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.

Expected: `r2-cents` prints `0.30`, exit 0.

### r2-cents

Input (`/tmp/csvtotal-qa-r511a/r2-cents.csv`, 14 bytes, 2 lines; `cat -vet`, `$` marks a line end):
```
a,0.10$
b,0.20$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/r2-cents.csv`

stdout:
```
0.30
```
stderr:
```

```
exit: 0

Verdict: PASS.
