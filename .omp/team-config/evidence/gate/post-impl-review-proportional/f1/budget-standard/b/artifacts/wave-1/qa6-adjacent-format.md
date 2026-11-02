# F2 wave 1 QA6: adjacent regression, total formatting of the pre-existing `src/format.ts`

Head: d32f7b7fc0c6003daa6168f2b65124b1708323d4 (snapshot head)

Why this row: the diff changes the pre-existing `groupThousands` in `src/format.ts` (on `main` it returned `String(whole)`), so totals of 1000 and more take a changed path. Expected: the same digits as on `main`, optionally with correct thousands separators (s5 allows grouping); never a separator in a non-thousands position.

## Input `big,999.99`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `999.99`

stderr: ``

exit: 0

`main` formatCents(99999): `999.99`

## Input `big,1000.00`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `1,000.00`

stderr: ``

exit: 0

`main` formatCents(100000): `1000.00`

## Input `big,1234567.89`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `1234,567.89`

stderr: ``

exit: 0

`main` formatCents(123456789): `1234567.89`

## Input `big,12345678.90`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `12345,678.90`

stderr: ``

exit: 0

`main` formatCents(1234567890): `12345678.90`

Verdict: FAIL. Totals of 1,000,000 and more print a separator after the leading digit group only (`1234,567.89`, `12345,678.90`): the regex `(\d)(?=(\d{3})$)` inserts one comma before the last three digits. `main` printed `1234567.89`; the reviewed head prints a figure that matches neither the plain nor the grouped form, and reads as `1234.567` in a decimal-comma locale.
