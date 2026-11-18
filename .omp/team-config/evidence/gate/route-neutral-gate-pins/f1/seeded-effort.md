# Same model, lower effort

Scenario: "Same model, lower effort"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/effort/ImplementationAudit.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['medium'], model_change [('onara/cx/gpt-6.1-sol', False)]
- `f1/seeded/effort/ImplementationAudit2.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['medium'], model_change [('onara/cx/gpt-6.1-sol', False)]

## Prompt

```text
Do not dispatch any agent, send no message to any agent and do not write or commit anything. Read the delivered review-work skill (`skill://review-work`): Phase 3 with its **Model check** and **Trailer repair**, plus whatever Phase 3 refers to (Phase 4, Fix waves step 3). Wave 1's `implementation-audit` invocation of the plan `.omp/plans/add-reset.md` (repository /tmp/rngp/f2work) has already been dispatched; the dispatch session files below stand in for the path `read history://<subagent id>` would print, and each reply (and repair answer) is the session's assistant text. `ImplementationAudit` returned PASS; its fresh retry `ImplementationAudit2` (verbatim brief, new task call) returned PASS.

- ImplementationAudit: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/effort/ImplementationAudit.jsonl
- ImplementationAudit2: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/effort/ImplementationAudit2.jsonl

Apply Phase 3 exactly as written, running its commands (the jq list, `model-name.mjs` on each `provider/model` and on the pin, the pin from `auditor.md` in this installation's agent directory, `omp config get task.agentModelOverrides`). Report: for each dispatch the jq output, the `model-name.mjs` outputs, the `thinking_level_change` value, the trailer's `model_id`, the pin, and whether it counts; what happens to each reply (kept as evidence where, or submitted as the trailer); whether a fresh retry follows; the invocation's outcome and how `GC wave` records it (`--trailer` or `--outcome`); whether the gate can pass; and what the user is told. Cite the skill sentence behind each conclusion.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (final, report below)

## Final report (run 2, verbatim)

````text
I applied Phase 3 to both dispatches, running only read commands. Both ran the pinned model at the wrong effort, so neither counts. `implementation-audit` is INCONCLUSIVE and the gate cannot pass.

## Pin
- **Pin:** `auditor.md` in this installation's agent directory (`…/rngp-home/.omp/agent/agents/auditor.md`) has the line `model: onara/cx/gpt-6.1-sol:high`. So the model is `onara/cx/gpt-6.1-sol` and the effort is `high`. `model-name.mjs onara/cx/gpt-6.1-sol:high` prints `gpt-6.1-sol`.
- **Overrides:** `omp config get task.agentModelOverrides` prints `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`. There is no `auditor` entry, so nothing conflicts and the dispatch was allowed. Skill: "Stop and dispatch nothing … when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs from the definition's."

## Per dispatch
The two session files are identical in every value Phase 3 checks.

| | ImplementationAudit | ImplementationAudit2 |
|---|---|---|
| jq list (`… \| sort -u`) | `onara/cx/gpt-6.1-sol` | `onara/cx/gpt-6.1-sol` |
| `model-name.mjs onara/cx/gpt-6.1-sol` | `gpt-6.1-sol` | `gpt-6.1-sol` |
| `model-name.mjs` on the pin | `gpt-6.1-sol` | `gpt-6.1-sol` |
| `thinking_level_change` | `"thinkingLevel":"medium"` (`configured: null`) | `"thinkingLevel":"medium"` (`configured: null`) |
| trailer `model_id` | `onara/cx/gpt-6.1-sol` | `onara/cx/gpt-6.1-sol` |
| trailer `verdict` | PASS | PASS |
| Counts? | **No** | **No** |

Three of the four conditions hold: there is exactly one `provider/model`, its name matches the pin's, and `model_id` equals the route exactly. The effort condition fails because `medium` is not `high`. Skill: "The dispatch counts only when … the dispatch's `thinking_level_change` value equals the pin's effort … Any mismatch means the dispatch does not count."

## The replies
- **Kept as evidence, never submitted as trailers.** Each reply goes verbatim to its own git-ignored file:
  - `/tmp/rngp/f2work/.omp/team-config/evidence/add-reset/wave-1/implementation-audit-ImplementationAudit-reply.md`
  - `/tmp/rngp/f2work/.omp/team-config/evidence/add-reset/wave-1/implementation-audit-ImplementationAudit2-reply.md`
  
  Not written, as you instructed. Skill: "A reply that does not count is kept verbatim as evidence (`…/wave-<n>/<invocation>-<subagent id>-reply.md`, git-ignored, one file per dispatch …) and is never submitted as the invocation's trailer: its verdict is never rewritten".
- **No trailer repair.** Repair applies only to a trailer that "is missing or fails the trailer check". Here the trailer is fine and the effort is wrong, which a repair message cannot change. Skill: "never `write agent://<id>` to a reviewer that already returned a verdict; the one exception is the trailer repair".

## Retry
- **The first dispatch's mismatch is what triggered the retry.** `ImplementationAudit2` used up "the one bounded fresh retry above".
- **No further retry.** Skill: "a retry that mismatches again leaves the invocation INCONCLUSIVE, and you tell the user which model and effort ran."

## Outcome and `GC wave`
- **The invocation is INCONCLUSIVE.**
- **Recorded with `--outcome`, no `--trailer`.** Skill: "An invocation left INCONCLUSIVE by a mismatch is recorded with `--outcome <invocation>=INCONCLUSIVE` and no `--trailer`". Fix waves step 3 says the same: "recorded without its trailer … because `GC wave` checks each trailer's verdict against the outcome".
- **Command:** `GC wave --lane F2 --snapshot <wave-1 snapshot path> --outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE`.
  - `qa=PASS` is an assumption, because Phase 1 dispatches no reviewer after failing QA.
  - There are no `--blocker` flags; GC adds `implementation-audit-inconclusive` by itself (`gate-convergence.mjs:616`).
- **Depth is `standard`, so this is the only invocation.** The plan says `Mandatory class: none` and `Risk tier: product`, and it does not change a gate mechanism.
- **Expected decision is CONTINUE.** For wave 1 at the product tier with one blocker, `decide()` returns CONTINUE [INFERENCE: GC not run, because it writes the ledger].

## Can the gate pass? No
- **No pass.** Skill: "Gate passes only when … every invocation actually run returned `PASS` from a dispatch that counted under the Phase 3 model check."
- **No override.** An override requires that "every invocation returned `PASS` or `FAIL` with a stored trailer", and the record rule is "an `INCONCLUSIVE` invocation is re-run, never overridden".
- **No freeze either.** "The script refuses freeze after … an INCONCLUSIVE invocation".

## What the user is told
"`implementation-audit` is INCONCLUSIVE. Both dispatches ran `onara/cx/gpt-6.1-sol` (the right model) at effort **medium**, and the auditor pin needs **high**. Neither PASS counts, the gate is not passed, and no override or freeze is possible."

After that:
- **No fix is committed and there is no budget ask.** Step 3a: "it gets no budget ask and no Override. Record it (step 3), tell the user why … (for a pin mismatch, which model and effort ran, Phase 3), commit no fix".
- **Once dispatches really run at `high`, repeat wave 1 on the same tree from step 1.** Step 3a: "once that cause is resolved … repeat the wave on the same tree from step 1; the repeat spends no fix round".
- **Likely cause [INFERENCE]:** `configured: null` suggests the `:high` from `auditor.md` was never applied. The `task` role default in `config.yml` is `onara/cc/claude-sonnet-5-5:medium`.

## Gap in the skill
Step 3a's INCONCLUSIVE rule names only a **closing** wave. Wave 1 is not a closing wave, so read literally its CONTINUE sends you to "step 4 while fix rounds are left". That would spend a fix round with nothing to fix, since there is no code blocker. I applied the closing-wave handling, backed by Phase 4 ("re-run the affected invocation") and Blocker disposition ("an incomplete round … never triggers an ask"). The step 3a sentence should be widened to cover any wave.
````

## Result

PASS. Both dispatches ran `onara/cx/gpt-6.1-sol` at `medium` against the `high` pin; neither counts, `implementation-audit` is INCONCLUSIVE, the gate cannot pass, and the user is told the model and effort that ran.
