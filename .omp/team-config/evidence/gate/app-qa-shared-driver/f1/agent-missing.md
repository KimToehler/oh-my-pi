# F1 agent-missing

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); omp and team config deployed from this head.

Surface: scratch onara worktree (configuration present), onara desktop app running (pid 81605), no driver session attached; the session's `PATH` has `/opt/homebrew/bin` replaced by `/tmp/app-qa-impl/nospectre-bin`, a folder of links to every entry of `/opt/homebrew/bin` except `spectre`

## Commands and output

```
$ d=/tmp/app-qa-impl/nospectre-bin; rm -rf $d; mkdir $d; for f in /opt/homebrew/bin/*; do [ "$(basename "$f")" = spectre ] || ln -s "$f" "$d/"; done
$ NP=$(echo "$PATH" | sed "s|/opt/homebrew/bin|/tmp/app-qa-impl/nospectre-bin|"); PATH="$NP" sh -c 'command -v spectre || echo "spectre: not on PATH"'
spectre: not on PATH
$ PATH="$NP" omp -p --mode json --no-session --max-time 15m "Type 'qa f1 agent check' into the desktop app's chat field and prove that it is there." > /tmp/app-qa-impl/agent-missing.jsonl
omp exit 0
```

The session's capture is `f1/agent-missing-capture.txt` (call arguments, driver output, final report).

## Observation

The fresh session read the team skill, the configuration and onara's QA skill, ran the shared driver's `preflight desktop` once (exit 1: `FAIL driver: spectre not found` with the download, checksum and `PATH` hint, `FAIL screen capture: not checked, spectre not found`, and the 8080 backend line), and stopped there: 6 calls, the last of them that preflight; no attach, type, find or capture, no OS-level GUI tool, no direct Spectre. Its report quotes the failed lines with their hints and says it stopped because a preflight check failed.
