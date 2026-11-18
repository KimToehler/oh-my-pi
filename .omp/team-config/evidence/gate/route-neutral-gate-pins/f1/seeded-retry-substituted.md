# Retry also substituted

Scenario: "Retry also substituted"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/retry-substituted/ImplementationAudit.jsonl`: models ['onara/cc/claude-opus-5-5', 'onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False), ('onara/cc/claude-opus-5-5', True)]
- `f1/seeded/retry-substituted/ImplementationAudit2.jsonl`: models ['onara/cc/claude-opus-5-5'], effort ['high'], model_change [('onara/cc/claude-opus-5-5', False)]

## Prompt

```text
Do not dispatch any agent, send no message to any agent and do not write or commit anything. Read the delivered review-work skill (`skill://review-work`): Phase 3 with its **Model check** and **Trailer repair**, plus whatever Phase 3 refers to (Phase 4, Fix waves step 3). Wave 1's `implementation-audit` invocation of the plan `.omp/plans/add-reset.md` (repository /tmp/rngp/f2work) has already been dispatched; the dispatch session files below stand in for the path `read history://<subagent id>` would print, and each reply (and repair answer) is the session's assistant text. `ImplementationAudit` was moved to another model by the retry chain and returned PASS; its fresh retry `ImplementationAudit2` (verbatim brief, new task call) returned PASS.

- ImplementationAudit: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/retry-substituted/ImplementationAudit.jsonl
- ImplementationAudit2: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/retry-substituted/ImplementationAudit2.jsonl

Apply Phase 3 exactly as written, running its commands (the jq list, `model-name.mjs` on each `provider/model` and on the pin, the pin from `auditor.md` in this installation's agent directory, `omp config get task.agentModelOverrides`). Report: for each dispatch the jq output, the `model-name.mjs` outputs, the `thinking_level_change` value, the trailer's `model_id`, the pin, and whether it counts; what happens to each reply (kept as evidence where, or submitted as the trailer); whether a fresh retry follows; the invocation's outcome and how `GC wave` records it (`--trailer` or `--outcome`); whether the gate can pass; and what the user is told. Cite the skill sentence behind each conclusion.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (final, report below)

## Final report (run 2, verbatim)

````text
Neither dispatch counts under Phase 3's model check. `implementation-audit` is **INCONCLUSIVE** for wave 1, no further retry follows, and the gate cannot pass. I dispatched nothing, sent no messages and wrote nothing.

## Pin (read before any dispatch)
- `~/.omp/agent/agents/auditor.md` has `model: onara/cx/gpt-6.1-sol:high`. That is model `gpt-6.1-sol` at effort `high`.
- `model-name.mjs onara/cx/gpt-6.1-sol:high` prints `gpt-6.1-sol`.
- `omp config get task.agentModelOverrides` prints `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`. There is no `auditor` entry, so there is no conflict and dispatching was allowed. Rule: "Stop and dispatch nothing … when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs from the definition's."

## Per dispatch
The tests come from this sentence: "The dispatch counts only when that list holds exactly one `provider/model`, `model-name.mjs` prints the same name for it and for the pin, the dispatch's `thinking_level_change` value equals the pin's effort, and the trailer's `model_id` equals that one `provider/model` exactly … Any mismatch means the dispatch does not count."

| | ImplementationAudit | ImplementationAudit2 |
|---|---|---|
| jq list | `onara/cc/claude-opus-5-5`, `onara/cx/gpt-6.1-sol` (two entries) | `onara/cc/claude-opus-5-5` (one entry) |
| `model-name.mjs` | `claude-opus-5-5`, `gpt-6.1-sol` | `claude-opus-5-5` |
| Pin's model name | `gpt-6.1-sol` | `gpt-6.1-sol` |
| `thinking_level_change` | `high` (matches the pin) | `high` (matches the pin) |
| Trailer `model_id` | `onara/cc/claude-opus-5-5` | `onara/cc/claude-opus-5-5` |
| Trailer verdict | `PASS`, blockers `none` | `PASS`, blockers `none` |
| Fails because | The list has two entries, not exactly one. `model_id` therefore cannot equal "that one" entry. One listed name (`claude-opus-5-5`) also differs from the pin. | The name `claude-opus-5-5` is not `gpt-6.1-sol`. The effort matches and `model_id` matches the route the session ran on, but the name test fails. |
| Counts | No | No |

The first session shows how it moved: `model_change` to `onara/cx/gpt-6.1-sol`, two GPT tool turns, then `model_change` to `onara/cc/claude-opus-5-5` with `resolvedModelIsFallback: true`. The Claude turns wrote the review. The second session started on `onara/cc/claude-opus-5-5` (`resolvedModelIsFallback: false`) and stayed there.

**Trailer repair does not apply.** Repair covers a trailer that "is missing or fails the trailer check". Both trailers are complete and agree with their replies. The defect is the model that ran, and repair cannot change that: it asks the same session again, and the model check is repeated "on the whole session file, repair turn included".

## What happens to each reply
- Neither reply is submitted as the trailer. Rule: "A reply that does not count is kept verbatim as evidence (`.omp/team-config/evidence/<plan basename>/wave-<n>/<invocation>-<subagent id>-reply.md`, git-ignored, one file per dispatch so a retry never overwrites the first reply) and is never submitted as the invocation's trailer: its verdict is never rewritten".
- The two evidence paths, in `/tmp/rngp/f2work`:
  - `.omp/team-config/evidence/add-reset/wave-1/implementation-audit-ImplementationAudit-reply.md`
  - `.omp/team-config/evidence/add-reset/wave-1/implementation-audit-ImplementationAudit2-reply.md`
- Neither goes in a `*trailer*` file. I wrote neither, as instructed.

## No further retry
ImplementationAudit2 was the one bounded retry. Rule: "It gets the one bounded fresh retry above; a retry that mismatches again leaves the invocation INCONCLUSIVE, and you tell the user which model and effort ran."

## Outcome and how `GC wave` records it
- The outcome is INCONCLUSIVE.
- `GC wave --lane F2 --snapshot <path> --outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE`, with no `--trailer`. `qa=PASS` assumes QA passed, since reviewers are only dispatched after passing QA.
- Rule: "An invocation left INCONCLUSIVE by a mismatch is recorded with `--outcome <invocation>=INCONCLUSIVE` and no `--trailer` (Fix waves step 3)". Step 3 says the same: "recorded without its trailer … because `GC wave` checks each trailer's verdict against the outcome and a verdict is never rewritten."

## Can the gate pass?
- **No.** Phase 4: "Gate passes only when QA matrix has no failing row and every invocation actually run returned `PASS` from a dispatch that counted under the Phase 3 model check." It also says: "one `FAIL` or `INCONCLUSIVE` blocks."
- An override is not available either: it "may accompany `FAIL` verdicts only (an `INCONCLUSIVE` invocation is re-run, never overridden)."
- Freeze is out too: "The script refuses freeze after failing QA or an INCONCLUSIVE invocation".

## What happens next
- Step 3a: "Record it (step 3), tell the user why the invocation is INCONCLUSIVE (for a pin mismatch, which model and effort ran, Phase 3), commit no fix, and once that cause is resolved … repeat the wave on the same tree from step 1; the repeat spends no fix round."
- That sentence is written for a *closing* wave, and wave 1 is not one. For a first wave, the general rule fills the gap: "an incomplete round keeps the lane's existing stop, never counts as free of blocking findings and never triggers an ask" (Blocker disposition). There are no blockers to fix in any case, and an INCONCLUSIVE invocation has to be re-run before anyone claims completion (Phase 4).

## What the user is told
1. `implementation-audit` is INCONCLUSIVE because of a pin mismatch.
2. The pin is `onara/cx/gpt-6.1-sol` at effort `high`.
3. ImplementationAudit started on `onara/cx/gpt-6.1-sol` at `high`. The retry chain then fell back to `onara/cc/claude-opus-5-5` at `high`, which wrote the review.
4. ImplementationAudit2 ran entirely on `onara/cc/claude-opus-5-5` at `high`.
5. Both PASS replies are kept only as git-ignored evidence. The gate has not passed, and no override or freeze is available.
6. The config is not the cause: `task.agentModelOverrides` has no `auditor` entry. The cause is the route falling back away from `gpt-6.1-sol`.
7. Once `gpt-6.1-sol` is reachable, wave 1 is repeated on the same tree from step 1. The repeat costs no fix round.
````

## Result

PASS (run 2). Both dispatches end on `onara/cc/claude-opus-5-5`; `implementation-audit` stays INCONCLUSIVE, `GC wave` records it with `--outcome implementation-audit=INCONCLUSIVE` and no `--trailer`, both replies are kept verbatim in their own files (`implementation-audit-ImplementationAudit-reply.md`, `implementation-audit-ImplementationAudit2-reply.md`), the gate does not pass, and the user is told which model and effort ran. Run 1 (on `acaf0ea77f`) showed both replies mapped to one `<invocation>-reply.md` path, so the second would overwrite the first; fixed in `2fcb711078`.
