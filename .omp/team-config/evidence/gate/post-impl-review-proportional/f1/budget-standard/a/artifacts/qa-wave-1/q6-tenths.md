# F2 wave 1 q6-tenths cents add exactly

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q6.csv`, shown with cat -A):
```
a,0.10$
b,0.20$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q6.csv`

Expected: prints 0.30, exit 0

stdout: `0.30`

stderr: ``

exit: 0
