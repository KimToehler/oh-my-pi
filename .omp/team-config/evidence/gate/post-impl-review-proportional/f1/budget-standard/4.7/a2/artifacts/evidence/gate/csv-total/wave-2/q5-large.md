# F2 wave-2 grouped total above 1000 (re-run, reaches the changed groupThousands)

Head: ae2afb0be177dd975d32b77c575f296806c33cc9

Input (`q5-large.csv`, synthetic, shown with `\r` made visible):
```
big,1234.50
```

Command: `bun src/cli.ts total q5-large.csv` (run from the repo root; bun 1.4.4)

Expected: exit 0, digits 1234.50 with two decimals, ungrouped 1234.50 or correctly grouped 1,234.50

stdout: `1,234.50`

stderr: ``

exit: 0
