# F1 row: A dispatch counts only on its pinned model (openspec-plan-review)

Fresh sessions in `.worktrees/f1-native-fixture-review` (deployed head 3e78520b8e) each ran `openspec instructions review --change f1-review --json` and applied the delivered instruction's dispatch check, pin lookup, retry and incomplete-round rules and review.md fields to session-file-shaped fixtures, dispatching and writing nothing. Every session started with `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml`, plus the overlay named per session.

Fixtures (`/tmp/f1-native/fx/`) are the real `PlanReviewF1R1.jsonl` (19 turns, `openai-codex/gpt-6.1-sol`, high) and `VerifyF1R1.jsonl` (5 turns, medium) of f1/plan-review.md, changed only in provider/model:

```
swap FILE K PROVIDER MODEL = jq -c -s 'reduce .[] as $e ({n:0,out:[]}; if ($e.type=="message" and $e.message.role=="assistant") then .n+=1 | .out+=[(if .n>=$k then ($e|.message.provider=$p|.message.model=$m) else $e end)] elif ($e.type=="model_change" and $k==1) then .out+=[($e|.model=($p+"/"+$m))] else .out+=[$e] end) | .out[]' (assistant turns from the K-th on change provider/model; K=1 also rewrites model_change)
$ jq -r '<assistant provider/model>' review-scopeA-switched.jsonl | uniq -c; thinking_level_change
     16 openai-codex/gpt-6.1-sol
      3 anthropic/claude-opus-5
high
$ jq -r '<assistant provider/model>' review-scopeA-retry.jsonl | uniq -c; thinking_level_change
     19 openai-codex/gpt-6.1-sol
high
$ jq -r '<assistant provider/model>' review-credfallback-1.jsonl | uniq -c; thinking_level_change
     19 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' review-credfallback-2.jsonl | uniq -c; thinking_level_change
     19 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' verifier-sub-1.jsonl | uniq -c; thinking_level_change
      5 anthropic/claude-opus-5-5
medium
$ jq -r '<assistant provider/model>' verifier-sub-2.jsonl | uniq -c; thinking_level_change
      5 anthropic/claude-opus-5-5
medium
$ jq -r '<assistant provider/model>' review-native.jsonl | uniq -c; thinking_level_change
     19 openai-codex/gpt-6.1-sol
high
```

Session prompt header, shared by every session:

> Run `openspec instructions review --change f1-review --json` and read its instruction. Do not run it as a review: dispatch nothing, and write, edit or commit nothing. Instead apply the instruction's own rules for what a dispatch ran on (the check after every reviewer or verifier dispatch, the pin lookup, the retry and incomplete-round rules, and the review.md fields) to the hypothetical dispatches below. Their session files are fixtures already on disk; treat each as that dispatch's session file. Read every pin from this installation's configuration exactly as the instruction says. For each case report: the pin and where you read it, the distinct provider/model list of each file (the instruction's jq command), whether each dispatch counts, and what the instruction then requires (retry, round complete or incomplete, Awaiting, whether review.md is written, what - **Reviewer**: and - **Models**: record, what the user is told), quoting the sentence that decides it.

## Session 1: seed only. Retry chain switches a reviewer mid-run; credential fallback; substituted verifier

Cases given: (1) PlanReviewA1 = review-scopeA-switched.jsonl (last 3 turns `anthropic/claude-opus-5`, returned REJECT), retry PlanReviewA2 = review-scopeA-retry.jsonl; (2) PlanReviewC1/C2 = review-credfallback-1/2.jsonl, parent on `anthropic/claude-opus-5-5`; (3) a counted reviewer with one blocker, verifier attempts VerifyS1/S2 = verifier-sub-1/2.jsonl. Reply, verbatim:

> Under the instruction's rules, Case 1 counts on the retry (PlanReviewA2), Case 2 produces nothing and stops with no review.md, and Case 3 ends REJECT, Awaiting `triage`, after both verifier attempts fail. I dispatched nothing and wrote, edited or committed nothing. To read the instruction I wrote it to two scratch files in `/tmp` and deleted them afterwards. `git status --porcelain` on the change folder prints nothing.
> 
> ## Pins (read from this installation's configuration)
> 
> The instruction says to use "the entry for that agent in `omp config get task.agentModelOverrides`, else the model named in its definition under `$(omp config path)/agents/`."
> 
> | Agent | Pin | Source | Model name (`model-name.mjs <pin>`) |
> |---|---|---|---|
> | plan-reviewer | `openai-codex/gpt-6.1-sol:high` | `task.agentModelOverrides["plan-reviewer"]` | `gpt-6.1-sol` |
> | blocker-verifier | `openai-codex/gpt-6.1-sol:medium` | No override entry, so the definition: `/Users/tim/.omp/agent/agents/blocker-verifier.md` frontmatter `model:` | `gpt-6.1-sol` |
> 
> The test that decides every dispatch below: "the dispatch ran on its pin only when the first prints exactly one line, equal to the second's; the provider takes no part."
> 
> ## Per-file distinct provider/model (the instruction's jq command, then `model-name.mjs | sort -u`)
> 
> | File | jq list | Names | Ran on pin? |
> |---|---|---|---|
> | review-scopeA-switched.jsonl | `anthropic/claude-opus-5`, `openai-codex/gpt-6.1-sol` (turn order: 16 sol turns, then 3 opus) | 2 lines | no (two lines) |
> | review-scopeA-retry.jsonl | `openai-codex/gpt-6.1-sol` | `gpt-6.1-sol` | **yes** |
> | review-credfallback-1.jsonl | `anthropic/claude-opus-5-5` | `claude-opus-5-5` | no |
> | review-credfallback-2.jsonl | `anthropic/claude-opus-5-5` | `claude-opus-5-5` | no |
> | verifier-sub-1.jsonl | `anthropic/claude-opus-5-5` | `claude-opus-5-5` | no |
> | verifier-sub-2.jsonl | `anthropic/claude-opus-5-5` | `claude-opus-5-5` | no |
> 
> ## Case 1: reviewer switched model mid-run, then retried
> 
> - **PlanReviewA1 does not count.** It ran on two models, and "A dispatch that ran on any other model counts as a dispatch without a structured result, whatever it returned." Its REJECT and its blockers are dropped: they are not carried and not triaged.
> - **Retry.** "A reviewer without a structured verdict (… or it ran on another model name) gets one fresh retry with the same brief, in a new task call."
> - **PlanReviewA2 counts.** It ran only on `gpt-6.1-sol`, so the round is complete, not incomplete. The incomplete-round rule only applies "If the retry also has none."
> - **What follows depends on A2's verdict.** You didn't say which verdict it returned.
>   - **OKAY with no blockers:** "A round with no blocker and nothing carried is OKAY; go to step 7." review.md is written and committed with Verdict OKAY, Awaiting `none`, `- **Verifier**: blocker-verifier, none` and `## Blockers` `none`. Then step 8, `V --reviewed`.
>   - **REJECT:** step 4 applies. Before the verifier dispatch, review.md is written and committed with Verdict REJECT, Awaiting `triage` and `- **Verifier**: blocker-verifier, none`. The blockers go under `### All scopes (PlanReviewA2)`, each marked `not triaged: the verifier has not returned`. Then blocker-verifier is dispatched.
>   - **Not told** in either branch: no failure stops the round.
> - **`- **Reviewer**:`** `plan-reviewer, PlanReviewA2`, because "a retried reviewer is listed with its retry's id".
> - **`- **Models**:`** `PlanReviewA1 openai-codex/gpt-6.1-sol anthropic/claude-opus-5 (no verdict); PlanReviewA2 openai-codex/gpt-6.1-sol`. The rule is "every further model that dispatch ran on appended and `(no verdict)` after an attempt whose result did not count."
> 
> ## Case 2: credential fallback on both attempts
> 
> - **Neither attempt counts.** Both ran on `claude-opus-5-5`, not `gpt-6.1-sol`. The parent running `anthropic/claude-opus-5-5` changes nothing. The instruction says "the runtime substitutes a pinned model silently on a credential or retry fallback, and a verdict from the substitute is not the independent draw this budget assumes", and "Name no model here; read the pin from the configuration every time."
> - **The retry was spent.** PlanReviewC2 was that retry, so the round is incomplete: "If the retry also has none, the round is incomplete and no verifier runs on it."
> - **Nothing is written.** It is standard round 1, so no other reviewer exists and nothing is carried. The deciding sentence: "when no other reviewer delivered a blocker and the round carries nothing, the round produced nothing: write no review.md and edit no existing one, tell the user which reviewer failed, and stop."
> - **No `- **Reviewer**:`, `- **Models**:` or Awaiting entries are recorded.** The existing `review.md` stays untouched. It is REJECT, round 1, Awaiting `none`, so no stale OKAY stays current.
> - **The user is told:** the plan-reviewer failed. PlanReviewC1 and its retry PlanReviewC2 both ran on `anthropic/claude-opus-5-5` instead of the pinned `gpt-6.1-sol`. Then stop: no further dispatch, no ask, no edit.
> 
> ## Case 3: substituted verifier on both attempts
> 
> - **Neither verifier attempt counts.** Both ran on `claude-opus-5-5`. The pin is the definition's `gpt-6.1-sol`. "Any other result, any task without a structured result, and any task that ran on another model name gets one fresh retry with the same brief." VerifyS2 was that retry.
> - **The round is not incomplete.** "If the retry is also missing or incomplete, the round is not incomplete as in step 3: its reviewers delivered their verdicts and those verdicts reject."
> - **review.md is rewritten and committed.** The deciding sentence: "Rewrite the record committed before the dispatch (step 7) so every untriaged blocker carries `not triaged: the verifier failed twice` instead and `- **Models**:` adds both verifier attempts, keeping Verdict REJECT and Awaiting `triage`, and commit it." This replaces the pre-triage record that step 4 committed.
>   - Verdict REJECT, Awaiting `triage`.
>   - `## Blockers`: `### All scopes (<reviewer id>)` holding the one blocker verbatim, marked `not triaged: the verifier failed twice`.
> - **`- **Reviewer**:`** `plan-reviewer, <reviewer id>`. The case gives no id for that reviewer.
> - **`- **Verifier**:`** stays `blocker-verifier, none`. The template says `none` when "no verifier result stands", and the rewrite clause changes only the marker and Models.
> - **`- **Models**:`** `<reviewer id> openai-codex/gpt-6.1-sol; VerifyS1 anthropic/claude-opus-5-5 (no verdict); VerifyS2 anthropic/claude-opus-5-5 (no verdict)`. The reviewer's entry assumes "counted" means it ran on the pin through `openai-codex`; any other provider for the same model would also count.
> - **The user is told:** the blocker-verifier triage failed. VerifyS1 and VerifyS2 both ran on `claude-opus-5-5` instead of the pinned `gpt-6.1-sol`. Then stop: "dispatch nothing further, ask nothing and edit no artifact."
> - **On resume:** a later session on the unchanged digest "dispatches triage again for exactly its untriaged findings … dispatching no reviewer and adding no finding."

## Session 2: pin `router/cx/gpt-6.1-sol:high`, every turn on `openai-codex/gpt-6.1-sol`

```
$ cat /tmp/f1-ov-pr-router.yml
task:
  agentModelOverrides:
    plan-reviewer: router/cx/gpt-6.1-sol:high
```

Case given: PlanReviewR1 = review-native.jsonl. Reply, verbatim:

> **PlanReviewR1 counts.** It ran on the pinned model name, so no retry is needed and the round continues normally. I ran only the instruction command, the config reads, the instruction's jq command and `model-name.mjs`. Nothing was dispatched, written, edited or committed.
> 
> **Pin**
> - Read from `omp config get task.agentModelOverrides`, entry `"plan-reviewer": "router/cx/gpt-6.1-sol:high"`.
> - Because the override names a model, the fallback to the agent definition under `$(omp config path)/agents/` (`/Users/tim/.omp/agent/agents/`) is never reached. That folder has no `plan-reviewer.md` anyway.
> - So the "no pin" rule ("When neither source names a model … write no review.md … and stop") does not apply.
> - `model-name.mjs router/cx/gpt-6.1-sol:high` → `gpt-6.1-sol`
> 
> **Provider/model list of `/tmp/f1-native/fx/review-native.jsonl`** (jq `select(.type=="message" and .message.role=="assistant") … | sort -u`):
> - `openai-codex/gpt-6.1-sol`, which is all 19 assistant turns.
> - Piped through `xargs node model-name.mjs | sort -u` it gives exactly one line, `gpt-6.1-sol`.
> - That matches the pin's name. The file's own `model_change` record also shows `resolvedModelIsFallback:false`, which agrees, but the decision rests only on the name comparison.
> 
> **Does the dispatch count: yes.** The deciding sentences are:
> > "the dispatch ran on its pin only when the first prints exactly one line, equal to the second's; the provider takes no part. The pinned model reached through another provider counts, and `- **Models**:` still records each full `provider/model`."
> 
> The pin goes through `router/cx`, but the session used `openai-codex`. That provider difference does not matter here.
> 
> **What the instruction requires next**
> - **No retry.** The retry rule covers only "A reviewer without a structured verdict (… or it ran on another model name)", and neither applies.
> - **Round complete.** The incomplete-round rules never trigger.
> - The case doesn't say whether the verdict was OKAY or REJECT, so both branches follow:
> 
> | Field / step | Verdict OKAY | Verdict REJECT |
> |---|---|---|
> | Deciding sentence | "A round with no blocker and nothing carried is OKAY; go to step 7." | "The round returns the blockers of every rejecting reviewer" → step 4: "Before the dispatch, write review.md for this round (step 7) and commit it with Verdict REJECT, Awaiting `triage`, `- **Verifier**: blocker-verifier, none`…" |
> | review.md written | Yes, step 7, with step 2's digest | Yes, committed before the verifier dispatch, then replaced after triage (step 5) |
> | Verdict | OKAY | REJECT |
> | Awaiting | `none` | `triage` (changes after triage) |
> | `- **Reviewer**:` | `plan-reviewer, <allocated id>` | same |
> | `- **Verifier**:` | `blocker-verifier, none` (no finding needed triage) | `blocker-verifier, none` until the verifier returns |
> | `- **Models**:` | `<allocated id> openai-codex/gpt-6.1-sol`, with no `(no verdict)` | same entry, plus the verifier's entry after triage |
> | Round | 1 | 1 |
> | `## Blockers` | `none` | Each blocker verbatim under `### All scopes (<id>)`, marked `not triaged: the verifier has not returned` |
> | Then | Step 8, `V --reviewed`, should pass | Dispatch `blocker-verifier` for triage (its own model check applies) |
> 
> In both branches, `<allocated id>` is the subagent id the runtime returns, which may not be `PlanReviewR1`.
> 
> **What the user is told:** the reviewer ran on its pinned model and its verdict stands. Nothing about a failed reviewer, a retry or a missing pin, since none of those rules apply. On a REJECT, the only user-facing step is later: any exception, scope or exhaustion ask that triage leads to.

## Session 3: pin `gpt-6.1-sol:high` (no provider), every turn on `openai-codex/gpt-6.1-sol`

```
$ cat /tmp/f1-ov-pr-bare.yml
task:
  agentModelOverrides:
    plan-reviewer: gpt-6.1-sol:high
```

Case given: PlanReviewB1 = review-native.jsonl. Reply, verbatim:

> PlanReviewB1 counts: it ran on its pinned model. The round is complete and needs no retry. Because its verdict is REJECT, the next step is step 4, verifier triage.
> 
> I wrote nothing in the repo and dispatched nothing. The only writes were scratch copies of the instruction output under `/tmp/f1-native/` (`instr.json`, `instr.md`, `instr.err`), so I could read it.
> 
> **Pin**
> - `omp config get task.agentModelOverrides` has the entry `"plan-reviewer":"gpt-6.1-sol:high"`. This entry decides it, because the instruction checks overrides first: "the entry for that agent in `omp config get task.agentModelOverrides`, else the model named in its definition under `$(omp config path)/agents/`."
> - No fallback is needed. Even if one were, `/Users/tim/.omp/agent/agents/` has no `plan-reviewer.md`, only `architecture-oracle.md`, `auditor.md`, `blocker-verifier.md` and `oracle.md`.
> - `model-name.mjs gpt-6.1-sol:high` gives `gpt-6.1-sol`.
> 
> **Provider/model list of `/tmp/f1-native/fx/review-native.jsonl`** (the instruction's jq command)
> - `openai-codex/gpt-6.1-sol`: one distinct entry, covering all 19 assistant turns.
> - Piped through `xargs model-name.mjs | sort -u`, it gives exactly one line, `gpt-6.1-sol`.
> 
> **Does the dispatch count?** Yes. The first command prints one line, and it equals the pin's name. The deciding sentence: "the dispatch ran on its pin only when the first prints exactly one line, equal to the second's; the provider takes no part."
> 
> **What the instruction requires next**
> - **No retry.** The retry rule covers "A reviewer without a structured verdict (… or it ran on another model name)". PlanReviewB1 has a structured verdict on its pinned model.
> - **The round is complete, not incomplete.** The incomplete rule only applies "If the retry also has none", and there is no retry.
> - **The verdict is REJECT.** The yield in the fixture has `verdict: "REJECT"` and one blocker, area `CHECK 6 — tasks.md 4.2 / F1 entry-path coverage`. So "A round with no blocker and nothing carried is OKAY" does not apply. "The round returns the blockers of every rejecting reviewer" sends it to step 4.
> - **review.md is written before the verifier is dispatched.** Step 4: "Before the dispatch, write review.md for this round (step 7) and commit it with Verdict REJECT, Awaiting `triage`, `- **Verifier**: blocker-verifier, none` and every blocker of the round verbatim under `## Blockers`, each carrying `not triaged: the verifier has not returned`." The fields, from step 7:
>   - **Verdict**: REJECT
>   - **Depth**: standard (gate.md's `- **Depth**:`)
>   - **Reviewer**: `plan-reviewer, PlanReviewB1`
>   - **Verifier**: `blocker-verifier, none`
>   - **Models**: `PlanReviewB1 openai-codex/gpt-6.1-sol`. It has no `(no verdict)` marker, because the result counted, and it records the full provider/model: "`- **Models**:` still records each full `provider/model`."
>   - **Round**: 1
>   - **Awaiting**: `triage`
>   - **Blockers**: one `### All scopes (PlanReviewB1)` subsection holding the CHECK 6 blocker verbatim, marked `not triaged: the verifier has not returned`.
>   - **Digest**: step 2's `V --digest`.
> - **Then the verifier is dispatched.** It is one fresh `blocker-verifier` item with blocker 1 copied verbatim from `read agent://<id>`, and no `model` on the item. Its own result then gets the same pin check.
> - **What the user is told.** Nothing is required at this point. No rule tells you to stop or ask. Stop-and-tell only applies after a failed reviewer retry or a failed verifier retry, and an ask only comes from step 5's triage outcomes.
> 
> **Two caveats**
> - The case says "returned a structured verdict" but doesn't give it. I took REJECT with one blocker from the fixture's `yield` call. If PlanReviewB1 had returned OKAY with no blockers, step 7 would apply instead: write review.md with Verdict OKAY, Awaiting `none`, Verifier `blocker-verifier, none`, the same Reviewer, Models and Round, and `## Blockers` set to `none`.
> - The existing `openspec/changes/f1-review/review.md` is a round-1 record from PlanReviewF1R1, with Awaiting `none`. In this hypothetical, the new record would overwrite it, since the case is a fresh round 1. No resume or carry-over rule applies, because those only cover Awaiting `triage` or `incomplete`.

## Session 4: installation without the pin

```
$ cat /tmp/f1-ov-pr-nopin.yml
task:
  agentModelOverrides:
    plan-reviewer: null
```

`plan-reviewer: null` stands in for an installation updated without the seed entry: `omp config get task.agentModelOverrides` then names no model for it, and `~/.omp/agent/agents/` holds no `plan-reviewer.md`. Case given: about to dispatch round 1's plan-reviewer. Reply, verbatim:

> The instruction's rules give one result: this installation has no pin for `plan-reviewer`. So no review.md is written, the user is told to add `task.agentModelOverrides.plan-reviewer`, and the review stops. I dispatched nothing and wrote, edited or committed nothing in the repo. I did put the instruction into two scratch files in `/tmp` and deleted them afterwards.
> 
> **Admission (step 3), checked first**
> - gate.md says `Mandatory class: none` and `Depth: standard`, and there is no consultation.md. You did not ask for a consultation, so step 2a is not entered.
> - Without the pin problem, the dispatch would be one fresh `plan-reviewer` item with the all-scopes paragraph and no `model`: "`standard`: dispatch one fresh plan-reviewer item with the all-scopes paragraph."
> 
> **Pin lookup**
> 1. `omp config get task.agentModelOverrides` returns `{"plan-reviewer":null,"reviewer":"@review",…}`. The `plan-reviewer` entry is `null`, so it names no model.
>    - The `null` comes from a config layer added through `PI_CONFIG_FILES`: `/tmp/f1-ov-pr-nopin.yml`, which sets `plan-reviewer: null`.
>    - It overrides `~/.omp/agent/config.yml:90` and the team seed `config.yml:69`. Both of those say `plan-reviewer: openai-codex/gpt-6.1-sol:high`.
>    - The instruction reads the pin from what `omp config get` returns, not from the raw files, so the `null` wins.
> 2. `omp config path` gives `/Users/tim/.omp/agent`, and `agents/` there holds only `architecture-oracle.md`, `auditor.md`, `blocker-verifier.md` and `oracle.md`. There is no `plan-reviewer.md`.
>    - The bundled `packages/coding-agent/src/prompts/agents/plan-reviewer.md` (`model: "@advisor"`) is not under that path, so it does not count.
> 3. Neither source names a model. The deciding sentence: "When neither source names a model, this installation has no pin for that agent: write no review.md, tell the user to add `task.agentModelOverrides.<agent>` to the agent configuration, and stop."
> 
> **Results for this case**
> - **Pin:** none. Sources checked: `omp config get task.agentModelOverrides` (entry is `null`), then `/Users/tim/.omp/agent/agents/` (no `plan-reviewer.md`).
> - **Provider/model list:** none. Nothing has run, so there is no session file for the jq command. `model-name.mjs` is not run either, because there is no pin to compare against.
> - **Does the dispatch count:** there is no dispatch to count.
> - **Retry:** none. The retry rule covers "A reviewer without a structured verdict", and no reviewer exists here.
> - **Round:** neither complete nor incomplete. Incomplete needs a failed retry first: "If the retry also has none, the round is incomplete." Here the instruction says "stop" before any round exists.
> - **review.md:** not written, and the existing file is left alone. So there is no Awaiting value, no `- **Reviewer**:` and no `- **Models**:` entry.
> - **What the user is told:** the installation has no pin for `plan-reviewer`, and they need to add `task.agentModelOverrides.plan-reviewer` to the agent configuration. In practice that means removing or replacing the `null` in `/tmp/f1-ov-pr-nopin.yml`. Changing the installation is the user's job, not the agent's.
> 
> **Two gaps in the instruction**
> - **When the check runs:** the text places the pin lookup "After every reviewer or verifier dispatch … before you use its result". Read literally, the reviewer would be sent first and its result thrown away. But the lookup depends only on configuration, not on the session file, so running it before the dispatch gives the same stop and spends no reviewer. Stopping before the dispatch is my reading; the instruction does not say it.
> - **Existing review.md:** the file already records round 1 as REJECT, Awaiting `none`, on digest `4fa8eeae…`. In a real session that record would change the round and budget count. Your case asks about round 1 as if nothing had run, so I applied that and did not use the record.

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`.
