# F1 cred-missing

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree

## Commands and output

A scratch credentials file `/tmp/app-qa-impl/creds-no-pw2.env` (dummy values) without account 2's password key; only its keys shown.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cut -d= -f1 /tmp/app-qa-impl/creds-no-pw2.env
DEV_TEST_USERNAME
DEV_TEST_PASSWORD
DEV_TEST_USERNAME_2
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/signin-ios.yaml --account 2 --credentials /tmp/app-qa-impl/creds-no-pw2.env; echo "driver exit $?"; pgrep -fl "maestro.cli.AppKt test" || echo "no maestro test process"
credentials: /tmp/app-qa-impl/creds-no-pw2.env
flow: DEV_TEST_PASSWORD_2 is missing in /tmp/app-qa-impl/creds-no-pw2.env
driver exit 2
no maestro test process
(exit 0)
```

## Observation

Onara: `--credentials` naming a scratch file (dummy values) that lacks `DEV_TEST_PASSWORD_2`, `--account 2`: the driver printed the file it read and `DEV_TEST_PASSWORD_2 is missing in <file>`, exit 2; no Maestro process ran.
