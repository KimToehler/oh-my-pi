# F1 row: A consultation counts only on its pinned model (plan-architecture-consultation)

## Part 1: configured override, both attempts refused, ask, skip

Fixture: worktree `.worktrees/f1-native-fixture-count` (detached at 6933006fe0), change `openspec/changes/f1-consult-count` (Depth `risky`). Overlay `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml:/tmp/f1-oracle-override.yml`:

```
$ cat /tmp/f1-oracle-override.yml
task:
  agentModelOverrides:
    architecture-oracle: openai-codex/gpt-6.1-sol
$ PI_CONFIG_FILES=<seed>:/tmp/f1-oracle-override.yml omp config get task.agentModelOverrides | jq -c '{"architecture-oracle"}'
{"architecture-oracle":"openai-codex/gpt-6.1-sol"}
```

Fresh session prompt: run `openspec instructions review --change f1-consult-count --json` and follow it exactly; dispatch no plan-reviewer, edit no plan artifact; print an ask's question and options as the final message when no ask tool is available (print mode has none).

```
$ jq -c '<task tool-call arguments>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-count/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-74e7-a440-91a41cbeda66.jsonl
{"items":[{"agent":"architecture-oracle","name":"ArchConsult6933006f1","has_model":false}]}
{"items":[{"agent":"architecture-oracle","name":"ArchConsult6933006f2","has_model":false}]}
$ jq -r '<assistant provider/model>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-count/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-74e7-a440-91a41cbeda66/ArchConsult6933006f1.jsonl | sort | uniq -c
     17 openai-codex/gpt-6.1-sol
$ node $V --consultation-report <same file> openspec/changes/f1-consult-count
exit 1
consultation report: assistant turn 1 ran on openai-codex/gpt-6.1-sol, expected anthropic/claude-fable-5-2 from /Users/tim/.omp/agent/agents/architecture-oracle.md
$ jq -r '<assistant provider/model>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-count/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-74e7-a440-91a41cbeda66/ArchConsult6933006f2.jsonl | sort | uniq -c
     18 openai-codex/gpt-6.1-sol
$ node $V --consultation-report <same file> openspec/changes/f1-consult-count
exit 1
consultation report: assistant turn 1 ran on openai-codex/gpt-6.1-sol, expected anthropic/claude-fable-5-2 from /Users/tim/.omp/agent/agents/architecture-oracle.md
```

The session's final message (the ask), verbatim:

> The review is stopped at step 2a, the architecture consultation. `gate.md` sets the depth to `risky` and the change had no `consultation.md`, so the instruction blocks the plan-reviewer round until a consultation is counted. No plan-reviewer was dispatched and no plan artifact was edited. `consultation.md` stays `pending` (committed at `fd9b8c4b77`), so `--reviewed` still refuses the change.
> 
> Both consultation attempts failed the model check, which makes the failures even, so the instruction now requires this question:
> 
> **Question:** Neither architecture consultation attempt counted. The consultation check expects `anthropic/claude-fable-5-2`, the model named in `~/.omp/agent/agents/architecture-oracle.md`. Both attempts ran on `openai-codex/gpt-6.1-sol` instead. The likely cause is the configured override `task.agentModelOverrides.architecture-oracle = "openai-codex/gpt-6.1-sol"`. The attempts' Models entries:
> 
> - `ArchConsult6933006f1 openai-codex/gpt-6.1-sol (no report)`
> - `ArchConsult6933006f2 openai-codex/gpt-6.1-sol (no report)`
> 
> How should the consultation for `f1-consult-count` proceed?
> 
> **Options:**
> 1. **Skip:** skip the architecture consultation. Give your reason in your own words; it is written as `skipped` in `consultation.md` with both attempts and consulted commit `6933006fe0e1155a3b184617fa7e74b6c89a54f3`.
> 2. **Stop:** leave the `pending` record, which `--reviewed` refuses, and dispatch nothing further.

Answer, in the same session: `omp -p --resume <session file> "Skip. Reason: F1 fixture run; the architecture-oracle override deliberately points at another model, so no consultation can count here."` (same overlay). Reply, verbatim:

> I recorded the consultation as skipped and stopped before the plan-reviewer round, which you told me not to dispatch. There is no `review.md` yet, so apply stays blocked.
> 
> - **Consultation record:** `consultation.md` now has Status `skipped` and your reason word for word as the skip reason. It keeps consulted commit `6933006fe0…` and both attempts, each marked `openai-codex/gpt-6.1-sol (no report)`. No findings were adopted, so no plan artifact changed. The validator printed `passed`, and the record is committed as `dd41314a15`.
> - **Back at steps 1–2:** the change folder has no uncommitted changes and Depth is `risky`. This round's digest is `93d9c1c8b3e329095a00a669930ecc057e63a0c05d4bd67f3a0ee53a5884ed0a`, the same as before the consultation, because `consultation.md` doesn't count towards it.
> - **Where it stopped:** with the consultation `skipped`, step 3 lets the round through. At `risky` depth that means two plan-reviewers (scope A and scope B) in one task call, with the briefs filled in for this repository and change directory.
> 
> To finish the review, I'll need you to allow that dispatch. If nothing in the change folder is edited first, the digest above still holds.

```
$ git -C .worktrees/f1-native-fixture-count log --oneline 6933006fe0..HEAD
dd41314a15 docs(openspec): record skipped architecture consultation for f1-consult-count
fd9b8c4b77 docs(openspec): record failed consultation attempt 2 for f1-consult-count
d804951633 docs(openspec): bind consultation attempt 2 session file for f1-consult-count
e58f483f86 docs(openspec): record failed consultation attempt 1 and dispatch attempt 2 for f1-consult-count
ee98a676d0 docs(openspec): bind consultation attempt 1 session file for f1-consult-count
e36f6328b6 docs(openspec): record pending architecture consultation for f1-consult-count
$ sed -n 1,9p openspec/changes/f1-consult-count/consultation.md
# Consultation

- **Status**: skipped
- **Consulted commit**: 6933006fe0e1155a3b184617fa7e74b6c89a54f3
- **Consultant**: none
- **Models**: ArchConsult6933006f1 openai-codex/gpt-6.1-sol (no report); ArchConsult6933006f2 openai-codex/gpt-6.1-sol (no report)
- **Bottom line**: none
- **Skip reason**: F1 fixture run; the architecture-oracle override deliberately points at another model, so no consultation can count here.

```

Scenario "Installation without the model entry" (no provider reaches `claude-fable-5-2`) was not run separately: its attempts reach the same report check and ask as above, with another cause for the other model.

## Part 2: report check on session files changed only in provider/model

Fixtures made with jq from the consultation session of `f1/consultation.md` (`ArchConsult6933006f1.jsonl`, 21 assistant turns on `anthropic/claude-fable-5-2`), changing only `.message.provider`/`.message.model` (and `model_change.model` when every turn changes):

```
$ jq -r '<assistant provider/model>' consult-router-fable.jsonl | uniq -c
     21 router/cc/claude-fable-5-2
$ jq -r '<assistant provider/model>' consult-last-turn-opus.jsonl | uniq -c
     20 anthropic/claude-fable-5-2
      1 anthropic/claude-opus-5-5
$ diff <(jq -c 'del(.message.provider, .message.model, .model)' ArchConsult6933006f1.jsonl) <(jq -c 'del(.message.provider, .message.model, .model)' consult-router-fable.jsonl) && echo identical-otherwise
identical-otherwise
identical-otherwise (consult-last-turn-opus)
# in .worktrees/f1-native-fixture:
$ node $V --consultation-report consult-router-fable.jsonl openspec/changes/f1-consult
exit 0
stdout: {"bottom_line":{"verdict":"KEEP APPROACH","reason":"The prefix-only cutover is sound: the native providers carry the sam
stderr: 
$ node $V --consultation-report consult-last-turn-opus.jsonl openspec/changes/f1-consult
exit 1
stdout: 
stderr: consultation report: assistant turn 21 ran on anthropic/claude-opus-5-5, expected anthropic/claude-fable-5-2 from /Users/tim/.omp/agent/agents/architecture-oracle.md
```

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`; `$V` is `~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs`.
