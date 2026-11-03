# F1 s1-happy: Valid lines are summed

- Change: csv-total (task 3.1)
- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
- Captured: 2026-11-03T09:47:36+01:00
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s1-happy.csv` (cwd = repo root; input file in a temp dir)

## Input file (25 bytes, 2 lines)

```
widget,19.99
gadget,5.01
```

Input repr: `'widget,19.99\ngadget,5.01\n'`

## Observed

- Exit code: `0`
- stdout repr: `'25.00\n'`
- stderr repr: `''`

## Probe

- Expected: stdout is exactly `25.00`, stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/price.ts`: `total + price.cents` → `total + 0` (sumCents ignores each line's cents)
- Exit code: `0`
- stdout repr: `'0.00\n'`
- stderr repr: `''`
- Probe result on mutant: NO MATCH
