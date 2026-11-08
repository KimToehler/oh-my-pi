# F1 agent-missing

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), onara desktop app running (pid 24595), no driver session attached; the session's `PATH` has `/opt/homebrew/bin` replaced by `/tmp/app-qa-impl/nospectre-bin`, a folder of links to every entry of `/opt/homebrew/bin` except `spectre`

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
detach: no attached session for this worktree; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
$ d=/tmp/app-qa-impl/nospectre-bin; rm -rf $d; mkdir $d; for f in /opt/homebrew/bin/*; do [ "$(basename "$f")" = spectre ] || ln -s "$f" "$d/"; done
$ NP=$(echo "$PATH" | sed "s|/opt/homebrew/bin|$d|"); PATH="$NP" sh -c 'command -v spectre || echo "spectre: not on PATH"'
spectre: not on PATH
$ PATH="$NP" omp -p --mode json --no-session --max-time 15m "Type 'qa f1 agent check' into the desktop app's chat field and prove that it is there." > /tmp/app-qa-impl/agent-missing.jsonl
omp exit 0
```

The session's capture is `f1/agent-missing-capture.txt` (call arguments, driver output, final report).

## Observation

The session read the team skill and the configuration, searched for the chat field's tag (two `grep` calls), and ran `preflight desktop` once: `FAIL driver: spectre not found` with the pinned-release install hint, screen capture not checked, and the backend on 8080 failing. It stopped there: no attach, type, find or capture, no other driving, and its report names the failed `driver` line with its hint (download the v0.9.0 release, check its sha256, put `spectre` on `PATH`, not brew) and says it did not type the text. 6 calls, all completed; one `ttsr_triggered` event naming `ui-automation-credentials`.

Finding: the first `grep` (pattern for a chat tag, path `.agents;.omp;.omo/rules`) covered `.omp/team-config/evidence/`, onara's committed evidence, which the session did not write; its report says it came across those files there and did not open them. The search returned matching lines from them, which the skill's rule on evidence one did not write does not allow; no credential is in its transcript (the only scan hits are account 1's username after `/Users/`, 70, the login name). The capture scans clean.
