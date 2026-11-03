# F1 s2-malformed — csv-total

- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
- **Runtime**: bun 1.4.4
- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s2-malformed.csv`
- **Expected (task 3.1)**: `widget,abc` exits 2 with a stderr message naming line 1, no total on stdout

## Input file

1 newline-terminated line(s), 11 bytes. Python `repr` of the bytes written:

```
'widget,abc\n'
```

## Observed

Exit code: `2`

stdout (`repr`): `''`

stdout: empty

stderr (`repr`): `'error: line 1: malformed price\n'`

```
error: line 1: malformed price
```
