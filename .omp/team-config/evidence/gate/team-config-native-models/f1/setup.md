# F1 setup

- Deployed head: `3e78520b8eb7ccd370cdb18390cde7463dca0027 3e78520b8e 2026-11-20T13:45:49+0100` (`scripts/deploy-local.sh 3e78520b8e`, full sha 3e78520b8eb7ccd370cdb18390cde7463dca0027; `git merge-base --is-ancestor main HEAD` exit 0).
- Removed from `~/.omp/agent/config.yml` `task.agentModelOverrides` for the F1 window:
  - `architecture-oracle: anthropic/claude-fable-5-2:high`
  - `auditor: openai-codex/gpt-6.1-sol:high`
  - `blocker-verifier: openai-codex/gpt-6.1-sol:medium`
- Every live session runs with `PI_CONFIG_FILES=/Users/tim/git/oh-my-pi/.worktrees/team-config-native-models/team-config/seed/config.yml`.

```
$ PI_CONFIG_FILES=/Users/tim/git/oh-my-pi/.worktrees/team-config-native-models/team-config/seed/config.yml omp config get task.agentModelOverrides
{"reviewer":"@review","plan-reviewer":"openai-codex/gpt-6.1-sol:high","measurement-sol":"openai-codex/gpt-6.1-sol:high","measurement-verifier":"openai-codex/gpt-6.1-sol:medium","measurement-terra":"openai-codex/gpt-6.1-terra:medium","measurement-adjudicator":"anthropic/claude-opus-5-5:high"}
$ PI_CONFIG_FILES=/Users/tim/git/oh-my-pi/.worktrees/team-config-native-models/team-config/seed/config.yml omp config get modelRoles
{"default":"anthropic/claude-opus-5-5:high","slow":"anthropic/claude-opus-5-5:xhigh","plan":"anthropic/claude-opus-5-5:xhigh","task":"anthropic/claude-sonnet-5-5:medium","smol":"openai-codex/gpt-6-luna:low","tiny":"anthropic/claude-haiku-5-5","commit":"anthropic/claude-haiku-5-5","judge":"anthropic/claude-haiku-5-5","advisor":"openai-codex/gpt-6.1-terra:medium","oracle":"openai-codex/gpt-6.1-sol:xhigh","review":"openai-codex/gpt-6.1-terra:high","deep":"anthropic/claude-opus-5-5:high"}
$ grep '^model:' ~/.omp/agent/agents/{architecture-oracle,auditor,blocker-verifier}.md
~/.omp/agent/agents/architecture-oracle.md:model: anthropic/claude-fable-5-2:high
~/.omp/agent/agents/auditor.md:model: openai-codex/gpt-6.1-sol:high
~/.omp/agent/agents/blocker-verifier.md:model: openai-codex/gpt-6.1-sol:medium
```
