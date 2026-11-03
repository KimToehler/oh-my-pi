# F2 wave 1 QA: Riskiest edge: totals across the thousands boundary of the changed formatter

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Why this edge: the diff changes `groupThousands` in `src/format.ts:11` (pre-existing on `main`, where it returned the digits unchanged) to insert a separator, and every total of 1000.00 or more goes through it. F1 s5 only exercised a four-digit total.

Expected (requirement "Totals are exact in cents": the total printed with exactly two decimals; F1 s5 allows grouping separators): the printed figure carries the exact digits of the total and two decimals, either ungrouped or with a separator after every group of three integer digits counted from the decimal point (`1,000,000.00`, `1,234,567.89`, `12,345,678.90`). A separator anywhere else is a misrendered figure.

1. `.omp/team-config/evidence/gate/csv-total/f1/s5-large.md` (tracked): `big,1234.50` observed stdout `1,234.50`, exit 0. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.
2. Fresh captures below: 999.99, 1000.00, 999999.99, 1000000.00, 1234567.89 (two lines), 12345678.90.

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
1000,000.00
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
1234,567.89
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
12345,678.90
```
stderr:
```

```
exit: 0

Observed: up to 999,999.99 the grouping is correct. From 1,000,000.00 on, only the last separator is inserted: `1000,000.00`, `1234,567.89`, `12345,678.90`. Cause: the regex `/(\d)(?=(\d{3})$)/` in `src/format.ts:11` has no global flag and anchors one lookahead at the end, so it inserts exactly one separator.

Verdict: FAIL. A total of one million or more is printed with a separator that is neither absent nor a thousands separator (`1234,567.89`); a reader comparing it with the invoice sees a figure in no standard notation, and in comma-decimal notation it reads as a different amount. This breaks the change's goal (a total finance compares with the invoice) for an ordinary input size.
