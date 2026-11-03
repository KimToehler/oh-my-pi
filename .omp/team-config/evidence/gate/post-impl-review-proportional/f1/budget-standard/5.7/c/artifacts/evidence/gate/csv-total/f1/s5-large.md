# F1 s5-large

- Head: `03369ba24543870be9c8c4bcd4bb99ba7791d60f`
- Bun: `1.4.4`
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-4anc72kz/s5-large.csv`
- Expected: printed total's digits are `1234.50` (grouping separators allowed)

## Input file (12 bytes)

```
big,1234.50
```

## Observed

- Exit code: `0`

stdout:

```
1234.50
```

stderr:

```
```
