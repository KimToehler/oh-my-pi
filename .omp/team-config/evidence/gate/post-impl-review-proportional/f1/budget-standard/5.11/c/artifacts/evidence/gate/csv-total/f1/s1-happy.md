# F1 s1-happy: Valid lines are summed

- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Command (repo root): `bun src/cli.ts total s1-happy.csv`
- Input `s1-happy.csv` (25 bytes):

```
widget,19.99
gadget,5.01
```

## Observed

- exit: 0
- stdout:

```
25.00
```

- stderr:

```
```

## Expected

stdout `25.00`, exit 0

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (decimal part dropped): src/cents.ts: `roundToCents(Number(text))` -> `roundToCents(parseInt(text))`

- exit: 0
- stdout:

```
24.00
```

- stderr:

```
```

Check result on mutant: NO MATCH
