# F2 wave 1 regression-cli-errors: CLI usage and unreadable-file exits, plus unit suite

- Change: csv-total (F2 wave 1, Phase 1 QA)
- Head: `86623019d0decf13b0faad42b9b12368448797a2` (working tree clean at capture: yes)
- Captured: 2026-11-03T09:51:51+01:00
- Runtime: bun 1.4.4
- Scenario: adjacent behaviour the change or the merge could break: wrong command and missing file exit 2 with a message and no total; the unit suite (sub-1000 formatting, parsing) stays green on the merged head

## Cases on head

### no arguments

- Command: `bun src/cli.ts` (cwd = repo root; no input file)
- Exit code: `2`
- stdout repr: `''`
- stderr repr: `'usage: csvtotal total <file>\n'`
- Case probe: MATCH

### unknown command

- Command: `bun src/cli.ts sum x.csv` (cwd = repo root; `x.csv` is never read)
- Exit code: `2`
- stdout repr: `''`
- stderr repr: `'usage: csvtotal total <file>\n'`
- Case probe: MATCH

### missing file

- Command: `bun src/cli.ts total does-not-exist.csv` (cwd = repo root; the file does not exist)
- Exit code: `2`
- stdout repr: `''`
- stderr repr: `'error: cannot read does-not-exist.csv\n'`
- Case probe: MATCH

## Probe

- Expected: no arguments and unknown command: stderr `usage: csvtotal total <file>`, stdout empty, exit 2; missing file: stderr `error: cannot read does-not-exist.csv`, stdout empty, exit 2
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/cli.ts`: `console.error(`error: cannot read ${file}`)
  process.exit(2)` → `console.error(`error: cannot read ${file}`)
  process.exit(0)` (unreadable file exits 0)
- no arguments: exit `2`, stdout `''`, stderr `'usage: csvtotal total <file>\n'`, case probe MATCH
- unknown command: exit `2`, stdout `''`, stderr `'usage: csvtotal total <file>\n'`, case probe MATCH
- missing file: exit `0`, stdout `''`, stderr `'error: cannot read does-not-exist.csv\n'`, case probe NO MATCH
- Probe result on mutant: NO MATCH
## Unit suite on head

- Command: `bun test` (cwd = repo root)
- Exit code: `0`

```
bun test v1.4.4 (5d9cc0f4f)

test/csvtotal.test.ts:
(pass) sums valid lines [0.24ms]
(pass) ten lines of 0.10 total 1.00 [0.02ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [4.00ms]
```
