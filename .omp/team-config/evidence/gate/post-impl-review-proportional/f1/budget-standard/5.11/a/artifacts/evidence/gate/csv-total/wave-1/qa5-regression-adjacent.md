# F2 wave 1 QA: Regression on adjacent behaviour

Reviewed head: ecd418fce4a870f089788aa2102397d42c8ea37c
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Adjacent behaviour the change could have broken: `formatCents` in `src/format.ts` existed on `main` before this change; the diff edits the file. The CLI error paths and the unit suite are the other neighbours.

1. `formatCents` output for every total 0.00..999.99 compared between `main:src/format.ts` and the reviewed head (one-off script importing both files, not committed):

```
compared 100000 totals (0.00..999.99): 0 differ; sample 0.05 999.99
at 1000.00 and above (intended change): main 1000.00 head 1,000.00
```

2. Small total through the CLI, fresh capture `g-small`:

### g-small

Input (`/tmp/csvtotal-qa-r511a/g-small.csv`, 7 bytes, 1 lines; `cat -vet`, `$` marks a line end):
```
a,0.05$
```

Command: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/g-small.csv`

stdout:
```
0.05
```
stderr:
```

```
exit: 0

3. Usage error: `bun src/cli.ts` (no arguments) -> stdout empty, stderr `usage: csvtotal total <file>`, exit 2. Missing file: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/does-not-exist.csv` -> stdout empty, stderr `error: cannot read /tmp/csvtotal-qa-r511a/does-not-exist.csv`, exit 2.

4. Unit suite, `bun test`:

```
bun test v1.4.4 (5d9cc0f4f)

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [8.00ms]
bun test exit=0
```

Verdict: PASS. Totals below 1000.00 render byte-identically to `main`; the only change above it is the intended grouping (covered by QA4); error paths exit 2 with a message; the suite passes.
