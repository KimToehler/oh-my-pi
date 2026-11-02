# F2 wave 1 s9-crlf — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: CRLF line endings (common in supplier exports) -> `25.00`, exit 0

## Input file

2 newline-terminated line(s), 27 bytes. Python `repr` of the bytes written:

```
'widget,19.99\r\ngadget,5.01\r\n'
```

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/s9-crlf.csv`

Exit code: `0`

stdout (`repr`): `'25.00\n'`

stderr (`repr`): `''`
