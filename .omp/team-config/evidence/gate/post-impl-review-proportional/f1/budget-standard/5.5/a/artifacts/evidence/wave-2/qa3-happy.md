# F2 wave 2 QA3 happy path (re-run: the first delta review of fix round 1 rejected its carry)

Head: c9b007ab1e4997752155a0a27eff4d1b91b9be61
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Expected: stdout `25.00`, exit 0, no stderr.

### Valid lines are summed

Input file bytes (`\r` shown literally where present):
```
widget,19.99
gadget,5.01
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
25.00
exit: 0
```

stderr file:
```
```

Verdict: PASS. stdout `25.00`, exit 0, no stderr.
