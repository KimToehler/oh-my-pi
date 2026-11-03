# F1 s5-large: Total of 1000 or more

- Change: csv-total (task 3.1)
- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
- Captured: 2026-11-03T09:47:37+01:00
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s5-large.csv` (cwd = repo root; input file in a temp dir)

## Input file (12 bytes, 1 lines)

```
big,1234.50
```

Input repr: `'big,1234.50\n'`

## Observed

- Exit code: `0`
- stdout repr: `'1234.50\n'`
- stderr repr: `''`

## Probe

- Expected: stdout digits are `1234.50` (grouping separators allowed), stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `return String(whole)` → `return String(whole % 1000)` (thousands grouping drops the leading group)
- Exit code: `0`
- stdout repr: `'234.50\n'`
- stderr repr: `''`
- Probe result on mutant: NO MATCH
