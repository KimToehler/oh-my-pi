# F2 wave 1 QA2: Requirement "Totals are exact in cents"

One row for the requirement; its three scenarios:

| Scenario | Capture | Head | Result |
|---|---|---|---|
| Cents add exactly (`a,0.10`, `b,0.20` print `0.30`) | this file, below (new on the reviewed head; F1 did not capture it) | `f09ecefde27c` | MATCH; mutant NO MATCH |
| Empty file (prints `0.00`, exit 0) | `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (tracked) | `d0c56d3` | MATCH; blank-lines-not-ignored mutant exits 2, NO MATCH (carried) |
| Negative control (ten lines of `x,0.10` print `1.00`, never `0.9999999999999999` or `1`) | `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (tracked) | `d0c56d3` | MATCH; float-sum mutant prints `0.99.99999999999999`, NO MATCH (carried) |

Carry reason (s3, s4): the only change since d0c56d3 is the merge of `main` (d5da87c), which edits `groupThousands` in `src/format.ts`; `formatCents` calls it only when the whole part is >= 1000, and these totals are 1 and 0, so their observed output cannot change. Not re-executed.

## Cents add exactly (new capture)

- Head: `f09ecefde27c257583c9a30824a656479b241ead` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Inputs are synthetic files in a scratch directory outside the repo (`$SCRATCH`)
- Command (worktree root): `bun src/cli.ts total $SCRATCH/r2-cents-add.csv`
- Input `r2-cents-add.csv` (14 bytes):

```
a,0.10
b,0.20
```

### Observed

- exit: 0
- stdout:

```
0.30
```

- stderr:

```
```

### Expected

stdout `0.30`, exit 0

Check result on head: MATCH

### Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (summed as float dollars, scaled to cents at the end): src/price.ts: `prices.reduce((total, price) => total + price.cents, 0)` -> `prices.reduce((total, price) => total + price.cents / 100, 0) * 100`

- exit: 0
- stdout:

```
0.30.000000000000004
```

- stderr:

```
```

Check result on mutant: NO MATCH
