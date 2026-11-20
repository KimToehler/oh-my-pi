# F1 minimum row: edge-terra

`openai-codex/gpt-6.1-terra` is missing from the bundled catalog; it resolves through `openai-codex` discovery.

```
$ PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml omp config get modelRoles
{"advisor":"openai-codex/gpt-6.1-terra:medium","review":"openai-codex/gpt-6.1-terra:high"}
$ PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml omp -p --model @review "Reply with the single word terra."
terra
$ jq -r '<assistant provider/model>' <session>.jsonl | sort | uniq -c
      1 openai-codex/gpt-6.1-terra
$ jq -r 'select(.type=="thinking_level_change") | .thinkingLevel' <session>.jsonl
high
```

Session file: `~/.omp/agent/sessions/--private-tmp-f1-terra--/2026-11-20T12-47-07-440Z_01a1f8ff-0eb0-72e9-8444-240a275db406.jsonl`.

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`.

## Discovery on this account

The seeded slug `openai-codex/gpt-6.1-terra` resolves only when this account's Codex discovery lists it (gate.md residual). This account's list:

```
$ omp models list terra   # openai-codex section
openai-codex (2)
┌───────────────┬─────────┬─────────┬───────────────────────────┬────────┐
│ model         │ context │ max-out │ thinking                  │ images │
├───────────────┼─────────┼─────────┼───────────────────────────┼────────┤
│ gpt-5.6-terra │    272K │    128K │ low,medium,high,xhigh,max │ yes    │
│ gpt-6.1-terra │    500K │    128K │ low,medium,high,xhigh,max │ yes    │
└───────────────┴─────────┴─────────┴───────────────────────────┴────────┘
```
