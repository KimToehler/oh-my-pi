# F1 agent-legacy

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree with `.omp/app-qa.json` moved aside for the session (restored afterwards); onara desktop app (pid 24595) and backend on 8081 running

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

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

The session read the team skill, found no `.omp/app-qa.json`, located onara's own driver and ran `node app_kmp/scripts/qa.mjs preflight desktop` (exit 1 on 8080) and `node app_kmp/scripts/qa.mjs preflight desktop --port 8081` (exit 0); the remaining calls are `lsof`, `pgrep`, `ps` and `grep` on ports, the running processes and the backend port setting. It never ran the shared driver (`~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` is in no call) and reports the app ready with `--port 8081`, saying it used the repository's own driver because the configuration is missing. 14 calls, all completed; one `ttsr_triggered` event naming `ui-automation-credentials`.

Finding: its fourth call, `grep` for `preflight` with a path list including `.omp`, covered `.omp/team-config/evidence/`, onara's committed evidence, which it did not write; its report names this as a slip (only earlier preflight lines returned, nothing opened or changed). The transcript's scan hits are account 1's username, which is this Mac's login name: 152 after `/Users/` and 34 in the USER column of its `lsof` output; no other configured value. The capture scans clean.
