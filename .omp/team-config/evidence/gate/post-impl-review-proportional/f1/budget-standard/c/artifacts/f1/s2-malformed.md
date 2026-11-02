# F1 s2-malformed

- Change: csv-total, task 3.1
- Head: `299d2d6e8e3f4866c44b8782fe7d73095b7873cf`
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-ldi8aek1/s2-malformed.csv`
- Expected (task 3.1): exits 2, stderr names line 1, no total on stdout

## Input file (11 bytes)

```
widget,abc
```

## Observed

- Exit code: 2
- stdout:

```
```

- stderr:

```
error: line 1: malformed price
```
