# F1 s3-cents

- Change: csv-total
- Head: dd2b9c69e842960609ddbaea9241975d19c674b9
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s3-cents.csv` (fixture written to a temp directory, cwd = repo root)
- Scenario expectation (tasks.md 3.1): ten lines of x,0.10 print 1.00

## Input file (70 bytes)

```text
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
```

## Observed

- Exit code: 0

stdout:

```text
1.00
```

stderr:

(empty)
