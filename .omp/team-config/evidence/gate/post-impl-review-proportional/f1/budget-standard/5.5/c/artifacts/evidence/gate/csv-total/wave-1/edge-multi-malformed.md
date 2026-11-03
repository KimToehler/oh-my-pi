# F2 wave 1 edge-multi-malformed: Several malformed lines among valid and blank lines

- Change: csv-total (F2 wave 1, Phase 1 QA)
- Head: `86623019d0decf13b0faad42b9b12368448797a2` (working tree clean at capture: yes)
- Captured: 2026-11-03T09:51:51+01:00
- Runtime: bun 1.4.4
- Scenario: riskiest edge for `Price lines are parsed strictly`: malformed price (`bad,abc`) and a line without a comma (`nocomma`) among valid and blank lines; every malformed line is named, blank lines are ignored and do not shift numbering, no total is printed

## Cases on head

### mixed file

- Command: `bun src/cli.ts total edge.csv` (cwd = repo root; input file in a temp dir)
- Input repr: `'widget,19.99\nbad,abc\n\ngadget,5.01\nnocomma\n'`
- Exit code: `2`
- stdout repr: `''`
- stderr repr: `'error: lines 2, 5: malformed price\n'`
- Case probe: MATCH

## Probe

- Expected: stderr is exactly `error: lines 2, 5: malformed price`, stdout empty (no total), exit 2
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/price.ts`: `${bad.join(", ")}` → `${bad[0]}` (names only the first malformed line)
- mixed file: exit `2`, stdout `''`, stderr `'error: lines 2: malformed price\n'`, case probe NO MATCH
- Probe result on mutant: NO MATCH
