# Team config

Shared omp setup for the team: agents, rules, skills, the merge-gate extension, global
instructions, and the onara model router. `scripts/deploy-local.sh` builds omp and syncs this
directory into the omp agent dir (`~/.omp/agent`) from the same commit as the binary.

## New machine

Prerequisites: [bun](https://bun.sh), Node.js 20.19+, a Rust toolchain ([rustup](https://rustup.rs)),
`git`, and OpenSpec 1.14.3 (`npm install -g @fission-ai/openspec@1.14.3`). On NixOS, `nix`
replaces bun/rust; the deploy script re-enters the flake dev shell.

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

Deploy ships the six core OpenSpec commands to every omp session. Projects keep their OpenSpec
config, schema, specs and changes in their own repository; the template in this repository is
`openspec/schemas/omp-gated/`. This keeps planning artifacts harness-independent and reviewable.

Before first use, install the CLI yourself (deploy never installs it or any user-level schema):

```sh
npm install -g @fission-ai/openspec@1.14.3
openspec config set telemetry.enabled false
openspec --version
```

### Project setup (manual)

Run from the root of the target project's git repository. `<fork>` is your oh-my-pi checkout: set `FORK` to its path
(the commands below use `"$FORK"` for `<fork>`). `openspec init` is not needed.

```sh
FORK=/path/to/oh-my-pi   # <fork>
mkdir -p openspec/schemas scripts
cp -R "$FORK"/openspec/schemas/omp-gated openspec/schemas/omp-gated
cp "$FORK"/scripts/validate-openspec-change.mjs scripts/validate-openspec-change.mjs
cat > openspec/config.yaml <<'EOF'
schema: omp-gated

rules:
  specs:
    - Every requirement has exactly one Scenario named "Negative control" with a plausible broken input or state whose outcome MUST fail.
  gate:
    - Classify risk from realistic consequence and a real trust, process or release boundary.
    - Use full review for auth/secrets/PII, schema/migration, externally supported wire/API, or concurrency/state-machine changes.

operations:
  apply:
    guidance:
      - Run `node scripts/validate-openspec-change.mjs <change-dir>` before editing source and after every planning-artifact change.
EOF
git add openspec/schemas/omp-gated scripts/validate-openspec-change.mjs openspec/config.yaml
git commit -m "chore: add omp-gated OpenSpec workflow"
```

Check with `openspec new change probe`: it must print `Schema: omp-gated`. Remove the probe afterwards
(`rm -r openspec/changes/probe`).

If `openspec init` already ran, still do the two `cp` steps; its `openspec/config.yaml` says `schema: spec-driven`: change that line to
`schema: omp-gated` and add the `rules:` and `operations:` blocks above if you want them. `openspec init --tools oh-my-pi`
also writes project `.omp/commands/opsx-*` copies that duplicate the globally deployed commands; delete them
(`rm -f .omp/commands/opsx-*.md`).

To update, repeat the two `cp` steps (the `cp -R` onto an existing directory would nest it, so run
`rm -r openspec/schemas/omp-gated` first) and commit. Your `openspec/config.yaml` is never touched by them.

Run `/opsx-propose <change>` for behaviour-changing work. Before applying, both validators must pass:

```sh
openspec validate <change> --strict
node scripts/validate-openspec-change.mjs openspec/changes/<change>
```

The team validator enforces the `Negative control` scenario for every requirement block, exact gate
classification, and a numbered task with exactly one `Verify:` command for every tracked checkbox (any marker OpenSpec
counts, e.g. `[~]`). A change with no behavioural delta must declare `skip_specs: true` once at top level of `.openspec.yaml` (plain boolean; duplicate, quoted, nested or malformed forms are rejected) and then has no
Markdown specs; a rename-only delta needs no scenarios. OpenSpec's own strict validator does not enforce project rules from
`openspec/config.yaml`. `DO_NOT_TRACK=1` or `OPENSPEC_TELEMETRY=0` is the environment equivalent of the persisted
telemetry setting.

### Regenerating the six `opsx-*` commands

`team-config/agent/commands/opsx-{propose,explore,apply,update,sync,archive}.md` are verbatim output of OpenSpec 1.14.3 and
stay standalone so each deploys on its own. Compare them against a fresh generation after any OpenSpec bump:

```sh
tmp=$(mktemp -d) && git -C "$tmp" init -q
DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 bunx --bun @fission-ai/openspec@1.14.3 init "$tmp" --tools oh-my-pi --profile core --no-animation
diff -r "$tmp/.omp/commands" team-config/agent/commands   # empty output = no drift
```

To update, copy `$tmp/.omp/commands/opsx-*.md` over `team-config/agent/commands/`, bump the pinned version everywhere in this
README, and rerun the diff. Never hand-edit these six files.

## Changing the team config

Edit files under `team-config/`, then run `bun run test:team-config`. It covers the merge-gate
extension, and the gate validator. Rules carry no repo-private paths or
evidence: this repository is public.

## Provenance

The skills `coding-agent-sessions`, `debugging`, `frontend`, `git-master`, `integration-review`,
`programming`, `review-work`, and `visual-qa` come from
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (`packages/shared-skills`),
which is published under the Sustainable Use License: free internal and non-commercial use;
redistribution only free of charge for non-commercial purposes. `frontend` additionally carries
its own Apache-2.0 notice (`agent/skills/frontend/ATTRIBUTION.md`). `angular-developer` is
[angular/skills](https://github.com/angular/skills) (MIT, Google LLC).
The files under `agent/commands/opsx-*.md` are generated from OpenSpec 1.14.3 (MIT).
