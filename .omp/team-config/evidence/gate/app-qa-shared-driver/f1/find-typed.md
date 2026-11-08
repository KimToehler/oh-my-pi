# F1 find-typed

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

Setup: the field filled through the driver.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop type chat-input "Add a health endpoint"
type: tag=chat-input textLength=21
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals "Add a health endpoint"
tag=chat-input count=1 enabled=true focused=true textLength=21 equals=true
(exit 0)
```

## Observation

`chat-input` holding `Add a health endpoint` (typed through the driver): find printed one line, count=1, enabled=true, focused=true, textLength=21, equals=true, exit 0; the text itself is not in the output.
