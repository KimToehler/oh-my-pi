# F1 row: Gate reviewers run on their pinned model (post-implementation-review)

Fixture: worktree `.worktrees/f1-native-fixture-audit` (detached), plan `.omp/plans/f1-audit-fixture.md` (commit 7459f91072), reviewed diff `HEAD~1..HEAD` (0345a74fb8, one README sentence). Deployed head 3e78520b8e, overlay `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml`, `auditor` override removed (f1/setup.md).

## Part 1: one implementation-audit, counted

Fresh session prompt: read skill://review-work, run only the implementation-audit invocation for that plan and diff with its brief verbatim, apply Phase 3's Model check before and after, write no record, save the trailer to `/tmp/f1-native/audit-trailer.txt`.

```
$ jq -c '.. task tool-call arguments ..' <orchestrator session>   # agent, model, name per dispatch
{"agent":["auditor"],"model":[null],"name":["F1ImplementationAudit"]}
{"agent":["auditor"],"model":[null],"name":["F1ImplementationAudit"]}
# the first call was refused by the task tool before any spawn: "Missing `context`. Provide the shared background for this batch — goal, constraints, and any contract the tasks share."
$ jq -r '<assistant provider/model>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-audit/2026-11-20T12-47-49-300Z_01a1f8ff-b234-77f7-969e-ac4bf9b5277d/F1ImplementationAudit.jsonl | sort | uniq -c
      8 openai-codex/gpt-6.1-sol
$ jq -r 'select(.type=="thinking_level_change") | .thinkingLevel' <same file>
high
$ cat /tmp/f1-native/audit-trailer.txt
REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: openai-codex/gpt-6.1-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: Identical configured role maps must not be treated as identical readiness evidence when provider credential availability differs.
  positive_witness: The documented preflight distinguishes a fully authenticated setup from one missing Codex authentication without starting a gate reviewer.
  negative_control: Both setups print the same role map and are considered equally ready.
  observable: Retained preflight output shows provider-specific usable or unavailable status rather than configuration values alone; not exercised in this audit.
  boundary: User-visible onboarding preflight before reviewer dispatch.
END-REVIEW-TRAILER
```

Orchestrator's model-check report, verbatim:

**Model check results:**

| Check | Result |
|---|---|
| Distinct `provider/model` across all 8 assistant turns (the `jq … \| sort -u` command) | `openai-codex/gpt-6.1-sol` only |
| `model-name.mjs` on the pin and on the session route | `gpt-6.1-sol` for both |
| `thinking_level_change` | `"thinkingLevel":"high"`, same as the pin's effort |
| Trailer `model_id` | `openai-codex/gpt-6.1-sol`, exactly the one route in the session |
| Counts under the Model check | **Yes** |

The fixture audit returned FAIL (B1: the README sentence does not check sign-ins). The row tests where the dispatch ran and whether it counts, not the fixture's verdict.

## Part 2: Phase 3 check on a trailer naming `router/cx/gpt-6.1-sol`, does not count

```
$ sed "s#^model_id: .*#model_id: router/cx/gpt-6.1-sol#" audit-trailer.txt > audit-trailer-router.txt; diff audit-trailer.txt audit-trailer-router.txt
4c4
< model_id: openai-codex/gpt-6.1-sol
---
> model_id: router/cx/gpt-6.1-sol
```

A fresh session (cwd `/tmp/f1-phase3`, same overlay) got: read skill://review-work, apply only Phase 3's Model check ('After each dispatch' bullet) to the session file above with `audit-trailer-router.txt`, dispatch nothing. Its reply, verbatim:

> **This dispatch does not count.** Model name and effort match the pin. The trailer's `model_id` does not exactly match the route the session ran on.
> 
> **Pin:** `openai-codex/gpt-6.1-sol:high`. I read it from the `model:` line (line 5) of `~/.omp/agent/agents/auditor.md`, which is where SKILL.md line 348 says the pin comes from ("the model and effort in `auditor.md` in the active agent directory").
> 
> **What the check compares** (SKILL.md line 351):
> 
> | Item | Value | Source | Result |
> |---|---|---|---|
> | Distinct assistant `provider/model` | `openai-codex/gpt-6.1-sol` (one value, across all 8 assistant turns) | `jq … \| sort -u` on `F1ImplementationAudit.jsonl` | Exactly one ✓ |
> | `model-name.mjs` output for the session route | `gpt-6.1-sol` | `node model-name.mjs openai-codex/gpt-6.1-sol` | |
> | `model-name.mjs` output for the pin | `gpt-6.1-sol` | `node model-name.mjs openai-codex/gpt-6.1-sol:high` | Same name ✓ |
> | Dispatch's `thinking_level_change` | `"thinkingLevel":"high"` (the session's only `thinking_level_change`) | session file | Equals pin effort `high` ✓ |
> | Trailer `model_id` | `router/cx/gpt-6.1-sol` | `/tmp/f1-native/audit-trailer-router.txt` | Not equal to `openai-codex/gpt-6.1-sol` ✗ |
> 
> The session's `model_change` entry also shows `openai-codex/gpt-6.1-sol` with `resolvedModelIsFallback:false`. It isn't part of the check, but it agrees with the route above.
> 
> `model-name.mjs` also prints `gpt-6.1-sol` for the trailer's `router/cx/gpt-6.1-sol`. That doesn't help, because the check only accepts the pinned model through another provider when comparing the session route against the pin. For the trailer it requires an exact match with the session route.
> 
> **Deciding clause (SKILL.md line 351):**
> > "the trailer's `model_id` equals that one `provider/model` exactly: the gate record takes its model from the trailer, so the trailer must name the route the session ran on. Any mismatch means the dispatch does not count."
> 
> **What follows** (same section, lines 351–352): the reply is kept verbatim as git-ignored evidence and never filed as a trailer. Its `FAIL` verdict with blocker B1 stays unrecorded for this invocation. The dispatch gets one bounded fresh retry, and if that retry also mismatches, the invocation is INCONCLUSIVE. I didn't dispatch anything or edit any file.

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`.

## Part 3: the remaining scenarios on session-file-shaped fixtures

Fresh sessions in `.worktrees/f1-native-fixture-audit` (deployed head 3e78520b8e, overlay `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml` plus the overlay named per session) applied the delivered review-work Phase 3 Model check and the rules it leads to, dispatching and writing nothing. Fixtures (`/tmp/f1-native/fx/`) are `F1ImplementationAudit.jsonl` of Part 1 (8 turns, `openai-codex/gpt-6.1-sol`, high) and its trailer, changed only where named:

```
swap FILE K PROVIDER MODEL = jq -c -s 'reduce .[] as $e ({n:0,out:[]}; if ($e.type=="message" and $e.message.role=="assistant") then .n+=1 | .out+=[(if .n>=$k then ($e|.message.provider=$p|.message.model=$m) else $e end)] elif ($e.type=="model_change" and $k==1) then .out+=[($e|.model=($p+"/"+$m))] else .out+=[$e] end) | .out[]' (assistant turns from the K-th on change provider/model; K=1 also rewrites model_change)
$ jq -r '<assistant provider/model>' audit-fallback.jsonl | uniq -c; thinking_level_change
      5 openai-codex/gpt-6.1-sol
      3 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' audit-medium.jsonl | uniq -c; thinking_level_change
      8 openai-codex/gpt-6.1-sol
medium
$ jq -r '<assistant provider/model>' audit-retry-sub-1.jsonl | uniq -c; thinking_level_change
      8 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' audit-retry-sub-2.jsonl | uniq -c; thinking_level_change
      8 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' audit-repair-sub.jsonl | uniq -c; thinking_level_change
      8 openai-codex/gpt-6.1-sol
      1 anthropic/claude-opus-5-5
high
$ jq -r '<assistant provider/model>' audit-router.jsonl | uniq -c; thinking_level_change
      8 router/cx/gpt-6.1-sol
high
# audit-medium.jsonl = jq -c 'if .type=="thinking_level_change" then .thinkingLevel="medium" else . end'
# audit-repair-sub.jsonl = the original + a user turn carrying the skill's TRAILER REPAIR message + its last assistant turn re-labelled anthropic/claude-opus-5-5
$ diff audit-trailer.txt trailer-fallback-pass.txt
4c4
< model_id: openai-codex/gpt-6.1-sol
---
> model_id: anthropic/claude-opus-5-5
6,7c6,7
< verdict: FAIL
< blockers: B1
---
> verdict: PASS
> blockers: none
$ diff audit-trailer.txt trailer-router.txt
4c4
< model_id: openai-codex/gpt-6.1-sol
---
> model_id: router/cx/gpt-6.1-sol
$ cmp audit-trailer.txt trailer-native.txt && echo same
same
$ cat /tmp/f1-ov-auditor-router.yml
task:
  agentModelOverrides:
    auditor: router/cx/gpt-6.1-sol:high
$ cat /tmp/f1-ov-auditor-opus.yml
task:
  agentModelOverrides:
    auditor: anthropic/claude-opus-5-5:high
$ cat /tmp/f1-ov-auditor-medium.yml
task:
  agentModelOverrides:
    auditor: openai-codex/gpt-6.1-sol:medium
```

Session prompt header, shared by every session:

> Read skill://review-work. Dispatch nothing, and write, edit or commit nothing. Apply only its Phase 3 Model check (both bullets: before any dispatch, and after each dispatch or trailer repair answer), its INCONCLUSIVE and retry rules, and what Fix waves step 3 and Phase 5 then record, to the hypothetical implementation-audit dispatches of auditor below. Their session files and trailers are fixtures already on disk; treat each as that dispatch's session file or trailer. Read the pin from this installation exactly as the skill says. For each case report: the pin and where you read it, the configured override if any, the values the check compares, whether the gate dispatches and whether the dispatch counts, and what the skill then requires (kept as evidence or submitted, retry, INCONCLUSIVE, the record's model, what the user is told), quoting the sentence that decides it.

### Session A (seed only): fallback model, lower effort, retry also substituted, repair turn substituted

Cases given: AuditF1 = audit-fallback.jsonl + trailer-fallback-pass.txt (PASS); AuditM1 = audit-medium.jsonl + trailer-native.txt; AuditS1/AuditS2 = audit-retry-sub-1/2.jsonl, each returning a PASS trailer; AuditR1 = audit-repair-sub.jsonl, repaired trailer trailer-native.txt. Reply, verbatim:

> I made no dispatches, edits or commits. Each fixture stood in for the subagent's session file, so I did not read `history://`. I applied only the parts of the skill you named.
> 
> ## Pin and override (same for all four cases)
> 
> - **Pin:** `model: openai-codex/gpt-6.1-sol:high`, from the frontmatter of `~/.omp/agent/agents/auditor.md`. `PI_CODING_AGENT_DIR` is not set, so the active agent directory is `~/.omp/agent`. `node model-name.mjs openai-codex/gpt-6.1-sol:high` prints `gpt-6.1-sol`. The pinned effort is `high`.
> - **Override:** none. `omp config get task.agentModelOverrides` lists `reviewer`, `plan-reviewer`, `measurement-sol`, `measurement-verifier`, `measurement-terra` and `measurement-adjudicator`, but has no `auditor` key. The seed config named by `PI_CONFIG_FILES` has no `auditor` key either.
> - **Pre-dispatch check:** it passes, so the gate dispatches. The deciding rule: *"Stop and dispatch nothing … when the definition names no model, or when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs from the definition's."* Neither condition holds.
> 
> Every case is decided by this rule: *"The dispatch counts only when that list holds exactly one `provider/model`, `model-name.mjs` prints the same name for it and for the pin, the dispatch's `thinking_level_change` value equals the pin's effort, and the trailer's `model_id` equals that one `provider/model` exactly … Any mismatch means the dispatch does not count. It gets the one bounded fresh retry above; a retry that mismatches again leaves the invocation INCONCLUSIVE, and you tell the user which model and effort ran."*
> 
> Where a dispatch does not count, this rule also applies: *"A reply that does not count is kept verbatim as evidence (`.omp/team-config/evidence/<plan basename>/wave-<n>/<invocation>-<subagent id>-reply.md` …) and is never submitted as the invocation's trailer: its verdict is never rewritten."*
> 
> ## Case 1: AuditF1, fallback model
> - **Session `provider/model` (jq list):** `anthropic/claude-opus-5-5` (3 turns) and `openai-codex/gpt-6.1-sol` (5 turns). The last turn is Opus. `thinking_level_change` = `high`.
> - **Trailer:** `model_id: anthropic/claude-opus-5-5`, `verdict: PASS`.
> - **Comparison:** the list has two entries, not exactly one. The trailer's `model-name` is `claude-opus-5-5`, but the pin's is `gpt-6.1-sol`. The effort does match. **The dispatch does not count.**
> - **What the skill requires:**
>   - Keep the PASS reply verbatim as `implementation-audit-AuditF1-reply.md`. Never submit it as the trailer.
>   - Run one fresh retry with the verbatim brief.
>   - If the retry counts, its trailer becomes the invocation's trailer, and the record's `model` comes from it (that would be `openai-codex/gpt-6.1-sol`).
>   - If the retry mismatches, the invocation is INCONCLUSIVE and the steps under case 3 apply.
>   - The user is told the model and effort only when the invocation ends up INCONCLUSIVE.
> 
> ## Case 2: AuditM1, same model at lower effort
> - **Session list:** only `openai-codex/gpt-6.1-sol`, which matches the pin's model name.
> - **Trailer:** `model_id: openai-codex/gpt-6.1-sol`, an exact match. `verdict: FAIL`, `blockers: B1`.
> - **Comparison:** `thinking_level_change` = `medium`, but the pin is `high`. **The dispatch does not count**, even though every model field matches.
> - **What the skill requires:**
>   - Keep the FAIL reply as `implementation-audit-AuditM1-reply.md`. Do not submit it.
>   - Run one fresh retry.
>   - If the retry also mismatches, the invocation is INCONCLUSIVE and the user is told: `openai-codex/gpt-6.1-sol` at `medium` ran, not `high`.
> - **Gaps:**
>   - The pre-dispatch check cannot catch this. The only medium override is on `measurement-verifier`, not `auditor`.
>   - The skill does not say whether B1 from a dispatch that does not count goes to `GC wave --blocker`. Since its trailer is never submitted, I would not record it, but that is my inference.
> 
> ## Case 3: AuditS1, then the retry AuditS2
> - **Both sessions:** only `anthropic/claude-opus-5-5`, at `high`. Each `model_change` already names Opus.
> - **Trailers:** `model_id: anthropic/claude-opus-5-5`, which matches the route exactly. Both say PASS.
> - **Comparison:** `model-name` gives `claude-opus-5-5`, but the pin is `gpt-6.1-sol`. **Neither dispatch counts.** The retry mismatched again, so the invocation is **INCONCLUSIVE**.
> - **Evidence:** keep both replies as `implementation-audit-AuditS1-reply.md` and `implementation-audit-AuditS2-reply.md`.
> - **Step 3 (`GC wave`):** pass `--outcome implementation-audit=INCONCLUSIVE` with no `--trailer`. The skill says: *"An invocation left INCONCLUSIVE by the Phase 3 model check is recorded without its trailer."*
> - **Step 3a, if `GC wave` prints CONTINUE:** *"A closing wave with an INCONCLUSIVE invocation is incomplete, not failed … when `GC wave` printed `CONTINUE` it gets no budget ask and no Override. Record it (step 3), tell the user why the invocation is INCONCLUSIVE (for a pin mismatch, which model and effort ran, Phase 3), commit no fix, and once that cause is resolved … repeat the wave on the same tree from step 1; the repeat spends no fix round."*
>   - That sentence covers a *closing* wave only. For a first wave, I rely on Phase 4: *"INCONCLUSIVE lane is not a pass … re-run the affected invocation."*
> - **If `GC wave` prints STOP:** step 3's ask applies, but freeze is not available: *"The script refuses freeze after failing QA or an INCONCLUSIVE invocation."*
> - **Phase 5:** no valid record is possible. An override *"may accompany `FAIL` verdicts only (an `INCONCLUSIVE` invocation is re-run, never overridden)"*, so there is no `model` to record.
> - **What the user is told:** `anthropic/claude-opus-5-5` at `high` ran in both dispatches, instead of `openai-codex/gpt-6.1-sol:high`.
> 
> ## Case 4: AuditR1, repair turn substituted
> - **The model check is re-run on the whole session file, including the repair turn.** The list is `openai-codex/gpt-6.1-sol` (8 turns) and `anthropic/claude-opus-5-5` (1 turn). The last turn, which is the repair answer, is Opus. Effort is `high`.
> - **Comparison:** the list has two entries. **The dispatch does not count.** The repaired trailer's `model_id: openai-codex/gpt-6.1-sol` does not rescue it. It matches the pin, but Opus wrote it, which is exactly the case this check exists to catch.
> - **What the skill requires:** *"When the repair turn fails it, the dispatch does not count (as above): keep its answer verbatim as `<invocation>-<subagent id>-repair-reply.md` next to the reply, never as a `*trailer*` file."*
>   - Keep the repair answer as `implementation-audit-AuditR1-repair-reply.md`, next to the first reply `implementation-audit-AuditR1-reply.md`.
>   - Do not store `trailer-native.txt`, with its FAIL/B1, as the trailer, and do not run the trailer check on it.
>   - Then: *"Only when … the repair turn fails the model check … dispatch a fresh reviewer with the verbatim brief."* That fresh reviewer is the one bounded retry. It may get one repair, and its session gets the same model check.
>   - If the retry counts, its trailer supplies the record's `model`. If not, the invocation is INCONCLUSIVE and the steps under case 3 apply.
> - **What the user is told:** the review turns ran on `openai-codex/gpt-6.1-sol` at `high`, but the repair turn ran on `anthropic/claude-opus-5-5`. The session's only `thinking_level_change` is `high`.
> 
> ## Summary
> 
> | Case | Dispatches | Counts | Trailer submitted | Next step | Record `model` |
> |---|---|---|---|---|---|
> | 1 | yes | no (two routes, Opus) | no, kept as reply | 1 fresh retry | from the retry's trailer if it counts |
> | 2 | yes | no (effort `medium`) | no, kept as reply | 1 fresh retry | from the retry's trailer if it counts |
> | 3 | yes (×2) | no, both Opus | no, both kept as replies | INCONCLUSIVE, no trailer; user told Opus at high | none; no record, no override |
> | 4 | yes | no (Opus repair turn) | no, kept as repair reply | fresh reviewer as the retry | from the retry's trailer if it counts |

### Session B (overlay auditor-router): same model through another provider

Case given: pre-dispatch check, then AuditX1 = audit-router.jsonl + trailer-router.txt. Reply, verbatim:

> The pre-dispatch check lets the gate dispatch, and AuditX1 counts. The record carries `router/cx/gpt-6.1-sol`. I dispatched nothing and wrote, edited or committed nothing.
> 
> ## Pin and override
> - **Pin**: `openai-codex/gpt-6.1-sol:high`. The skill says "Its pin is the model and effort in `auditor.md` in the active agent directory", so I read it from the `model:` line of `~/.omp/agent/agents/auditor.md`. No agent-directory override is set in the environment, so that is the active directory. The other `auditor.md` copies (`agents.bak-*`, `backups/`, `profiles/prp/`, `tmp/`) are not active.
> - **Configured override**: `omp config get task.agentModelOverrides` returns `"auditor":"router/cx/gpt-6.1-sol:high"`. It comes from `/tmp/f1-ov-auditor-router.yml`, which `PI_CONFIG_FILES` loads after the team-config seed `config.yml`. The seed has no `auditor` entry.
> 
> ## Before dispatch
> - **Model name**: `model-name.mjs router/cx/gpt-6.1-sol openai-codex/gpt-6.1-sol:high` prints `gpt-6.1-sol` for both.
> - **Effort**: `high` on both sides.
> - Only the provider differs. The deciding sentence: "An entry that differs only in its provider (`router/cx/gpt-6.1-sol:high` for `openai-codex/gpt-6.1-sol:high`) is no conflict and dispatches."
> - **Result**: the gate dispatches. There is nothing to tell the user at this step.
> 
> ## After dispatch (AuditX1)
> I ran the skill's checks on `audit-router.jsonl` and `trailer-router.txt`:
> 
> | Check | Value read | Result |
> |---|---|---|
> | Distinct `provider/model` of assistant turns (`jq … \| sort -u`) | `router/cx/gpt-6.1-sol` only | exactly one ✔ |
> | `model-name.mjs` for that route and for the pin | `gpt-6.1-sol` = `gpt-6.1-sol` | ✔ |
> | `thinking_level_change.thinkingLevel` | `high`, against pin effort `high` | ✔ |
> | Trailer `model_id` | `router/cx/gpt-6.1-sol`, identical to the session route | ✔ |
> 
> Deciding sentence: "The dispatch counts only when that list holds exactly one `provider/model`, `model-name.mjs` prints the same name for it and for the pin, the dispatch's `thinking_level_change` value equals the pin's effort, and the trailer's `model_id` equals that one `provider/model` exactly". All four conditions hold, so:
> - **Counts**: yes.
> - **Retry**: none needed. The "one bounded fresh retry" applies only on a mismatch.
> - **INCONCLUSIVE**: no.
> 
> The session's `credential_pin` record names `openai-codex`. The model check does not read that record, so it doesn't affect the outcome.
> 
> ## What the skill then requires
> - **Submitted, not just kept as evidence.** The keep-as-evidence rule covers only "A reply that does not count". This reply counts, so "A retry that counts supplies the invocation's trailer" applies to it as a first dispatch.
> - **Wave record (Fix waves step 3).** The trailer's verdict is `FAIL` with `blockers: B1`. The reply has a matching `Blocker B1:` line. The wave is recorded with:
>   - `--outcome implementation-audit=FAIL`
>   - `--trailer implementation-audit=<stored trailer file>`
> 
>   Deciding text: "one `--trailer <invocation>=<trailer file>` for each reviewer outcome that is PASS or FAIL". The skill's own `validate-gate-record.mjs --trailer` check still runs before the wave is recorded. I did not run it, because you scoped this to the model check.
> - **Gate record model (Phase 5).** `resolution[].model` is `router/cx/gpt-6.1-sol`, taken from the trailer and not from config or the pin. Deciding text: "the gate record takes its model from the trailer, so the trailer must name the route the session ran on". The record's `model_id` must also match the trailer's.
> - **What the user is told.** There is no pin-mismatch message, because "tell the user which model and effort ran" applies only after a retry also mismatches. The user does hear the gate outcome: this FAIL blocks ("one `FAIL` or `INCONCLUSIVE` blocks"). It goes to a fix round under Fix waves step 3a, or to an override with one `downgrades` entry for B1.

### Session C (overlay auditor-opus): override names another model

> The check stops the gate. Nothing is dispatched, so nothing is counted, retried, recorded or committed. The only required step is telling the user about the conflicting override.
> 
> **Where the pin comes from**
> - The active agent directory has `~/.omp/agent/agents/auditor.md`, with frontmatter `model: openai-codex/gpt-6.1-sol:high`. The pinned model is `gpt-6.1-sol` and the effort is `high`. The project's `.omp/agents/` has no `auditor.md`, so nothing shadows it. `team-config/agent/agents/auditor.md` has the same value.
> - This matches the pin the skill names: "`auditor` runs on `openai-codex/gpt-6.1-sol:high` from its own definition (`auditor.md` …)".
> 
> **The override that is set**
> - `omp config get task.agentModelOverrides` returns `"auditor":"anthropic/claude-opus-5-5:high"`.
> - It comes from `/tmp/f1-ov-auditor-opus.yml` (`task.agentModelOverrides.auditor: anthropic/claude-opus-5-5:high`), which is listed in `PI_CONFIG_FILES`.
> 
> **What the check compares**
> - `model-name.mjs openai-codex/gpt-6.1-sol:high anthropic/claude-opus-5-5:high` prints `gpt-6.1-sol` and `claude-opus-5-5`, so the model names differ.
> - The efforts are both `high`, so they match.
> - The difference is the model itself, not only the provider. The exemption ("An entry that differs only in its provider … is no conflict and dispatches") therefore does not apply.
> 
> **Does the gate dispatch, and does it count:** no and no. The deciding sentence is:
> > "Before any dispatch, read the pin from `auditor.md`. Stop and dispatch nothing, and tell the user which setting conflicts or that the pin is missing, when the definition names no model, or when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs from the definition's."
> 
> There is no session file to check against the pin and no trailer. "A dispatch counts only when it ran on that model at that effort" never comes into play.
> 
> **What the skill then requires**
> - **Evidence or submitted trailer:** neither. The rule for keeping a reply as evidence ("A reply that does not count is kept verbatim as evidence … `<invocation>-<subagent id>-reply.md`") needs a reply, and none exists. No `--trailer` is filed.
> - **Retry:** none. The bounded retry ("Apply one bounded fresh-context retry; if unresolved, record `INCONCLUSIVE`") and the fresh reviewer in Trailer repair both apply to a reviewer that was dispatched. Here the stop happens before any dispatch, and dispatching anyway would break "dispatch nothing".
> - **INCONCLUSIVE and Fix waves step 3:** there is no wave to record. Step 3 runs "After the wave's verdicts, before any fix", and no verdict exists. The `--outcome implementation-audit=INCONCLUSIVE` with no `--trailer` route is for "An invocation left INCONCLUSIVE by the Phase 3 model check", meaning a dispatch that ran and failed the post-dispatch check. That did not happen. No step 3a repeat is needed either, because no wave started.
>   - One part is open to reading: Phase 0.6 says "An unresolvable invocation is recorded loudly with its reason and becomes `INCONCLUSIVE`." I don't read it as applying here. The pin resolves cleanly; what conflicts is a configuration setting, and the Phase 3 bullet that covers this exact case only says to stop and tell the user.
> - **The record's model (Phase 5):** none. No record is written. The record takes `model_id` from a trailer, and none exists. Any record would be `blocked` anyway, since every invocation in `reviewers_run` "needs its **own** `trailer_artifact`".
> - **What the user is told:** that `task.agentModelOverrides.auditor = anthropic/claude-opus-5-5:high` (from `/tmp/f1-ov-auditor-opus.yml` via `PI_CONFIG_FILES`) conflicts with the `auditor.md` pin `openai-codex/gpt-6.1-sol:high` on model name (`claude-opus-5-5` vs `gpt-6.1-sol`; effort matches). The implementation-audit cannot be dispatched until that entry is removed or set to `gpt-6.1-sol:high` through any provider. Until then the gate stays not passed.

### Session D (overlay auditor-medium): override names another effort

> **Pre-dispatch case: the gate stops and dispatches nothing.** The configured override keeps the pinned model but lowers the effort from `high` to `medium`.
> 
> **Pin and where I read it**
> - The skill says to read the pin from "`auditor.md` in the active agent directory" (Phase 3 Model check). The active agent directory is `~/.omp/agent/agents/`. No profile is active, and `PI_CONFIG_FILES` sets no agent directory.
> - `~/.omp/agent/agents/auditor.md` frontmatter: `model: openai-codex/gpt-6.1-sol:high`.
> - So the model is `openai-codex/gpt-6.1-sol` and the effort is `high`. This matches the value the skill text quotes.
> 
> **Configured override**
> - `omp config get task.agentModelOverrides` returns `"auditor":"openai-codex/gpt-6.1-sol:medium"`.
> - It comes from the fixture config `/tmp/f1-ov-auditor-medium.yml`, which `PI_CONFIG_FILES` lists after the seed config. The file contains `task.agentModelOverrides.auditor: openai-codex/gpt-6.1-sol:medium`.
> 
> **Values compared**
> | | Definition (pin) | Override |
> |---|---|---|
> | Model name (`model-name.mjs`) | `gpt-6.1-sol` | `gpt-6.1-sol` (same) |
> | Provider | `openai-codex` | `openai-codex` (same) |
> | Effort | `high` | `medium` (**differs**) |
> 
> The provider exemption does not apply, because the provider is the same and the difference is the effort: "An entry that differs only in its provider (`router/cx/gpt-6.1-sol:high` for `openai-codex/gpt-6.1-sol:high`) is no conflict and dispatches."
> 
> **Deciding sentence** (Phase 3, first Model check bullet):
> > "Before any dispatch, read the pin from `auditor.md`. Stop and dispatch nothing, and tell the user which setting conflicts or that the pin is missing, when the definition names no model, or when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs from the definition's."
> 
> **Does the gate dispatch, and does it count?**
> - **No dispatch.** The implementation-audit `task` is never sent.
> - **Nothing to count.** There is no subagent, session file, reply or trailer. The post-dispatch bullet, which checks the session file's `provider/model`, `thinking_level_change` and the trailer's `model_id`, never runs.
> 
> **What the skill then requires**
> - **Kept as evidence or submitted:** neither. No reply exists, so nothing goes to `wave-<n>/<invocation>-<subagent id>-reply.md` or to a `*trailer*` path.
> - **Retry:** none. The Phase 3 retry ("Apply one bounded fresh-context retry") covers a dispatched reviewer that times out or returns nothing. Re-sending is pointless anyway, because the conflict is in the configuration. The "Brief guard" re-send rule doesn't apply either.
> - **INCONCLUSIVE:** not reached. INCONCLUSIVE is an outcome of a dispatch or invocation that ran. Fix waves step 3 records `--outcome <invocation>=…` only "for each invocation that ran", and none ran. So there is no `GC wave` call, no ledger entry, and no wave or fix round spent. Fix waves step 3a's line "tell the user why the invocation is INCONCLUSIVE (for a pin mismatch, which model and effort ran …)" applies only after a dispatch that ran on the wrong model, not to this case.
> - **Record model (Phase 5):** none. No record is written, so no `resolution[].model`, `verdicts[]` or `trailer_sha256` exists. The gate is not passed and not overridden. Phase 4: "Gate passes only when … every invocation actually run returned `PASS` from a dispatch that counted under the Phase 3 model check."
> - **What the user is told:** which setting conflicts. In this case: `task.agentModelOverrides.auditor = openai-codex/gpt-6.1-sol:medium`, from `/tmp/f1-ov-auditor-medium.yml` through `PI_CONFIG_FILES`. Its effort `medium` differs from the `auditor.md` pin `openai-codex/gpt-6.1-sol:high`, so the implementation-audit was not dispatched. The gate can't proceed until the override is removed or changed to effort `high`. A provider-only difference, such as `router/cx/gpt-6.1-sol:high`, would be acceptable.
> 
> One possible ambiguity: Phase 0.6 says "An unresolvable invocation is recorded loudly with its reason and becomes `INCONCLUSIVE`." I didn't apply it here. The invocation does resolve, to `auditor`, and the Phase 3 bullet more specifically says what to do with a pin conflict: stop and tell the user, nothing more.
> 
> Nothing was dispatched, written, edited or committed.

Not run: an `auditor.md` without a `model:` line (Configuration overrides the pin, second clause); it needs a second signed-in agent directory. The skill sentence the sessions above quote names that case in the same clause.
