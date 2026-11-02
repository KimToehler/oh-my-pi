# F2 wave 1 q13-thousand grouping threshold 1000.00 and under-1000 unchanged

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q13.csv`, shown with cat -A):
```
x,999.99$
y,0.01$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q13.csv`

Expected: prints digits 1000.00 (separator allowed), exit 0

stdout: `1,000.00`

stderr: ``

exit: 0
