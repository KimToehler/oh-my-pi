# F1 s3-cents

- Head: `03369ba24543870be9c8c4bcd4bb99ba7791d60f`
- Bun: `1.4.4`
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-4anc72kz/s3-cents.csv`
- Expected: prints `1.00`

## Input file (70 bytes)

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

- Exit code: `0`

stdout:

```
1.00
```

stderr:

```
```
