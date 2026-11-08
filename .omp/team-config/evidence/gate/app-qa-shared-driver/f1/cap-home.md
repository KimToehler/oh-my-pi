# F1 cap-home

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ rm -rf /tmp/app-qa-impl/f1caps/cap-home; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-home
capture: /tmp/app-qa-impl/f1caps/cap-home/home.png
capture: /tmp/app-qa-impl/f1caps/cap-home/home.json
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls -l /tmp/app-qa-impl/f1caps/cap-home | awk 'NR>1 {print $5, $9}'; jq -r ".nodes? // empty | length" /tmp/app-qa-impl/f1caps/cap-home/home.json; jq -r '[.. | objects | .testTag? // empty] | group_by(.) | map("\(.[0]) \(length)") | join(", ")' /tmp/app-qa-impl/f1caps/cap-home/home.json; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1caps/cap-home; echo "scan exit $?"
8665 home.json
56040 home.png
15
chat 1, chat-input 1, chat-send 1, display-name 1, home 1, jobs 1, jobs-empty 1, jobs-refresh 1, sign-out 1, snackbar 1
scan exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

## Observation

`desktop capture home`: `home.png` and `home.json` written into the new `--out` folder, exit 0, and the folder scans clean. The QA lane viewed `home.png`: the onara home screen ("Signed in as ...", Running generations, Coach chat with the typed text, Logout). `home.json` holds a 15-node tree with the home screen's tags (`home`, `chat`, `chat-input`, `sign-out`, ...). Files kept outside the evidence folder (`/tmp/app-qa-impl/f1caps/cap-home/`) because they show the account's name.
