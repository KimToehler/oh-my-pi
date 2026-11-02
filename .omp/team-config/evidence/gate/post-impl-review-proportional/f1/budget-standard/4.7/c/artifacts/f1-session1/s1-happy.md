# F1 s1-happy — csv-total

- **Change**: csv-total, task 3.1 (F1 manual QA on the real surface)
- **Head**: `19eb3d486b907bd52ea4ddba42ced6ab15774742` (branch `feat/csv-total`, after merging `main`; last code commit `0cd516d`)
- **Runtime**: bun 1.4.4
- **Command**: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-zqecoio1/s1-happy.csv`
- **Expected (task 3.1)**: `widget,19.99` and `gadget,5.01` print `25.00`, exit 0

## Input file

2 newline-terminated line(s), 25 bytes. Python `repr` of the bytes written:

```
'widget,19.99\ngadget,5.01\n'
```

## Observed

Exit code: `0`

stdout (`repr`): `'25.00\n'`

```
25.00
```

stderr (`repr`): `''`

stderr: empty
