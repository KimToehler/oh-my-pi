# F2 wave-2 summed total crossing one million (re-run after fix 1.3)

Head: ae2afb0be177dd975d32b77c575f296806c33cc9

Input (`q9b-million-sum.csv`, synthetic, shown with `\r` made visible):
```
a,999999.99
b,0.01
```

Command: `bun src/cli.ts total q9b-million-sum.csv` (run from the repo root; bun 1.4.4)

Expected: exit 0 and 1,000,000.00 (or ungrouped 1000000.00)

stdout: `1,000,000.00`

stderr: ``

exit: 0
