# F1 3.6: report check on the four session files of task 1.2

Deployed validator `/Users/tim/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs` (byte-identical to head `acaf0ea77f`). Change directory `/tmp/rngp/base/openspec/changes/persist-counts` (fixture `/tmp/rngp/base`). Each session file (`/tmp/rngp/validator-report/*.jsonl`, generator `/tmp/rngp/validator-report/make.mjs`, same turn layouts as the four files of task 1.2's tests) holds the brief naming the change, assistant turns on the listed models and a final `yield` of a real accepted architecture report (the report recorded in this change's `consultation.md`), every tool result accepted. Pin: `architecture-oracle.md` model `onara/cc/claude-fable-5-2:high`.

## anthropic-fable

Turns: `anthropic/claude-fable-5-2,anthropic/claude-fable-5-2`

```
$ node /Users/tim/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/rngp/validator-report/anthropic-fable.jsonl /tmp/rngp/base/openspec/changes/persist-counts
exit 0
stdout: {"bottom_line":{"verdict":"KEEP APPROACH","reason":"The core of the change is sound and matches the code: comparing model names with the existing `bareModelName… (12195 bytes, the report JSON)
stderr: 
```

## onara-fable

Turns: `onara/cc/claude-fable-5-2,onara/cc/claude-fable-5-2`

```
$ node /Users/tim/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/rngp/validator-report/onara-fable.jsonl /tmp/rngp/base/openspec/changes/persist-counts
exit 0
stdout: {"bottom_line":{"verdict":"KEEP APPROACH","reason":"The core of the change is sound and matches the code: comparing model names with the existing `bareModelName… (12195 bytes, the report JSON)
stderr: 
```

## opus-among-fable

Turns: `onara/cc/claude-fable-5-2,onara/cc/claude-opus-5-5,onara/cc/claude-fable-5-2`

```
$ node /Users/tim/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/rngp/validator-report/opus-among-fable.jsonl /tmp/rngp/base/openspec/changes/persist-counts
exit 1
stdout: 
stderr: consultation report: assistant turn 2 ran on onara/cc/claude-opus-5-5, expected onara/cc/claude-fable-5-2 from /Users/tim/.omp/agent/agents/architecture-oracle.md
```

## codex-sol

Turns: `openai-codex/gpt-6.1-sol,openai-codex/gpt-6.1-sol`

```
$ node /Users/tim/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --consultation-report /tmp/rngp/validator-report/codex-sol.jsonl /tmp/rngp/base/openspec/changes/persist-counts
exit 1
stdout: 
stderr: consultation report: assistant turn 1 ran on openai-codex/gpt-6.1-sol, expected onara/cc/claude-fable-5-2 from /Users/tim/.omp/agent/agents/architecture-oracle.md
```

Result: both Fable routes are accepted (exit 0, the report printed); a turn on `onara/cc/claude-opus-5-5` and a session on `openai-codex/gpt-6.1-sol` are refused (exit 1, naming the turn and the pin). The code half of the consultation Negative control holds.
