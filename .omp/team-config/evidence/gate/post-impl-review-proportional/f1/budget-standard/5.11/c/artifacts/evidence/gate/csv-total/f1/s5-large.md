# F1 s5-large: Large amount big,1234.50

- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Command (repo root): `bun src/cli.ts total s5-large.csv`
- Input `s5-large.csv` (12 bytes):

```
big,1234.50
```

## Observed

- exit: 0
- stdout:

```
1234.50
```

- stderr:

```
```

## Expected

stdout digits `1234.50` (grouping separators allowed), exit 0

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (formats without fixed two decimals): src/format.ts: `return `${head}.${String(rest).padStart(2, "0")}`` -> `return String(cents / 100)`

- exit: 0
- stdout:

```
1234.5
```

- stderr:

```
```

Check result on mutant: NO MATCH
