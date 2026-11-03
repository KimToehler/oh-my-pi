# F1 s3 exact cents

Head: 5b0f706 (the code commit)

Input (`/tmp/f1d-data.csv`):
```
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: prints 1.00

stdout: `1.00`

stderr: ``

exit: 0
