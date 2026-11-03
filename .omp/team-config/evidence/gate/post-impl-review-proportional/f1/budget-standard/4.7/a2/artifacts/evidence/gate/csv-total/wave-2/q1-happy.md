# F2 wave-2 happy path (re-run, delta review rejected its carry)

Head: ae2afb0be177dd975d32b77c575f296806c33cc9

Input (`q1-happy.csv`, synthetic, shown with `\r` made visible):
```
widget,19.99
gadget,5.01
```

Command: `bun src/cli.ts total q1-happy.csv` (run from the repo root; bun 1.4.4)

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
