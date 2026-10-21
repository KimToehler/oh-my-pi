---
name: workspace-health
description: "Read-only audit of machine memory and dev-tool scope: which processes really hold RAM (incl. compressed/swapped pages RSS hides), runaway language servers and build daemons, TypeScript projects that sweep in gitignored bulk data, large ignored dirs IntelliJ still indexes, worktree piles. Use when RAM/swap is exhausted, the machine is sluggish, a language server or IDE balloons, or for a periodic workspace audit."
---

# Workspace Health

`SKILL_DIR=~/.omp/agent/skills/workspace-health`

## Run

```sh
bun $SKILL_DIR/scripts/workspace-health.ts [repo-dir ...]   # default: git root of the cwd
```

Read-only. It sizes every large gitignored directory with `du`, so a repo with tens of GB of
worktrees takes a minute or two; run it as a background job. Thresholds via env:
`WH_TS_FILE_LIMIT` (20000 files per TS project), `WH_TS_IGNORED_LIMIT` (1000 gitignored files
per TS project), `WH_IGNORED_MB` (500).

## Read the report

1. **Memory**: on macOS the footprint column is `top`'s MEM, which includes compressed and
   swapped pages. RSS (`ps`, Activity Monitor's default column) hides them: a process can show
   9 GB RSS while holding 130 GB. Rank by footprint, never by RSS.
2. **Language servers and build daemons**: anything above 8 GB is a finding. Tie it to the
   repo section below via its command path and working directory (`lsof -a -p <pid> -d cwd`).
3. **Repo**: the cause, not the symptom.
   - `sweeps in N gitignored files`: a TS project an editor or language server loads pulls in
     data git ignores. TypeScript does not read `.gitignore`. Fix the config, then restart the
     server.
   - `note: includes gitignored ...`: small and usually generated code the project imports
     (OpenAPI clients). Not a finding unless it grows.
   - Large ignored directory `not excluded in IntelliJ`: IntelliJ indexes it. Excluding is a
     per-user IDE setting (Mark Directory as > Excluded); propose it, do not edit `.idea/`.
   - Worktree count: each worktree carries its own `node_modules` and build output.

## Fix

| Finding | Fix |
|---|---|
| Root `tsconfig.json` with only `references` | Add `"files": []`. Without `files`/`include`, TypeScript includes every `.ts` below the config's directory. |
| Project config sweeping in a data dir | Add the dir to `exclude`, or narrow `include`. |
| Runaway server still running | Kill it (`kill`, then `kill -9`: a heavily swapped process may not answer SIGTERM). omp's LSP mux respawns servers on demand. |
| Bulk tool output inside the repo | Move it outside the repo, or exclude it per tool (tsconfig, IDE, Spotlight `.metadata_never_index`), not only in `.gitignore`. |
| Stale worktrees | List them; remove only after the user confirms each one is merged and clean (`git worktree remove`). |

Verify a config fix with the same script: the project's file count must drop and the warning
must disappear. Report freed memory from before/after `memory_pressure` output, not estimates.

Never kill IDE or browser processes, delete directories, or remove worktrees without the
user's explicit confirmation.
