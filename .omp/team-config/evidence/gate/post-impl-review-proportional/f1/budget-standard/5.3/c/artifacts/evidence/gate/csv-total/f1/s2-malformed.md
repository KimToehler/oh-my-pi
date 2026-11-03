# F1 s2-malformed

- Change: csv-total
- Head: dd2b9c69e842960609ddbaea9241975d19c674b9
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s2-malformed.csv` (fixture written to a temp directory, cwd = repo root)
- Scenario expectation (tasks.md 3.1): widget,abc exits 2 naming line 1, no total

## Input file (11 bytes)

```text
widget,abc
```

## Observed

- Exit code: 2

stdout:

(empty)

stderr:

```text
error: line 1: malformed price
```
