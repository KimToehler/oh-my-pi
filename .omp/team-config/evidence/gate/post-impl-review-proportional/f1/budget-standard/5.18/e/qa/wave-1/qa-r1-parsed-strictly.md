# F2 wave 1 QA row 1: Requirement "Price lines are parsed strictly"

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

## Scenario: Valid lines are summed
Cites `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (tracked at the reviewed head). Observed there: stdout `25.00`, stderr empty, exit 0. Expected `25.00`, exit 0. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Malformed price is rejected with its line number
Cites `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (tracked at the reviewed head). Observed there: stdout empty, stderr `error: line 1: malformed price`, exit 2. Expected a message naming line 1 on stderr, no total, exit 2. PASS.
Carried, not re-run: captured on 81c2b7b (the code commit); the only later commit, 8a1d0d6, adds evidence files and edits openspec/changes/csv-total/tasks.md, touches no file under src/ or test/, so it cannot change what this capture observed.

## Scenario: Negative control (fresh capture, wave 1)
A malformed line inside a file that also holds valid lines and a blank line: counting it as zero or skipping it would print `25.00`.

### Mixed file: two valid lines, one blank line, malformed lines 3 and 5

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r1-mixed.csv`, bytes shown with `\r` escaped, 41 bytes):
```
widget,19.99

bad,abc
gadget,5.01
worse,
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/r1-mixed.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: ``

stderr: `error: lines 3, 5: malformed price`

exit: 2

Expected: no total on stdout, stderr names lines 3 and 5 (each malformed line), the blank line 2 is not reported, exit 2. Observed matches. PASS.

Row verdict: PASS
