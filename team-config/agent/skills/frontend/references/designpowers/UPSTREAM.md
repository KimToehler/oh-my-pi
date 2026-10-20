# Designpowers Reference Manifest

Upstream project: `Owl-Listener/designpowers`

Upstream repository: `https://github.com/Owl-Listener/designpowers`

Pinned upstream commit: `cb00757da9d554591fa78d27aa1854d60a05c4f7`

## Materialized Files

Third-party designpowers files are vendored into `references/designpowers/vendor/`.

- `LICENSE` -> `vendor/LICENSE`
- `agents/*.md` allowlist -> `vendor/agents/`
- selected `skills/*/SKILL.md` allowlist -> `vendor/skills/*/reference.md`

## Included Upstream Skills

- `accessible-content`
- `adaptive-interfaces`
- `cognitive-accessibility`
- `design-debate`
- `design-debt-tracker`
- `design-handoff`
- `design-md`
- `design-retrospective`
- `design-review`
- `design-system-alignment`
- `designpowers-critique`
- `heuristic-evaluation`
- `inclusive-personas`
- `inspiration-scouting`
- `interaction-design`
- `motion-choreography`
- `research-planning`
- `responsive-patterns`
- `synthetic-user-testing`
- `taste-feedback`
- `taste-report`
- `token-architecture`
- `ui-composition`
- `usability-testing`
- `verification-before-shipping`
- `voice-and-tone`
- `writing-design-plans`

## Included Upstream Agents

- `accessibility-reviewer.md`
- `content-writer.md`
- `design-builder.md`
- `design-critic.md`
- `design-lead.md`
- `design-scout.md`
- `design-strategist.md`
- `heuristic-evaluator.md`
- `inspiration-scout.md`
- `motion-designer.md`

## Excluded Upstream Skills

These upstream skills are intentionally excluded because they are bridge/state/router integration surfaces that would compete with the existing frontend/omp workflow:

- `figma-bridge`
- `design-express`
- `design-library`
- `using-designpowers`
- `design-discovery`
- `design-memory`
- `design-state`
- `design-strategy`
- `design-taste`
