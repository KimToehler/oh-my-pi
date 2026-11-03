# QA6 formatter boundary at 1,000 (regression on pre-existing src/format.ts)

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`data.csv`, synthetic):
```
a,999.99
b,0.01
```

Command: `bun src/cli.ts total data.csv`

Expected: prints a total whose digits are 1000.00, with no separator or a correctly placed one (1,000.00); exit 0

stdout: `1,000.00`

stderr: ``

exit: 0
