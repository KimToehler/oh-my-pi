# F2 wave 2 QA: Happy path named by the goal

Reviewed head: ddc134eacefc3ada4e7cb21962f3846be52ae3c9
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Re-run on the fixed head because the round-1 delta review rejected the carry of F1 s1 (`f1/s1-happy.md`, captured at 4e5e75b): `src/format.ts`, through which every printed total passes, changed in ddc134e. Goal: total a `name,price` supplier file in exact cents and print it with two decimals.

1. F1 s1 input re-run (`widget,19.99` and `gadget,5.01`). Expected `25.00`, stderr empty, exit 0.
2. Same file with CRLF line endings, as spreadsheet exports write it. Expected `25.00`, exit 0.

### s1-happy

Input (`/tmp/csvtotal-qa-r511a/s1-happy.csv`, 25 bytes, 2 lines; `cat -vet`, `$` marks a line end):
```
widget,19.99$
gadget,5.01$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/s1-happy.csv`

stdout:
```
25.00
```
stderr:
```

```
exit: 0

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
