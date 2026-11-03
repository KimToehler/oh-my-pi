# F2 wave 1 QA4 riskiest edge: line numbers of several malformed lines in a CRLF file with a blank line

Head: ecd418fce4a870f089788aa2102397d42c8ea37c
Harness: `^D` + two backspaces echoed by `script` on stdin EOF removed from the pty transcript; CR stripped.

Expected: physical line numbers 3 and 5 named (blank line 2 still counted; `nut,` has an empty price), no total on stdout, exit 2.

### CRLF, blank line, two malformed lines

Input file bytes (`\r` shown literally where present):
```
widget,19.99\r
\r
gadget,abc\r
bolt,0.50\r
nut,\r
```

Command (in a pty via `script -q /dev/null sh -c '...'`, stderr redirected to a file so stdout and stderr stay separate): `bun src/cli.ts total <file> 2><errfile>; echo "exit: $?"`

pty transcript (stdout + exit):
```
exit: 2
```

stderr file:
```
error: lines 3, 5: malformed price
```

Verdict: PASS. stderr `error: lines 3, 5: malformed price`, no stdout, exit 2.
