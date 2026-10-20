---
description: Answer model/effort config questions before tracing internals
globs:
  - "**/.omp/agent/config.yml"
  - "**/.omp/agent/models.yml"
---

# Lesson: Answer model/effort config questions before tracing internals

Recorded: 2026-09-26
Lesson id: answer-omo-effort-model-config-questions-55c5e2803a17df7f
Lesson hash: 55c5e2803a17df7f

## What went wrong
User asked a simple question: which "max" reasoning entries in the agent config could be lowered, and whether xhigh is the second-highest level for OpenAI and Claude. About 40 tool calls went into tracing harness model-core, provider transforms and the LLM router's translators before the first answer, and the user complained about the delay. Only two router files carried the load-bearing fact: the router clamps Claude xhigh to high.

## Rule for next time
For model or effort questions: read `~/.omp/agent/config.yml` / `models.yml`, check the provider effort docs, and check what the LLM router in front of the provider actually sends (its thinking-level mapping and per-format translation). Answer within about 5-8 tool calls. Do not trace omp/pi-ai internals unless the answer depends on them. If a deeper trace is needed, give the direct answer first and say what is still being checked.
