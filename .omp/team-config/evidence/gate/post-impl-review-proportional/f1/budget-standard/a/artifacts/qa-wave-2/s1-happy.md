# F2 wave 2 s1-happy happy path (re-run: carry rejected by delta review)

Head: aa9b7e1e3a6e, bun 1.4.4

Input (`/tmp/csvqa.TN6q/s1.csv`, shown with cat -A):
```
widget,19.99$
gadget,5.01$
```

Command: `bun src/cli.ts total /tmp/csvqa.TN6q/s1.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
