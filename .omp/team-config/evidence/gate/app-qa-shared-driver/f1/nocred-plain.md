# F1 nocred-plain

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, Android emulator `emulator-5554` (weaver app `eu.weaver.app`)

## Commands and output

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight android
PASS driver: maestro 2.12.1
PASS tools: adb ~/Library/Android/sdk/platform-tools/adb
PASS device: emulator-5554
(exit 0)
```

The scratch flow, run with `MAESTRO_DEV_PW` exported by the shell (a dummy value).

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat qa-f1/plain.yaml; MAESTRO_DEV_PW=qa-f1-exported-value node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml
appId: eu.weaver.app
---
- launchApp
- assertVisible: "Needs you"
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-rQYRmN
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-out-ZcnXFZ
sweep: deleted out/2026-11-08_162028/plain/commands.json
PASS plain 2.3s
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: credentials without a credentials section carry none, even when the caller exports them`

## Observation

Weaver (no `credentials` section), Android: the scratch flow launching `eu.weaver.app` and asserting `Needs you`, run with `MAESTRO_DEV_PW` exported by the shell: `PASS plain`, exit 0. That neither `MAESTRO_DEV_USER` nor `MAESTRO_DEV_PW` reaches Maestro is *test* `flow: credentials without a credentials section carry none, even when the caller exports them` in `f1/qa-test-log.txt` (the fake Maestro records its environment).
