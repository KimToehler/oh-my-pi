# F1 s2-malformed: Malformed price is rejected with its line number

- Change: csv-total (task 3.1)
- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
- Captured: 2026-11-03T09:47:36+01:00
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s2-malformed.csv` (cwd = repo root; input file in a temp dir)

## Input file (11 bytes, 1 lines)

```
widget,abc
```

Input repr: `'widget,abc\n'`

## Observed

- Exit code: `2`
- stdout repr: `''`
- stderr repr: `'error: line 1: malformed price\n'`

## Probe

- Expected: stderr names line 1, stdout empty (no total), exit 2
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/cents.ts`: `return null` → `return 0` (a malformed price is counted as zero cents (spec negative control))
- Exit code: `0`
- stdout repr: `'0.00\n'`
- stderr repr: `''`
- Probe result on mutant: NO MATCH
