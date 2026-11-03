# F1 s3-cents: Ten lines of x,0.10

- Head: `d0c56d3633318caebd703282dc70635d4768bc7d` (Merge branch 'main' into feat/csv-total); tracked tree clean at run time
- Runtime: bun 1.4.4
- Command (repo root): `bun src/cli.ts total s3-cents.csv`
- Input `s3-cents.csv` (70 bytes):

```
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
```

## Observed

- exit: 0
- stdout:

```
1.00
```

- stderr:

```
```

## Expected

stdout `1.00`, exit 0

Check result on head: MATCH

## Negative control

Same input and check against a scratch copy of `src/` outside the repo with one mutation (summed as float dollars, scaled to cents at the end): src/price.ts: `prices.reduce((total, price) => total + price.cents, 0)` -> `prices.reduce((total, price) => total + price.cents / 100, 0) * 100`

- exit: 0
- stdout:

```
0.99.99999999999999
```

- stderr:

```
```

Check result on mutant: NO MATCH
