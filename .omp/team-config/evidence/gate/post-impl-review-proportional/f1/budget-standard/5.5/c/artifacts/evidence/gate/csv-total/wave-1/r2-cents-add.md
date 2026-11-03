# F2 wave 1 r2-cents-add: Cents add exactly

- Change: csv-total (F2 wave 1, Phase 1 QA)
- Head: `86623019d0decf13b0faad42b9b12368448797a2` (working tree clean at capture: yes)
- Captured: 2026-11-03T09:51:36+01:00
- Runtime: bun 1.4.4
- Scenario: spec `Totals are exact in cents` / Scenario `Cents add exactly`: `a,0.10` and `b,0.20` print `0.30` (missing from the reused F1 matrix)

## Cases on head

### a,0.10 + b,0.20

- Command: `bun src/cli.ts total r2.csv` (cwd = repo root; input file in a temp dir)
- Input repr: `'a,0.10\nb,0.20\n'`
- Exit code: `0`
- stdout repr: `'0.30\n'`
- stderr repr: `''`
- Case probe: MATCH

## Probe

- Expected: stdout is exactly `0.30`, stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/price.ts`: `total + price.cents, 0)` → `total + price.cents / 100, 0) * 100` (sums float dollars instead of integer cents)
- a,0.10 + b,0.20: exit `0`, stdout `'0.30.000000000000004\n'`, stderr `''`, case probe NO MATCH
- Probe result on mutant: NO MATCH
