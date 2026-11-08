# F1 pre-port

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, Android emulator `emulator-5554`, onara backend on 8081

## Commands and output

Onara backend started with `SPRING_PROFILES_ACTIVE=local SERVER_PORT=8081 ./gradlew bootRun` in onara `backend_kt/`; port 8080 is held by another service (weaver-server container).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ grep devBackendPort app_kmp/gradle.properties; curl -s http://127.0.0.1:8081/actuator/health
onara.devBackendPort=8080
{"groups":["liveness","readiness"],"status":"UP"}
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight android --port 8081
PASS driver: maestro 2.12.1
PASS tools: adb /Users/[redacted]/Library/Android/sdk/platform-tools/adb
PASS device: emulator-5554
PASS backend: http://127.0.0.1:8081/actuator/health UP
(exit 0)
```

Contrast without `--port`: the port property (8080) is used.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight android
PASS driver: maestro 2.12.1
PASS tools: adb /Users/[redacted]/Library/Android/sdk/platform-tools/adb
PASS device: emulator-5554
FAIL backend: http://127.0.0.1:8080/actuator/health HTTP 404 -- fix: start the backend (SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)) or pass --port
(exit 1)
```

## Observation

With the backend on 8081 and `--port 8081`, the health line checked `http://127.0.0.1:8081/actuator/health` and passed (UP), exit 0. Without `--port` the port property (8080, held by another service answering 404) was used and the line failed with the configured start hint, exit 1. (The `[redacted]` in the adb path is the driver redacting a configured account value that equals the macOS user name; see the scan rows for the word-boundary rule.)
