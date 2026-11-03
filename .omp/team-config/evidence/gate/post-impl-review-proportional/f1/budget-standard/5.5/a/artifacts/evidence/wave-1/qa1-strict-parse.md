# F2 wave 1 QA1 requirement: Price lines are parsed strictly

Head: ecd418fce4a870f089788aa2102397d42c8ea37c
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Scenarios:
- Valid lines are summed (`widget,19.99`, `gadget,5.01` -> `25.00`, exit 0): carried, `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (sha256 f31413fe59a0e8892e33ffde372880fc28cfda8e475f2fa0edb26b00d50756a0). Carry reason: captured at 4e5e75b (the code commit); the only later commit, ecd418f, adds F1 evidence files and ticks tasks.md 3.1, so it cannot change what the capture observed.
- Malformed price is rejected with its line number (`widget,abc` -> stderr names line 1, no stdout, exit 2): carried, `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` (sha256 2bb0e7324e2cf277f7e59e084b5aeb70001093da3d3ad792d8cf02718bbf560b). Carry reason: captured at 4e5e75b (the code commit); the only later commit, ecd418f, adds F1 evidence files and ticks tasks.md 3.1, so it cannot change what the capture observed.
- Negative control: new capture below (a malformed line among valid lines must not be counted as zero or skipped: no total, exit 2, line 2 named).

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

Verdict: PASS. No total on stdout, stderr `error: line 2: malformed price`, exit 2.
