# F1 s3-cents — csv-total

- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
- **Runtime**: bun 1.4.4
- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s3-cents.csv`
- **Expected (task 3.1)**: ten lines of `x,0.10` print `1.00`

## Input file

10 newline-terminated line(s), 70 bytes. Python `repr` of the bytes written:

```
'x,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\n'
```

## Observed

Exit code: `0`

stdout (`repr`): `'1.00\n'`

```
1.00
```

stderr (`repr`): `''`

stderr: empty
