# F2 wave 1 q10-header header row

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q10.csv`, shown with cat -A):
```
name,price$
widget,19.99$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q10.csv`

Expected: header line is not a price line: stderr names line 1, no total, exit 2 (spec: every line is name,price)

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2
