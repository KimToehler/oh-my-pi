# F1 s4-empty — csv-total

- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
- **Runtime**: bun 1.4.4
- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s4-empty.csv`
- **Expected (task 3.1)**: an empty file prints `0.00`, exit 0

## Input file

0 newline-terminated line(s), 0 bytes. Python `repr` of the bytes written:

```
''
```

## Observed

Exit code: `0`

stdout (`repr`): `'0.00\n'`

```
0.00
```

stderr (`repr`): `''`

stderr: empty
