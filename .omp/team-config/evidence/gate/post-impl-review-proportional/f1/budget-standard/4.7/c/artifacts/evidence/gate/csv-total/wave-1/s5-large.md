# F2 wave 1 s5-large — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: `big,1234.50` prints a total whose digits are `1234.50` (grouping separators allowed), exit 0; re-run because the merge of `main` (7b6e2e2) changed `groupThousands`, which this row reaches

## Input file

1 newline-terminated line(s), 12 bytes. Python `repr` of the bytes written:

```
'big,1234.50\n'
```

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/s5-large.csv`

Exit code: `0`

stdout (`repr`): `'1,234.50\n'`

stderr (`repr`): `''`
