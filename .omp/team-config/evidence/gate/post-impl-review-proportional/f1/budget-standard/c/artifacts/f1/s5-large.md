# F1 s5-large

- Change: csv-total, task 3.1
- Head: `299d2d6e8e3f4866c44b8782fe7d73095b7873cf`
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-ldi8aek1/s5-large.csv`
- Expected (task 3.1): prints a total whose digits are `1234.50` (grouping separators allowed)

## Input file (12 bytes)

```
big,1234.50
```

## Observed

- Exit code: 0
- stdout:

```
1234.50
```

- stderr:

```
```
