# F2 wave 2 s5-large large total

Head: aa9b7e1e3a6e, bun 1.4.4

Input (`/tmp/csvqa.TN6q/s5.csv`, shown with cat -A):
```
big,1234.50$
```

Command: `bun src/cli.ts total /tmp/csvqa.TN6q/s5.csv`

Expected: digits 1234.50, grouping separators allowed; any separator at a thousands boundary; exit 0

stdout: `1,234.50`

stderr: ``

exit: 0
