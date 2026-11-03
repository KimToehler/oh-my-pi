# F1 s2-malformed

- Head: `03369ba24543870be9c8c4bcd4bb99ba7791d60f`
- Bun: `1.4.4`
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-4anc72kz/s2-malformed.csv`
- Expected: exit 2, stderr names line 1, no total on stdout

## Input file (11 bytes)

```
widget,abc
```

## Observed

- Exit code: `2`

stdout:

```
```

stderr:

```
error: line 1: malformed price
```
