# F2 wave 1 s5-large (re-run after merging main e1c4b54)

- Change: csv-total, task 3.1 scenario s5, re-run in F2 wave 1 because the merge of `main` changed `src/format.ts` (`groupThousands`), which formats every total of 1000 or more
- Head: `aba51593da95898f6a2a1f9bd90e747d3d26f76d`
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-3d_0spfw/s5-large.csv`
- Expected (task 3.1): prints a total whose digits are `1234.50` (grouping separators allowed), exit 0

## Input file (12 bytes)

```
big,1234.50
```

## Observed

- Exit code: 0
- stdout:

```
1,234.50
```

- stderr:

```
```
