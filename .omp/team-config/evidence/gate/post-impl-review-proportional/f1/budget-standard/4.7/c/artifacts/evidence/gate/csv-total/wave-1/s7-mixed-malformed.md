# F2 wave 1 s7-mixed-malformed — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: negative control of 'Price lines are parsed strictly': malformed lines 3 and 5 among valid lines and a blank line 2 -> exit 2, stderr names lines 3 and 5, no total on stdout (never counted as zero or skipped)

## Input file

5 newline-terminated line(s), 41 bytes. Python `repr` of the bytes written:

```
'widget,19.99\n\ngadget,abc\nthing,1.00\nfoo,\n'
```

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/s7-mixed-malformed.csv`

Exit code: `2`

stdout (`repr`): `''`

stderr (`repr`): `'error: lines 3, 5: malformed price\n'`
