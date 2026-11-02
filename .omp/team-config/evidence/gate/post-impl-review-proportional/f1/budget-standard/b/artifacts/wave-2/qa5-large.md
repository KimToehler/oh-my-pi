# F2 wave 2 QA5: s5 large total (re-run, the fix reaches `groupThousands`)

Head: 20fb5fb8e973d2208fbb572644e2ee1947c347f2

Input:
```
big,1234.50
```

Command: `bun src/cli.ts total <tmp>/in.csv`

Expected: digits 1234.50, grouping separators allowed

stdout: `1,234.50`

stderr: ``

exit: 0
