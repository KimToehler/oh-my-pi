# F2 wave 1 spec scenario: cents add exactly

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`q8-spec-cents.csv`, synthetic, shown with `\r` made visible):
```
a,0.10
b,0.20
```

Command: `bun src/cli.ts total q8-spec-cents.csv` (run from the repo root; bun 1.4.4)

Expected: prints 0.30, exit 0

stdout: `0.30`

stderr: ``

exit: 0
