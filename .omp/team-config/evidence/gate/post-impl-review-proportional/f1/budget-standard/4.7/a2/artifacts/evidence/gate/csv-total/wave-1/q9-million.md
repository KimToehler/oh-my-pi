# F2 wave 1 total of one million or more

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`q9-million.csv`, synthetic, shown with `\r` made visible):
```
big,1234567.00
```

Command: `bun src/cli.ts total q9-million.csv` (run from the repo root; bun 1.4.4)

Expected: exit 0 and a total whose digits are 1234567.00 with exactly two decimals: either ungrouped (1234567.00) or correctly grouped in thousands (1,234,567.00)

stdout: `1234,567.00`

stderr: ``

exit: 0
