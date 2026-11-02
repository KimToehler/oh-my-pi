# F2 wave 1 Q6 regression: thousands grouping on adjacent formatter

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

`src/format.ts` existed on `main`; this diff changes `groupThousands` from `String(whole)` to `String(whole).replace(/(\d)(?=(\d{3})$)/, "$1,")`.

## CLI on the branch

Input (`$TMP/r6.csv`):
```
big,1234567.00
```

Command: `bun src/cli.ts total $TMP/r6.csv`

stdout: `1234,567.00`

stderr: ``

exit: 0

Input (`$TMP/r6b.csv`):
```
a,600000.00
b,634567.00
```

Command: `bun src/cli.ts total $TMP/r6b.csv`

stdout: `1234,567.00`

exit: 0

## formatCents probe, main vs branch (cents, output)

Command: `bun probe.ts` importing `formatCents` from `git show main:src/format.ts`, then from `src/format.ts`

main:
```
123450 1234.50
123456700 1234567.00
100000000000 1000000000.00
```

branch:
```
123450 1,234.50
123456700 1234,567.00
100000000000 1000000,000.00
```

Expected: digits `1234567.00`, either ungrouped (as `main` prints) or grouped at every third digit (`1,234,567.00`).

Observed: `1234,567.00`; only the last group is separated (`1000000,000.00` for 1e9). A total of one million or more prints a malformed figure a reader can take for 1234.567.

Verdict: FAIL
