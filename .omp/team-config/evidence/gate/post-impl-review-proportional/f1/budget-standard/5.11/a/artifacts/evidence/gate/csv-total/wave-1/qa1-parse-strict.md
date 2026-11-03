# F2 wave 1 QA: Requirement "Price lines are parsed strictly"

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Scenarios of the requirement, in one row:

1. Valid lines are summed: `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (tracked at the reviewed head) observed stdout `25.00`, exit 0. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.
2. Malformed price rejected with its line number: `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (tracked) observed stdout empty, stderr `error: line 1: malformed price`, exit 2. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.
3. Negative control (a malformed line is never counted as zero or skipped): fresh capture `r1-mixed` below, a malformed line between two valid lines.
4. Each malformed line is named and blank lines are ignored: fresh captures `r1-multi-blank` (blank lines 1, 3, 7 and malformed lines 4, 6, 8) and `r1-blank-only-valid` (blank lines around valid lines).

Expected: 3 prints no total, names line 2, exits 2; `r1-multi-blank` names lines 4, 6 and 8 and no blank line, prints no total, exits 2; `r1-blank-only-valid` prints `25.00`, exits 0.

### r1-mixed

Input (`/tmp/csvtotal-qa-r511a/r1-mixed.csv`, 33 bytes, 3 lines; `cat -vet`, `$` marks a line end):
```
widget,19.99$
bad,abc$
gadget,5.01$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/r1-mixed.csv`

stdout:
```

```
stderr:
```
error: line 2: malformed price
```
exit: 2

### r1-multi-blank

Input (`/tmp/csvtotal-qa-r511a/r1-multi-blank.csv`, 54 bytes, 8 lines; `cat -vet`, `$` marks a line end):
```
$
widget,19.99$
$
foo,$
gadget,5.01$
nocomma$
   $
bar,1.2.3$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/r1-multi-blank.csv`

stdout:
```

```
stderr:
```
error: lines 4, 6, 8: malformed price
```
exit: 2

### r1-blank-only-valid

Input (`/tmp/csvtotal-qa-r511a/r1-blank-only-valid.csv`, 30 bytes, 7 lines; `cat -vet`, `$` marks a line end):
```
$
$
widget,19.99$
$
$
gadget,5.01$
$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/r1-blank-only-valid.csv`

stdout:
```
25.00
```
stderr:
```

```
exit: 0

Verdict: PASS. No total is printed when any line is malformed, every malformed line is named by its 1-based line number, blank lines are skipped without shifting the numbering.
