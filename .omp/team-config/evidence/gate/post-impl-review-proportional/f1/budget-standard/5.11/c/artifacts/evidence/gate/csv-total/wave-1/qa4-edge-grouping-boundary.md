# F2 wave 1 QA4: riskiest edge, the 1000 grouping boundary after merging main

The merge of `main` (d5da87c) makes `groupThousands` render the whole part with `toLocaleString("en-US")` when it is >= 1000. Edge: totals just below, exactly at, and far above the boundary, including a total that reaches it only through cents from a second line.

- Head: `f09ecefde27c257583c9a30824a656479b241ead` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Inputs are synthetic files in a scratch directory outside the repo (`$SCRATCH`)
- Check: removing `,` from stdout yields the exact decimal total with exactly two decimals, exit 0, stderr empty

## e1-999.csv

- Command (worktree root): `bun src/cli.ts total $SCRATCH/e1-999.csv`
- Input `e1-999.csv` (9 bytes):

```
a,999.99
```

### Observed

- exit: 0
- stdout:

```
999.99
```

- stderr:

```
```

Expected digits `999.99`. Check result on head: MATCH

### Negative control

Scratch copy of `src/` outside the repo with one mutation (grouping in a locale whose group separator is `.`): src/format.ts: `whole.toLocaleString("en-US")` -> `whole.toLocaleString("de-DE")`

- exit: 0
- stdout:

```
999.99
```

- stderr:

```
```

Check result on mutant: MATCH

## e1-1000.csv

- Command (worktree root): `bun src/cli.ts total $SCRATCH/e1-1000.csv`
- Input `e1-1000.csv` (16 bytes):

```
a,999.99
b,0.01
```

### Observed

- exit: 0
- stdout:

```
1,000.00
```

- stderr:

```
```

Expected digits `1000.00`. Check result on head: MATCH

### Negative control

Scratch copy of `src/` outside the repo with one mutation (grouping in a locale whose group separator is `.`): src/format.ts: `whole.toLocaleString("en-US")` -> `whole.toLocaleString("de-DE")`

- exit: 0
- stdout:

```
1.000.00
```

- stderr:

```
```

Check result on mutant: NO MATCH

## e1-million.csv

- Command (worktree root): `bun src/cli.ts total $SCRATCH/e1-million.csv`
- Input `e1-million.csv` (13 bytes):

```
a,1234567.89
```

### Observed

- exit: 0
- stdout:

```
1,234,567.89
```

- stderr:

```
```

Expected digits `1234567.89`. Check result on head: MATCH

### Negative control

Scratch copy of `src/` outside the repo with one mutation (grouping in a locale whose group separator is `.`): src/format.ts: `whole.toLocaleString("en-US")` -> `whole.toLocaleString("de-DE")`

- exit: 0
- stdout:

```
1.234.567.89
```

- stderr:

```
```

Check result on mutant: NO MATCH

The mutant is indistinguishable below the boundary (999.99) by design; it fails at and above it.
