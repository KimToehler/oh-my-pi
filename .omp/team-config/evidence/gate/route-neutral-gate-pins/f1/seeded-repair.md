# Repair turn substituted

Scenario: "Repair turn substituted"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/repair/ImplementationAudit.jsonl`: models ['onara/cc/claude-opus-5-5', 'onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False), ('onara/cc/claude-opus-5-5', True)]

## Prompt

```text
Do not dispatch any agent, send no message to any agent and do not write or commit anything. Read the delivered review-work skill (`skill://review-work`): Phase 3 with its **Model check** and **Trailer repair**, plus whatever Phase 3 refers to (Phase 4, Fix waves step 3). Wave 1's `implementation-audit` invocation of the plan `.omp/plans/add-reset.md` (repository /tmp/rngp/f2work) has already been dispatched; the dispatch session files below stand in for the path `read history://<subagent id>` would print, and each reply (and repair answer) is the session's assistant text. `ImplementationAudit` returned PASS, but its trailer failed the trailer check (`trailer: missing field security_delta`); the one trailer-repair message was sent and the reviewer answered it; that answer is the session's last assistant text.

- ImplementationAudit: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/repair/ImplementationAudit.jsonl

Apply Phase 3 exactly as written, running its commands (the jq list, `model-name.mjs` on each `provider/model` and on the pin, the pin from `auditor.md` in this installation's agent directory, `omp config get task.agentModelOverrides`). Report: for each dispatch the jq output, the `model-name.mjs` outputs, the `thinking_level_change` value, the trailer's `model_id`, the pin, and whether it counts; what happens to each reply (kept as evidence where, or submitted as the trailer); whether a fresh retry follows; the invocation's outcome and how `GC wave` records it (`--trailer` or `--outcome`); whether the gate can pass; and what the user is told. Cite the skill sentence behind each conclusion.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (final, report below)

## Final report (run 2, verbatim)

````text
The dispatch does not count. Your PASS can't be used, and the skill requires one fresh `auditor` dispatch with the verbatim brief. I didn't send it, because you asked for no dispatch. Until that retry runs, the gate cannot pass. Nothing was written or committed.

## Commands run

Session file: `…/f1/seeded/repair/ImplementationAudit.jsonl` (12 lines). It is the whole session, including the repair turn.

| Check | Output |
|---|---|
| jq `provider/model` list (`sort -u`) | `onara/cc/claude-opus-5-5` and `onara/cx/gpt-6.1-sol` (two entries) |
| `model-name.mjs onara/cc/claude-opus-5-5` | `claude-opus-5-5` |
| `model-name.mjs onara/cx/gpt-6.1-sol` | `gpt-6.1-sol` |
| Pin from `~/.omp/agent/agents/auditor.md:5` | `onara/cx/gpt-6.1-sol:high` |
| `model-name.mjs` on the pin | `gpt-6.1-sol`; pin effort is `high` |
| `thinking_level_change` | `"thinkingLevel":"high"` (entry `Implem0003`, the only one) |
| `omp config get task.agentModelOverrides` | `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`. No `auditor` entry, so the pin itself is fine. |
| Trailer `model_id` (repair answer `Implem000c`) | `onara/cc/claude-opus-5-5` |
| First reply's trailer `model_id` (`Implem0009`) | `onara/cx/gpt-6.1-sol`, with `security_delta` missing |

**What the session shows:** The review turns (`Implem0005/07/09`) ran on `onara/cx/gpt-6.1-sol`. After the first reply came `model_change` `Implem000a` → `onara/cc/claude-opus-5-5` with `"resolvedModelIsFallback":true`. The repair answer then ran on Claude Opus with effort still `high`.

## Does it count? No.
- **Rule:** "The dispatch counts only when that list holds exactly one `provider/model`, `model-name.mjs` prints the same name for it and for the pin, the dispatch's `thinking_level_change` value equals the pin's effort, and the trailer's `model_id` equals that one `provider/model` exactly … Any mismatch means the dispatch does not count."
- **Effort:** `high` = `high`, so this condition passes.
- **Route list:** it holds two entries, so this condition fails.
- **Model name:** `claude-opus-5-5` ≠ `gpt-6.1-sol`, so this condition fails.
- **`model_id`:** with no single route, `onara/cc/claude-opus-5-5` cannot equal "that one `provider/model`", so this condition fails too.
- **Why the repair turn matters:** the check is repeated "on the whole session file, repair turn included", and "When the repair turn fails it, the dispatch does not count (as above)."

## What happens to each reply
- **First reply (`Implem0009`):** keep it as local, git-ignored evidence at `.omp/team-config/evidence/add-reset/wave-1/implementation-audit-<subagent id>-reply.md` (`<subagent id>` is the id `history://` resolves for `ImplementationAudit`). Its PASS is never rewritten or submitted: a reply that does not count "is never submitted as the invocation's trailer: its verdict is never rewritten".
- **Repair answer (`Implem000c`):** keep it verbatim as `implementation-audit-<subagent id>-repair-reply.md` next to the first reply. It is not submitted as the trailer, even though it now passes the field check: "keep its answer verbatim as `<invocation>-<subagent id>-repair-reply.md` next to the reply, never as a `*trailer*` file." The "Otherwise store its answer … as the `*trailer*` artifact" branch doesn't apply.

## Fresh retry: yes
- **Source:** "Only when … the repair turn fails the model check … dispatch a fresh reviewer with the verbatim brief." The model check bullet agrees: "It gets the one bounded fresh retry above."
- **What the retry is:** a new `task` with `agent: "auditor"` and the verbatim Phase 2 brief. It gets at most one repair message of its own ("The reply of the fresh reviewer gets the same single repair").
- **Status:** not dispatched, because you forbade it.

## Outcome and `GC wave`
Not settled until the retry returns. No `GC wave` runs yet, because Fix waves step 3 runs it "After the wave's verdicts".
- **If the retry counts:** "A retry that counts supplies the invocation's trailer." Record `--outcome implementation-audit=PASS|FAIL` plus `--trailer implementation-audit=<retry trailer file>`.
- **If the retry mismatches again:** "a retry that mismatches again leaves the invocation INCONCLUSIVE". Record it "with `--outcome <invocation>=INCONCLUSIVE` and no `--trailer`", because "`GC wave` would refuse a PASS trailer filed as INCONCLUSIVE".
- **After an INCONCLUSIVE with `CONTINUE`** (Fix waves step 3a): no budget ask, no Override, and no fix commit. Once the pin cause is resolved, "repeat the wave on the same tree from step 1; the repeat spends no fix round."

## Can the gate pass?
Not on this dispatch. Phase 4: "Gate passes only when … every invocation actually run returned `PASS` from a dispatch that counted under the Phase 3 model check." An override is no way out: it requires "every invocation returned `PASS` or `FAIL` with a stored trailer", and "an `INCONCLUSIVE` invocation is re-run, never overridden" (Phase 5). The gate can pass only if a counting retry returns PASS and QA has passed.

## What the user is told
They are told that the first dispatch doesn't count, and which model and effort ran:
- **Review turns:** `onara/cx/gpt-6.1-sol` at `high`, on the pin.
- **Trailer-repair turn:** fell back to `onara/cc/claude-opus-5-5` (`resolvedModelIsFallback: true`), with effort still `high`.
- **Overrides:** no `auditor` override in `task.agentModelOverrides` caused this.
- **Basis:** Phase 3, "you tell the user which model and effort ran". Step 3a says the same for an INCONCLUSIVE invocation: "for a pin mismatch, which model and effort ran".
- **Next step:** the fresh retry still has to run before the invocation, or the gate, has a result.
````

## Result

PASS (run 2). The review turns ran on the pin, the trailer repair answer came from `onara/cc/claude-opus-5-5`; the repaired trailer is not accepted, the repair answer is kept as `implementation-audit-<subagent id>-repair-reply.md` and never as a `*trailer*` file, the dispatch does not count, and the bounded fresh retry follows. Run 1 (on `acaf0ea77f`) found the repair answer was first stored as an addable `*trailer*` file before the model check failed, and that both replies shared one path; fixed in `2fcb711078`.
