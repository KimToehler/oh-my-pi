# F2 wave 1 s5-large (re-run after merging main)

- Head: `60d56444eccee97bb24e5c51c3be2653eb256229`
- Bun: `1.4.4`
- Command: `bun src/cli.ts total <tmp>/s5-large.csv`
- Expected: printed total's digits are `1234.50` (grouping separators allowed)
- Why re-run: the merge of main (066253a) changes `groupThousands` in `src/format.ts`, reached for this total (whole part 1234 >= 1000); the F1 capture at 03369ba (`1234.50`) is stale.

## Input file (12 bytes)

```
big,1234.50
```

## Observed

- Exit code: `0`

stdout:

```
1,234.50
```

stderr:

```

```

Verdict: PASS (digits `1234.50`, one `,` grouping separator, exit 0)
