# F1 min-regression

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

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
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-wBsmXO
out: /tmp/app-qa-impl/f1out/min-regression
sweep: deleted out/2026-11-08_202742/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_202742/maestro.log
sweep: redacted out/2026-11-08_202742/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_202742/signin/logs/maestro.log
screenshot: /tmp/app-qa-impl/f1out/min-regression/signed-in.png
PASS signin 43.7s
(exit 0)
```

The exported screenshot scanned before anyone views it; the run root afterwards.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1out/min-regression; echo "scan exit $?"; ls -d "$TMPDIR"/app-qa-flow-wBsmXO 2>&1
scan exit 0
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa-flow-wBsmXO: No such file or directory
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
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-flow-IJAGhE
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-out-1GVGVj
sweep: deleted out/2026-11-08_202847/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_202847/maestro.log
sweep: redacted out/2026-11-08_202847/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_202847/signin/logs/maestro.log
screenshot: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/onara-qa-out-1GVGVj/signed-in.png
PASS signin 44.4s
(exit 0)
```

The binary-file match on random data: 1000 files of 345000 random bytes (the size of a screenshot), scanned against the onara credentials; the hit lines counted, never printed.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ d=$(mktemp -d /tmp/app-qa-impl/rnd.XXXXXX); for i in $(seq 1 1000); do head -c 345000 /dev/urandom > "$d/r$i.png"; done; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$d" > /tmp/app-qa-impl/rnd-scan.txt 2>&1; echo "scan exit $?"; grep -vc "^credentials:" /tmp/app-qa-impl/rnd-scan.txt; ls "$d" | wc -l; rm -rf "$d"
scan exit 0
0
    1000
(exit 0)
```

## Observation

Onara, iOS sign-in subflow with account 1 through the shared driver: `PASS signin`, the screenshot `signed-in.png` exported to `--out`, scanned clean (exit 0) before viewing, and showing the home screen signed in (viewed by the QA lane: "Angemeldet als …", coach chat, sign-out button); the run root removed. Onara's own driver on the same flow, same precondition: `PASS signin`, the same sweep lines. Same result as onara's own driver. Precondition: the simulator keychain is reset before each run, because the app keeps its session there and Maestro's `clearState` does not clear it; a run on a signed-in keychain fails at the subflow's first wait for the login form, under either driver. An earlier attempt on an app build installed without the entitlements section failed at the expected screen under both drivers (the Keychain token store refused with -34018); the app was rebuilt as onara's `kmp-commands.md` prescribes (`CODE_SIGN_IDENTITY=-`) before the runs recorded here.

The screenshot match no longer depends on chance: the scan of 1000 files of 345000 random bytes (the size of a screenshot) against the onara credentials, whose account 1 username is three letters, hits none (exit 0, 0 hit lines), where the same scan on the earlier F1 head `ba01b61b70` hit 9 and the sweep then deleted a clean screenshot.
