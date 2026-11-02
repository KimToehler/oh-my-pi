# F1 evidence: fresh replay dispatch (task 2.1)

Run: `runs/plan-review-loop-measurement-20261102` (gitignored raw sessions; normalized dataset is committed).
Status: **complete — all 20 intended reviewer cells usable.** Ten cells ran in the first wave; the remaining ten (six never dispatched, four lost to a mid-run model substitution) ran in the authorised resume wave below, after the retry rule that caused the substitutions was corrected.

## Fixtures and inputs unchanged

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 107 sources, 5 items, 40 trials, 56 attempts, 165 findings
```

Every source listed in `input-manifest.json` is re-hashed by this command; it exits nonzero when a supplied byte differs from its recorded digest. It passed after the last dispatch, so no plan fixture, brief, rule or agent contract changed during the experiment.

## Dispatch order (shuffle seed 20261102)

1. T-Smt-1 · 2. S-Spt-3 · 3. S-Rtr-3 · 4. S-Fmp-1 · 5. S-Spt-2 · 6. S-Rtr-1 · 7. S-Smt-2 · 8. S-Smt-3 · 9. S-Fmp-3 · 10. S-App-3 · 11. S-Smt-1 · 12. S-Fmp-2 · 13. T-Fmp-1 · 14. S-App-1 · 15. T-App-1 · 16. T-Spt-1 · 17. S-Spt-1 · 18. S-Rtr-2 · 19. T-Rtr-1 · 20. S-App-2

At most four reviewer/verifier tasks ran concurrently and never two on the same item, as design D2 requires.

## Cells and attempts

| # | trial | status/triage | attempt | stage | result | actual pin | cost | dispatched | terminal | reason |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | T-Smt-1 | completed/available | TrialTSmt1 | reviewer | completed | onara/cx/gpt-6.1-terra:medium | $0.12 | 2026-11-02T11:07:01.762Z | 2026-11-02T11:08:09.856Z | - |
| 1 | T-Smt-1 | completed/available | VerifyTSmt1 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.12 | 2026-11-02T11:10:47.672Z | 2026-11-02T11:12:20.738Z | - |
| 2 | S-Spt-3 | completed/available | TrialSSpt3 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $3.67 | 2026-11-02T11:07:01.762Z | 2026-11-02T11:40:55.538Z | Actual pin/tool-grant mismatch |
| 2 | S-Spt-3 | completed/available | Replacement1SSpt3 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $1.11 | 2026-11-02T11:44:44.900Z | 2026-11-02T12:02:50.293Z | - |
| 2 | S-Spt-3 | completed/available | VerifySSpt3 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.17 | 2026-11-02T12:02:54.257Z | 2026-11-02T12:05:18.611Z | - |
| 3 | S-Rtr-3 | completed/available | TrialSRtr3 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $0.60 | 2026-11-02T11:07:01.762Z | 2026-11-02T11:16:47.378Z | - |
| 3 | S-Rtr-3 | completed/available | VerifySRtr3 | verifier | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:medium | $0.72 | 2026-11-02T11:17:07.956Z | 2026-11-02T11:34:13.466Z | Wrong pin or incomplete indices |
| 3 | S-Rtr-3 | completed/available | Replacement2SRtr3 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.12 | 2026-11-02T11:45:33.033Z | 2026-11-02T11:46:35.373Z | - |
| 4 | S-Fmp-1 | completed/available | TrialSFmp1 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $1.01 | 2026-11-02T11:07:01.762Z | 2026-11-02T11:20:10.487Z | - |
| 4 | S-Fmp-1 | completed/available | VerifySFmp1 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.15 | 2026-11-02T11:20:32.964Z | 2026-11-02T11:22:36.274Z | - |
| 5 | S-Spt-2 | completed/available | TrialSSpt2 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $0.83 | 2026-11-02T12:05:32.427Z | 2026-11-02T12:14:25.449Z | - |
| 5 | S-Spt-2 | completed/available | VerifySSpt2 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.21 | 2026-11-02T12:14:29.680Z | 2026-11-02T12:16:22.209Z | - |
| 6 | S-Rtr-1 | completed/unavailable | TrialSRtr1 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $0.57 | 2026-11-02T11:36:04.064Z | 2026-11-02T11:43:50.423Z | - |
| 6 | S-Rtr-1 | completed/unavailable | VerifySRtr1 | verifier | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:medium | $0.40 | 2026-11-02T11:47:10.259Z | 2026-11-02T12:03:52.605Z | Wrong pin or incomplete indices |
| 7 | S-Smt-2 | excluded/unavailable | TrialSSmt2 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $4.99 | 2026-11-02T11:14:29.057Z | 2026-11-02T11:47:21.220Z | Actual pin/tool-grant mismatch |
| 7 | S-Smt-2 | excluded/unavailable | Replacement3SSmt2 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $5.81 | 2026-11-02T11:48:14.297Z | 2026-11-02T12:25:01.708Z | Actual pin/tool-grant mismatch |
| 8 | S-Smt-3 | completed/unavailable | TrialSSmt3 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $0.94 | 2026-11-02T12:25:05.555Z | 2026-11-02T12:35:40.235Z | - |
| 9 | S-Fmp-3 | completed/available | TrialSFmp3 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $0.99 | 2026-11-02T11:23:33.697Z | 2026-11-02T11:33:15.258Z | - |
| 9 | S-Fmp-3 | completed/available | VerifySFmp3 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.16 | 2026-11-02T11:36:04.057Z | 2026-11-02T11:37:45.549Z | - |
| 10 | S-App-3 | completed/available | TrialSApp3 | reviewer | completed | onara/cx/gpt-6.1-sol:high | $1.05 | 2026-11-02T11:38:36.837Z | 2026-11-02T11:51:24.660Z | - |
| 10 | S-App-3 | completed/available | VerifySApp3 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.19 | 2026-11-02T11:56:19.081Z | 2026-11-02T11:58:43.949Z | - |
| 11 | S-Smt-1 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |
| 12 | S-Fmp-2 | excluded/unavailable | TrialSFmp2 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $5.17 | 2026-11-02T11:58:46.979Z | 2026-11-02T12:33:00.477Z | Actual pin/tool-grant mismatch |
| 13 | T-Fmp-1 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |
| 14 | S-App-1 | excluded/unavailable | TrialSApp1 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $6.62 | 2026-11-02T12:03:55.187Z | 2026-11-02T12:39:26.248Z | Actual pin/tool-grant mismatch |
| 15 | T-App-1 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |
| 16 | T-Spt-1 | completed/available | TrialTSpt1 | reviewer | completed | onara/cx/gpt-6.1-terra:medium | $0.15 | 2026-11-02T12:16:25.262Z | 2026-11-02T12:18:22.739Z | - |
| 16 | T-Spt-1 | completed/available | VerifyTSpt1 | verifier | completed | onara/cx/gpt-6.1-sol:medium | $0.15 | 2026-11-02T12:18:26.401Z | 2026-11-02T12:20:29.304Z | - |
| 17 | S-Spt-1 | excluded/unavailable | TrialSSpt1 | reviewer | excluded | onara/cx/gpt-6.1-sol + onara/cc/claude-opus-5:high | $4.19 | 2026-11-02T12:20:37.131Z | 2026-11-02T12:49:14.122Z | Actual pin/tool-grant mismatch |
| 18 | S-Rtr-2 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |
| 19 | T-Rtr-1 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |
| 20 | S-App-2 | missing/unavailable | - | - | not dispatched | n/a | n/a | n/a | n/a | Planned cell; not yet dispatched. |

## Reviewer-to-verifier index mapping (actual)

`TrialSRtr3` returned 3 blockers. Its verifier `Replacement2SRtr3` was given those findings as indices 1-3 without arm, model, cost or historical metadata, and returned one judgment per index:

- `TrialSRtr3.1` → confirmed, blocking=true, protected=false
- `TrialSRtr3.2` → confirmed, blocking=true, protected=true
- `TrialSRtr3.3` → confirmed, blocking=true, protected=false

The first verifier for this trial, `VerifySRtr3`, is retained as excluded: its runtime fell back to `claude-opus-5` mid-run, so its judgments are not used while its $0.72 still counts.

## Costs

| | |
|---|---|
| Total fresh-stage cost | $40.21 |
| Declared ceiling | $30.00 |
| Cost of excluded attempts | $31.97 (79% of spend) |
| Excluded attempts | 9 of 26 fresh dispatches |
| Replacements used | 3 of 3 |

## Why the run stopped

Nine fresh dispatches did not hold their pin. In each case the provider stream ended with `stream_disconnected: stream closed before response.completed` and the runtime continued the same session on `onara/cc/claude-opus-5`; the recorded `model_change` event carries `resolvedModelIsFallback`. Those results are excluded from quality figures and their cost is retained, as the spec requires.

The failures concentrate on the largest plans (`session-move-tool`, `acp-permission-parity`, `strength-progression-targets`, `finish-modality-program-route`) and cost $3.67-$6.62 each, so the three-replacement budget and then the $30 ceiling were consumed before the intended 20 cells could run. Dispatch was frozen at $29.39; the already in-flight batch carried the total to $40.21.

No model, effort, brief or contract was re-pinned to avoid the fallback: that would have changed the measured axis.

## Session provenance

Raw transcripts stay local under `runs/plan-review-loop-measurement-20261102/raw/`; each was frozen by digest at the moment it was scored.

| attempt | retained transcript | sha256 |
|---|---|---|
| TrialTSmt1 | `raw/TrialTSmt1.jsonl` | `219a434459000ea7…` |
| VerifyTSmt1 | `raw/VerifyTSmt1.jsonl` | `b9cbec16bfe28a6a…` |
| TrialSRtr3 | `raw/TrialSRtr3.jsonl` | `b8d765ddadd51f3a…` |
| TrialSFmp1 | `raw/TrialSFmp1.jsonl` | `c9a66394ed1c0b03…` |
| VerifySFmp1 | `raw/VerifySFmp1.jsonl` | `a24fa7663b4f975f…` |
| TrialSFmp3 | `raw/TrialSFmp3.jsonl` | `cb92a4310cc87d4e…` |
| VerifySRtr3 | `raw/VerifySRtr3.jsonl` | `cfce710a17be0a41…` |
| VerifySFmp3 | `raw/VerifySFmp3.jsonl` | `e830608cca1fb283…` |
| TrialSSpt3 | `raw/TrialSSpt3.jsonl` | `f3ea931798148834…` |
| TrialSRtr1 | `raw/TrialSRtr1.jsonl` | `97a3cf616550cd0e…` |
| Replacement2SRtr3 | `raw/Replacement2SRtr3.jsonl` | `a42615d9740b193b…` |
| TrialSSmt2 | `raw/TrialSSmt2.jsonl` | `6f18f854a3c4a851…` |
| TrialSApp3 | `raw/TrialSApp3.jsonl` | `4f35d86f7968a7c1…` |
| VerifySApp3 | `raw/VerifySApp3.jsonl` | `b60e5ac699080622…` |
| Replacement1SSpt3 | `raw/Replacement1SSpt3.jsonl` | `395570f7904de65f…` |
| VerifySRtr1 | `raw/VerifySRtr1.jsonl` | `1a86cd55d41d4434…` |
| VerifySSpt3 | `raw/VerifySSpt3.jsonl` | `9840a922b5502a9e…` |
| TrialSSpt2 | `raw/TrialSSpt2.jsonl` | `08209221ebe53d51…` |
| VerifySSpt2 | `raw/VerifySSpt2.jsonl` | `9309a63dd5029253…` |
| TrialTSpt1 | `raw/TrialTSpt1.jsonl` | `995fec48081bfe70…` |
| VerifyTSpt1 | `raw/VerifyTSpt1.jsonl` | `e1ebe8b680ed4d2b…` |
| Replacement3SSmt2 | `raw/Replacement3SSmt2.jsonl` | `c8a745863b0aaa4a…` |
| TrialSFmp2 | `raw/TrialSFmp2.jsonl` | `8464b90a116c2152…` |
| TrialSSmt3 | `raw/TrialSSmt3.jsonl` | `3e7e57bc2d95425e…` |
| TrialSApp1 | `raw/TrialSApp1.jsonl` | `c78681f70da7750c…` |
| TrialSSpt1 | `raw/TrialSSpt1.jsonl` | `7f8c5461d7ab9760…` |

## Resume wave (user-authorised, 2026-11-02)

Task 2.1 allows an incomplete dispatch to be settled either by recovering the cells or by a user scope change. After the fallback diagnosis (`runs/plan-review-loop-measurement-20261102/fallback-diagnosis.md`) showed that the nine lost dispatches were caused by a local retry rule and not by the measured axis, the user authorised changing that setting and re-running the outstanding cells with a ceiling of 20 USD above the incurred spend.

The setting changed in `~/.omp/agent/config.yml` is `retry.fallbackOn: any` → `retry.fallbackOn: usage-limit`, so a transient `stream_disconnected` no longer switches the session to another model mid-task. That file is outside this repository and outside the frozen inputs; no fixture, brief, agent contract or model pin of this experiment was touched, and no excluded attempt was re-scored.

Ten reviewer cells and twelve verifier passes ran in this wave; every one held its intended pin, so none is excluded. Two of the verifier passes repair earlier gaps: `S-Rtr-1` lost its first verifier to the same substitution, and `S-Smt-3` had never been triaged.

| attempt | trial | stage | actual pin | cost | dispatched | terminal |
|---|---|---|---|---|---|---|
| TrialSSmt1 | S-Smt-1 | reviewer | sol:high | $0.93 | 14:45:45.041Z | 14:56:11.231Z |
| TrialSRtr2 | S-Rtr-2 | reviewer | sol:high | $0.51 | 14:45:45.041Z | 14:54:08.000Z |
| TrialSApp2 | S-App-2 | reviewer | sol:high | $0.86 | 14:45:45.041Z | 15:11:49.595Z |
| TrialTFmp1 | T-Fmp-1 | reviewer | terra:medium | $0.15 | 14:45:45.041Z | 14:48:22.089Z |
| TrialTRtr1 | T-Rtr-1 | reviewer | terra:medium | $0.09 | 14:55:24.461Z | 14:56:44.444Z |
| TrialTApp1 | T-App-1 | reviewer | terra:medium | $0.17 | 15:14:07.143Z | 15:16:57.260Z |
| RerunSFmp2 | S-Fmp-2 | reviewer | sol:high | $0.78 | 14:50:13.813Z | 15:32:03.060Z |
| RerunSSmt2 | S-Smt-2 | reviewer | sol:high | $1.19 | 14:58:04.120Z | 15:31:45.776Z |
| RerunSSpt1 | S-Spt-1 | reviewer | sol:high | $1.13 | 15:13:03.750Z | 15:42:25.936Z |
| RerunSApp1 | S-App-1 | reviewer | sol:high | $1.11 | 15:33:29.499Z | 16:02:07.677Z |
| VerifyTFmp1 … VerifyRerunSRtr1 | 12 trials | verifier | sol:medium | $1.72 total | 14:48:25.555Z | 16:20:30.707Z |

Resume reviewer and verifier spend: **$8.65**; second adjudication round: **$9.91**; both inside the authorised 20 USD. All timestamps are 2026-11-02 UTC.

One dispatch error is recorded rather than hidden: `RerunTFmp1` was launched by a scheduler that did not yet exclude cells completed earlier in the same wave. It was cancelled immediately, no model request was billed, and it appears in `dispatch-ledger.json` with decision `cancelled`. The scheduler was fixed to skip completed cells before any further dispatch.

Consequence for the published numbers: S rests on 15 of 15 cells and T on 5 of 5, three repeats per item for S and one for T. Arm comparisons stay descriptive, as design D6 requires.

After the resume wave and the second adjudication round, the frozen-input check still passes:

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 140 sources, 5 items, 40 trials, 88 attempts, 210 findings
```
