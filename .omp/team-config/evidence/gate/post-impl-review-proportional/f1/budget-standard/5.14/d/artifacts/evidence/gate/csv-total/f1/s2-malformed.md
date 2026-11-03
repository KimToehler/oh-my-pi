# F1 s2 malformed price

Head: 5b0f706 (the code commit)

Input (`/tmp/f1d-data.csv`):
```
widget,abc
```

Command: `bun src/cli.ts total /tmp/f1d-data.csv`

Expected: stderr names line 1, no total, exit 2

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2
