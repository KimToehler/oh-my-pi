# F2 wave 2 QA5 regression on adjacent behaviour: formatCents/groupThousands (pre-existing src/format.ts, changed by this diff) across grouping boundaries (re-run: failed in wave 1, fix 4.1 changes the code it observes)

Head: c9b007ab1e4997752155a0a27eff4d1b91b9be61
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Expected: exactly two decimals and the total's digits preserved; a grouping separator before every group of three digits (`1,000.00`, `999,999.99`, `1,000,000.00`, `1,234,567.89`), none below 1000.

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

### F1 s5 input: 1234.50

Input file bytes (`\r` shown literally where present):
```
big,1234.50
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
1,234.50
exit: 0
```

stderr file:
```
```

### Below 1,000,000: 999999.99

Input file bytes (`\r` shown literally where present):
```
a,999999.99
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
999,999.99
exit: 0
```

stderr file:
```
```

### Boundary 1,000,000: 1000000.00

Input file bytes (`\r` shown literally where present):
```
a,1000000.00
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
1,000,000.00
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
1,234,567.89
exit: 0
```

stderr file:
```
```

Verdict: PASS. 999.99 -> `999.99`, 1000.00 -> `1,000.00`, 1234.50 -> `1,234.50`, 999999.99 -> `999,999.99`, 1000000.00 -> `1,000,000.00`, 1234567.89 -> `1,234,567.89`; all exit 0 with empty stderr.
