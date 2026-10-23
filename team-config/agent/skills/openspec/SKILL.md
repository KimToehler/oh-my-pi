---
name: openspec
description: "Use to plan, specify or implement a behaviour change in a repository that has openspec/. Picks /opsx-propose, /opsx-apply or plan mode; small changes and repositories without openspec/ stay in plan mode."
---

# OpenSpec routing

Two planning paths exist. Pick one before writing any plan; the user should not have to remember which.

## Decide

1. **Is there an OpenSpec root?** Run `openspec context --json` in the working directory (prefix `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`). `"root": null` or a missing `openspec` CLI means no. Never create `openspec/` or run `openspec init` to get one.
2. **Does the request change observable behaviour?** A new feature, a changed contract, output, API, UI flow or error is a behaviour change. A rename, typo, comment, config value, dependency bump, or a one-file fix that restores specified behaviour is a small change.

| Situation | Path |
|---|---|
| OpenSpec root and a behaviour change to plan | `/opsx-propose` |
| OpenSpec root and the user wants an existing change implemented | `/opsx-apply` |
| Small change, any repository | plan directly, or ask the user to switch to plan mode (`/plan`) for non-trivial work |
| No OpenSpec root | plan mode; mention the team's `install-openspec-workflow.mjs` only if the user asks for OpenSpec |

## Follow a command

You cannot run slash commands. To take an OpenSpec path, read `~/.omp/agent/commands/opsx-propose.md` (or `opsx-apply.md`) and follow its steps yourself, with the user's request as the command input. Do not shorten the steps: `/opsx-propose` ends with the `review` artifact, which dispatches `plan-reviewer` and writes `review.md`; `/opsx-apply` refuses to edit source until `validate-openspec-change.mjs --reviewed` passes.

## In plan mode

Plan mode can write only `local://` files, so it cannot create `openspec/changes/`. If plan mode is active and the request is a behaviour change in a repository with an OpenSpec root, write no plan: tell the user to leave plan mode and run `/opsx-propose <request>`. Small changes stay in plan mode.

## When unsure

If the size or the root is unclear, ask one question naming both paths and their difference: OpenSpec keeps versioned specs, a gate and an independent review in the repository; plan mode keeps a session plan reviewed before approval.
