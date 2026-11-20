# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes; one README paragraph about members' own config files)
- **Risk tier**: internal-tooling
- **Author's risk assessment**: Only the README's guidance changes; no code, seed, installer or agent definition. What could break: the paragraph still misses a router-bound setting, or names a wrong key or value, so a member who follows it keeps router models in `enabledModels` or loses a setting of their own. The damage stays in that member's own `~/.omp/agent/config.yml`, is visible in `omp config get` and is reversible by hand or by re-seeding; no protected asset is reached, so `internal-tooling` with class `none` fits.
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: a member who already rewrote only the prefixes under the earlier paragraph is not told again; the corrected paragraph reaches them only when they reread the README.
- **Out of scope for blocking**: the re-seed route of the same paragraph (unchanged); an installer notice or automatic rewrite of existing configs (the installer never rewrites an existing `config.yml`, and adding one is its own change).
- Feature-specific criteria:
  - Invariant: a member who does not use the router and follows the README's manual route on a `config.yml` and `models.yml` seeded before the switch is left with no setting that names the router, and keeps their own settings.
    Positive witness: a fresh session given the README and copies of the pre-switch seed files (`git show 97228532bd:team-config/seed/config.yml` and `…/models.yml`, plus one personal setting) edits them as the paragraph says; afterwards `grep -c onara` on the resulting `config.yml` prints 0, `models.yml` defines no `onara` provider, the personal setting is unchanged, `omp config get enabledModels` and `modelProviderOrder` under that config print only `anthropic` and `openai-codex` entries, and an `omp -p` session under it runs on `anthropic/claude-opus-5-5` as its session file records.
    Negative control: the same session given the paragraph as it stood at 18de738708 (prefix rewrite only) leaves `enabledModels`, `modelProviderOrder` or a `compaction.modelThresholds` key naming `onara`, so `grep -c onara` prints more than 0.
    Observable: `grep -c onara` on the edited `config.yml`, `omp config get` output under it, and the `provider/model` of the session file's assistant turns.
    Boundary: the member's edited config files as omp's config resolution reads them, not the README text.
