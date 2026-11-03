# QA7 total of seven integer digits (second grouping boundary of src/format.ts)

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`data.csv`, synthetic):
```
big,1234567.00
```

Command: `bun src/cli.ts total data.csv`

Expected: prints a total whose digits are 1234567.00, with no separator or correctly placed ones (1,234,567.00); exit 0

stdout: `1234,567.00`

stderr: ``

exit: 0
