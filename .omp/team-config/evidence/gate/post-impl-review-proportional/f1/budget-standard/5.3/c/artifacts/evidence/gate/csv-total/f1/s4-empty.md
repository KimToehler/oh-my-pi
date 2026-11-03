# F1 s4-empty

- Change: csv-total
- Head: dd2b9c69e842960609ddbaea9241975d19c674b9
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s4-empty.csv` (fixture written to a temp directory, cwd = repo root)
- Scenario expectation (tasks.md 3.1): an empty file prints 0.00

## Input file (0 bytes)

(empty file, 0 bytes)

## Observed

- Exit code: 0

stdout:

```text
0.00
```

stderr:

(empty)
