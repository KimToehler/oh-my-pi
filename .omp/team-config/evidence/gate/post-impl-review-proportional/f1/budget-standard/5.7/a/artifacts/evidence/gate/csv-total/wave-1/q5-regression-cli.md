# Q5 regression: CLI errors and the pre-existing sub-1000 format path

Head: ecd418fce4a870f089788aa2102397d42c8ea37c (F2 wave 1 snapshot)
Channel: `bun src/cli.ts` subprocess from the repo root, stdout and stderr captured separately; synthetic data in a temp dir shown as `$QA_TMP`.

## Usage error, no file argument

Input bytes (Python-escaped): `(none)`

Command: `bun src/cli.ts total`

Expected: stderr usage line, exit 2

stdout: ``

stderr: `usage: csvtotal total <file>`

exit: 2

## Unknown command

Input bytes (Python-escaped): `a,1.00\n`

Command: `bun src/cli.ts sum $QA_TMP/in.csv`

Expected: stderr usage line, exit 2

stdout: ``

stderr: `usage: csvtotal total <file>`

exit: 2

## Unreadable (missing) file

Input bytes (Python-escaped): `(none)`

Command: `bun src/cli.ts total /missing.csv`

Expected: stderr `cannot read`, exit 2

stdout: ``

stderr: `error: cannot read /missing.csv`

exit: 2

## Sub-1000 total keeps the pre-existing ungrouped format

Input bytes (Python-escaped): `a,0.05\nb,12.30\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 12.35, exit 0

stdout: `12.35`

stderr: ``

exit: 0

