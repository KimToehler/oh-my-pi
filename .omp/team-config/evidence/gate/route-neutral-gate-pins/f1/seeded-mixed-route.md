# All turns on one provider/model

Scenario: F2 requirement "all turns on one `provider/model`"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/mixed-route/ImplementationAudit.jsonl`: models ['onara/cx/gpt-6.1-sol', 'openai-codex/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False), ('openai-codex/gpt-6.1-sol', True)]
- `f1/seeded/mixed-route/ImplementationAudit2.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]

## Prompt

```text
Do not dispatch any agent, send no message to any agent and do not write or commit anything. Read the delivered review-work skill (`skill://review-work`): Phase 3 with its **Model check** and **Trailer repair**, plus whatever Phase 3 refers to (Phase 4, Fix waves step 3). Wave 1's `implementation-audit` invocation of the plan `.omp/plans/add-reset.md` (repository /tmp/rngp/f2work) has already been dispatched; the dispatch session files below stand in for the path `read history://<subagent id>` would print, and each reply (and repair answer) is the session's assistant text. `ImplementationAudit` returned PASS with a trailer that passes the trailer check; its fresh retry `ImplementationAudit2` (verbatim brief, new task call) returned PASS.

- ImplementationAudit: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/mixed-route/ImplementationAudit.jsonl
- ImplementationAudit2: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/mixed-route/ImplementationAudit2.jsonl

Apply Phase 3 exactly as written, running its commands (the jq list, `model-name.mjs` on each `provider/model` and on the pin, the pin from `auditor.md` in this installation's agent directory, `omp config get task.agentModelOverrides`). Report: for each dispatch the jq output, the `model-name.mjs` outputs, the `thinking_level_change` value, the trailer's `model_id`, the pin, and whether it counts; what happens to each reply (kept as evidence where, or submitted as the trailer); whether a fresh retry follows; the invocation's outcome and how `GC wave` records it (`--trailer` or `--outcome`); whether the gate can pass; and what the user is told. Cite the skill sentence behind each conclusion.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (final, report below)

## Final report (run 2, verbatim)

````text
Phase 3 outcome: the first dispatch (`ImplementationAudit`) does not count, and the retry (`ImplementationAudit2`) does, so `implementation-audit` = PASS. I wrote nothing, dispatched nothing and messaged no agent.

## Before dispatch
- **Pin.** `~/.omp/agent/agents/auditor.md` has `model: onara/cx/gpt-6.1-sol:high`. Running `model-name.mjs` on it prints `gpt-6.1-sol`. The effort is `high`.
- **Overrides.** `omp config get task.agentModelOverrides` prints `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`. There is no `auditor` entry, so there is no conflict. Rule: "Stop and dispatch nothing … when `omp config get task.agentModelOverrides` has an `auditor` entry whose model name or effort differs".
- **Depth.** The plan says `Mandatory class: none` and `Risk tier: product`, and it changes no review or gate mechanism. So the depth is `standard`, and `implementation-audit` is the only invocation. Rule: "It is `risky` when the Mandatory class is not `none` or the plan changes a review, gate or release mechanism … otherwise it is `standard`."

## Model check per dispatch

| | ImplementationAudit | ImplementationAudit2 |
|---|---|---|
| jq output | `onara/cx/gpt-6.1-sol`<br>`openai-codex/gpt-6.1-sol` | `onara/cx/gpt-6.1-sol` |
| `model-name.mjs` per entry | `gpt-6.1-sol`, `gpt-6.1-sol` | `gpt-6.1-sol` |
| `model-name.mjs` on pin | `gpt-6.1-sol` | `gpt-6.1-sol` |
| `thinking_level_change` | `high` | `high` |
| trailer `model_id` | `onara/cx/gpt-6.1-sol` | `onara/cx/gpt-6.1-sol` |
| pin | `onara/cx/gpt-6.1-sol:high` | `onara/cx/gpt-6.1-sol:high` |
| **counts** | **no** | **yes** |

**Why the first dispatch fails.** At `Implem0007` the session logged `model_change` → `openai-codex/gpt-6.1-sol` with `resolvedModelIsFallback: true`. The whole review and its trailer were written on that fallback route. The model name and effort still match the pin, but the list has two entries. The trailer's `model_id` names the route the review was *not* written on, so there is no single route it could equal. Rule: "The dispatch counts only when that list holds exactly one `provider/model` … and the trailer's `model_id` equals that one `provider/model` exactly … Any mismatch means the dispatch does not count."

**Why the retry counts.** All four conditions hold.

## What happens to each reply
- **ImplementationAudit reply.** Kept verbatim as git-ignored evidence at `/tmp/rngp/f2work/.omp/team-config/evidence/add-reset/wave-1/implementation-audit-ImplementationAudit-reply.md`. It is never used as the trailer, and its PASS is not rewritten. Rule: "A reply that does not count is kept verbatim as evidence (`…/<invocation>-<subagent id>-reply.md`, git-ignored, one file per dispatch …) and is never submitted as the invocation's trailer: its verdict is never rewritten."
- **No trailer repair.** Repair applies only to a trailer that "is missing or fails the trailer check". This one passes; it fails the model check, which goes to the fresh retry instead. Rule: "It gets the one bounded fresh retry above."
- **ImplementationAudit2 reply.** This supplies the trailer. Rule: "A retry that counts supplies the invocation's trailer." It is stored verbatim from `read agent://<id>` at a tracked `*trailer*` path, for example `.omp/team-config/evidence/add-reset/f2/trailer-implementation-audit.txt`. `trailer_sha256` comes from `shasum -a 256`.
- **Trailer check on the retry.** I ran it read-only, feeding the reply in through process substitution rather than a stored file. Result: `validate-gate-record.mjs --trailer … --invocation implementation-audit --verdict PASS` printed `passed`, exit 0. Its trailer block is byte-identical to the first one; only the session's route differs. The check must still run on the stored file once it exists. Rule: "Check each stored trailer as soon as it arrives."

## Retry, outcome and wave record
- **No further retry.** The retry counted, so there is nothing left to retry. Rule: "one bounded fresh retry … a retry that mismatches again leaves the invocation INCONCLUSIVE".
- **Outcome.** `implementation-audit` = PASS.
- **`GC wave` uses `--trailer`, not an `--outcome …=INCONCLUSIVE` without a trailer:**
  `GC wave --lane F2 --snapshot <snapshot path> --outcome qa=PASS --outcome implementation-audit=PASS --trailer implementation-audit=.omp/team-config/evidence/add-reset/f2/trailer-implementation-audit.txt`
  Rule: "one `--trailer <invocation>=<trailer file>` for each reviewer outcome that is PASS or FAIL". The no-trailer form is only for "An invocation left INCONCLUSIVE by the Phase 3 model check".
  - `qa=PASS` is an inference: a reviewer is only dispatched after QA passes ("Any FAIL ends the review here … skip the gate reviewer").

## Can the gate pass
Yes. The only invocation the `standard` depth requires returned PASS from a dispatch that counted. Rule (Phase 4): "Gate passes only when QA matrix has no failing row and every invocation actually run returned `PASS` from a dispatch that counted under the Phase 3 model check."

It has not passed yet. Three steps remain:
1. `GC wave` must print `DECISION: PASS`.
2. The record must be written with `resolution.model` = `onara/cx/gpt-6.1-sol`, taken from the trailer ("`model_id` comes from the reviewer's own trailer"). Its independence is derived from `implementation_models`; if the diff's authors were Claude models it would be `cross-provider` (inference).
3. The validator must print `passed`, both before and after the record commit.

## What the user is told
- **Wave 1 result.** `implementation-audit` PASS on `onara/cx/gpt-6.1-sol` at `high`, from the retry `ImplementationAudit2`.
- **First dispatch.** `ImplementationAudit` did not count: mid-session it fell back from `onara/cx/gpt-6.1-sol` to `openai-codex/gpt-6.1-sol` at `high`, and its trailer named the route it did not run on. Its reply stays local evidence. This disclosure is my choice: the skill only requires telling the user which model and effort ran when the retry also mismatches ("a retry that mismatches again leaves the invocation INCONCLUSIVE, and you tell the user which model and effort ran"), which did not happen here.
- **Gate status.** Not passed until `GC wave` prints `DECISION: PASS` and the record validates. Rule (Enforcement): "either the gate passes, or say plainly that it has not."
````

## Result

PASS. `ImplementationAudit` ran on both `onara/cx/gpt-6.1-sol` and `openai-codex/gpt-6.1-sol` at `high` with a trailer naming `onara/cx/gpt-6.1-sol`; Phase 3 refuses it, the retry `ImplementationAudit2` (only `onara/cx/gpt-6.1-sol`, `high`) counts and supplies the trailer.
