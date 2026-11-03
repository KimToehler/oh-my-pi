# F1 s1-happy

- Head: `03369ba24543870be9c8c4bcd4bb99ba7791d60f`
- Bun: `1.4.4`
- Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f1-4anc72kz/s1-happy.csv`
- Expected: prints `25.00`, exit 0

## Input file (25 bytes)

```
widget,19.99
gadget,5.01
```

## Observed

- Exit code: `0`

stdout:

```
25.00
```

stderr:

```
```
