# F1 cred-acc2

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, iOS simulator `onara-f1`, backend on 8081, local database `onara-pg`

## Commands and output

Account 2's profile reset in the local database with onara's script (`--reset-only`), then the simulator keychain reset (the sign-in subflow's precondition, see `min-regression`).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ app_kmp/scripts/maestro-onboarding.sh --reset-only; echo "reset exit $?"; xcrun simctl keychain 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A reset; echo "keychain reset exit $?"
user_consent deleted: 1
user_preferences deleted: 1
user_identity cleared: 1
maestro-onboarding: account 2 profile reset
reset exit 0
keychain reset exit 0
(exit 0)
```

The scratch sign-in flow with `--account 2 --expect onboarding`; meanwhile a background poller writes `ps -axww` of every process to `/tmp/app-qa-impl/ps-acc2.txt` three seconds after Maestro's test process appears.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cat qa-f1/signin.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/signin.yaml --account 2 --expect onboarding --out /tmp/app-qa-impl/f1out/cred-acc2
appId: eu.onara.app.kmp
---
- launchApp:
    clearState: true
- runFlow: ../app_kmp/maestro/signin-ios.yaml
- takeScreenshot: signed-in
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-2f3aMD
out: /tmp/app-qa-impl/f1out/cred-acc2
sweep: deleted out/2026-11-08_163643/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_163643/maestro.log
sweep: redacted out/2026-11-08_163643/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_163643/signin/logs/maestro.log
screenshot: /tmp/app-qa-impl/f1out/cred-acc2/signed-in.png
PASS signin 41.2s
(exit 0)
```

The `ps` snapshot taken during the run (Maestro's test process in it) and the exported screenshot, each scanned for every configured account's username and password.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ grep -c "maestro.cli.AppKt test" /tmp/app-qa-impl/ps-acc2.txt; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/ps-acc2.txt; echo "scan ps exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1out/cred-acc2; echo "scan out exit $?"
1
/tmp/app-qa-impl/ps-acc2.txt
scan ps exit 1
scan out exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

Account 1's username equals this Mac's login name, so the whole snapshot is a hit through every `/Users/<name>` path (the QA lane counted: all hits are account 1's username after `/Users/` or in another process's name, none of account 2's username or of either password). Maestro's processes alone, with the home directory written as `~`, scanned again.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ grep -i maestro /tmp/app-qa-impl/ps-acc2.txt | sed "s|$HOME|~|g" > /tmp/app-qa-impl/ps-acc2-maestro.txt; wc -l < /tmp/app-qa-impl/ps-acc2-maestro.txt; grep -c "maestro.cli.AppKt test" /tmp/app-qa-impl/ps-acc2-maestro.txt; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/ps-acc2-maestro.txt; echo "scan maestro ps exit $?"
       3
1
scan maestro ps exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: credentials only in the environment, never in argv`

## Observation

Account 2's profile reset by onara's `maestro-onboarding.sh --reset-only` (exit 0). The iOS sign-in subflow with `--account 2 --expect onboarding` through the shared driver: `PASS signin`; the exported `signed-in.png`, scanned clean before viewing, shows onara's onboarding welcome (viewed by the QA lane: "Willkommen bei Onara", "Loslegen"). A `ps -axww` snapshot taken while Maestro's test process ran: Maestro's processes (3 lines, the `maestro.cli.AppKt test` line among them) scan clean for every configured username and password. The whole snapshot is a scan hit only because account 1's username is this Mac's login name, so every `/Users/<name>` path in any process matches; the QA lane counted the hits without printing them: all 1075 are account 1's username, 1071 after `/Users/` and 4 inside another process's name or arguments, none is account 2's username or either password.
