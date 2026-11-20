# F1 install row: team-config-install "Team config names only built-in providers"

Head: 3e78520b8eb7ccd370cdb18390cde7463dca0027. RED output of task 1.1 on the unchanged seed: [red-provider-check.txt](../red-provider-check.txt).

## Fresh install into an empty agent directory

```
$ env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=<empty tmp A> bun scripts/install-team-config.ts
Team config → <A>
  seeded (1): config.yml
exit: 0
$ ls <A>/config.yml <A>/models.yml
ls: cannot access '<A>/models.yml': No such file or directory
<A>/config.yml
$ grep -H '^model:' <A>/agents/*.md   # `@oracle` is the seeded role oracle: openai-codex/gpt-6.1-sol:xhigh (line 12 below)
<A>/agents/architecture-oracle.md:model: anthropic/claude-fable-5-2:high
<A>/agents/auditor.md:model: openai-codex/gpt-6.1-sol:high
<A>/agents/blocker-verifier.md:model: openai-codex/gpt-6.1-sol:medium
<A>/agents/oracle.md:model: "@oracle"
$ grep -nE '(anthropic|openai-codex|onara|router)[/*]|^  - (anthropic|openai-codex)$|"@' <A>/config.yml
3:  default: anthropic/claude-opus-5-5:high
4:  slow: anthropic/claude-opus-5-5:xhigh
5:  plan: anthropic/claude-opus-5-5:xhigh
6:  task: anthropic/claude-sonnet-5-5:medium
7:  smol: openai-codex/gpt-6-luna:low
8:  tiny: anthropic/claude-haiku-5-5
9:  commit: anthropic/claude-haiku-5-5
10:  judge: anthropic/claude-haiku-5-5
11:  advisor: openai-codex/gpt-6.1-terra:medium
12:  oracle: openai-codex/gpt-6.1-sol:xhigh
13:  review: openai-codex/gpt-6.1-terra:high
14:  deep: anthropic/claude-opus-5-5:high
27:    anthropic/claude-opus-5-5:
28:      - openai-codex/gpt-6.1-sol
29:    anthropic/claude-sonnet-5-5:
30:      - openai-codex/gpt-6.1-terra
31:    anthropic/claude-fable-5-2:
32:      - anthropic/claude-opus-5-5
33:    anthropic/claude-haiku-5-5:
34:      - openai-codex/gpt-6-luna
35:    openai-codex/gpt-6.1-sol:
36:      - anthropic/claude-opus-5
37:    openai-codex/gpt-6.1-terra:
38:      - anthropic/claude-sonnet-5-5
39:    openai-codex/gpt-6-luna:
40:      - anthropic/claude-haiku-5-5
42:  - anthropic
43:  - openai-codex
45:  - anthropic/**
46:  - openai-codex/**
68:    reviewer: "@review"
69:    plan-reviewer: openai-codex/gpt-6.1-sol:high
152:    "anthropic/*": 256000
153:    "openai-codex/*": 256000
$ grep -l -i onara <A>/config.yml <A>/agents/*.md | wc -l
files naming onara: 0
```

## Existing installation keeps its own routes

Directory B holds a config.yml and a models.yml that name a custom provider `myrouter`.

```
$ env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=<B> bun scripts/install-team-config.ts
Team config → <B>
exit: 0
$ cmp <B>/config.before <B>/config.yml && cmp <B>/models.before <B>/models.yml
both byte-identical (exit 0)
```
