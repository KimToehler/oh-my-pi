# F1 min-regression

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, iOS simulator `onara-f1`, backend on 8081

## Commands and output

Precondition of onara's sign-in subflow (the app shows its login entry): the simulator keychain, where the app keeps its session and which Maestro's `clearState` leaves alone, is reset.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl keychain 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A reset; echo "keychain reset exit $?"
keychain reset exit 0
(exit 0)
```

A scratch flow (untracked, `qa-f1/signin.yaml`): a fresh launch with cleared state, onara's iOS sign-in subflow, a screenshot named `signed-in` of the screen it lands on; account 1 and expected screen `home` (the configured defaults). The app is a Debug build of the scratch onara worktree, ad hoc signed as `kmp-commands.md` prescribes, against the backend on 8081.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cat qa-f1/signin.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/signin.yaml --out /tmp/app-qa-impl/f1out/min-regression
appId: eu.onara.app.kmp
---
- launchApp:
    clearState: true
- runFlow: ../app_kmp/maestro/signin-ios.yaml
- takeScreenshot: signed-in
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-BRh6Cj
out: /tmp/app-qa-impl/f1out/min-regression
sweep: deleted out/2026-11-08_163206/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_163206/maestro.log
sweep: redacted out/2026-11-08_163206/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_163206/signin/logs/maestro.log
screenshot: /tmp/app-qa-impl/f1out/min-regression/signed-in.png
PASS signin 41.8s
(exit 0)
```

The exported screenshot scanned before anyone views it; the run root afterwards.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1out/min-regression; echo "scan exit $?"; ls -d "$TMPDIR"/app-qa-flow-BRh6Cj 2>&1
scan exit 0
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa-flow-BRh6Cj: No such file or directory
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 1)
```

Comparison: onara's own driver on the same flow, same precondition.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl keychain 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A reset; echo "keychain reset exit $?"
keychain reset exit 0
(exit 0)
```

Onara's own driver (`app_kmp/scripts/qa.mjs` of the scratch onara worktree), its defaults (account 1, `home`).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node app_kmp/scripts/qa.mjs flow ios qa-f1/signin.yaml
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-flow-C4TOPr
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-out-0KtJJ0
sweep: deleted out/2026-11-08_163331/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_163331/maestro.log
sweep: redacted out/2026-11-08_163331/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_163331/signin/logs/maestro.log
screenshot: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-out-0KtJJ0/signed-in.png
PASS signin 40.7s
(exit 0)
```

## Observation

Onara, iOS sign-in subflow with account 1 through the shared driver: `PASS signin`, the screenshot `signed-in.png` exported to `--out`, scanned clean (exit 0) before viewing, and showing the home screen signed in (viewed by the QA lane: "Angemeldet als …", coach chat, sign-out button); the run root removed. Onara's own driver on the same flow, same precondition: `PASS signin`, the same sweep lines. Same result as onara's own driver. Precondition: the simulator keychain is reset before each run, because the app keeps its session there and Maestro's `clearState` does not clear it; a run on a signed-in keychain fails at the subflow's first wait for the login form, under either driver. An earlier attempt on an app build installed without the entitlements section failed at the expected screen under both drivers (the Keychain token store refused with -34018); the app was rebuilt as onara's `kmp-commands.md` prescribes (`CODE_SIGN_IDENTITY=-`) before the runs recorded here.

A first attempt on this head, same precondition, failed: the sweep deleted the exported `signed-in.png` (`sweep: deleted out/2026-11-08_162950/signin/takeScreenshot/signed-in.png`, `flow: screenshot signed-in.png removed by the sweep`, `FAIL signin 42s: named screenshots not exported`, exit 1); nothing was exported, so no image was seen. The run above, unchanged, passed. Onara's own driver's screenshot of the same screen scanned clean, and so did all 17 screenshots on disk from this F1. The scan of 1000 files of 345000 random bytes (the size of a screenshot) from `/dev/urandom` hit 9: the binary-file match of a configured value (account 1's username is three letters, matched where no ASCII letter or digit borders it) occurs by chance in compressed image data in about 1 in 100 screenshots of that size, and the sweep then deletes a clean screenshot and fails the run. The failure is on the safe side (no `PASS`, the file named as removed), and the rerun passes; it is reported as an open finding with this row.
