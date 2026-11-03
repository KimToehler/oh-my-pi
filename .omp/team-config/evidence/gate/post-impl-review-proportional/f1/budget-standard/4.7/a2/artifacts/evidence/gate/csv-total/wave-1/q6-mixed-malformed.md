# F2 wave 1 mixed valid and malformed lines

Head: ecd418fce4a870f089788aa2102397d42c8ea37c

Input (`q6-mixed-malformed.csv`, synthetic, shown with `\r` made visible):
```
widget,19.99
gadget,abc
bolt,5.01
nut,
```

Command: `bun src/cli.ts total q6-mixed-malformed.csv` (run from the repo root; bun 1.4.4)

Expected: stderr names lines 2 and 4, stdout prints no total (no line counted as zero or skipped), exit 2

stdout: ``

stderr: `error: lines 2, 4: malformed price`

exit: 2
