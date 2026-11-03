# F1 s2-malformed: Malformed price is rejected with its line number

- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Command (repo root): `bun src/cli.ts total s2-malformed.csv`
- Input `s2-malformed.csv` (11 bytes):

```
widget,abc
```

## Observed

- exit: 2
- stdout:

```
```

- stderr:

```
error: line 1: malformed price
```

## Expected

stderr names line 1, stdout empty (no total), exit 2

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (malformed price counted as zero): src/cents.ts: `return null` -> `return 0`

- exit: 0
- stdout:

```
0.00
```

- stderr:

```
```

Check result on mutant: NO MATCH
