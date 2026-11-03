# F1 s4-empty: Empty file

- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Command (repo root): `bun src/cli.ts total s4-empty.csv`
- Input `s4-empty.csv` (0 bytes):

```
```

## Observed

- exit: 0
- stdout:

```
0.00
```

- stderr:

```
```

## Expected

stdout `0.00`, exit 0

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (blank lines not ignored): src/price.ts: `if (line.trim() === "") continue` -> `if (false) continue`

- exit: 2
- stdout:

```
```

- stderr:

```
error: line 1: malformed price
```

Check result on mutant: NO MATCH
