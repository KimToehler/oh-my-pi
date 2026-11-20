# F1 row: manual route (feature-specific criterion)

Head: cb6aa6219eb150a4a020f288070211cf1cdb286c (last code commit; later commits touch only openspec/changes/team-config-reseed-guidance).
Fixture: git show 97228532bd:team-config/seed/config.yml and models.yml, plus steeringMode: all, enabledModels github-copilot/**, retry.fallbackChains github-copilot/gpt-6.1-sol.
Fixture vs pre-switch seed:
```
40a41,42
>     github-copilot/gpt-6.1-sol:
>       - github-copilot/claude-opus-5-5
45a48
>   - github-copilot/**
159c162
< steeringMode: one-at-a-time
---
> steeringMode: all
```

## Positive: fresh session with the README at cb6aa6219eb150a4a020f288070211cf1cdb286c
cwd /tmp/rs/pos (git archive cb6aa6219eb150a4a020f288070211cf1cdb286c team-config/README.md team-config/seed); command: omp -p --session-dir /tmp/rs/pos/sessions "<prompt>"
Prompt:
```
I am a member of the team whose shared omp setup is described in team-config/README.md (in the current directory). My ~/.omp/agent/config.yml was seeded before the team config switched to the built-in providers, and I do not use the router it still names. For this task the directory /tmp/rs/pos/agent stands in for my ~/.omp/agent: read every ~/.omp/agent path in the README as that directory, and do not read or change the real ~/.omp/agent. I do not want to re-seed; follow the README's guidance for doing it by hand, editing config.yml and models.yml in AGENTDIR. When you are done, tell me briefly what you changed.
```
Session file: /tmp/rs/pos/sessions/2026-11-20T13-52-23-565Z_01a1f93a-d00d-772e-8180-43b541ff1260.jsonl
Assistant models: anthropic/claude-opus-5-5 
Reply:
```
I edited the two files in `/tmp/rs/pos/agent` by hand, as the README describes. Nothing was re-seeded and I didn't touch the real `~/.omp/agent`. A `diff` against `team-config/seed/config.yml` shows no router names left, and both files parse as valid YAML.

**`config.yml`**
- **Prefix rewrite:** every `onara/cc/` became `anthropic/` and every `onara/cx/` became `openai-codex/`. That covers all 12 `modelRoles`, the keys and entries of `retry.fallbackChains`, and `task.agentModelOverrides.plan-reviewer`, which is now `openai-codex/gpt-6.1-sol:high` and matches the seed's pin.
- **`modelProviderOrder`:** `onara` is replaced by `anthropic` and `openai-codex`.
- **`enabledModels`:** `onara/**` and `onara-bifrost/**` are replaced by `anthropic/**` and `openai-codex/**`. Your `github-copilot/**` entry stays.
- **`compaction.modelThresholds`:** the keys `"onara/*"` and `"onara-bifrost/*"` are now `"anthropic/*"` and `"openai-codex/*"`, still at 256000.
- **Your own settings were kept:** the `github-copilot/gpt-6.1-sol` fallback chain and `steeringMode: all`. These are now the only differences from the seed.

**`models.yml`**
- I deleted both router providers, `onara` and `onara-bifrost`, along with the router comment header. They were the only contents, so the file is now just `providers: {}`.
- That also removed the GLM-5.3 model, because it was only reachable through `onara-bifrost`.

To use the new setup, sign in with `/login` to Anthropic and to OpenAI Codex. The model roles and gate pins depend on both.
exit 0
```
grep -c onara config.yml: 0
grep -c onara models.yml: 0
models.yml:
```
providers: {}
```
PI_CONFIG_FILES=/tmp/rs/pos/agent/config.yml omp config get enabledModels: ["anthropic/**","openai-codex/**","github-copilot/**"]
PI_CONFIG_FILES=/tmp/rs/pos/agent/config.yml omp config get modelProviderOrder: ["anthropic","openai-codex"]
PI_CONFIG_FILES=/tmp/rs/pos/agent/config.yml omp config get compaction.modelThresholds: {"anthropic/*":256000,"openai-codex/*":256000,"onara/*":256000,"onara-bifrost/*":256000}
Note: the overlay deep-merges object keys, so the onara/* keys above come from the member's real ~/.omp/agent/config.yml ({"anthropic/*":256000,"openai-codex/*":256000,"onara/*":256000,"onara-bifrost/*":256000}). The edited file's own section:
```
  modelThresholds:
    "anthropic/*": 256000
    "openai-codex/*": 256000
```

## Negative control: paragraph as of 18de738708 applied literally
command: sed -e 's#onara/cc/#anthropic/#g' -e 's#onara/cx/#openai-codex/#g' /tmp/rs/base/config.yml > /tmp/rs/lit/config.yml
grep -c onara config.yml: 5
```
44:  - onara
46:  - onara/**
47:  - onara-bifrost/**
154:    "onara/*": 256000
155:    "onara-bifrost/*": 256000
```
PI_CONFIG_FILES=/tmp/rs/lit/config.yml omp config get enabledModels: ["onara/**","onara-bifrost/**","github-copilot/**"]
PI_CONFIG_FILES=/tmp/rs/lit/config.yml omp config get modelProviderOrder: ["onara"]
Unmodified real config for comparison (the overlay replaces arrays): omp config get enabledModels: ["anthropic/**","openai-codex/**","onara/**","onara-bifrost/**"]

## Why a session is no control: two sessions given the old paragraph
### Run 1: README at 18de738708 (its Follow-ups list carries the follow-up this change takes)
Session file: /tmp/rs/neg-contaminated/sessions/2026-11-20T13-52-23-565Z_01a1f93a-d00d-7547-9cd7-d1499474c922.jsonl; models: anthropic/claude-opus-5-5 
grep -c onara config.yml: 0
Reply:
```
I made the change by hand in `/tmp/rs/neg/agent`, without re-seeding. Both files parse as YAML. Apart from your own settings, which I kept, `config.yml` now matches `team-config/seed/config.yml`. Nothing in the real `~/.omp/agent` was read or changed.

**`config.yml`**
- **Model names:** every `onara/cc/` became `anthropic/` and every `onara/cx/` became `openai-codex/`. That covers the model roles, the fallback chains and the `plan-reviewer` override, which is now `openai-codex/gpt-6.1-sol:high`.
- **Three more router settings:** the README's by-hand steps only mention the model names, but its own Follow-ups list notes that three other settings also still point at the router. I changed those too:
  - `modelProviderOrder`: `onara` became `anthropic, openai-codex`.
  - `enabledModels`: `onara/**` and `onara-bifrost/**` became `anthropic/**` and `openai-codex/**`.
  - `compaction.modelThresholds`: the `onara/*` and `onara-bifrost/*` entries became `anthropic/*` and `openai-codex/*`, still at 256000.
- **Kept as they were:** your `github-copilot` fallback chain, `github-copilot/**` in `enabledModels`, and `steeringMode: all`.

**`models.yml`**
- It only defined the two router providers (`onara`, `onara-bifrost`), so I removed both and left `providers: {}` with a short comment.
- The old file is saved as `models.yml.onara-router.bak` in the same folder. Delete it if you don't want it.

Next, sign in with `/login` to both Anthropic and OpenAI Codex. Without both, the roles and the pinned gate reviewers can't run.
exit 0
```
### Run 2: README at 94640b8d50 (same paragraph, no follow-up; git diff --stat 94640b8d50 18de738708 -- team-config/README.md:  1 file changed, 2 insertions(+))
Session file: /tmp/rs/neg/sessions/2026-11-20T13-53-32-058Z_01a1f93b-db9a-77e7-9cd4-62cc390a55b2.jsonl; models: anthropic/claude-opus-5-5 
grep -c onara config.yml: 0
Reply:
```
I hand-edited both files in `/tmp/rs/neg/agent` and did not re-seed. The real `~/.omp/agent` was not touched.

**`config.yml`**: I applied the README's renaming: `onara/cc/` became `anthropic/` and `onara/cx/` became `openai-codex/`.
- **Renamed models:** all 12 `modelRoles`, the 7 router fallback chains, and `task.agentModelOverrides.plan-reviewer`, which is now `openai-codex/gpt-6.1-sol:high` as in the seed.
- **`modelProviderOrder`:** changed from `onara` to `anthropic`, `openai-codex`.
- **`enabledModels`:** `onara/**` became `anthropic/**`, `openai-codex/**`. I removed `onara-bifrost/**` because it goes through the same router.
- **`compaction.modelThresholds`:** `onara/*` and `onara-bifrost/*` became `anthropic/*` and `openai-codex/*` (256000 each).
- **Kept as they were:** your `github-copilot` fallback chain, `github-copilot/**` in `enabledModels`, and `steeringMode: all`. These three are now the only differences from `team-config/seed/config.yml`. `retry.fallbackOn: usage-limit` and `contextFiles.extra: [AGENTS.local.md]` were already there.

**`models.yml`**: The whole file only defined the router providers (`onara` and `onara-bifrost`, both at `router.onara.eu`, using `ONARA_ROUTER_KEY`). I removed both, so the file now has just `providers: {}` and a short comment. The bifrost GLM model is gone with them; nothing in `config.yml` used it.

**Check:** I ran `omp models` on a throwaway copy of the two files, so neither directory was changed. They loaded without the validation warning, and a deliberately broken `models.yml` did show that warning. The built-in `anthropic` and `openai-codex` models didn't appear in that run because the copy has no sign-in, so it only proves the files load. On your setup you still need `/login` to Anthropic and to OpenAI Codex.

If `ONARA_ROUTER_KEY` is set in your shell profile, you can remove it too.
exit 0
```
