# F2 wave 1 QA: Happy path named by the goal

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Goal: total a `name,price` supplier file in exact cents and print it with two decimals.

1. `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` (tracked): `widget,19.99` and `gadget,5.01` observed stdout `25.00`, stderr empty, exit 0. carried, not re-run: the only commit after its capture head 4e5e75b is ecd418f, which adds F1 evidence files and ticks tasks.md 3.1; it changes no file under src/ or test/, so it cannot change what the row observed.
2. Same file with CRLF line endings, as spreadsheet exports write it: fresh capture `g-crlf` below. Expected `25.00`, exit 0.

### g-crlf

Input (`/tmp/csvtotal-qa-r511a/g-crlf.csv`, 27 bytes, 2 lines; `cat -vet`, `$` marks a line end):
```
widget,19.99^M$
gadget,5.01^M$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/g-crlf.csv`

stdout:
```
25.00
```
stderr:
```

```
exit: 0

Verdict: PASS.
