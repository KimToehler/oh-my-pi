# QA9 two malformed lines are each named

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`data.csv`, synthetic):
```
widget,abc
gadget,5.01
thing,
```

Command: `bun src/cli.ts total data.csv`

Expected: stderr names lines 1 and 3, stdout prints no total; exit 2

stdout: ``

stderr: `error: lines 1, 3: malformed price`

exit: 2
