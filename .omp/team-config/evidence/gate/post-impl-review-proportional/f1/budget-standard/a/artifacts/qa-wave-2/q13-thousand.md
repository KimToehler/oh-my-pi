# F2 wave 2 q13-thousand grouping threshold 1000.00

Head: aa9b7e1e3a6e, bun 1.4.4

Input (`/tmp/csvqa.TN6q/q13.csv`, shown with cat -A):
```
x,999.99$
y,0.01$
```

Command: `bun src/cli.ts total /tmp/csvqa.TN6q/q13.csv`

Expected: prints 1,000.00, exit 0

stdout: `1,000.00`

stderr: ``

exit: 0
