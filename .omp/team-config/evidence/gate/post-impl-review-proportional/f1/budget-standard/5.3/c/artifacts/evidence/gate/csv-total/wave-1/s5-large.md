# F2 wave 1 s5-large (re-run after merging main)

- Change: csv-total
- Head: 3c11e3c32ffadd0a8fb38b602f6520ee02431d12
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s5-large.csv` (fixture written to a temp directory, cwd = review worktree root)
- Scenario expectation (tasks.md 3.1): big,1234.50 prints a total whose digits are 1234.50 (grouping separators allowed)
- Why re-run: the merge of `main` (c065578) changed `groupThousands` in `src/format.ts`, which only totals of 1000 or more reach

## Input file (12 bytes)

```text
big,1234.50
```

## Observed

- Exit code: 0

stdout:

```text
1,234.50
```

stderr:

(empty)
