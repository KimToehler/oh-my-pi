# Design

## Context

See proposal.md (Why). Current state, observed on `main` at `e19ac37659`:

- `gate-convergence.mjs` builds both locations from the checkout root: the ledger at `.omo/ulw-execute/ledger.jsonl` (`ledgerPath`, line 55) and wave snapshots in `.omo/gate-deltas/` (`snapshot`, line 336). `patch --out` and `delta --dir` take any path; the skill text points them at `.omo/gate-deltas/`.
- `validate-gate-record.mjs` checks `schema` (lines 634-637, a v1-specific message plus `must equal omo.merge-gate/v2`) but not where the record or the trailers live: any tracked path passes. The plan path is opaque and bound by content (`plan_sha256`).
- The merge-gate extension (`extensions/merge-gate.ts`, `lib/gate-record.ts`) reads the record path from the reply's Gate proof, looks for that path in every linked worktree, drops a file whose `schema` is not `omo.merge-gate/v2` (so the reason is the generic "no record exists"), and accepts a record whose reviewed SHA and exact bytes are already on the default branch without running the validator (`recordIsSettled`).
- `team-config/seed/config.yml:117` seeds `plan.autosaveDir: .omo/plans`. The installer copies seeds only when the target is absent (`scripts/install-team-config.ts:7`), so existing installs keep the value.
- omp reads only fixed names under a project `.omp/` (`packages/coding-agent/src/discovery/builtin.ts:64-72` resolves the root, then each capability appends its own: `commands` 375, `rules` 407, `prompts` 468, `extensions` 516/620, `instructions` 675, `hooks` 720, `tools` 786, `config.yml` 915, `skills` 309-326). Nothing enumerates arbitrary `.omp/*` children, so `.omp/team-config/` is never loaded as rules, skills, commands, prompts or context. Plan autosave defaults to `path.join(cwd, ".omp", "plans")` (`plan-mode/plan-autosave.ts:30-40`, `packages/utils/src/dirs.ts:645-647`).
- In this repository `.omp/` is tracked upstream content (`.gitignore:48` `!.omp/`), so `.omp/team-config/` is addable unless the root `.gitignore` says otherwise. The `.omo` block (`.gitignore:59-69`) keeps plans, `evidence/gate/**` and `*trailer*` addable and everything else local.
- onara records its gates at `docs/evidence/<slug>/merge-gate.json`; that keeps working, because the record location stays free (D1).

## Goals / Non-Goals

**Goals:**
- One location for each kind of team-config state, defined once per runtime: the gate scripts share a module, the extension carries its own copy.
- Every refusal names the expected id, so an agent holding an old record learns what to do instead of seeing "no record exists".

**Non-Goals:**
- Reading, converting or re-validating anything under `.omo/`. Old records, ledgers and deltas are an archive.
- Constraining the plan path. It stays opaque and content-bound: OpenSpec change folders and this repository's not-yet-moved `.omo/plans/*.md` (until P5b) remain valid plan inputs.
- Any change in `packages/` (omp core).

## Decisions

### D1 Record and trailer paths stay free (decided by Tim, 2026-10-23)
The validator and the stop hook do not check where a record or a trailer lives; the existing checks stay (tracked in git, inside the repository via `assertInsideRepo`, `trailer_sha256` matches). review-work and the README name the defaults: records at `.omp/team-config/evidence/gate/<plan basename>.json`, trailers and QA evidence under `.omp/team-config/evidence/<plan basename>/`.
The id carries the cutover alone: every record written before it is v1 or v2, so D2 and D3 refuse all of them wherever they lie. A location rule would add only one refusal: a new v3 record written to a non-default path, whose content is still review-bound by `reviewed_sha`, `plan_sha256` and the trailer digests.
Alternative rejected: a fixed whitelist location (the first version of this change). Closing it needed three path checks per record and trailer (normalised path, `lstat` of every fixed component, real path anchored on the repository root) in the validator and again in the extension, a trailer check before the settled shortcut, and it ended onara's `docs/evidence/` convention. Review rounds 1-3 spent five blockers on symlink routes into that whitelist.

### D2 New id, no legacy branches
`schema` must equal `team-config.merge-gate/v3`; the v1-specific message goes. Every other value gets the same finding, which names v3 and says to re-run review-work. The body keeps the v2 fields. The major bump marks the cutover: no record written before it carries the new id.

### D3 Stop-hook order: id, settled, validator
The lookup tells "no file" apart from "file with another schema" and refuses the latter with a reason naming v3, before the settled shortcut. Only a v3 record reaches the settled shortcut. A merged historical v2 record therefore never backs a claim, wherever it lies: on `main` under `.omo/evidence/gate/`, at `packages/metaharness/docs/evidence/evo2-metrics/gate-record.json`, or moved unchanged to `.omp/team-config/evidence/gate/` by P5b.

### D4 Constants: shared by the scripts, duplicated in the extension
A new `review-work/scripts/gate-layout.mjs` exports the record id and the `.omp/team-config` paths. `validate-gate-record.mjs` and `gate-convergence.mjs` import it, as they already import `folder-plan.mjs`.
The extension keeps its own id constant in `lib/gate-record.ts`. Importing from the skill directory would make the extension's load depend on a skill file, and a failed extension load removes the stop hook: the gate would open instead of closing. F1 catches drift between the two copies with a real session per path: an unmerged v3 record goes through the validator (its invocation is logged through an `OMP_GATE_VALIDATOR` wrapper that runs the real validator), a merged one takes the settled shortcut, and the retired-id refusal is exercised for a merged v2 record at its old path and at the new one.

### D5 Ledger and deltas: new paths only
`ledger.jsonl` and `gate-deltas/` move under `.omp/team-config/`. No fallback read of `.omo/ulw-execute/ledger.jsonl`. A gate open on the old ledger is finished with the old tooling before the deploy (Migration Plan). The validator does not read the ledger, so an old ledger cannot affect a stop decision.

### D6 Ignore policy in this repository
A new block after `!.omp/` in the root `.gitignore`:

```
/.omp/team-config/*
!/.omp/team-config/evidence/
/.omp/team-config/evidence/**/*
!/.omp/team-config/evidence/**/
!/.omp/team-config/evidence/gate/**
!/.omp/team-config/evidence/**/*trailer*
```

The `.omo` block stays until P5b moves the existing plans and evidence; until then it still protects their local QA output, and it lets this change's own gate record land (D9). The README shows the same block for consumer repositories.

### D7 Guidance and rule globs
Instructions name `.omp/plans/<slug>.md`, `.omp/team-config/evidence/<plan basename>/…`, `.omp/team-config/evidence/gate/<plan basename>.json`, `.omp/team-config/gate-deltas/` and `.omp/team-config/frontend-design/state.md`. review-work keeps its "or the repo's convention" record alternative (D1); the default it names is the new one. Rule globs: `**/.omo/plans/**` becomes `**/.omp/plans/**`, `**/.omo/evidence/**` becomes `**/.omp/team-config/evidence/**`. `**/.omo/drafts/**` and `**/.omo/handover-*.md` are dropped without a replacement: omp has no drafts directory, and handovers written as plans are covered by `**/.omp/plans/**`.
Historical text stays verbatim and is the inventory allowlist:
- `skills/coding-agent-sessions/**` (P5c);
- `skills/frontend/references/design/aside.md` (where a 2026-06-30 capture was stored);
- `rules/lesson-keep-next-step-advice-inside-the-named-p-17da8d4006723faf.md` line 14 (incident narrative);
- `rules/lesson-migrating-an-adapter-onto-a-shared-engin-a05ae0db814ee653.md` line 15 (incident narrative);
- `*.test.mjs` under `team-config/agent/` (old paths and ids as refused inputs).

### D8 Deploy notice
`installTeamConfig` adds a `notices` list to its report. After seeding, it reads `<agentDir>/config.yml` with `Bun.YAML.parse`. If `plan.autosaveDir` is a string with a `.omo` path segment, it adds one notice naming the file, the key and the value. The CLI prints the notices. A missing or unparsable file yields no notice and no failure: the installer does not own that file, and omp reports its own parse errors.

### D9 This change's own merge gate runs on the deployed tooling
A validator that checks its own replacement proves nothing, and the deployed stop hook knows only v2. So F2 for this change uses the deployed (v2) review-work and stop hook, and writes the last v2 record at `.omo/evidence/gate/team-config-omp-native-locations.json`. F1 exercises the new tooling from the worktree, installed into a temporary agent directory. P5b moves that record along with the rest of `.omo/evidence`.

### D10 One change, not three gated plans
The change touches three mechanisms: record validation with the stop hook, gate-convergence storage, and seed with the deploy notice. They ship together because their contracts are coupled, not because the diff is convenient:
- One gate procedure. review-work `SKILL.md` Phases 0.6-5 walk one gate through ledger (`GC baseline`), delta artifacts (`GC snapshot`, `patch --out`), QA evidence and the record, in one text. Shipping the record cutover alone would leave that procedure writing the ledger and deltas to `.omo/` and the record to `.omp/team-config/`. The `gate-workspace-layout` inventory requirement (no `.omo/` path in shipped files) cannot hold for any partial cut.
- One definition. `gate-layout.mjs` defines the evidence, gate, ledger and delta paths for both scripts, and the D6 `.gitignore` block covers all of them as one policy. Split plans would each ship half a layout module and half an ignore block.
- One cutover. Each deploy that moves gate state needs the Migration Plan: drain gates open on the old ledger, deploy, restart every session. Two or three cuts mean draining and restarting two or three times, with mixed old and new locations in shipped guidance between the cuts. The record cutover and the ledger move are each a `schema-migration` change, so each cut would need its own two-reviewer gate.
- The seed is shipped guidance too. `team-config/seed/config.yml` is inside the inventory scope, so the seed change belongs to the same requirement. The notice is the decided companion of the seed change (Tim, 2026-10-23: existing installs get a notice, and their `config.yml` is not overwritten). It is about 20 lines in `install-team-config.ts`, and a separate gate for it would cost more than the change.
Independent testing is still kept: each mechanism has its own task group, its own test file and its own F1 scenario (a, b/c, d).

## Risks / Trade-offs

- [Gate open in another worktree at deploy time loses its ledger state] → the Migration Plan inventory; deploy only after those gates closed.
- [Repositories with plans still in `.omo/plans` (this one until P5b, onara) lose rule-glob injection for those plans] → accepted until they move; P5b follows directly.
- [The extension's constants drift from `gate-layout.mjs`] → F1 scenario c: one real session per stop-hook path. The unmerged case proves that the validator was invoked and returned exit 0.
- [A user keeps `plan.autosaveDir: .omo/plans` despite the notice] → plans keep going there; no gate behaviour depends on the plan path (D2 non-goal), so nothing breaks.

## Migration Plan

1. Implement in `.worktrees/team-config-omp-native-locations`; gate per D9; merge to `main`.
2. Before the deploy, close every gate on the old ledger. Inventory on 2026-10-23 (`git worktree list` plus `<wt>/.omo/ulw-execute/ledger.jsonl`):

   | Worktree | Branch | Ledger | State |
   |---|---|---|---|
   | `.worktrees/acp-v2-surface` | `feat/acp-v2-surface` (unmerged, 6 dirty) | 7 events, last `gate_wave` 2026-10-23T12:25Z, plan `.omo/plans/ACP_V2_BASELINE_PLAN.md`; 7 entries in `.omo/gate-deltas/` | **open**: finish before the deploy |
   | `.worktrees/fork-compaction-budget` | `feat/fork-compaction-budget` (unmerged, 2 dirty) | 10 events, last `gate_wave` 2026-10-23T12:29Z, plan `.omo/plans/subagent-compaction-budget.md`; 16 delta entries | **open**: finish before the deploy |
   | `.worktrees/fork-wait-progress` | `feat/fork-wait-progress` (merged) | 4 events, last `gate_wave` 2026-10-23T11:20Z | closed (merged); archive |
   | main checkout | `main` | 91 events, last `follow_up_done` 2026-10-18 (`omp-native-plan-review`) | closed; archive |
   | 15 others (acp-v2-* except surface, acp-jsonrpc-batch, upstream-*, omp-deploy, evo-source, two temp worktrees) | — | none | — |

   Re-run the inventory right before the deploy; a new open gate either finishes first or restarts under the new tooling with a fresh baseline.
3. Deploy into every agent directory that holds team-config, not only the default one: `deploy-local.sh` runs the installer once for `getAgentDir()` (`scripts/install-team-config.ts:602-603`), while named profiles (`~/.omp/profiles/NAME/agent`) and `PI_CODING_AGENT_DIR` overrides are separate agent directories (`packages/utils/src/dirs.ts:119-134,364-370`) whose v2 hook would stay. Inventory: `for r in ~/.omp ${PI_CONFIG_DIR:+$HOME/$PI_CONFIG_DIR}; do for d in "$r/agent" "$r"/profiles/*/agent; do test -f "$d/.team-config-manifest.json" && echo "$d"; done; done; ps -axeww -o command= | grep -oE '(PI_CODING_AGENT_DIR|PI_CONFIG_DIR|PI_PROFILE|OMP_PROFILE)=[^ ]+' | sort -u`. On 2026-10-23 it lists only `~/.omp/agent` (no `~/.omp/profiles/` directory exists). The inventory sees roots of the current environment and of running processes only, so the operator adds every agent directory it cannot see (a custom `PI_CONFIG_DIR` root used elsewhere, an install no running session uses); that explicit list is part of the cutover note. Run `scripts/deploy-local.sh`, then `env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=DIR bun scripts/install-team-config.ts` for each other directory: an inherited profile variable makes `getAgentDir()` ignore `PI_CODING_AGENT_DIR` (`packages/utils/src/dirs.ts:495-503`), so it is cleared, and the installer's `Team config → DIR` line must name the intended directory. Read the notices and remove `plan.autosaveDir` from each named `config.yml`.
4. Restart every running omp session, whatever the launch form: the installed `omp` binary, source launches (`bun --cwd=packages/coding-agent src/cli.ts`, as `package.json` `dev` does), the npm bundle (`dist/cli.js`) and IntelliJ ACP. A session loads the extension once at startup, so a session started before the deploy keeps the v2 hook, which still accepts settled v2 records. Inventory: `ps -axo pid=,lstart=,command= | grep -E '[/ ]omp( |$)|src/cli\.ts|dist/cli\.js'`. Before relying on it, show that it lists a running source-launched session (the negative control for a missed launch form). The cutover counts as complete only when the inventory lists no process whose start time is before the deploy.
5. Rollback: redeploy the previous `main` commit and restart sessions again. v3 records written in between are then refused by the v2 hook, and gates started in between restart.
