# Credential fallback to the parent model

Scenario: "Credential fallback to the parent model"

Installation: router installation `/tmp/rngp/homes/credential-fallback` (one change, see setup.md). Fixture checkout: `/tmp/rngp/rows/credential-fallback`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `add-reset` in this repository: get its instruction with `openspec instructions review --change add-reset --json` and follow it exactly. Stop once round 1 is recorded (its review.md written and committed) or the instruction tells you to stop or ask me; do not fix blockers and do not start a second round. Finish with a short report: each dispatch, the provider/model its session file shows, whether it counted, and what you recorded.
```

Main session: `/tmp/rngp/homes/credential-fallback/.omp/agent/sessions/--private-tmp-rngp-rows-credential-fallback--/2026-11-17T23-46-39-583Z_01a1ebe7-cd5f-77ca-a15b-6d0f0a8520b0.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `EvilWhippet.jsonl`: models ['onara/cc/claude-opus-5-5'], effort ['high'], model_change [('onara/cc/claude-opus-5-5', False)]
- `HuskyPeacock.jsonl`: models ['onara/cc/claude-opus-5-5'], effort ['high'], model_change [('onara/cc/claude-opus-5-5', False)]

### Final report (verbatim)

````text
I stopped before writing anything: there is no `review.md` and no commit. Both review attempts ran on a different model from the one `plan-reviewer` is pinned to, so neither verdict counts. Under the instruction, that leaves round 1 incomplete with nothing to record.

**Setup:**
- The validator passed on the change folder.
- The folder was already committed and clean, so I didn't need a commit.
- Depth in `gate.md` is `standard` (class `none`), so the round is one reviewer.
- The digest for this round is `345870c01b9615b5d265da62caa7a66160abfda950a30d2708e122f15273b742`.
- No architecture consultation was needed, because the change isn't `risky` and you didn't ask for one.
- The pin from `task.agentModelOverrides` is `plan-reviewer: openai-codex/gpt-6.1-sol:high`, which is model `gpt-6.1-sol`.

| Dispatch | Provider/model in its session file | Counted |
|---|---|---|
| `HuskyPeacock` (plan-reviewer, first attempt) | `onara/cc/claude-opus-5-5` | No: `claude-opus-5-5` is not `gpt-6.1-sol`. Its OKAY doesn't count. |
| `EvilWhippet` (plan-reviewer, retry with the same brief, new task call) | `onara/cc/claude-opus-5-5` | No: same mismatch. Its OKAY doesn't count. |

Both session files are in `~/.omp/agent/sessions/--private-tmp-rngp-rows-credential-fallback--/2026-11-17T23-46-39-583Z_01a1ebe7-…/`, named `HuskyPeacock.jsonl` and `EvilWhippet.jsonl`.

**What I recorded:** nothing. The instruction's rule here is that when the retry also has no counted verdict, no reviewer delivered a blocker and nothing carries over, the round produced nothing. So I wrote no `review.md`, made no commit, ran no blocker-verifier and changed no artifact. `--reviewed` will keep refusing the change, so apply stays blocked.

**Why the reviewer fell back:** each session's only `model_change` entry sets `onara/cc/claude-opus-5-5` with `resolvedModelIsFallback: false`. So the sessions started on the Claude model and never ran on the pinned GPT model at all. My guess is that the `openai-codex` provider isn't usable here, for example missing credentials, and the runtime chose another model; I haven't checked that. Fixing this in the installation is yours to do. Once `plan-reviewer` actually runs on `gpt-6.1-sol`, running the review again starts round 1 fresh.
````

## Result

PASS. Override `openai-codex/gpt-6.1-sol:high` is unreachable in this home; both attempts (`HuskyPeacock`, `EvilWhippet`) ran only on `onara/cc/claude-opus-5-5`, neither counted, nothing was recorded, and the user was told the model that ran.
