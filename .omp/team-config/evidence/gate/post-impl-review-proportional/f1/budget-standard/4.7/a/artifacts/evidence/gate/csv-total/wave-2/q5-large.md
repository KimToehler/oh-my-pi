# F2 wave 2 Q5 large total (re-run: the fix changes groupThousands, which this total reaches)

Head: 58aa50fd80a17a2228ad58cf1a3b52bebbad35ff

Input (`$TMP/s5.csv`):
```
big,1234.50
```

Command: `bun src/cli.ts total $TMP/s5.csv`

Expected: digits 1234.50, grouping separators allowed

stdout: `1,234.50`

stderr: ``

exit: 0

Verdict: PASS
