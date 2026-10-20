---
description: Bash 3.2 strict-mode portability for pipelines and empty arrays
globs:
  - "**/scripts/**/*.sh"
  - "*.sh"
---

# Lesson: Avoid early-exit pipelines and raw empty arrays in Bash 3.2

Recorded: 2026-10-05
Lesson id: avoid-early-exit-pipelines-and-raw-empty-bd11870a99469fc2
Lesson hash: bd11870a99469fc2

## What went wrong
Rolling deploy used `docker logs ... | grep -q` under `pipefail`, so a large producer could exit 141 after grep found an early match and make detection false. It also expanded empty arrays as `"${arr[@]}"` under `set -u`, which Bash 3.2 treats as unbound.

## Rule for next time
In Bash 3.2 strict-mode scripts, capture large producer output before matching or use a stdin-draining matcher; audit out `grep -q`, `head`, and `read` early-exit pipelines. Expand possibly-empty arrays with `${arr[@]+"${arr[@]}"}` or guard on length, and test both paths under `/bin/bash`.
