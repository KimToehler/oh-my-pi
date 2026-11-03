# F2 wave 1 QA5: regression on adjacent behaviour, s5-large re-run after merging main

Re-run of `f1/s5-large.md` (captured on d0c56d3): the merge of `main` (d5da87c) changed `groupThousands` in `src/format.ts`, which this input reaches (whole part 1234 >= 1000), so the F1 capture is stale and this file replaces it for the row.

- Head: `f09ecefde27c257583c9a30824a656479b241ead` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Inputs are synthetic files in a scratch directory outside the repo (`$SCRATCH`)
- Command (worktree root): `bun src/cli.ts total $SCRATCH/s5-large.csv`
- Input `s5-large.csv` (12 bytes):

```
big,1234.50
```

## Observed

- exit: 0
- stdout:

```
1,234.50
```

- stderr:

```
```

## Expected

stdout digits `1234.50` (grouping separators allowed), exit 0

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (formats without fixed two decimals): src/format.ts: `return `${head}.${String(rest).padStart(2, "0")}`` -> `return String(cents / 100)`

- exit: 0
- stdout:

```
1234.5
```

- stderr:

```
```

Check result on mutant: NO MATCH
