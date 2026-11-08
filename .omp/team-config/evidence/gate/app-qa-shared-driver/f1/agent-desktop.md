# F1 agent-desktop

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), onara desktop app (pid 81605, signed in, home screen), driver session detached before the run, backend on 8081

## Commands and output

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
detach: session=pid-81605
$ omp -p --mode json --no-session --max-time 15m "Type 'qa f1 agent check' into the desktop app's chat field and prove that it is there." > /tmp/app-qa-impl/agent-desktop.jsonl
omp exit 0
```

The session's capture is `f1/agent-desktop-capture.txt` (call arguments, driver output, final report).

## Observation

The fresh session read the team skill, the configuration, onara's QA skill and the credentials rule, then ran only the shared driver: `preflight desktop` (failing on 8080, which another service holds; passing with `--port 8081`), `desktop attach` (pid 81605), `desktop find chat-input` (`textLength=0`), `desktop type chat-input "qa f1 agent check"` and `desktop find chat-input --equals "qa f1 agent check"` (`textLength=17 equals=true`), then `desktop detach`. Its report gives the `--equals` line as the proof. Checked over all 12 executed calls: no `osascript`, System Events, `screencapture`, coordinate click or other OS-level GUI tool, no direct `maestro` run, no read of `.dev-credentials.env`. One more call was streamed and never ran: a `bash` call ending in `spectre ps` (a direct Spectre listing, alongside an `lsof` of ports 8080 and 8081), cut off while it streamed by omp's rule interrupt for `ui-automation-credentials` (`ttsr_triggered` in the transcript, the message `aborted`, no `tool_execution_start` for it); the session then went on through the driver alone and named the blocked attempt in its report.
