# Harness integration: omp native + OpenSpec + remaining team plugin

Roadmap. Each phase below ships as its own plan with its own gate; this file holds the decisions,
the target picture and the baseline the phases are measured against.

- Merge gate: not applicable (roadmap; every phase carries its own plan and gate, P1 is a config-only change verified by smoke runs below)

## Decisions (Tim, 2026-10-22)

1. OpenSpec rolls out team-wide directly (colleagues already use it); no single-project pilot.
2. Planning surface: features with behaviour change go through OpenSpec; small changes stay in omp plan mode.
   Independent plan review for OpenSpec changes uses option B: OpenSpec runs inside plan mode and the change
   folder is proposed through `xd://propose`, so the existing core cross-family review fires
   (`agent-session.ts` `submitPlanProposal`). Core changes stay minimal.
3. The merge-gate worktree (`fix/merge-gate-worktree-records`) is told that `--plan` must accept an OpenSpec
   change folder.
4. Team config and skills stay public and free of charge.

## Target picture

| Layer | Owner | Removed |
|---|---|---|
| What (proposal, specs, design, tasks) | OpenSpec per project, custom schema `omp-gated` | `.omo/plans`, `boulder.json`, always-on plan rules |
| How it is built | omp native: task isolation, goal mode, compaction/handoff, `learn`, TTSR rules, `bash.patterns`, bundled `reviewer` | OmO leftovers, rule prose duplicating omp mechanics |
| Whether it may merge | Team plugin (`merge-gate.ts` + validator), two tiers | Full evidence review for every change |
| Fork-only | ACP goal mode, cross-family plan review | Upstream both; fork shrinks afterwards |

## Phases

- [x] P0 Baseline (below)
- [x] P1 Config quick wins (below)
- [x] P2 Rules diet: `destructive-git-consent` is pre-tool TTSR on destructive Git through `bash`/`eval`; `delegation` is TTSR on main-agent `task` calls; OpenSpec change files now match the handoff rule; Self-Improvement Loop routes personal/project context to `learn` and cross-project policy to reviewed team rules. Main prompt: 13,214 → 11,783 tokens (−1,431); TTSR parser positive/negative controls passed; 39 focused tests passed. `merge-gate-proof` and `plan-merge-gate` remain owned by the gate worktree and wait for P4.
- [x] P3 OpenSpec team rollout (`.omo/plans/openspec-team-rollout.md`): six global `opsx-*` commands via team-config, no `openspec init` (it writes `schema: spec-driven` and duplicate project commands); manual project setup copies schema `omp-gated` (with a `gate` artifact for the risk class) and `scripts/validate-openspec-change.mjs`, which checks what `openspec validate --strict` does not (Negative control scenario per requirement, `Verify:` command per task, gate fields). No `review` artifact: OpenSpec marks an artifact done when its file exists (`OpenSpec/src/core/artifact-graph/state.ts:32-36`), so a self-written review proves nothing. Merged `6a409c9c45` (F2 record `.omo/evidence/gate/openspec-team-rollout.json`, implementation-audit PASS). P2 follow-up merged `40efb590fc`: destructive-git TTSR condition now covers git global options, eval list syntax, force refspecs and `commit --amend` (12 RED rows, 31 green).
- [ ] P3b OpenSpec distribution (`.omo/plans/openspec-distribution.md`, after P3 merges): deploy checks the pinned OpenSpec CLI version and sets `telemetry.enabled false` persistently; one git-backed project install/update command replaces P3's manual copy steps.
- [ ] P3a' OpenSpec planning with review, routed from default mode (`.omo/plans/openspec-planning.md`; replaces P3a, decided by Tim, 2026-10-23: no core patch, plan mode stays file-only): the `omp-gated` schema gains a `review` artifact (bundled `plan-reviewer` over the change folder, verdict bound to the folder digest) that OpenSpec requires before apply, `/opsx-apply` runs `validate-openspec-change.mjs --reviewed` before editing source, and an `openspec` skill routes behaviour changes in OpenSpec repositories to `/opsx-propose`. Dropped from P3a: write protection while planning, approval dialog, execution from an immutable snapshot; revisit only if real changes show the need.
- [ ] P4 Gate on OpenSpec (`.omo/plans/openspec-gate.md`): validator `--plan` accepts a change folder (sha256 over its artifacts), two tiers from `gate.md` (standard: bundled `reviewer` + smoke; full: review-work, max 2 rounds, only the four mandatory classes), `opsx-apply` runs each task's `Verify:`; only the gate record and reviewer trailers stay tracked, everything else under `.omo/` is git-ignored (decided by Tim, 2026-10-22: no history rewrite).
- [ ] P5 Remove OmO leftovers: `.omo/boulder.json`, `ulw-execute`, `run-continuation`, `notepads`; repoint `plan.autosaveDir`; `~/.omo` only after listing paths and consent.
- [ ] P6 Upstream: ACP goal mode (genuine upstream gap: `goals/host-controller.ts` absent in `upstream/main`), cross-family plan review. Needs a contributor sentence per PR (CONTRIBUTING.md).

Order: P2 and P3 now; P3a after P3 shows the plan-mode friction in practice; P4 after the gate worktree merges; P5/P6 independent.

## P0 Baseline (measured 2026-10-22, `~/.omp/stats.db`, window 2026-10-15..2026-10-22)

| Measure | Value |
|---|---|
| Total cost | 2307 USD (main 1820, subagents 487) |
| Main sessions | 13038 requests, avg prompt 250k tokens; cost split cache-write 701, cache-read 722, output 332 |
| Subagents | 12238 requests, avg prompt 80k tokens |
| By model | opus-5-5 1512, sonnet-5-5 267, opus-5 201, gpt-5.6-terra 148, gpt-5.6-sol 123 |
| This repo (`-git-oh-my-pi`) | 933 USD: main 806, review/gate subagents 79, other subagents 49 (session-name heuristic) |
| Most expensive single main sessions here | 182, 129, 68 USD |
| Base system prompt (`omp -p`, empty repo) | 21.6k tokens; 17.0k without the four `alwaysApply` rules, so they cost 4.6k tokens per request and per subagent |

Review rounds from `.omo/evidence/*/gate-convergence/ledger.jsonl` and gate records:

| Feature | Fix-delta reviews | Max round | Rejects | Gate override |
|---|---|---|---|---|
| team-config | 27 | 5 | 18 | yes (F2 frozen) |
| acp-goal-mode | 5 | 3 | 3 | yes (convergence STOP) |
| review-blocking-threshold | 3 | 1 | 0 | no |
| omp-native-plan-review | no ledger | | | yes |

Reading: the dominant cost is long main sessions (cache write/read on a 250k prompt), not reviewer calls.
Three of six gated features ended in an owner override, so extra rounds bought little. The P2 rules diet saves
4.6k tokens per request; shorter main sessions (OpenSpec artifacts as handoff boundary, compaction) are the larger lever.
Re-measure after P2/P3 with the same queries.

## P1 Config quick wins (done 2026-10-22)

Changed in `team-config/seed/config.yml` and the live `~/.omp/agent/config.yml`:

```yaml
task:
  isolation:
    enabled: true          # delegation rule already demanded isolated: true; the feature was off
autolearn:
  enabled: true            # learn tool; standing capture guidance, autoContinue stays off (no extra turn)
memory:
  backend: local           # learn needs a live backend (tools/learn.ts createIf)
memories:
  maxRolloutsPerStartup: 0 # no phase-1 extraction model calls; learned.md only
```

Not enabled: `advisor` (recurring per-turn cost, no blocking power).

Why these values hold in ACP: `protocolDefault: ["rpc","acp"]` only pins the default when no config layer sets
the key (`config/settings.ts:1007-1025`); an explicit global value wins.

Smoke evidence (sandbox agent dir, then the live config):

- Isolated task: child wrote `b.txt` in an APFS clone (`~/.omp/wt/<id>/m`), result `Applied patches: yes`, file present in the repo afterwards.
- `learn`: lesson written to `memories/<project>/learned.md`; a fresh session quoted it verbatim from context.
- Memory startup with `maxRolloutsPerStartup: 0`: no stage-1 jobs, only a pending global consolidation job; base prompt grew 21.6k → 23.1k tokens (memory/learn guidance).
- ACP (`omp --mode acp`, initialize → session/new → session/prompt): current config before the change reported `learn=no isolated=no`; new config and then the live config reported `learn=yes isolated=yes`.

Open: phase-2 consolidation with zero stage-1 outputs should complete without a model call (`memories/index.ts` `runPhase2` empty-input branch) — confirm in `omp stats` over the next days that no `memory` role spend appears.
