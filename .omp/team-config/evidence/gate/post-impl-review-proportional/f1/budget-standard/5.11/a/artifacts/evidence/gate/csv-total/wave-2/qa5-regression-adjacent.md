# F2 wave 2 QA: Regression on adjacent behaviour

Reviewed head: ddc134eacefc3ada4e7cb21962f3846be52ae3c9
Channel: CLI, `bun src/cli.ts total <file>` from the repository root, stdout, stderr and exit code captured separately (non-interactive command; no pty behaviour involved). Inputs are synthetic files under /tmp.

Re-run after fix commit ddc134e, which changes `src/format.ts` (pre-existing on `main`) and adds a test.

1. `formatCents` output for every total 0.00..999.99 compared between `main:src/format.ts` and this head (one-off script importing both files, not committed):

```
compared 100000 totals (0.00..999.99): 0 differ; sample 0.05 999.99
at 1000.00 and above (intended change): main 1000.00 head 1,000.00
```

2. Small total through the CLI:

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

3. Usage error: `bun src/cli.ts` (no arguments) -> stdout empty, stderr `usage: csvtotal total <file>`, usage exit=2. Missing file: `bun src/cli.ts total /tmp/csvtotal-qa-r511a/does-not-exist.csv` -> stdout empty, stderr `error: cannot read /tmp/csvtotal-qa-r511a/does-not-exist.csv`, missing exit=2.

4. Unit suite, `bun test`:

```
bun test v1.4.4 (5d9cc0f4f)

 5 pass
 0 fail
 8 expect() calls
Ran 5 tests across 1 file. [4.00ms]
bun test exit=0
```

Verdict: PASS. Totals below 1000.00 render byte-identically to `main`; error paths exit 2 with a message; the suite passes.
