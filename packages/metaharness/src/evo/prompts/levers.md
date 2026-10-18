# omp harness levers

RFC 2119 applies to MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. `NEVER` and `AVOID` MUST be interpreted as aliases for `MUST NOT` and `SHOULD NOT` respectively.

A variant genome is an omp agent dir. Registration snapshots only the paths below and rejects files omp would ignore.

## Levers

|Lever|Genome path|In context|Fired signal|
|---|---|---|---|
|Instruction block|`SYSTEM.md` (replaces default block) or `SYSTEM_TEMPLATE.md` (Handlebars; ignored when `SYSTEM.md` exists)|always|none|
|Appended instructions|`APPEND_SYSTEM.md`|always, main agent only|none|
|Personality|`PERSONALITY.md`|always, main agent only|none|
|Sticky rules|`RULES.md`|always, every request|none|
|Project context|`AGENTS.md`|always, main agent only|none|
|Triggered rule|`rules/<name>.md` with `condition` (regex), `astCondition` or `question`|when the trigger matches|`rule:<name>`|
|Rulebook rule|`rules/<name>.md` with `description` only|name+description listed; body on demand|`rule:<name>`|
|Always-apply rule|`rules/<name>.md` with `alwaysApply: true`|always|none|
|Skill|`skills/<name>/SKILL.md` (+ helpers in `skills/<name>/`); `description` REQUIRED|description listed; body on demand|`skill:<name>`|
|Subagent|`agents/<name>.md`; `name`, `description` REQUIRED; `tools`, `spawns`, `thinking-level`, `output`, `autoloadSkills`|own context, returns text|`agent:<name>`|
|Extension|`extensions/<name>.ts` or `extensions/<name>/index.ts`; hooks `tool_call` (block/rewrite), `tool_result` (patch), `before_agent_start`, `before_provider_request`|inside the tool loop; zero prompt cost|`mark:<id>` when it prints `EVO-MARK:<id>` on its own stderr line|
|Runtime knobs|`config.yml`: `compaction.*`, `read.defaultLimit`, `read.summarize.*`, `bash.autoBackground`, `tools.maxTimeout`, `task.eager`, `task.structured`, `task.maxEffort`, `todo.eager`, `todo.reminders.max`, `editPromptVariant`, `tools.format`, `async.enabled`, `async.maxJobs`|n/a|via behaviour metrics|

## Choosing the form

Always-on text is the most expensive lever: every token competes with the agent's output budget on every request. Prefer, in order:
1. Skill: recognisable trigger, multi-step procedure.
2. Triggered rule: a recurring mistake with a matchable signature.
3. Extension: mechanical enforcement the model cannot skip — trim oversized tool output, hint after a recurring error, cap a runaway tool, verify a write, block finishing before the deliverable exists.
4. Subagent: bounded sub-task with large input and small answer.
5. Always-on text last; adding text SHOULD remove an equal amount elsewhere.

You MUST declare `expectedSignals` for every lever with a fired signal; credited gain is clamped to 0 unless every expected signal fires. Always-on prose has no signal, so its gain is never mechanism-evidenced.

## Dimensions

Each proposal SHOULD change one dimension:
- INV, how the agent works: tool errors, mechanical repetition, triggered workflows, ignored invariants, sequencing.
- DOM, what a practitioner knows: analytic moves, artifact contracts, decision rules.

## Constraints

- NEVER set `modelRoles`, `enabledModels`, `modelProviderOrder`, `retry` or `defaultThinkingLevel`; the executor owns them and registration rejects them.
- NEVER enable `memory.backend`; trials would write state that changes later trials and breaks variant identity.
- Task subagents do not inherit `AGENTS.md`, `APPEND_SYSTEM.md` or `PERSONALITY.md`; to change subagent behaviour, edit `agents/*.md` or a rule scoped with `agents:`.
- Project `.omp/` files inside a task repository take precedence over genome `SYSTEM.md`/`SYSTEM_TEMPLATE.md`/`RULES.md`.
- Every edit MUST trace to a specific trajectory moment; an edit you cannot tie to evidence is speculation.
