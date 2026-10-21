---
description: Tool scope hygiene - .gitignore does not scope tsc, language servers or IDE indexers; references-only tsconfigs need "files": [], and bulk generated output stays out of the repo or is excluded per tool
globs:
  - "**/tsconfig*.json"
  - "**/jsconfig.json"
  - "**/.gitignore"
  - "**/scripts/**"
  - "**/package.json"
---

# Tool Scope Hygiene

`.gitignore` only scopes git. The TypeScript compiler, language servers, IntelliJ's indexer
and Spotlight walk the directory tree themselves. A directory that is gitignored but sits inside
the repo is still loaded by every tool whose scope covers it.

Observed: a root `tsconfig.json` held only `references`. An eval tool later wrote 22 GB of `.ts`
fixtures into a gitignored `runs/` dir at the repo root. The root project grew to 469,547 files.
A `tsc --lsp` opened for one edit grew to 131 GB, filled swap, and starved the machine. The
config had been harmless for six months; the data dir arrived later.

## THE RULE

- A `tsconfig.json` that only aggregates `references` MUST set `"files": []`. Without `files` or
  `include`, TypeScript includes every `.ts` below the config's directory, gitignored or not.
- A `tsconfig.json` without `files`/`include` at a directory that also holds data, fixtures or
  run output MUST name its sources with `include`.
- A script or tool you add that writes bulk output (eval runs, clones, benchmarks, caches,
  fixtures) MUST write outside the repo, or under a directory every tool already excludes
  (`node_modules`, the build output dir). Adding the dir to `.gitignore` alone is not enough.
- When adding such an output dir inside the repo, exclude it per tool in the same change: the
  owning `tsconfig` (`exclude`), and tell the user to mark it Excluded in IntelliJ.

## CHECK IT

`tsc -p <config> --showConfig` lists the files a project really contains. Count them before
and after the change. For an audit across processes and repos, use the `workspace-health` skill.
