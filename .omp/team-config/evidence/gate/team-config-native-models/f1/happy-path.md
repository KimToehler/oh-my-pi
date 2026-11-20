# F1 minimum row: happy path

Deployed head 3e78520b8e, overlay `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml`, cwd `/tmp/f1-happy`.

```
$ omp -p --wait-async "Spawn exactly one subagent with the task tool (default agent, no model override) whose task is: reply with the single word pong. When it returns, reply with its answer."
pong
$ jq -r '<assistant provider/model>' <main session>.jsonl | sort | uniq -c
      4 anthropic/claude-opus-5-5
$ jq -r '<assistant provider/model>' <main session>/DualOstrich.jsonl | sort | uniq -c   # the task subagent
      1 anthropic/claude-sonnet-5-5
$ jq -r 'select(.type=="thinking_level_change") | .thinkingLevel' (main, subagent)
high
medium
```

Session files: `~/.omp/agent/sessions/--private-tmp-f1-happy--/2026-11-20T12-47-07-332Z_01a1f8ff-0e44-7330-95d7-c2b0aa1dd963.jsonl` and `~/.omp/agent/sessions/--private-tmp-f1-happy--/2026-11-20T12-47-07-332Z_01a1f8ff-0e44-7330-95d7-c2b0aa1dd963/DualOstrich.jsonl`.

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`.

## Every seeded model id is known to the registry

Each seeded model id is a `retry.fallbackChains` key or entry in `seed/config.yml`; non-interactive startup runs `validateRetryFallbackChains` and logs one `references unknown model` warning per unknown key or selector to the session's `~/.omp/logs/omp.<date>.<pid>.log`. (The overlay merges with the operator's own config, so the operator's keys are validated too.)

```
$ PI_CONFIG_FILES=<seed> omp config get retry.fallbackChains | jq -r '[keys[], .[][]] | unique[] | select(test("^(anthropic|openai-codex)/"))'
anthropic/claude-fable-5-2
anthropic/claude-haiku-5-5
anthropic/claude-opus-5
anthropic/claude-opus-5-5
anthropic/claude-sonnet-5-5
openai-codex/gpt-6-luna
openai-codex/gpt-6.1-sol
openai-codex/gpt-6.1-terra
$ (cd /tmp/f1-happy && PI_CONFIG_FILES=<seed> omp -p "Reply with the single word ok.")
ok
$ grep -c "unknown model" ~/.omp/logs/omp.2026-11-20.94783.log   # that run
0
# positive control: the same run plus /tmp/f1-chain-bogus.yml
$ cat /tmp/f1-chain-bogus.yml
retry:
  fallbackChains:
    anthropic/claude-bogus-9-9:
      - openai-codex/gpt-bogus-9
$ (cd /tmp/f1-happy && PI_CONFIG_FILES=<seed>:/tmp/f1-chain-bogus.yml omp -p "Reply with the single word ok.")
ok
$ grep "unknown model" ~/.omp/logs/omp.2026-11-20.95136.log | jq -r .message
retry.fallbackChains key references unknown model: anthropic/claude-bogus-9-9
Fallback chain for model 'anthropic/claude-bogus-9-9' references unknown model: openai-codex/gpt-bogus-9
```
