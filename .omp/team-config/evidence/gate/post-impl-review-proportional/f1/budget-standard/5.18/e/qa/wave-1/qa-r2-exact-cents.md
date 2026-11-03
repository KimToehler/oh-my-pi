# F2 wave 1 QA row 2: Requirement "Totals are exact in cents"

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

## Scenario: Cents add exactly (fresh capture, wave 1)
### a,0.10 and b,0.20

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r2-cents.csv`, bytes shown with `\r` escaped, 14 bytes):
```
a,0.10
b,0.20
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r2-cents.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `0.30`

stderr: ``

exit: 0

Expected `0.30`, exit 0. Observed matches. PASS.

## Scenario: Empty file
Cites `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (tracked at the reviewed head). Observed there: stdout `0.00`, stderr empty, exit 0. Expected `0.00`, exit 0. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Negative control
Cites `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (tracked at the reviewed head). Observed there: ten lines of `x,0.10`, stdout `1.00`, stderr empty, exit 0. Expected `1.00`; `0.9999999999999999` or `1` would fail. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

Row verdict: PASS
