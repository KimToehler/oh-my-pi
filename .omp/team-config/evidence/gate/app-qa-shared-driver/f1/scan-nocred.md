# F1 scan-nocred

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

`/tmp/app-qa-impl/scan/scan-nocred` holds `clean.log` and `token.log` (a synthetic JWT, no real token).

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ stat -f "%z %Sm %N" /tmp/app-qa-impl/scan/scan-nocred/*; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-nocred
11 Nov  8 16:08:52 2026 /tmp/app-qa-impl/scan/scan-nocred/clean.log
78 Nov  8 16:08:52 2026 /tmp/app-qa-impl/scan/scan-nocred/token.log
/tmp/app-qa-impl/scan/scan-nocred/token.log
(exit 1)
```

## Observation

Weaver (no `credentials` section): `scan` of a folder holding `clean.log` and `token.log` (a synthetic JWT) printed only `token.log`'s path and exited 1; nothing on stderr (no credentials file is read).
