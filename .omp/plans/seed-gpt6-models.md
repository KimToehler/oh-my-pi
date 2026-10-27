# Seed OpenAI models: GPT-5.6 → GPT-6.1 Sol / GPT-6.1 Terra / GPT-6 Luna

## Goal

`team-config/seed/config.yml` and `team-config/seed/models.yml` still name the GPT-5.6 models.
New team installs should start on the current onara Codex models, matching the switch already
made in Tim's local `~/.omp/agent/config.yml` and `models.yml` on 2026-10-27.

## Change

- `seed/models.yml`: replace `cx/gpt-5.6-sol`, `cx/gpt-5.6-terra`, `cx/gpt-5.6-luna` with
  `cx/gpt-6.1-sol` (contextWindow 500000, the Codex-backend limit in the catalog),
  `cx/gpt-6.1-terra` and `cx/gpt-6-luna` (272000 each). Costs are the OpenAI list prices from
  `packages/catalog/src/models.json`. Effort ladders and maxTokens stay the same.
- `seed/config.yml`: roles `smol`, `advisor`, `oracle`, `review` and the `retry.fallbackChains`
  point at the new ids. The effort suffixes stay the same.
- Unchanged on purpose: `gpt-5.6-*` strings in gate/aside test fixtures and the review-work
  SKILL.md example. They are arbitrary vendor-parsing inputs, not model selection.

## Verification

- Router `/v1/models` lists `cx/gpt-6.1-sol` and `cx/gpt-6-luna`. `cx/gpt-6.1-terra` is not
  listed yet, but Codex accepts it, while an unknown id gets 400 `model_not_found`.
- `omp -p --model` answered with `onara/cx/gpt-6.1-sol:xhigh`, `onara/cx/gpt-6.1-terra:high`
  and `onara/cx/gpt-6-luna:low`.
- Every model reference in the seed config (roles and fallback chains, 24 total) resolves to a
  seed `models.yml` entry.

- Merge gate: not applicable (two seed data files, copied only when the target is missing, so existing installs are unaffected; no code, no tests read their content)
