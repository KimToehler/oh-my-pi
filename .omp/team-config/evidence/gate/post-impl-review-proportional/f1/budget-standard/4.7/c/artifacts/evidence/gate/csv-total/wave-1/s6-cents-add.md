# F2 wave 1 s6-cents-add — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: spec scenario 'Cents add exactly': prints `0.30`, exit 0

## Input file

2 newline-terminated line(s), 14 bytes. Python `repr` of the bytes written:

```
'a,0.10\nb,0.20\n'
```

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/s6-cents-add.csv`

Exit code: `0`

stdout (`repr`): `'0.30\n'`

stderr (`repr`): `''`
