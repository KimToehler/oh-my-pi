# F2 wave 2 q15-exact-million total of exactly 1,000,000.00 from 999,999.99 + 0.01

Head: aa9b7e1e3a6e, bun 1.4.4

Input (`/tmp/csvqa.TN6q/q15.csv`, shown with cat -A):
```
a,999999.99$
b,0.01$
```

Command: `bun src/cli.ts total /tmp/csvqa.TN6q/q15.csv`

Expected: prints 1,000,000.00, exit 0

stdout: `1,000,000.00`

stderr: ``

exit: 0
