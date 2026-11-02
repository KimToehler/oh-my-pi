# F2 wave 1 CRLF line endings

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`q7-crlf.csv`, synthetic, shown with `\r` made visible):
```
widget,19.99\r
gadget,5.01\r
```

Command: `bun src/cli.ts total q7-crlf.csv` (run from the repo root; bun 1.4.4)

Expected: prints 25.00, exit 0 (same as the LF happy path)

stdout: `25.00`

stderr: ``

exit: 0
