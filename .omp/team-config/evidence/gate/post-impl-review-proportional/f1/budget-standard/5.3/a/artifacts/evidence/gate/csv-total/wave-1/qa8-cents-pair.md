# QA8 spec scenario "Cents add exactly"

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`data.csv`, synthetic):
```
a,0.10
b,0.20
```

Command: `bun src/cli.ts total data.csv`

Expected: prints 0.30; exit 0

stdout: `0.30`

stderr: ``

exit: 0
