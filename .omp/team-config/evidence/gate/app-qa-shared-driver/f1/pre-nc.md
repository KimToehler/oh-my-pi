# F1 pre-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree (iOS simulators, backend on 8081) and scratch weaver worktree (Android emulator `emulator-5554`), and the Mac locked for the last two steps

## Commands and output

Maestro removed from the driver's reach: it is not on `PATH`, and `HOME` names an empty directory, so `~/.maestro/bin/maestro` does not exist for the driver; weaver preflight android.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ h=$(mktemp -d); which maestro; ls "$h"; HOME="$h" node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight android; rmdir "$h"
FAIL driver: maestro not found -- fix: curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash
PASS tools: adb ~/Library/Android/sdk/platform-tools/adb
PASS device: emulator-5554
rmdir: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/tmp.WJtFmOpmzg: Directory not empty
(exit 1)
```

The empty `HOME` of the step above afterwards: `adb` wrote `.android` into it (the driver writes nothing there), so it is removed with its content.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ d=$TMPDIR/tmp.WJtFmOpmzg; ls -A "$d"; rm -rf "$d"; ls -d "$d" 2>&1
.android
ls: cannot access '/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//tmp.WJtFmOpmzg': No such file or directory
(exit 2)
```

Two simulators booted (`onara-f1` and a second iPhone 17 Pro), onara preflight ios without `--device` (backend on 8081 healthy).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl list devices booted | grep -c Booted; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios --port 8081
2
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
FAIL device: 2 booted devices (612AB788-087A-408B-ACE1-34BCD68C235D (iPhone 17 Pro), 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A (onara-f1)); pass --device ID -- fix: pass --device ID
PASS backend: http://127.0.0.1:8081/actuator/health UP
(exit 1)
```

Backend stopped: no process listens on 8082 (the onara backend on 8081 is left running for the other rows), onara preflight ios against it.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ lsof -nP -iTCP:8082 -sTCP:LISTEN | wc -l; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios --port 8082
       0
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
FAIL backend: http://127.0.0.1:8082/actuator/health unreachable -- fix: start the backend (SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)) or pass --port
(exit 1)
```

One simulator booted (`onara-f1`); onara preflight ios with `--device` naming the shut-down second iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl list devices | grep 612AB788-087A-408B-ACE1-34BCD68C235D; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios --port 8081 --device 612AB788-087A-408B-ACE1-34BCD68C235D
    iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D) (Shutdown) 
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
FAIL device: 612AB788-087A-408B-ACE1-34BCD68C235D is not booted (booted: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A (onara-f1)) -- fix: pass --device ID
PASS backend: http://127.0.0.1:8081/actuator/health UP
(exit 1)
```

Screen locked by hand (Ctrl+Cmd+Q; `/tmp/app-qa-impl/pre-nc-locked.sh` waited for `CGSSessionScreenIsLocked`, locked seen 21:35:46): onara preflight desktop.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
FAIL backend: http://127.0.0.1:8080/actuator/health HTTP 404 -- fix: start the backend (SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)) or pass --port
(exit 1)
```

Screen still locked: weaver preflight desktop.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
(exit 1)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `preflight: denied screen capture`
- `preflight: other driver version`
- `preflight: unparseable maestro version line`
- `preflight: a 2xx health answer passes only when a JSON status, if present, is exactly UP`
- `preflight: two usable devices`

## Observation

Each failing check printed its own line with the fix and the command exited 1: Maestro off `PATH` and `~/.maestro/bin` out of reach (weaver preflight android with `HOME` an empty directory: `FAIL driver: maestro not found` with the install command, the adb and device lines still pass); two simulators booted (onara preflight ios: `FAIL device: 2 booted devices (...); pass --device ID`); backend stopped (onara preflight ios against 8082, where nothing listens: `FAIL backend ... unreachable` with the start hint); `--device` naming a simulator that is shut down (`FAIL device: ... is not booted` listing the booted one). The empty `HOME` gained `.android`, written by `adb`, not by the driver; it was removed afterwards. Permission denied, other driver versions and the 2xx bodies are covered by the suite's tests listed below. Screen locked (run last, after every other GUI row): onara and weaver preflight desktop each print `FAIL screen: locked -- fix: unlock the screen` and exit 1, with the driver and screen-capture lines still passing; onara's backend line also fails there because 8080 belongs to another service, which `pre-port` covers.
