# F1 s3-cents: Ten lines of x,0.10 add exactly

- Change: csv-total (task 3.1)
- Head: `ec36fb4e6026b5ff34806a2a261417f57968899a` (working tree clean at capture)
- Captured: 2026-11-03T09:47:36+01:00
- Runtime: bun 1.4.4
- Command: `bun src/cli.ts total s3-cents.csv` (cwd = repo root; input file in a temp dir)

## Input file (70 bytes, 10 lines)

```
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
x,0.10
```

Input repr: `'x,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\nx,0.10\n'`

## Observed

- Exit code: `0`
- stdout repr: `'1.00\n'`
- stderr repr: `''`

## Probe

- Expected: stdout is exactly `1.00`, stderr empty, exit 0
- Probe result on head: MATCH

## Negative control (probe can go red)

- Mutation, applied to a temp copy of `src/` only: `src/format.ts`: `return `${head}.${String(rest).padStart(2, "0")}`` → `return String(cents / 100)` (formatter prints the float dollars (`1`, spec negative control))
- Exit code: `0`
- stdout repr: `'1\n'`
- stderr repr: `''`
- Probe result on mutant: NO MATCH
