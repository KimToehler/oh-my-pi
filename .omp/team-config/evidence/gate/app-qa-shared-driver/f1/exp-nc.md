# F1 exp-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara and weaver worktrees

## Commands and output

Onara: `--expect settings`, a screen the configuration does not map.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/signin-ios.yaml --expect settings; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
flow: screen settings is not in expect.tags of ~/git/onara/.worktrees/qa-shared-f1/.omp/app-qa.json (screens: home, onboarding)
driver exit 2
no maestro test process
(exit 0)
```

Weaver (no `expect` section): `--expect home`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml --expect home; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
flow: --expect needs an expect section in ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json
driver exit 2
no maestro test process
(exit 0)
```

## Observation

Onara `--expect settings` and weaver `--expect home` each exited 2 (the unmapped screen named with the configured screens; weaver's missing `expect` section named), with no Maestro process.
