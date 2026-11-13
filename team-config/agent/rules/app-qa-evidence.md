---
description: "Before an evidence-folder `mkdir` or a search with ignore rules off during app QA: create your own output folder without `-p` and never search evidence you did not write"
condition:
  - '\bmkdir\b[^\n]*\bevidence'
  - '"gitignore"\s*:\s*false|--no-ignore|\brg\b[^\n]*\s-u{1,3}\b'
scope: ["tool"]
interruptMode: always
---

# App QA evidence

These clauses apply during app QA, or in a repository with `.omp/app-qa.json`. In any other session this rule does not apply: make the interrupted call again unchanged.

- Create your own output folder with `mkdir` without `-p` in a step of its own, stop when it fails and pick another name, and never pass a driver `--out` below a folder you did not create. A search (`grep`, `rg`, `glob`, `find`, a recursive listing) never covers an evidence folder you did not write: never run it over `.omp/` or `.omo/` as a whole or with ignore rules off (`gitignore: false`, `--no-ignore`, `-u`), and exclude `**/evidence/**` and `**/*-evidence/**` from any search over the whole worktree. In a repository with `.omp/app-qa.json`, read its QA skill before the first search, for the evidence folders it names.
