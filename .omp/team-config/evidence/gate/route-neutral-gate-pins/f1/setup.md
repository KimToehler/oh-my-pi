# F1 setup

- Head after the last code commit: `4f92bdb783f6b6f3506eadd69cab102ccc21259a`
- `git merge-base --is-ancestor main HEAD`: exit 0 (no merge needed)
- Deploy: `scripts/deploy-local.sh 4f92bdb783f6b6f3506eadd69cab102ccc21259a` → `==> Deployed 4f92bdb783f6b6f3506eadd69cab102ccc21259a 4f92bdb783f6b6f3506eadd69cab102ccc21259a 2026-11-18T01:02:41+0100`; binary `omp/18.22.0`
- `diff -r team-config/agent/skills/review-work ~/.omp/agent/skills/review-work` and the same against `$TMPDIR/rngp-home`: identical at that head

## Deploy history and the head each row ran on

F1 found defects, each fixed in its own commit and redeployed:

| Deployed head | Fix it carries | Rows run on it (final run) |
|---|---|---|
| `acaf0ea77f` | triage-failure rewrite and Models keep every dispatch of a round | direct-plan-review, direct-consultation, direct-audit, router-plan-review, router-consultation, no-pin, credential-fallback, no-fable (run 1; run 2 resumed on the same home), oracle-override, auditor-conflict |
| `e40e449cfc` (not deployed alone) | SKILL.md model-ID paragraph defers to the Phase 3 route binding (NcReview2 item 1) | none |
| `2fcb711078` | one evidence file per non-counting reply; a substituted repair answer is never stored as a `*trailer*` file (seeded-repair and seeded-retry-substituted run 1) | seeded-fallback, seeded-effort, seeded-trailer-route, seeded-mixed-route, seeded-retry-substituted, seeded-repair |
| `4f92bdb783` | model-check scope names plan-reviewer and blocker-verifier, delta reviewer follows the model check, exception rewrite keeps Models (NcReview2 items 2-4) | seeded-switch, seeded-other-provider, seeded-verifier, nc-review |

`git diff --stat acaf0ea77f 4f92bdb783`: `SKILL.md` 8 lines and `schema.yaml` 10 lines, all prose. The live rows on `acaf0ea77f` were not rerun: the later sentences govern a model-ID paragraph before Phase 3, non-counting reply file names, trailer repair, delta checks and exception rewrites, none of which those rows reach (each live row either counted its first dispatch, stopped before a dispatch, or ended at the consultation ask). [INFERENCE] that their outcome is unchanged on `4f92bdb783`; the seeded rows that do reach those sentences ran on the final head.

## Every installation's `omp config get task.agentModelOverrides`

- direct (with overlay): `{"plan-reviewer":"gpt-6.1-sol:high","architecture-oracle":"anthropic/claude-fable-5-2:high","auditor":"openai-codex/gpt-6.1-sol:high","reviewer":"@review"}`
- router `$TMPDIR/rngp-home`: `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`
- `/tmp/rngp/homes/no-pin`: `{"reviewer":"@review"}`
- `/tmp/rngp/homes/credential-fallback`: `{"reviewer":"@review","plan-reviewer":"openai-codex/gpt-6.1-sol:high"}`
- `/tmp/rngp/homes/no-fable`: `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`; its `models.yml` has 0 lines naming `claude-fable-5-2`
- `/tmp/rngp/homes/oracle-override`: `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high","architecture-oracle":"onara/cx/gpt-6.1-sol"}`
- `/tmp/rngp/homes/auditor-conflict`: `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high","auditor":"onara/cx/gpt-6.1-sol:medium"}`

Each configuration row ran in its own copy of the router home with that one change (`diff -rq` against the router home shows only that file and the install manifest), so the router home itself was never modified and needs no restore.

## Residual outside this change

- Fix waves step 3a covers an INCONCLUSIVE invocation only in "a closing wave"; seeded-retry-substituted applied it to wave 1 by analogy. Unchanged from `main` and shared with timeouts, so not changed here.

## Direct installation

Agent dir `~/.omp/agent` (signed in to openai-codex and anthropic, router key from the login shell). Every session runs with `PI_CONFIG_FILES=/tmp/rngp/direct-overlay.yml`:

```yaml
task:
  agentModelOverrides:
    plan-reviewer: gpt-6.1-sol:high
    architecture-oracle: anthropic/claude-fable-5-2:high
    auditor: openai-codex/gpt-6.1-sol:high
```

`PI_CONFIG_FILES=/tmp/rngp/direct-overlay.yml omp config get task.agentModelOverrides`:

```json
{"plan-reviewer":"gpt-6.1-sol:high","architecture-oracle":"anthropic/claude-fable-5-2:high","auditor":"openai-codex/gpt-6.1-sol:high","reviewer":"@review"}
```

Direct provider probes (`omp -p --mode json --model <m>`, served provider/model from `message_end`): openai-codex/gpt-6.1-sol → openai-codex gpt-6.1-sol stop; anthropic/claude-fable-5-2 → anthropic claude-fable-5-2 stop.

## Router installation

Disposable home `$TMPDIR/rngp-home`, installed with `env -u PI_PROFILE -u OMP_PROFILE -u PI_CODING_AGENT_DIR HOME=$TMPDIR/rngp-home bun scripts/install-team-config.ts` (exit 0, config.yml and models.yml seeded). Sessions start as `zsh -lic 'export HOME=$TMPDIR/rngp-home; unset PI_PROFILE OMP_PROFILE PI_CODING_AGENT_DIR PI_CONFIG_FILES; exec omp ...'`, so `ONARA_ROUTER_KEY` comes from the operator's login-shell environment; no `.env` exists in the home (`ls -a` count of `.env`: 0).
- `diff -r team-config/agent/skills/review-work $RH/.omp/agent/skills/review-work`: identical

`HOME=$TMPDIR/rngp-home omp config get task.agentModelOverrides`:

```json
{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}
```

Router probe: onara/cx/gpt-6.1-sol → onara cx/gpt-6.1-sol stop.

## Fixtures

- `/tmp/rngp/base` (git, main `f419f20`): counter module, omp-gated schema installed from the deployed skill (identical to the head's), changes `add-reset` (standard) and `persist-counts` (risky, concurrency-state); both pass `validate-openspec-change.mjs`. Each row runs on its own `git clone` of it.
- `/tmp/rngp/f2base` + worktree `/tmp/rngp/f2work` (branch `feat/add-reset`, head `7b00ff6`): plan-mode plan `.omp/plans/add-reset.md` (standard, `--plan-only` passed) and its implementation, main merged.
