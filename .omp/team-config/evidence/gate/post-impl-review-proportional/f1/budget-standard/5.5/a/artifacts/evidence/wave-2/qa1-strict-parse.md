# F2 wave 2 QA1 requirement: Price lines are parsed strictly

Head: c9b007ab1e4997752155a0a27eff4d1b91b9be61
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Scenarios:
- Valid lines are summed: re-run on this head below (its carry was rejected by the first delta review of fix round 1; the same execution is QA3's capture).
- Malformed price is rejected with its line number (`widget,abc` -> stderr names line 1, no stdout, exit 2): carried, `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (sha256 2bb0e7324e2cf277f7e59e084b5aeb70001093da3d3ad792d8cf02718bbf560b). Carry reason: captured at 4e5e75b; ecd418f only adds evidence and ticks tasks.md, and fix commit c9b007a changes only `groupThousands`, tests and tasks.md, while this path throws in `parsePrices` before `formatCents` runs.
- Negative control (`widget,19.99` + `gadget,abc` -> no total, `line 2`, exit 2): carried, captured at ecd418f in F2 wave 1 and copied below verbatim. Carry reason: the error path throws in `parsePrices` before `formatCents` runs; c9b007a does not touch parsing, `cli.ts` or the error path.

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

### Negative control

Input file bytes (`\r` shown literally where present):
```
widget,19.99
gadget,abc
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
exit: 2
```

stderr file:
```
error: line 2: malformed price
```

Verdict: PASS. Valid sum prints `25.00` exit 0; malformed lines print no total, name the line, exit 2.
