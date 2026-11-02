# F2 wave 2 QA6: adjacent regression, total formatting of the pre-existing `src/format.ts` (re-run after fix 4.1)

Head: 20fb5fb8e973d2208fbb572644e2ee1947c347f2

Expected: the same digits as `main`, with a separator between every group of three digits for totals of 1000 and more, none below; never a separator in a non-thousands position.

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

stdout: `1,234,567.89`

stderr: ``

exit: 0

`main` formatCents(123456789): `1234567.89`

## Input `big,12345678.90`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `12,345,678.90`

stderr: ``

exit: 0

`main` formatCents(1234567890): `12345678.90`

## Input `big,1000000.00`

Command: `bun src/cli.ts total <tmp>/in.csv`

stdout: `1,000,000.00`

stderr: ``

exit: 0

`main` formatCents(100000000): `1000000.00`
