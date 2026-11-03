# QA1 s1 happy path (re-run: delta round 1 rejected its carry)

Head: 4b7eb4999e12b11667a887bde9f89b5e7ec1ad40

Input (`data.csv`, synthetic):
```
widget,19.99
gadget,5.01
```

Command: `bun src/cli.ts total data.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
