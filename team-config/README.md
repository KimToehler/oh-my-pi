# Team config

Shared omp setup for the team: agents, rules, skills, the merge-gate extension, global
instructions, and the onara model router. `scripts/deploy-local.sh` builds omp and syncs this
directory into the omp agent dir (`~/.omp/agent`) from the same commit as the binary.

## New machine

Prerequisites: [bun](https://bun.sh), Node.js 20.19+, a Rust toolchain ([rustup](https://rustup.rs)),
`git`, and the OpenSpec CLI at the version pinned in `team-config/openspec-version`
(`npm install -g @fission-ai/openspec@1.14.3`). On NixOS, `nix` replaces bun/rust; the deploy script re-enters the
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
(including IntelliJ ACP) afterwards.

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

`OMP_SKIP_TEAM_CONFIG=1 scripts/deploy-local.sh` installs only the binary.

Before building, the deploy checks the OpenSpec CLI (`scripts/ensure-openspec-cli.ts`): a missing CLI or a version
other than `team-config/openspec-version` stops the deploy with the `npm install -g` line to run. On a match it persists
`telemetry.enabled false` in the global OpenSpec config and prints that file's path. Every OpenSpec call the check makes
runs with `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`. The opt-out covers the config of the environment that deploys; a
shell with a different `XDG_CONFIG_HOME` reads another file. `OMP_SKIP_TEAM_CONFIG=1` skips the check too.

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
  want them.

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

The last artifact `/opsx-propose` creates is `review.md`: the agent runs the bundled `plan-reviewer` (the `advisor`
model, another family than the planner) over the whole change folder, fixes blockers in the artifacts for at most two
rounds, and records the verdict with the digest of the folder it reviewed. OpenSpec reports apply as `blocked` while
`review.md` is missing, and `/opsx-apply` runs this before the first source edit:

```sh
node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed openspec/changes/<change>
```

It fails when `review.md` is missing or malformed, when the verdict is `REJECT` without an override, and when any
artifact changed after the review (`stale`; ticking tasks does not count). Re-run the review after editing an artifact:
`openspec instructions review --change <change>` and follow it. To accept a `REJECT`, tell the agent your reason; it
writes it as `- **Override**:` and `--reviewed` prints it. `--digest` prints the digest the review is bound to. Both
checks are prompt-level: they stop an agent that follows the commands, not one that ignores them.

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
`team-config/agent/commands/opsx-{propose,explore,apply,update,sync,archive}.md` are verbatim output of that version and
stay standalone so each deploys on its own. To bump, set the new version in `team-config/openspec-version`, then
regenerate the commands with it and compare:

```sh
v=$(cat team-config/openspec-version)
tmp=$(mktemp -d) && git -C "$tmp" init -q
DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 bunx --bun "@fission-ai/openspec@$v" init "$tmp" --tools oh-my-pi --profile core --no-animation
diff -r "$tmp/.omp/commands" team-config/agent/commands   # empty output = no drift
```

Copy `$tmp/.omp/commands/opsx-*.md` over `team-config/agent/commands/` and rerun the diff. Update the version in the
New machine install line and in Provenance, install the new CLI, and redeploy. Never hand-edit the six command files.

## Changing the team config

Edit files under `team-config/`, then run `bun run test:team-config`. It covers the merge-gate
extension, the gate validator, the OpenSpec checks, the project installer and the deploy's OpenSpec CLI check. Rules
carry no repo-private paths or evidence: this repository is public.

## Provenance

The skills `coding-agent-sessions`, `debugging`, `frontend`, `git-master`, `integration-review`,
`programming`, `review-work`, and `visual-qa` come from
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (`packages/shared-skills`),
which is published under the Sustainable Use License: free internal and non-commercial use;
redistribution only free of charge for non-commercial purposes. `frontend` additionally carries
its own Apache-2.0 notice (`agent/skills/frontend/ATTRIBUTION.md`). `angular-developer` is
[angular/skills](https://github.com/angular/skills) (MIT, Google LLC).
The files under `agent/commands/opsx-*.md` are generated from OpenSpec 1.14.3 (MIT).
