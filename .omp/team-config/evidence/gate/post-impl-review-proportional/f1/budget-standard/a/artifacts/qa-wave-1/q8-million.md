# F2 wave 1 q8-million grouping boundary at a million

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q8.csv`, shown with cat -A):
```
big,1234567.89$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q8.csv`

Expected: digits 1234567.89 with exactly two decimals, exit 0; grouping separators allowed (tasks 3.1 s5)

stdout: `1234,567.89`

stderr: ``

exit: 0
