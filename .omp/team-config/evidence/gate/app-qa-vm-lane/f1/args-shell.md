# args-shell

Run 2026-11-15T18:15:02+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input 'a "b" $HOME; c'
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
type: tag=chat-input textLength=14
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals 'a "b" $HOME; c'
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tag=chat-input count=1 enabled=true focused=true textLength=14 equals=true
[exit 0]
```

## Observation

After `vm up desktop` and the sign-in (`target-desktop`), routed `type` from `app_kmp/` reports textLength 14 and `find --equals` with the same text reports `equals=true`: quotes, `$HOME` and `;` arrived unchanged.

## Verdict

PASS
