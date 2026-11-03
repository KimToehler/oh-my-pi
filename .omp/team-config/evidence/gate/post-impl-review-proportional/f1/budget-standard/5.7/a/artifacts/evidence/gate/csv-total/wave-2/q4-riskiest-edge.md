# Q4 riskiest edge: input boundaries and large totals (re-run: fix round 1 changed `groupThousands`)

Head: b64d9652e387f2768741b29deb16c5e84e924c10 (F2 wave 2 snapshot)
Channel: `bun src/cli.ts` subprocess from the repo root, stdout and stderr captured separately; synthetic data in a temp dir shown as `$QA_TMP`.

## CRLF line endings

Input bytes (Python-escaped): `widget,19.99\r\ngadget,5.01\r\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0

## Header row is not a price

Input bytes (Python-escaped): `name,price\nwidget,19.99\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: stderr names line 1, no total, exit 2

stdout: ``

stderr: `error: line 1: malformed price`

exit: 2

## Grouping boundary 999.99

Input bytes (Python-escaped): `a,999.99\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 999.99, exit 0

stdout: `999.99`

stderr: ``

exit: 0

## Grouping boundary 1000.00

Input bytes (Python-escaped): `a,1000.00\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 1,000.00, exit 0

stdout: `1,000.00`

stderr: ``

exit: 0

## F1 s5 large total

Input bytes (Python-escaped): `big,1234.50\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 1,234.50, exit 0

stdout: `1,234.50`

stderr: ``

exit: 0

## Grouping boundary 999999.99

Input bytes (Python-escaped): `a,999999.99\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 999,999.99, exit 0

stdout: `999,999.99`

stderr: ``

exit: 0

## Grouping boundary 1000000.00

Input bytes (Python-escaped): `a,1000000.00\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 1,000,000.00, exit 0

stdout: `1,000,000.00`

stderr: ``

exit: 0

## Total above one million

Input bytes (Python-escaped): `big,1234567.89\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 1,234,567.89 (separator before every three digits), exit 0

stdout: `1,234,567.89`

stderr: ``

exit: 0

## Three decimals (accepted residual: rounded per line)

Input bytes (Python-escaped): `a,0.125\nb,0.125\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: rounded per line to whole cents, two decimals printed; exact figure recorded, not judged (accepted residual)

stdout: `0.26`

stderr: ``

exit: 0

