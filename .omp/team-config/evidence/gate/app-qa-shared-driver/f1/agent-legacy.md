# F1 agent-legacy

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree with `.omp/app-qa.json` moved aside for the session (restored afterwards)

## Commands and output

```
$ mv .omp/app-qa.json /tmp/app-qa-impl/onara-app-qa.json.aside && ls .omp/
plans
team-config
$ omp -p --mode json --no-session --max-time 10m "Run the desktop QA preflight for this app and tell me whether the desktop app is ready to be driven." > /tmp/app-qa-impl/agent-legacy.jsonl
omp exit 0
$ mv /tmp/app-qa-impl/onara-app-qa.json.aside .omp/app-qa.json && ls .omp/
app-qa.json
plans
team-config
```

The session's capture is `f1/agent-legacy-capture.txt` (call arguments, driver output, final report).

## Observation

The fresh session read the team skill `app-qa-drivers`, checked for `.omp/app-qa.json` (absent), read onara's own QA skill and ran `node app_kmp/scripts/qa.mjs preflight desktop` (failing on 8080, which another service holds) and again with `--port 8081` (all four lines pass). No call runs the shared driver `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` (0 of 9 calls). Its report says why it used the repository's own driver (no `.omp/app-qa.json`) and gives each preflight line with the fix for the failing port.
