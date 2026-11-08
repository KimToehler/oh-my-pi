# F1 find-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find chat-input --equals "Add a health check"; echo "find exit $?"
tag=chat-input count=1 enabled=true focused=true textLength=21 equals=false
find exit 1
(exit 0)
```

## Observation

Same field (holding `Add a health endpoint`), find with a different expected text (`Add a health check`): one line with equals=false, exit 1; neither the field text nor the expected text is in the output.
