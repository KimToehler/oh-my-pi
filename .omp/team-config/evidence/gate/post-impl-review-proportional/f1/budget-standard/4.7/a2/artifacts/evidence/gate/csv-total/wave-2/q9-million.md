# F2 wave-2 total of one million or more (re-run after fix 1.3)

Head: ae2afb0be177dd975d32b77c575f296806c33cc9

Input (`q9-million.csv`, synthetic, shown with `\r` made visible):
```
big,1234567.00
```

Command: `bun src/cli.ts total q9-million.csv` (run from the repo root; bun 1.4.4)

Expected: exit 0 and a total whose digits are 1234567.00 with exactly two decimals: either ungrouped (1234567.00) or correctly grouped in thousands (1,234,567.00)

stdout: `1,234,567.00`

stderr: ``

exit: 0
