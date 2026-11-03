# F1 s5-large — csv-total

- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
- **Runtime**: bun 1.4.4
- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s5-large.csv`
- **Expected (task 3.1)**: `big,1234.50` prints a total whose digits are `1234.50` (grouping separators allowed)

## Input file

1 newline-terminated line(s), 12 bytes. Python `repr` of the bytes written:

```
'big,1234.50\n'
```

## Observed

Exit code: `0`

stdout (`repr`): `'1234.50\n'`

```
1234.50
```

stderr (`repr`): `''`

stderr: empty
