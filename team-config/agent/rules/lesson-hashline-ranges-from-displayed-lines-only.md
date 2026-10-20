---
description: Hashline edits - take every range from lines the latest read displayed, end the body exactly at the range end, never stack many scattered PUTs on one file
globs:
  - "**/*"
---

# Lesson: Hashline ranges come from displayed lines, and a body never runs past its range

Recorded: 2026-10-19

## What went wrong
1. One `edit` call carried nine PUTs across a 206-line term table, four of them against lines the latest
   read had not shown in full. Several bodies ended with the opener of the *next* block (`ACL_RECONSTRUCTION to
   listOf(`, `ANKLE_SPRAIN to listOf(`, `HIP_OSTEOARTHRITIS to listOf(`) while the range stopped one line earlier,
   so the original opener survived beside the new one: duplicated keys, file no longer parsed.
2. Recovery repeated the class: the follow-up `PUT 31.=31` used a line number derived from content I had just
   written myself instead of a fresh read, and overwrote the `KNEE` enum entry instead of `BACK`.
The tool warned both times ("boundary echo", "no longer parses"); the file had to be rewritten whole.

## Rule for next time
- Every range endpoint comes from a line the **latest** read or edit response displayed. Line numbers computed
  from your own new content, or from a read before an earlier edit, are guesses: re-read first.
- A body replaces exactly `N..M`. If the body's last line is the text of line `M+1`, the range is wrong:
  either extend the range to `M+1` or drop that line from the body.
- More than ~3 scattered changes in one structured literal (map, enum, table): use `xd://ast_edit`, or
  `write` the whole file and prove it with `git diff --stat` + a content diff of only the intended lines.
- On a "no longer parses" or "boundary echo" warning: stop, re-read the touched region, fix with one
  correcting edit. Do not chain further numbered edits onto a broken file.
