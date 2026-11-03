# F1 s1-happy

- Change: csv-total
- Head: dd2b9c69e842960609ddbaea9241975d19c674b9
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s1-happy.csv` (fixture written to a temp directory, cwd = repo root)
- Scenario expectation (tasks.md 3.1): widget,19.99 and gadget,5.01 print 25.00

## Input file (25 bytes)

```text
widget,19.99
gadget,5.01
```

## Observed

- Exit code: 0

stdout:

```text
25.00
```

stderr:

(empty)
