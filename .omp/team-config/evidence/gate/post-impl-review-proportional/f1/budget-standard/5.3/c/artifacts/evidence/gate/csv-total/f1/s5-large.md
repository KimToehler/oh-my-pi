# F1 s5-large

- Change: csv-total
- Head: dd2b9c69e842960609ddbaea9241975d19c674b9
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s5-large.csv` (fixture written to a temp directory, cwd = repo root)
- Scenario expectation (tasks.md 3.1): big,1234.50 prints a total whose digits are 1234.50 (grouping separators allowed)

## Input file (12 bytes)

```text
big,1234.50
```

## Observed

- Exit code: 0

stdout:

```text
1234.50
```

stderr:

(empty)
