# F1 s4-empty: Empty file

- Change: csv-total (task 3.1)
- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
- Captured: 2026-11-03T09:47:36+01:00
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s4-empty.csv` (cwd = repo root; input file in a temp dir)

## Input file (0 bytes, 0 lines)

```
```

Input repr: `''`

## Observed

- Exit code: `0`
- stdout repr: `'0.00\n'`
- stderr repr: `''`

## Probe

- Expected: stdout is exactly `0.00`, stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `String(rest).padStart(2, "0")` → `String(rest)` (formatter drops the cents zero-padding)
- Exit code: `0`
- stdout repr: `'0.0\n'`
- stderr repr: `''`
- Probe result on mutant: NO MATCH
