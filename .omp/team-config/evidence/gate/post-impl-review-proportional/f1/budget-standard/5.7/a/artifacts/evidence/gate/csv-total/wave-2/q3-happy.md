# Q3 happy path (re-run: the fix-round-1 delta review rejected the carry of F1 s1)

Head: b64d9652e387f2768741b29deb16c5e84e924c10 (fix round 1 head)
Channel: `bun src/cli.ts` subprocess from the repo root, stdout and stderr captured separately; synthetic data in a temp dir shown as `$QA_TMP`.

Input bytes (Python-escaped): `widget,19.99\ngadget,5.01\n`

Command: `bun src/cli.ts total $QA_TMP/in.csv`

Expected: prints 25.00, exit 0

stdout: `25.00`

stderr: ``

exit: 0
