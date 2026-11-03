# QA7 total of seven integer digits (re-run: wave 1 FAIL, fix 4.1)

Head: 4b7eb4999e12b11667a887bde9f89b5e7ec1ad40

Input (`data.csv`, synthetic):
```
big,1234567.00
```

Command: `bun src/cli.ts total data.csv`

Expected: prints a total whose digits are 1234567.00, with no separator or correctly placed ones (1,234,567.00); exit 0

stdout: `1234567.00`

stderr: ``

exit: 0
