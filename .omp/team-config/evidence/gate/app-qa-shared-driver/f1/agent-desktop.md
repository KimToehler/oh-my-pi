# F1 agent-desktop

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), onara desktop app (pid 24595, signed in, home screen, `chat-input` empty), driver session detached before the run, backend on 8081

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
detach: session=pid-24595
$ omp -p --mode json --no-session --max-time 15m "Type 'qa f1 agent check' into the desktop app's chat field and prove that it is there." > /tmp/app-qa-impl/agent-desktop.jsonl
omp exit 0
```

The session's capture is `f1/agent-desktop-capture.txt` (call arguments, driver output, final report).

## Observation

The fresh session read the team skill (`skill://app-qa-drivers`), the configuration and onara's QA skill, then ran only the shared driver: `preflight desktop` (failing on 8080, which another service holds; passing with `--port 8081`), `desktop attach` (pid 24595), `desktop find chat-input` (`textLength=0`), `desktop type chat-input "qa f1 agent check"` with `desktop find chat-input --equals "qa f1 agent check"` (`textLength=17 equals=true`), and `desktop detach`. Its report gives the `equals=true` find as the proof. 11 calls, all completed; none uses OS-level GUI scripting or a capture tool (no `osascript`, `cliclick`, System Events, `screencapture`), runs Maestro, or touches a credentials file. The session's JSON output holds one `ttsr_triggered` event naming `ui-automation-credentials`, raised when it read the skill. The transcript scanned clean apart from home-directory paths: its only scan hits are account 1's username after `/Users/` (231, counted by the QA lane without printing them; that username is this Mac's login name, as in row `cred-acc2`); the capture writes the home directory as `~` and scans clean.
