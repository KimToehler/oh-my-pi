# QA6 formatter boundary at 1,000 (re-run: reaches changed groupThousands)

Head: 4b7eb4999e12b11667a887bde9f89b5e7ec1ad40

Input (`data.csv`, synthetic):
```
a,999.99
b,0.01
```

Command: `bun src/cli.ts total data.csv`

Expected: prints a total whose digits are 1000.00, with no separator or a correctly placed one (1,000.00); exit 0

stdout: `1000.00`

stderr: ``

exit: 0
