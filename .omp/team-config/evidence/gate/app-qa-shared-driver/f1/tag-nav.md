# F1 tag-nav

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

Setup: sign the onara app out so the login entry shows; the grown chat pushed `sign-out` below the visible area, so one Spectre wheel scroll of the home column (outside the driver) first.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ spectre scroll-wheel pid-81605 "$(spectre find --json pid-81605 home 2>/dev/null | jq -r ".nodes[0].childKeys[0]")" 40 2>&1 | grep -v WARNING; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-out && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait sign-in --timeout 20
Scrolled window:0:0:24 by 40 wheel clicks.
tap: tag=sign-out
wait: tag=sign-in count=1
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-in; echo "tap exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait home --timeout 45; echo "wait exit $?"
tap: tag=sign-in
tap exit 0
wait: tag=home count=1
wait exit 0
(exit 0)
```

## Observation

Onara signed out (login entry shown, `sign-in` count 1). `desktop tap sign-in` exit 0, then `desktop wait home --timeout 45` exit 0 with the `home` tag found once: tag-addressed navigation from the login entry to the home screen.
