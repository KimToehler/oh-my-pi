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

Before first use:

```sh
npm install -g @fission-ai/openspec@1.14.3
openspec config set telemetry.enabled false
openspec --version
```

Run `/opsx-propose <change>` for behaviour-changing work. Before applying, both validators must pass:

```sh
openspec validate <change> --strict
node scripts/validate-openspec-change.mjs openspec/changes/<change>
```

The team validator enforces the `Negative control` scenario, exact gate classification and one
deterministic command per tracked task. OpenSpec's own strict validator does not enforce project
rules from `openspec/config.yaml`. `DO_NOT_TRACK=1` or `OPENSPEC_TELEMETRY=0` is the environment
equivalent of the persisted telemetry setting.

## Changing the team config

Edit files under `team-config/`, then run `bun run test:team-config`. It covers the merge-gate
extension, the gate validator, and the installer. Rules carry no repo-private paths or
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
