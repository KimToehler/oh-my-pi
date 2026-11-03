# F2 wave 1, row 4: Riskiest edge, malformed price variants and CRLF input

Head: 63687cd82a15a6c50d600ea3217a360e42f1d9ab
Run from the review worktree; `$QA_TMP` is a disposable temp directory holding synthetic input.

The author's risk assessment names a malformed line counted as a number and a wrong line number. This row feeds price fields that `Number()` would coerce or that look numeric (empty, `NaN`, `Infinity`, `0x10`, embedded letters, two dots, no comma) next to one valid padded price, and a CRLF file of valid lines.

### Capture: malformed price variants

Input (`$QA_TMP/variants.csv`, `\r` shown literally where present):
```
a,
b,abc12
c,12abc
d,NaN
e,Infinity
f,0x10
g 12
h,1.2.3
i, 3.50 
```

Command: `bun src/cli.ts total $QA_TMP/variants.csv`

stdout: ``

stderr: `error: lines 1, 2, 3, 4, 5, 6, 7, 8: malformed price`

exit: 2

Expected: no total; stderr names lines 1 through 8 and not line 9 (`i, 3.50 ` is a valid padded price); exit 2.
Verdict: PASS. Observed matches.

### Capture: CRLF line endings

Input (`$QA_TMP/crlf.csv`, `\r` shown literally where present):
```
widget,19.99\r
gadget,5.01\r
```

Command: `bun src/cli.ts total $QA_TMP/crlf.csv`

stdout: `25.00`

stderr: ``

exit: 0

Expected: `25.00`, exit 0 (the `\r` is not part of the price).
Verdict: PASS. Observed matches.

### Observation outside this row's expectation (not judged by QA)

The spec does not define a line holding more than one comma, and the design lists quoted CSV fields and locale formatting as non-goals. The parser splits at the last comma (`src/price.ts:16`), so a price written with a thousands separator is summed as its last group without an error:

### Capture: three comma-separated fields

Input (`$QA_TMP/threefield.csv`, `\r` shown literally where present):
```
widget,1,234.50
```

Command: `bun src/cli.ts total $QA_TMP/threefield.csv`

stdout: `234.50`

stderr: ``

exit: 0

Recorded for the reviewer: the CLI's own output for totals of 1000.00 and more uses this separator (`.omp/team-config/evidence/gate/csv-total/f1/s5-large.md`).
