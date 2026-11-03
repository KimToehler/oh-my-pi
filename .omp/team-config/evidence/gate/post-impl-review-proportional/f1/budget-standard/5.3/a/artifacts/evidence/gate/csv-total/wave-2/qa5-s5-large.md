# QA5 s5 large total (re-run: fix 4.1 changes formatting of totals of 1000 or more)

Head: 4b7eb4999e12b11667a887bde9f89b5e7ec1ad40

Input (`data.csv`, synthetic):
```
big,1234.50
```

Command: `bun src/cli.ts total data.csv`

Expected: prints a total whose digits are 1234.50, with no separator or a correctly placed one; exit 0

stdout: `1234.50`

stderr: ``

exit: 0
