---
description: bun test load order is filesystem readdir order, not CLI argument order
globs:
  - "**/*.test.ts"
  - "**/test-setup.ts"
  - "**/bunfig.toml"
---

# Lesson: bun test load order is filesystem readdir order, not CLI argument order

Recorded: 2026-09-05
Lesson id: bun-test-load-order-is-filesystem-readdi-603a9081414fe456
Lesson hash: 603a9081414fe456

## What went wrong
A handover concluded that 43 cross-file `runtime-fallback` failures were "NOT ordering" and put that in bold as an established fact, costing the next session real time. Its disproof was: "put runtime-fallback FIRST on the command line and the 43 still fail". That experiment proves nothing, because `bun test` does not load files in the order the paths appear on the command line - it walks the filesystem and loads in `readdir` order. Re-running with a byte-identical 13-line probe placed in different directories showed the opposite: the probe poisons `runtime-fallback` from every directory whose `readdir` index is lower than `runtime-fallback`'s, and is harmless from every directory with a higher index. Renaming the suspect directory kept it failing; `cp -R` of the same directory to a later readdir slot made it pass. The failure is purely positional, and the handover's own "loose thread" (why an identical logger mock in `anthropic-context-window-limit-recovery` was harmless) was simply that this directory sorts after `runtime-fallback`.

## Rule for next time
Never conclude a cross-file test-pollution bug is order-independent from a command-line-argument-order experiment. To vary load order in `bun test`, vary the file's position in `readdir` order: place a byte-identical probe file into several directories and compare `fs.readdirSync(parent).indexOf(dir)` against the victim's index, or move/copy the suspect directory to a different slot. Since `readdir` order is filesystem- and machine-dependent, a green suite on one machine is not evidence that such a leak is absent, and any fix must be proven with a probe deliberately positioned BEFORE the victim, not merely present somewhere in the tree.
