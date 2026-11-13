# same-turn-nc: requirement 1 negative control

Criterion (tasks.md 4.1): the `auth` planning turn holds no read of `opsx-apply.md` and no write outside `openspec/changes/`; either one fails the row.

Captures: `sessions/auth/transcript.jsonl`, `sessions/auth/screen.txt`.

Observation, turn 0 (07:07:24Z to the continuation at 07:20:06Z):

1. Read of `opsx-apply.md`: the opening context survey ran `diff ~/.omp/agent/commands/opsx-propose.md .omp/commands/opsx-propose.md; echo ===; diff ~/.omp/agent/commands/opsx-apply.md .omp/commands/opsx-apply.md; ...`. The tool result for the second `diff` is empty (`===\n===`), because the two copies are identical, so no content of `opsx-apply.md` reached the agent. The command still opened the file.
2. Write outside `openspec/changes/`: at 07:18:35Z the round-2 fix-delta step wrote `.omp/team-config/gate-deltas/widget-cache-round2.patch` (untracked, mtime 08:18:35 local). The `omp-gated` schema's review instruction prescribes this path (`openspec/schemas/omp-gated/schema.yaml:624`: "patch goes under `.omp/team-config/gate-deltas/`, which is never committed").
3. No implementation: no write to `src/`, no `openspec instructions apply`, no task ticked. The turn's commits touch only `openspec/changes/widget-cache/`.

Verdict: FAIL as the criterion is written. Hits 1 and 2 meet its letter: a `diff` that opened `opsx-apply.md`, and the schema-mandated review delta patch outside `openspec/changes/`. Neither starts apply or edits project code, which is what the requirement forbids. Hit 2 comes from the review procedure the same planning turn must run, so any review with a fix round trips this criterion. Owner decision required: accept the row on the requirement's intent, or amend the criterion (a planning-artifact change, then re-review) and rerun.

Owner decision (user, 2026-11-13): "Accept same-turn-nc on intent, tick 4.1, proceed to F2". The row is accepted on the requirement's intent: the planning turn started no apply and edited no project code. The FAIL-as-written hits above stand as recorded.
