# F2 wave 1 q9-crlf CRLF line endings

Head: ecd418fce4a8, bun 1.4.4

Input (`/tmp/csvqa.HEsp/q9.csv`, shown with cat -A):
```
widget,19.99^M$
gadget,5.01^M$
```

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/q9.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
