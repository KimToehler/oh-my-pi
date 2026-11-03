# F2 wave 1 s8-grouping-millions — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: adjacent behaviour (merged `groupThousands`): cents carry into the whole part across two groups -> `1,234,568.00`, exactly two decimals, exit 0

## Input file

2 newline-terminated line(s), 20 bytes. Python `repr` of the bytes written:

```
'a,1234567.89\nb,0.11\n'
```

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/s8-grouping-millions.csv`

Exit code: `0`

stdout (`repr`): `'1,234,568.00\n'`

stderr (`repr`): `''`
