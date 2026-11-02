# F2 wave 2 q8-million grouping boundary at a million

Head: aa9b7e1e3a6e, bun 1.4.4

Input (`/tmp/csvqa.TN6q/q8.csv`, shown with cat -A):
```
big,1234567.89$
```

Command: `bun src/cli.ts total /tmp/csvqa.TN6q/q8.csv`

Expected: prints 1,234,567.89 (every run of three digits grouped, fix 4.1), exit 0

stdout: `1,234,567.89`

stderr: ``

exit: 0
