# F2 wave 1 q7-mixed-malformed malformed lines among valid ones

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q7.csv`, shown with cat -A):
```
widget,19.99$
bad,abc$
gadget,5.01$
empty,$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q7.csv`

Expected: stderr names lines 2 and 4, stdout empty (no total), exit 2

stdout: ``

stderr: `error: lines 2, 4: malformed price`

exit: 2
