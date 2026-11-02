# F2 wave 2 Q6 regression: thousands grouping on adjacent formatter (re-run after fix row 1)

Head: 58aa50fd80a17a2228ad58cf1a3b52bebbad35ff

## CLI

Input (`$TMP/r6.csv`):
```
big,1234567.00
```

Command: `bun src/cli.ts total $TMP/r6.csv`

stdout: `1,234,567.00`

stderr: ``

exit: 0

Input (`$TMP/r6b.csv`):
```
a,600000.00
b,634567.00
```

Command: `bun src/cli.ts total $TMP/r6b.csv`

stdout: `1,234,567.00`

stderr: ``

exit: 0

## formatCents boundary probe (cents, output)

Command: `bun probe.ts` importing `formatCents` from `src/format.ts`

```
99999 999.99
100000 1,000.00
123450 1,234.50
99999999 999,999.99
123456700 1,234,567.00
100000000000 1,000,000,000.00
```

Expected: `1,234,567.00` for 1,234,567.00; a separator before every group of three digits; none below 1,000.

Observed: as expected at every probed boundary (999.99, 1,000.00, 999,999.99, 1,000,000,000.00).

Verdict: PASS
