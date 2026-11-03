# F2 wave 1 QA5 regression on adjacent behaviour: formatCents/groupThousands (pre-existing src/format.ts, changed by this diff) across grouping boundaries

Head: ecd418fce4a870f089788aa2102397d42c8ea37c
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Expected: exactly two decimals and the total's digits preserved; when a grouping separator is printed it groups thousands (`1,000.00`, `1,234,567.89`), matching the diff's own contract in src/format.ts ("grouped thousands", "with a thousands separator"); an ungrouped total is also acceptable (tasks.md 3.1 s5: with or without grouping separators). A separator that splits the digits anywhere other than at thousands is a malformed figure.

- 1234.50 -> `1,234.50`: carried, `.omp/team-config/evidence/gate/csv-total/f1/s5-large.md` (sha256 887b029d60afc5db1399666034d37db3391f480367e3c53be1e2d4c3c8b5ec01). Carry reason: captured at 4e5e75b (the code commit); the only later commit, ecd418f, adds F1 evidence files and ticks tasks.md 3.1, so it cannot change what the capture observed.

### Below 1000: 999.99

Input file bytes (`\r` shown literally where present):
```
a,999.99
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
999.99
exit: 0
```

stderr file:
```
```

### Boundary 1000: 1000.00

Input file bytes (`\r` shown literally where present):
```
a,1000.00
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
1,000.00
exit: 0
```

stderr file:
```
```

### Above 1,000,000: 1234567.89

Input file bytes (`\r` shown literally where present):
```
a,1234567.89
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
1234,567.89
exit: 0
```

stderr file:
```
```

Verdict: FAIL. 999.99 -> `999.99` and 1000.00 -> `1,000.00` as expected, but 1234567.89 prints `1234,567.89`: one separator after the fourth digit, neither thousands grouping nor the ungrouped total. Cause: `groupThousands` in src/format.ts uses `/(\d)(?=(\d{3})$)/`, whose lookahead is anchored to the last three digits, so exactly one separator is inserted whatever the length. A total of 1,000,000.00 or more is printed as a malformed figure that a person checks against the invoice.
