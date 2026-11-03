# F2 wave 1 s5-large: Total of 1000 or more on the merged head

- Change: csv-total (F2 wave 1, Phase 1 QA)
- Head: `86623019d0decf13b0faad42b9b12368448797a2` (working tree clean at capture: yes)
- Captured: 2026-11-03T09:51:36+01:00
- Runtime: bun 1.4.4
- Scenario: `big,1234.50` prints a total whose digits are `1234.50`, grouping separators allowed (tasks.md 3.1 s5); re-run because the merge of main (1e88cd0) changed `groupThousands`

## Cases on head

### big,1234.50

- Command: `bun src/cli.ts total s5-large.csv` (cwd = repo root; input file in a temp dir)
- Input repr: `'big,1234.50\n'`
- Exit code: `0`
- stdout repr: `'1,234.50\n'`
- stderr repr: `''`
- Case probe: MATCH

## Probe

- Expected: stdout with `,` removed is exactly `1234.50`, stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `return whole.toLocaleString("en-US")` → `return (whole % 1000).toLocaleString("en-US")` (thousands grouping drops the leading group)
- big,1234.50: exit `0`, stdout `'234.50\n'`, stderr `''`, case probe NO MATCH
- Probe result on mutant: NO MATCH
