# F2 wave 1 QA2 requirement: Totals are exact in cents

Head: ecd418fce4a870f089788aa2102397d42c8ea37c
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Scenarios:
- Cents add exactly: new capture below.
- Empty file (`0.00`, exit 0): carried, `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` (sha256 efcdae5be453e0570385562f45235f3b117980c4467f533f5b57abf4bee76c2f). Carry reason: captured at 4e5e75b (the code commit); the only later commit, ecd418f, adds F1 evidence files and ticks tasks.md 3.1, so it cannot change what the capture observed.
- Negative control (ten lines of `x,0.10` -> `1.00`): carried, `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` (sha256 11525ab3a8e2da47652ae3f89df783e5d7ed86f25b626e6718bb5e27e7701ddb). Carry reason: captured at 4e5e75b (the code commit); the only later commit, ecd418f, adds F1 evidence files and ticks tasks.md 3.1, so it cannot change what the capture observed.

### Cents add exactly

Input file bytes (`\r` shown literally where present):
```
a,0.10
b,0.20
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
0.30
exit: 0
```

stderr file:
```
```

Verdict: PASS. stdout `0.30`, exit 0, no stderr.
