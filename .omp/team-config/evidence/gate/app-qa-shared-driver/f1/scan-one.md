# F1 scan-one

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree

## Commands and output

`/tmp/app-qa-impl/scan/scan-one` holds `clean.log` (a plain line) and `leak.log` (account 1's password, written by a kernel script that prints nothing).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ stat -f "%z %Sm %N" /tmp/app-qa-impl/scan/scan-one/*; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-one
11 Nov  8 16:08:52 2026 /tmp/app-qa-impl/scan/scan-one/clean.log
15 Nov  8 16:08:52 2026 /tmp/app-qa-impl/scan/scan-one/leak.log
/tmp/app-qa-impl/scan/scan-one/leak.log
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 1)
```

## Observation

Onara: `scan` of a folder holding `clean.log` and `leak.log` (account 1's password) printed only `leak.log`'s path on stdout and exited 1; `clean.log` is not named and no value is printed. Its stderr names the credentials file it read (the username in the home path redacted), as the suite's scan tests pin (`scan: a file with the account 2 password is a hit and the value is never printed` asserts that stderr line).
