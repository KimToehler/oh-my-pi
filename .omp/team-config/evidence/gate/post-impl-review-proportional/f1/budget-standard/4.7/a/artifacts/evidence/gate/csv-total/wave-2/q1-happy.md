# F2 wave 2 Q1 happy path (re-run; delta review round 1 rejected its carry)

Head: 58aa50fd80a17a2228ad58cf1a3b52bebbad35ff

Input (`$TMP/s1.csv`):
```
widget,19.99
gadget,5.01
```

Command: `bun src/cli.ts total $TMP/s1.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0

Verdict: PASS
