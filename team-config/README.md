# Team config

Shared omp setup for the team: agents, rules, skills, the merge-gate extension, global
instructions, and the onara model router. `scripts/deploy-local.sh` builds omp and syncs this
directory into the omp agent dir (`~/.omp/agent`) from the same commit as the binary.

## New machine

Prerequisites: [bun](https://bun.sh), Node.js 22.20+, a Rust toolchain ([rustup](https://rustup.rs)),
`git`, and the OpenSpec CLI at the version pinned in `team-config/openspec-version`
(`npm install -g @fission-ai/openspec@2.1.0`). On NixOS, `nix` replaces bun/rust; the deploy script re-enters the
flake dev shell.

```sh
git clone git@github.com:KimToehler/oh-my-pi.git ~/git/oh-my-pi
cd ~/git/oh-my-pi
scripts/deploy-local.sh
{ [ ! -e ~/.omp/agent/.env ] && [ ! -L ~/.omp/agent/.env ] || { [ -f ~/.omp/agent/.env ] && [ ! -L ~/.omp/agent/.env ]; }; } &&
  ( umask 077; touch ~/.omp/agent/.env ) && chmod 600 ~/.omp/agent/.env &&
  [ -f ~/.omp/agent/.env ] && [ ! -L ~/.omp/agent/.env ] &&
  { [ ! -s ~/.omp/agent/.env ] || [ -z "$(tail -c1 ~/.omp/agent/.env)" ] || printf '\n' >> ~/.omp/agent/.env; } &&
  printf 'Router key: ' && read -rs ONARA_ROUTER_KEY && echo &&
  printf 'ONARA_ROUTER_KEY=%s\n' "$ONARA_ROUTER_KEY" >> ~/.omp/agent/.env; unset ONARA_ROUTER_KEY
```

- `scripts/deploy-local.sh` builds omp, installs `~/.local/bin/omp` and syncs this config.
- The first `{ ... }` guard passes only if `~/.omp/agent/.env` is absent or a regular non-symlink file; otherwise the chain stops before `touch`/`chmod`.
- `touch` under `umask 077` plus `chmod 600` give mode 600 before any key is written.
- The second `[ -f ... ]` check stops on a directory or symlink before anything is read.
- The next `{ ... }` group adds a newline if the last line is unterminated, so the key starts on its own line.
- `read -rs` takes the next line you type or paste as the key; it neither echoes the key nor stores it in shell history (zsh and bash).

Paste the router key at the `Router key:` prompt, then start omp (`~/.local/bin` must be on `PATH`):

```sh
omp
```

Update later with `git pull && scripts/deploy-local.sh`. Restart running omp sessions
(including IntelliJ ACP) afterwards. `seed/config.yml` is copied only when it is missing, so a
new entry in it never reaches an existing `~/.omp/agent/config.yml`: after an update that adds
one, merge it by hand. Today that is `task.agentModelOverrides.plan-reviewer`, the model plan
review is pinned to; without a pin for the agent it dispatches, a plan review stops and asks you
to add the entry instead of reviewing on whatever model the runtime picks. `seed/models.yml` is
copied the same way: merge its `cc/claude-fable-5-2` entry into an existing
`~/.omp/agent/models.yml` by hand (and into each profile or custom `PI_CODING_AGENT_DIR`), or
every architecture consultation runs on another model, counts as failed and ends in the
skip-or-stop ask below. Open `risky` OpenSpec changes need a `consultation.md` before
`--reviewed` passes again: re-run their review, which records the consultation, or a skip you
approve, without a round unless an adopted finding edits the plan.

The pin checks of the plan review, the architecture consultation and the F2 gate compare model names, not providers:
`onara/cx/gpt-6.1-sol` and `openai-codex/gpt-6.1-sol` are the same model. The pins themselves name the router. A
member without the router sets `task.agentModelOverrides` in `~/.omp/agent/config.yml` to their own provider with the
pinned model and effort: `plan-reviewer: openai-codex/gpt-6.1-sol:high`, `blocker-verifier:
openai-codex/gpt-6.1-sol:medium`, `auditor: openai-codex/gpt-6.1-sol:high` and `architecture-oracle:
anthropic/claude-fable-5-2:high`. Prefer this provider-prefixed form: a bare override such as `gpt-6.1-sol:high`
resolves to any authenticated provider carrying that exact id, API-key providers from the environment included, at
that provider's price and without a configured fallback chain.

## What lands where

| Repo path | Target | On every deploy |
|---|---|---|
| `agent/**` (`AGENTS.md`, `agents/`, `commands/`, `rules/`, `skills/`, `extensions/`) | `~/.omp/agent/**` | Overwritten; files removed here are removed there |
| `seed/config.yml`, `seed/models.yml` | `~/.omp/agent/` | Copied only if missing; your edits are kept |

The installer records what it shipped in `~/.omp/agent/.team-config-manifest.json`. Files it did
not ship are never touched. If a shipped file was edited locally, or a same-named file existed
before the first deploy (even an identical one: the installer only owns files it wrote itself), its previous content is moved to a fresh `~/.omp/agent/backups/team-config-<time>-<random>/`
before it is replaced; the deploy output names the directory.

`.team-config-manifest.json` is installer control state, not a user file: the installer rewrites it canonically on every run, so do not edit it by hand. A manifest that is not exactly the v1 or v2 shape is rejected before any change.

Every profile shares the deployed binary, so the deploy also syncs each `~/.omp/profiles/<name>/agent` that already holds
a `.team-config-manifest.json`, after `~/.omp/agent`. A profile without one stays untouched; install into it once with
`env -u OMP_PROFILE -u PI_PROFILE PI_CODING_AGENT_DIR=~/.omp/profiles/<name>/agent bun scripts/install-team-config.ts`
and later deploys keep it current. An agent dir outside `~/.omp` (a custom `PI_CODING_AGENT_DIR`) needs that command
after every deploy.

`OMP_SKIP_TEAM_CONFIG=1 scripts/deploy-local.sh` installs only the binary.

Before building, the deploy checks the OpenSpec CLI (`scripts/ensure-openspec-cli.ts`): a missing CLI or a version
other than `team-config/openspec-version` stops the deploy with the `npm install -g` line to run. On a match it persists
`telemetry.enabled false` in the global OpenSpec config and prints that file's path. Every OpenSpec call the check makes
runs with `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`. The opt-out covers the config of the environment that deploys; a
shell with a different `XDG_CONFIG_HOME` reads another file. `OMP_SKIP_TEAM_CONFIG=1` skips the check too.

## Where plans and gate state live

The team config follows omp's own locations; omp does not load `.omp/team-config/` itself, only the skills, rules and the merge-gate extension read and write it.

- Plans: `.omp/plans/<slug>.md`.
- `.omp/team-config/` holds the team-config state of a project:
  - `evidence/`: local scratch and reviewer trailers, `evidence/<plan basename>/…`;
  - `evidence/gate/`: gate records (`<plan basename>.json`) and the record's evidence directory (the record path without `.json`, `<plan basename>/`), which holds the F3 integration-review report (`f3-integration-review-report.md`) and the QA artifacts the record cites (`wave-<n>/`, `f1/`);
  - `ledger.jsonl`: the gate-convergence ledger;
  - `gate-deltas/`: delta-review artifacts;
  - `frontend-design/`: the design state ledger (`state.md`).

Only `evidence/gate/**` and `*trailer*` files under `evidence/` are meant to be committed; everything else is local. Add this block to a project's `.gitignore`, after any `!.omp/` rule:

```gitignore
/.omp/team-config/*
!/.omp/team-config/evidence/
/.omp/team-config/evidence/**/*
!/.omp/team-config/evidence/**/
!/.omp/team-config/evidence/gate/**
!/.omp/team-config/evidence/**/*trailer*
```

The default gate record location is `.omp/team-config/evidence/gate/<plan basename>.json`; any other tracked path inside the repository still works (for example `docs/evidence/<slug>/merge-gate.json`). Records carry the schema id `team-config.merge-gate/v3`. Records written earlier (`omo.merge-gate/v1`, `omo.merge-gate/v2`) are an archive: they stay readable but back no new merge claim, so re-run review-work for open work.

### Upgrading from the `.omo` layout

1. Finish or close every open gate before deploying: the ledger and gate-delta state move to the new paths, and a gate left open in the old layout loses its state.
2. Restart every omp session after deploying: a running session keeps the old merge-gate hook in memory (and keeps enforcing the old record id).
3. Install once into every profile that lacks the team config, and after every deploy into a custom agent directory (see the deploy notes above); profiles that already carry it are synced by `scripts/deploy-local.sh`.
4. If your `config.yml` sets `plan.autosaveDir` to an `.omo` path, remove it after the deploy notice names it; plans then land in `.omp/plans`.
5. Nothing defaults to `.omo` any more: plans autosave to `.omp/plans`, and the ledger and gate deltas live under `.omp/team-config/`. The old `.omo` ledger and deltas are not read, and an old `omo.merge-gate` record is read only to refuse it. A plan you pass by path still works wherever it lies; move plans and evidence you want found in the default places.

## Personal settings

- Personal instructions (role, stack, language): `AGENTS.local.md` in the agent dir (default
  `~/.omp/agent`). It loads only while `contextFiles.extra` lists it. The seeded `config.yml`
  does; a pre-existing `config.yml` needs `contextFiles: { extra: [AGENTS.local.md] }` added by
  hand. A project-level `contextFiles.extra` replaces the user list, so the agent-dir file is
  then not read.
- Personal rules or skills: any other file name under `~/.omp/agent/rules/` or `skills/`.
- Model roles, approval mode, bash patterns: edit `~/.omp/agent/config.yml` directly.
  After a team change to `seed/config.yml`, compare with
  `diff ~/.omp/agent/config.yml team-config/seed/config.yml` and merge what you want.
  A config that predates `retry.fallbackOn: usage-limit` still switches models on any
  provider error, so a pinned reviewer can answer from the next chain entry; merge that
  key if you run gates.
- Do not edit shipped files in `~/.omp/agent`; the next deploy replaces them (with a backup).
  Change them here and open a PR instead.

## OpenSpec

Deploy ships the six core OpenSpec commands to every omp session, plus the `omp-gated` schema, the team project config
and the validator under `~/.omp/agent/skills/review-work/`. Projects keep their OpenSpec config, schema, specs and
changes in their own repository. This keeps planning artifacts harness-independent and reviewable. The canonical
schema is `team-config/agent/skills/review-work/openspec/schemas/omp-gated/`; this repository's own
`openspec/schemas/omp-gated` is a symlink to it.

### Project setup and update

Install the CLI first (see New machine); deploy checks it. Then, in the target project's git repository, after a deploy:

```sh
node ~/.omp/agent/skills/review-work/scripts/install-openspec-workflow.mjs
```

It runs on the work-tree root (or the root given as its argument) and writes only two paths:

- `openspec/schemas/omp-gated/` is replaced wholesale with the deployed schema; local edits and extra files in it are
  dropped.
- `openspec/config.yaml` is created with the team content when it does not exist. An existing one is never rewritten:
  with `schema: omp-gated` it is left alone; any other or missing `schema:` refuses, and you change that line yourself.
  Merge the team `rules:` and `operations:` from `~/.omp/agent/skills/review-work/openspec/config.yaml` by hand if you
  want them. A changed team rule reaches an existing config only this way: for example the `gate:` rule that classifies
  risk of the delivered change, never the tools used to verify it.

Git is the backup. The installer refuses, changing nothing, unless
`git status --porcelain --ignored --untracked-files=all -- openspec/config.yaml openspec/schemas/omp-gated` is empty, so
every byte it replaces is in `HEAD`. It also refuses when a `.gitignore` rule would ignore a file it is about to create (it names the path and rule), on a symlinked `openspec`, `openspec/schemas`, schema directory or
config, and outside a git work tree. If the copy fails, it rolls back to `HEAD` before exiting and checks that the
status is clean again; if that rollback fails too, it says so and prints the remaining paths. It never suggests
deleting anything on a refusal: inspect the listed paths yourself.

Then review and commit:

```sh
git status -- openspec/config.yaml openspec/schemas/omp-gated
git diff -- openspec/config.yaml openspec/schemas/omp-gated
git add openspec/config.yaml openspec/schemas/omp-gated
git commit -m "chore: add omp-gated OpenSpec workflow"
```

On an update the diff mixes the team's new version with the reversal of any local edits you had committed (lines you
added appear as removed, files you added as deleted); `git show HEAD:openspec/schemas/omp-gated/<file>` returns the
previous content. Check with `openspec new change probe`: it must print `Schema: omp-gated`. Remove the probe afterwards
(`rm -r openspec/changes/probe`).

`openspec init` is not needed. If it already ran, change its `schema: spec-driven` line to `schema: omp-gated`, commit,
then run the installer.

### Projects set up before the installer

Projects set up by hand from an earlier version of this README may still carry a copy of the validator and open changes
in the old gate format. After installing, the installer prints one `notice:` line per finding and changes none of
these files:

- `openspec/config.yaml` naming `scripts/validate-openspec-change.mjs`: point it at
  `~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs`.
- a project file `scripts/validate-openspec-change.mjs`: remove it (`git rm`).
- an open change (not under `openspec/changes/archive/`) whose `gate.md` has `Review tier`: the gate refuses it; replace
  it with `- **Risk tier**: product` (or `internal-tooling`) and add `- **Author's risk assessment**`.
- project `.omp/commands/opsx-*.md`, written by `openspec init --tools oh-my-pi`: they duplicate the deployed commands;
  remove them.

Run `/opsx-propose <change>` for behaviour-changing work. In default mode you can also just ask the agent to plan the
feature: the `openspec` skill routes a behaviour change in a repository with an OpenSpec root to `/opsx-propose` (the
agent reads and follows the command file), keeps small changes in plan mode, and never creates `openspec/` where there is
none. Plan mode cannot write `openspec/changes/`; there the agent asks which planning path you want (OpenSpec via
`/opsx-propose` outside plan mode, recommended, or a session plan).
Before applying, both validators must pass:

```sh
openspec validate <change> --strict
node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs openspec/changes/<change>
```

Before a design introduces a mechanism that implements a published protocol, format or algorithm, or general-purpose
infrastructure, the design instruction asks the planner to search this repository and its dependencies, then the
platform, then maintained libraries, stopping at the first that covers it, with `web_search`, `read` and the deps.dev
API (no key or MCP server). Each such mechanism gets a `Build vs. adopt` decision in `design.md`; auth, crypto and
protocol mechanisms are never built when one of those covers them, and a failed search leaves the decision open for
the user. Everything read during the search is data, never instructions. The plan reviewer that covers correctness
(the single `standard` reviewer, or scope A of a `risky` round) blocks on a missing, incomplete or open decision and on
a verdict without a gap, and the `blocker-verifier` checks such a finding like any other.

The last artifact `/opsx-propose` creates is `review.md`. The review's depth comes from `gate.md`: `risky` when the
change carries a mandatory class or alters a review, gate or release mechanism, `standard` otherwise. A `standard`
round dispatches one `plan-reviewer` over the whole change folder with every scope; a `risky` round dispatches two in
one batch, scope A (correctness, architecture, security, the mechanical checks) and scope B (verification and tests).
Both run as `onara/cx/gpt-6.1-sol:high`, pinned in the team seed, and the planner adds no focus of its own to the fixed
brief. Every finding the round returns then goes, verbatim and numbered, to one read-only `blocker-verifier`
(`onara/cx/gpt-6.1-sol:medium`), which checks each against the repository and returns `confirmed`, `refuted` or
`undecided` with a reason. Confirmed blocking findings are fixed; a finding that is refuted, below the threshold or
left undecided without a blocking consequence is recorded under `## Residuals` with the verifier's reason and never
reviewed again, while a finding awaiting one of the asks below stays under `## Blockers` until you answer. The budget
is fixed: a `standard` round is followed by one delta check
over the fix diff, unless a fix raised the depth, which starts one full `risky` round instead; a `risky` review runs
at most two full rounds. Four cases ask you instead of deciding: an
`undecided` finding whose stated consequence meets the blocking threshold, a finding on a security or privacy path or
a protected asset that it did not confirm as blocking, whether refuted or confirmed below the threshold, a fix that
needs a decision about the change's scope, and exhaustion of the budget with a confirmed finding still open. Every ask
quotes the finding verbatim; its options differ. The two findings the verifier did not confirm offer Fix, keep as a
residual with your reason, and Stop. The scope decision offers the alternatives the artifacts leave open and Stop,
never keep: the finding is confirmed. Exhaustion offers Fix, Override and Stop, and Override is unavailable while a
security-scope or protected-asset finding is open. A Fix answer given after the budget is spent buys exactly one more
delta check over the edits it names. The record is written and committed before any fix or ask, and a round whose
reviewers delivered blockers is recorded REJECT with Awaiting `triage` before the verifier is dispatched, so a session
that dies during triage leaves no earlier OKAY current and an interrupted session
resumes from `review.md` alone. Each dispatch is checked against its pinned model and the record's `Models` line names
what every dispatch ran on: a reviewer or verifier that ran on another model, returned no structured result or failed
is retried once, and a retry without a result counts the same. A verifier that fails twice leaves the round REJECT
with Awaiting `triage`; a reviewer that fails twice while another reviewer delivered blockers leaves it REJECT with
Awaiting `incomplete`, and a resumed session re-runs that round in full and triages its delivered findings together
with the re-run's. Only a round that delivered nothing and carries nothing writes no record. Verification of the change itself follows review-work's
`Change verification` section: instruction changes are proven by their text plus real sessions on disposable fixtures,
not by checkers that re-score model output, and the class comes from the delivered change, not from the session's own
login. F2, its delta reviews and an on-demand `integration-review` keep review-work's `Blocker disposition` section unchanged; plan review does not use it.

Before every `plan-reviewer` dispatch of a `risky` change, a full round or a delta check, while the folder holds no
record, the review runs one architecture consultation (a `standard` change gets one only when you ask). The planner commits the
change folder and a `pending` `consultation.md` naming the attempt, then dispatches one fresh `architecture-oracle`
item with a fixed brief: a read-only agent (`read, grep, glob`) pinned in its definition to
`onara/cc/claude-fable-5-2:high`, a second model family next to the Sol reviewers, at about $4-8 per consultation at
list price. An attempt counts only when `validate-openspec-change.mjs --consultation-report <session file> <change dir>`
accepts its session file: the brief names this change, every turn ran on the definition's model through any provider (an
override naming another model never counts), and the final `yield` delivered a report matching the agent's output schema. A failed
attempt gets one retry; after two, you choose between skipping with your reason and stopping. After a Stop you can ask
the agent to consult again, for example once the model entry is fixed, which allows two more attempts. The counted report is
copied into `consultation.md` by the report command, never retyped, and the planner marks every finding
`adopted:` (with the plan edit) or `rejected:` with a reason, without a verifier; the record and the adopted edits
are committed together before the round's digest. The formal reviewers stay blind: their briefs exclude
`consultation.md`, the delta patch omits it, and no dispatch quotes a consultation finding. A session that finds a
`pending` record resolves its named attempts from their session files before dispatching anything, so an interrupted
consultation is never paid for twice.

The record carries the digest of the folder it reviewed and the round's subagent ids. OpenSpec reports apply as
`blocked` while `review.md` is missing, and `/opsx-apply` runs this before the first source edit:

```sh
node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed openspec/changes/<change>
```

It fails when `review.md` is missing or malformed (including a missing `## Blockers` section, one that says `none`
for a `REJECT`, one that lists blockers for an `OKAY`, or a repeated subagent id), when the verdict is `REJECT` without an override, when
a `risky` change has no `consultation.md`, when `consultation.md` is malformed or still `pending`, and when any
artifact changed after the review (`stale`; ticking tasks does not count). `consultation.md` is outside the digest,
like `review.md`: adding or editing it never makes the review stale. Re-run the review after editing an artifact:
`openspec instructions review --change <change>` and follow it. To accept a `REJECT`, tell the agent your reason; it
writes it as `- **Override**:` and `--reviewed` prints it. `--digest` prints the digest the review is bound to. Both
checks are prompt-level: they stop an agent that follows the commands, not one that ignores them.

The post-implementation gate is proportional, like the plan review. Its depth comes from `gate.md` `Depth` (a plan-mode plan
derives it from its class and whether it changes a review, gate or release mechanism; the orchestrator may raise it, never
lower it). A `standard` gate dispatches one `implementation-audit` at F2; a `risky` gate dispatches it and
`strategic-risk-review` together in one batch. Both lanes run on `auditor`, pinned in `auditor.md` to
`onara/cx/gpt-6.1-sol:high`; the gate checks the pin before dispatch and each session file after it, and a dispatch that ran
on another model or effort does not count: it gets one fresh retry and is then recorded INCONCLUSIVE. The former F3 whole-diff
lane is folded into F2, whose reviewers read the whole diff; `integration-review` stays available on demand. Fix rounds are
bounded by depth (1 for `standard`, 2 for `risky`), each ending in a closing wave that re-runs QA and, when it passes, every
reviewer lane; when a closing wave still fails, the gate asks you once whether to fix once more, re-plan, Stop or, for
eligible blockers only, Override. F1 runs one QA row per requirement plus three minimum rows at `standard` and one row per
scenario at `risky`; after a fix or a merge of the default branch only the rows its diff can change are re-run, and the
carried rows with their reasons go to the reviewers.

A gate whose F2 baseline predates the deploy finishes under the text it started with. Running sessions restart after
`scripts/deploy-local.sh`, which also syncs every profile that already carries the team config; a custom agent directory needs its own install to receive the new `auditor.md`.

When a task names a worktree for the change, `/opsx-apply` implements only while the session runs inside it, because
relative paths and task ticks resolve against the session's directory. Anywhere else, the agent moves the session there
itself with the `session_move` tool, creating a missing worktree with the task's branch and base (once the change folder
is committed), and continues the command in the worktree; it ticks nothing before the move. Only when `session_move` is
unavailable or fails does it ask you to type `/move <worktree>` and then `/opsx-apply <change>`. `/move` works in the
terminal UI and over ACP (IntelliJ) and keeps the chat; an ACP client that reloads the chat reopens it in the worktree it
was moved to, and a chat whose worktree was removed reopens in the project directory. Do not use `/wt` here: it creates
its own worktree outside `.worktrees/` with a generated branch.

The team validator enforces the proposal sections (`## Why`, `## What Changes` and `## Impact` with content outside HTML
comments, and `## Capabilities` without template placeholders; its subsections may stay empty), the `Negative control`
scenario for every requirement block, the `gate.md` fields (exactly one `Mandatory class` token, `Risk tier` `product` or
`internal-tooling` with the same rules as a plan's, `Author's risk assessment`, `Whole-diff review` and both abort
fields), and a numbered task with exactly one `Verify:` command for
every tracked checkbox (any marker OpenSpec counts, e.g. `[~]`). A change with no behavioural delta must declare
`skip_specs: true` in `.openspec.yaml` and then has no
Markdown specs; a change without requirements (`skip_specs`, rename-only) must carry a `- Feature-specific criteria:`
block in `gate.md` (the template ends with a commented example), because the gate takes its review criteria from the
requirements otherwise. Once `skip_specs` appears there, the whole file must be flat top-level `key: value` lines with plain values and
no repeated key, and `skip_specs` must be exactly `true` or `false`; anything else is rejected. A rename-only delta needs no
scenarios. OpenSpec's own strict validator does not enforce project rules from
`openspec/config.yaml`. `DO_NOT_TRACK=1` or `OPENSPEC_TELEMETRY=0` is the environment equivalent of the persisted
telemetry setting.

### Bumping OpenSpec

`team-config/openspec-version` is the single pin; the deploy check reads it.
`team-config/agent/commands/opsx-{propose,explore,apply,update,sync,archive}.md` are the output of OpenSpec 1.15.0,
with four team additions: step 4 of `opsx-apply.md` ("Run in the change's worktree"), step 5 of `opsx-archive.md`
("Route the change's follow-ups"), the `Take matching follow-ups (proposal only)` bullet of step 6a in
`opsx-propose.md`, plus its Guardrails and Output lines, and the `**Goal-mode continuation**` paragraph after the
planning boundary of `opsx-propose.md` with its four one-sentence additions (to the boundary paragraph, the line
"start the apply workflow explicitly", the Output and the first Guardrail); the later steps of the first two are
renumbered, and `opsx-archive.md` also carries the `Follow-ups` summary bullet and output lines. They stay standalone
so each deploys on its own. OpenSpec 2.0 stopped generating command files and writes the same workflows only as
skills (`openspec-propose`, `openspec-apply-change`, …), so a bump no longer regenerates the commands.

To bump, set the new version in `team-config/openspec-version`. Run the CLI calls the workflow makes (`list`,
`context`, `status`, `show`, `instructions <artifact>`, `validate --strict`) with the old and the new version on a
copy of each project's `openspec/` and compare the output, then `archive` and `new change` on copies the same way.
Update the version in the New machine install line, and the Node.js minimum from the package's `engines` field,
install the new CLI, run `bun run test:team-config` and redeploy.

To take upstream changes to the workflow text, compare the skills of 1.15.0 with those of the pinned version and
port what applies to the commands by hand. Skip edits that only replace `/opsx-*` references, since the team keeps
the commands:

```sh
v=$(cat team-config/openspec-version)
old=$(mktemp -d) new=$(mktemp -d) && git -C "$old" init -q && git -C "$new" init -q
export DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0
bunx --bun @fission-ai/openspec@1.15.0 init "$old" --tools oh-my-pi --profile core --no-animation
bunx --bun "@fission-ai/openspec@$v" init "$new" --tools oh-my-pi --profile core --scope project --no-animation
diff -r "$old/.omp/skills" "$new/.agents/skills"
```

Ported from 2.1.0: `opsx-apply.md` step 3 shows the CLI's recovery `instruction` for missing artifacts, and
`opsx-update.md` names the implementation tasks or code changes a revised plan calls for (step 6 and the first
Guardrail). Not ported: update's `openspec archive` suggestion, which would skip the team step 5 of `opsx-archive.md`,
and archive's inline merge for a missing sync skill, since `/opsx-sync` always deploys with it. Name any later port
here, so the next comparison starts from the right base. Hand-edit the command files only for the team additions and
ported upstream changes.

## Changing the team config

Edit files under `team-config/`, then run `bun run test:team-config`. It covers the merge-gate
extension, the gate validator, the OpenSpec checks, the project installer, the deploy's OpenSpec CLI check and the
context-review measurement. Rules carry no repo-private paths or evidence: this repository is public.

Keep the always-on part small: `AGENTS.md`, `alwaysApply` rules and every rule or skill description reach every
request. The `context-review` skill measures what the agent dir and a project add
(`bun ~/.omp/agent/skills/context-review/scripts/measure-context.ts --repo <repo>`, no model call) and walks
through trimming it; run it monthly per repository and after adding rules or lessons.

## Provenance

The skills `coding-agent-sessions`, `debugging`, `frontend`, `git-master`, `integration-review`,
`programming`, `review-work`, and `visual-qa` come from
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (`packages/shared-skills`),
which is published under the Sustainable Use License: free internal and non-commercial use;
redistribution only free of charge for non-commercial purposes. `frontend` additionally carries
its own Apache-2.0 notice (`agent/skills/frontend/ATTRIBUTION.md`). `angular-developer` is
[angular/skills](https://github.com/angular/skills) (MIT, Google LLC).
The files under `agent/commands/opsx-*.md` are generated from OpenSpec 1.15.0 (MIT).

## Follow-ups

- `/opsx-archive` step 5 has no runtime proof that it collects a finding in an area `gate.md` names under `Out of scope for blocking`. F1 also never ran a proposal naming several documents that all have the section, or a repaired trailer, so those branches can misroute unnoticed. `team-config/agent/commands/opsx-archive.md:168`. Source: `follow-up-routing` `.omp/team-config/evidence/gate/follow-up-routing/f2/trailer-implementation-audit.txt`, N1
- No capture shows that routing leaves the following sections byte-for-byte unchanged when `## Follow-ups` is not the last section of the destination, so an append under the next heading, or damage to it when a taken bullet is removed, would go unnoticed. `team-config/agent/commands/opsx-archive.md:174`. Source: `follow-up-routing` `.omp/team-config/evidence/gate/follow-up-routing/f2/trailer-implementation-audit.txt`, note 1
- `qa.mjs scan` prints the credentials file's path before the configured scan sentinels join output redaction, so a sentinel inside that path prints literally while later hit paths are redacted. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:426`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/implementation-audit-trailer.md`, N1
- The evidence rule of `app-qa-drivers` and `ui-automation-credentials` is guidance, not enforcement: F1 sessions `agent-missing` and `agent-legacy` ran a broad `grep` over `.omp` that returned lines of committed evidence they did not write, and `agent-signin`'s report named account 1's username. `team-config/agent/skills/app-qa-drivers/SKILL.md`, `team-config/agent/rules/ui-automation-credentials.md`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/implementation-audit-trailer.md`, N2
- No test imports `qa.mjs` from outside a Git repository, so moving `main()` out of the direct-execution guard (which would make an import read the CLI arguments and configuration) goes unnoticed. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:1325`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/implementation-audit-trailer.md`, note 1
- `qa.mjs scan` emits its credentials-path diagnostic before configured sentinels join `redactValues`, so a credentials filename holding a scan marker prints that marker literally. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:415`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/strategic-risk-review-trailer.md`, N1
- The driver takes the parent of `git --git-common-dir` as the main checkout, so a repository with a separate Git directory resolves the default credentials file wrongly (`--credentials` works around it). `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:84`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/strategic-risk-review-trailer.md`, N2
- `sweepRoot` walks the run root several times; a single pass could replace them, but only if the screenshot manifest is still recorded before the sweep and deletion stays safe. No defect is shown. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:961`. Source: `app-qa-shared-driver` `.omp/team-config/evidence/gate/app-qa-shared-driver/wave-1/strategic-risk-review-trailer.md`, note 1
- The continuation-to-apply handoff across the worktree move was captured only on the ordinary path; no session applies a change whose destination worktree holds a different or stale proposal, so validating in one checkout and editing in another would go unnoticed. `team-config/agent/commands/opsx-apply.md` (worktree step). Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-implementation-audit.txt`, note 1
- A goal continuation that does not apply left the failed condition out of its own reply (`planonly-later`; named one turn earlier in the proposal output), although the Goal-mode continuation paragraph requires it, so an owner reading only that turn cannot tell why the goal stopped short of apply. `team-config/agent/commands/opsx-propose.md:16`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-implementation-audit.txt`, Residual note 1
- The same-turn QA criteria (no read of `opsx-apply.md`, no write outside `openspec/changes/`) also reject harmless planning support, and the exact build-request sessions stopped for clarification before presenting artifacts, so the combined build-request-to-presented-proposal scenario is unobserved. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/same-turn-nc.md:13`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-implementation-audit.txt`, Residual note 2
- The authorized-continuation capture skipped the apply workflow's `openspec status` call and change announcement, so full compliance with the unchanged `opsx-apply.md` steps on a goal continuation is not shown. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/authorized.md:14`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-implementation-audit.txt`, Residual note 3
- `owner-objects.md` gives the first two continuation starts as 08:39:59Z and 08:40:07Z (the ends of the preceding turns); the transcript records 08:39:55.076Z and 08:40:05.816Z, so the row's timeline is a few seconds off. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/owner-objects.md:11`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-implementation-audit.txt`, Residual note 4
- The qualifying planning-only continuation did not name the failed authorization condition in its own reply, despite the command requiring it; only the earlier planning reply explained it. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/planonly-nc.md:17`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-strategic-risk-review.txt`, Note — known diagnostic deviation
- The QA proxies "no read of the apply file" and "no write outside the change directory" are stricter than the boundary and reject harmless comparison and schema-required review-delta output; future criteria would be clearer if they distinguished apply execution and project-code edits from planning support. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/same-turn-nc.md:3`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-strategic-risk-review.txt`, Note — QA proxies are stricter than the actual boundary
- Both build-request runs stopped for clarification before presenting artifacts, so the complete no-goal build-request interaction is shown only by adjacent sessions. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/build-request.md:16`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-strategic-risk-review.txt`, Note — combined no-goal build scenario is partial
- The authorized continuation omitted the apply workflow's status step, so complete apply-command compliance on a continuation is not established. `.omp/team-config/evidence/gate/goal-mode-apply-continuation/f1/authorized.md:14`. Source: `goal-mode-apply-continuation` `.omp/team-config/evidence/gate/goal-mode-apply-continuation/wave-2/trailer-strategic-risk-review.txt`, Note — complete apply-command compliance is not established
- A finding id that carries Markdown, such as `F1 <!-- rationale -->`, passes the report check but changes when its `### <id>` disposition heading is parsed, so a correctly written consultation record is refused as mismatched. `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs:447`. Source: `plan-architecture-consultation` `.omp/team-config/evidence/gate/plan-architecture-consultation/wave-1/trailer-implementation-audit.txt`, N1
- The README promises an interrupted consultation is never paid for twice, but an attempt interrupted before its session file is recorded counts as failed and is retried, so it is paid again. `team-config/README.md:261`. Source: `plan-architecture-consultation` `.omp/team-config/evidence/gate/plan-architecture-consultation/wave-1/trailer-strategic-risk-review.txt`, note 1
- No capture resumes an incomplete round, adopts a consultation edit, is interrupted after that commit and before the re-run is recorded, then resumes again on the now stale digest, so a resume that drops the round's untriaged findings would go unnoticed. `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:768`. Source: `plan-architecture-consultation` `.omp/team-config/evidence/gate/plan-architecture-consultation/wave-1/trailer-strategic-risk-review.txt`, note 3
- The fixed failure status of a prelude is looked up from the enabled prelude registry when the call fails, so a `computer` call whose prelude is disabled or replaced while it runs records the error's full text, which can name another app's window, instead of `failed`. `packages/coding-agent/src/eval/js/tool-bridge.ts:160`. Source: `app-qa-computer-use-exception` `.omp/team-config/evidence/gate/app-qa-computer-use-exception/wave-2/implementation-audit-trailer.md`, N1
- The skill's "One target window" bullet packs window discovery, root-reference parsing, dialog classification, handle reuse, error suppression, the stop after a fixed failure text and the host-window limits into one paragraph, so the next edit to it can break one of them unnoticed; ordered resolve, use and failure steps would be easier to change. `team-config/agent/skills/app-qa-drivers/SKILL.md:96`. Source: `app-qa-computer-use-exception` `.omp/team-config/evidence/gate/app-qa-computer-use-exception/wave-2/strategic-risk-review-trailer.md`, N1
- Output-folder ownership and the search exclusions are stated in both the skill and `app-qa-evidence`, and the check that `.omp/app-qa.json` exists in both rules (`ui-automation-credentials.md:19`, `app-qa-evidence.md:12`), so an edit to one copy can leave the others contradicting it. `team-config/agent/rules/app-qa-evidence.md:14`. Source: `app-qa-computer-use-exception` `.omp/team-config/evidence/gate/app-qa-computer-use-exception/wave-2/strategic-risk-review-trailer.md`, N2
- The change's design keeps superseded procedures beside the current ones (menu-state confirmation through another `menu.items` call in D8 and D18, replaced by D21(c)'s device-setting confirmation), so a later change that reads the design for the current host-menu procedure can pick a retired one. `openspec/changes/archive/2026-11-15-app-qa-computer-use-exception/design.md:116`. Source: `app-qa-computer-use-exception` `.omp/team-config/evidence/gate/app-qa-computer-use-exception/wave-2/strategic-risk-review-trailer.md`, note 1
- The standalone `omp config get` check of `computer.backgroundFallback` does not see a running session's settings overlay, so a session can take its first `computer` action in takeover before the outcome shows the mismatch; the skill stops only afterward, and prevention belongs to the setting mechanism. `packages/coding-agent/src/tools/settings.ts:709`. Source: `app-qa-computer-use-exception` `.omp/team-config/evidence/gate/app-qa-computer-use-exception/wave-2/strategic-risk-review-trailer.md`, note 2
- `vm up --config OTHER` builds with the named configuration, but the guest starts the targets from the staged copy of `.omp/app-qa.json`, so build and launch can use different configurations; refuse `--config` for `vm up` as routed commands do, or define how it becomes the guest configuration. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:2712`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/implementation-audit-trailer.md`, N1
- With another macOS VM already running on the host, Apple's limit of two running macOS guests makes `lume run` of the clone fail ("The number of virtual machines exceeds the limit", `.omp/team-config/evidence/gate/app-qa-vm-lane/f2/wave-9/slot2-vm-limit.txt`), but `vm up` only reports after its 180 s wait that the clone did not accept an ssh connection, so an agent reports a timeout instead of a capacity limit; surface the `lume run` error or count the running macOS guests before starting the clone. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:2257`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/implementation-audit-trailer.md`, N2
- The host-key pin command turns every `ssh-keyscan` stdout line into a known-hosts entry, so a banner line becomes a malformed extra entry (SSH skips it); filter comment lines and require the key fields. `team-config/agent/skills/app-qa-drivers/vm-image.md:45`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/implementation-audit-trailer.md`, N3
- The interrupted-return tests wait at most 10 s for their markers (`waitFor` default), so both `route: interrupt` cases time out under heavy host load and pass alone; the suite-wide `--timeout 120000` does not lengthen that wait. `team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:556`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/implementation-audit-trailer.md`, N4
- The host-key pin instructions write the `ssh-keyscan` banner as an extra, malformed known-hosts line; filter comments and require the expected key fields before writing the pin file. `team-config/agent/skills/app-qa-drivers/vm-image.md:45`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/strategic-risk-review-trailer.md`, N1
- Host builds a `vm up` starts are not owned by its lease: recovery ends a dead driver's surviving lume mutations but not its build, so a replacement `vm up` can be admitted while the old build still writes the artifact; extend the lease's process-lifetime ownership to builds. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:1431`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/strategic-risk-review-trailer.md`, N2
- `test:team-config` raises Bun's timeout for the whole suite, while the reported failures were the interruption tests' own 10 s marker wait; a deadline scoped to those tests would address load tolerance without hiding other hangs. `package.json:85`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/strategic-risk-review-trailer.md`, N3
- When a foreign VM exhausts the host's macOS guest capacity, `vm up` fails safely but reports an ssh start timeout, which looks like a network or image problem; a capacity check before the start would tell them apart. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:2242`. Source: `app-qa-vm-lane` `.omp/team-config/evidence/gate/app-qa-vm-lane/wave-9/strategic-risk-review-trailer.md`, N4
