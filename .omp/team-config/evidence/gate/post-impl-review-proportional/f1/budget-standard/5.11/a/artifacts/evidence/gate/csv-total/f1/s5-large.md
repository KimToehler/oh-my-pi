# F1 s5 large total

Head: 4e5e75b (the code commit)

Input (`/tmp/f1d-data.csv`):
```
big,1234.50
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: digits 1234.50, grouping separators allowed

stdout: `1,234.50`

stderr: ``

exit: 0
