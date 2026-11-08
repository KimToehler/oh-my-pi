# F1 tag-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

Setup: two chat messages sent through the driver so two nodes carry `chat-message` (the first reply awaited).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input "qa f1 tag check one" && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap chat-send && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait chat-reply --timeout 90 && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input "qa f1 tag check two" && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap chat-send && sleep 5 && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-message
type: tag=chat-input textLength=19
tap: tag=chat-send
wait: tag=chat-reply count=1
type: tag=chat-input textLength=19
tap: tag=chat-send
find: tag=chat-message count=2
(exit 1)
```

Setup continued: the first reply pushed `chat-send` below the visible area; one Spectre wheel scroll of the home column (outside the driver), then the second send.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ spectre scroll-wheel pid-24595 "$(spectre find --json pid-24595 home 2>/dev/null | jq -r ".nodes[0].childKeys[0]")" 40 2>&1 | grep -v WARNING; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap chat-send && sleep 5 && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-message
Scrolled window:0:0:159 by 40 wheel clicks.
tap: tag=chat-send
find: tag=chat-message count=2
(exit 1)
```

Tag state before: two chat messages sent and both replies shown, so two nodes carry `chat-message`.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ rm -rf /tmp/app-qa-impl/f1caps/tag-nc; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture before --out /tmp/app-qa-impl/f1caps/tag-nc && jq -r '[.. | objects | .testTag? // empty] | group_by(.) | map("\(.[0]) \(length)") | join(", ")' /tmp/app-qa-impl/f1caps/tag-nc/before.json
capture: /tmp/app-qa-impl/f1caps/tag-nc/before.png
capture: /tmp/app-qa-impl/f1caps/tag-nc/before.json
chat 1, chat-input 1, chat-message 2, chat-reply 2, chat-send 1, display-name 1, home 1, jobs 1, jobs-empty 1, jobs-refresh 1, sign-out 1, snackbar 1
(exit 0)
```

Tap on a tag no node carries on this screen.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap onboarding-welcome; echo "tap exit $?"
tap: tag=onboarding-welcome count=0
tap exit 1
(exit 0)
```

Tap on the tag two nodes carry.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap chat-message; echo "tap exit $?"
tap: tag=chat-message count=2
tap exit 1
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture after --out /tmp/app-qa-impl/f1caps/tag-nc && jq -r '[.. | objects | .testTag? // empty] | group_by(.) | map("\(.[0]) \(length)") | join(", ")' /tmp/app-qa-impl/f1caps/tag-nc/after.json && diff <(jq -S "del(.capturedAt, .meta)" /tmp/app-qa-impl/f1caps/tag-nc/before.json) <(jq -S "del(.capturedAt, .meta)" /tmp/app-qa-impl/f1caps/tag-nc/after.json) | head -5
capture: /tmp/app-qa-impl/f1caps/tag-nc/after.png
capture: /tmp/app-qa-impl/f1caps/tag-nc/after.json
chat 1, chat-input 1, chat-message 2, chat-reply 2, chat-send 1, display-name 1, home 1, jobs 1, jobs-empty 1, jobs-refresh 1, sign-out 1, snackbar 1
505c505
<     "captureDurationMs": 17,
---
>     "captureDurationMs": 11,
(exit 0)
```

Scan of the capture folder.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1caps/tag-nc; echo "scan exit $?"
scan exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

## Observation

Tap on an absent tag (`onboarding-welcome`): `count=0`, exit 1. Tap on `chat-message`, which two nodes carry: `count=2`, exit 1. The tag counts before and after are equal, and the node tree before and after both taps differs only in capture metadata (`capturedAt`, `meta` removed; the one remaining diff line is `captureDurationMs`), so nothing was clicked. The setup sent the two messages through the driver; a Spectre wheel scroll outside the driver brought `chat-send` back into view after the first long reply. The capture folder scans clean.
