# F2 wave 2 QA: Riskiest edge: totals across the thousands boundary of the changed formatter

Reviewed head: ddc134eacefc3ada4e7cb21962f3846be52ae3c9
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Re-run after fix commit ddc134e (tasks.md 4.1), which changed exactly the code this row observed; failed in wave 1 (`1234,567.89`).

Expected (requirement "Totals are exact in cents": the total printed with exactly two decimals; F1 s5 allows grouping separators): the exact digits of the total and two decimals, with a separator before every group of three integer digits counted from the decimal point, or none.

### e-999

Input (`/tmp/csvtotal-qa-r511a/e-999.csv`, 9 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,999.99$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-999.csv`

stdout:
```
999.99
```
stderr:
```

```
exit: 0

### e-1000

Input (`/tmp/csvtotal-qa-r511a/e-1000.csv`, 10 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,1000.00$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-1000.csv`

stdout:
```
1,000.00
```
stderr:
```

```
exit: 0

### s5-large

Input (`/tmp/csvtotal-qa-r511a/s5-large.csv`, 12 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
big,1234.50$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/s5-large.csv`

stdout:
```
1,234.50
```
stderr:
```

```
exit: 0

### e-999999

Input (`/tmp/csvtotal-qa-r511a/e-999999.csv`, 12 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,999999.99$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-999999.csv`

stdout:
```
999,999.99
```
stderr:
```

```
exit: 0

### e-1000000

Input (`/tmp/csvtotal-qa-r511a/e-1000000.csv`, 13 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,1000000.00$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-1000000.csv`

stdout:
```
1,000,000.00
```
stderr:
```

```
exit: 0

### e-1234567

Input (`/tmp/csvtotal-qa-r511a/e-1234567.csv`, 25 bytes, 2 lines; `cat -vet`, `$` marks a line end):
```
a,1000000.00$
b,234567.89$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-1234567.csv`

stdout:
```
1,234,567.89
```
stderr:
```

```
exit: 0

### e-12345678

Input (`/tmp/csvtotal-qa-r511a/e-12345678.csv`, 14 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,12345678.90$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/e-12345678.csv`

stdout:
```
12,345,678.90
```
stderr:
```

```
exit: 0

Observed: `999.99`, `1,000.00`, `1,234.50`, `999,999.99`, `1,000,000.00`, `1,234,567.89`, `12,345,678.90`, all exit 0, stderr empty.

Verdict: PASS.
