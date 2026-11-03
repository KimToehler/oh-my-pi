# F1 s1 happy path

Head: 5b0f706 (the code commit)

Input (`/tmp/f1d-data.csv`):
```
widget,19.99
gadget,5.01
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
