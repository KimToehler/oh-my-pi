# F1 type-exact

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

Setup: the field holding `draft`.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input draft && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals draft
type: tag=chat-input textLength=5
tag=chat-input count=1 enabled=true focused=true textLength=5 equals=true
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input "Add a health endpoint"; echo "type exit $?"
type: tag=chat-input textLength=21
type exit 0
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals "Add a health endpoint"; echo "find exit $?"
tag=chat-input count=1 enabled=true focused=true textLength=21 equals=true
find exit 0
(exit 0)
```

## Observation

Setup: `chat-input` holding `draft` (textLength=5, equals=true). `desktop type chat-input "Add a health endpoint"` replaced the value rather than appending: exit 0, textLength=21 (not 26), and find --equals with the new text reported equals=true, exit 0.
