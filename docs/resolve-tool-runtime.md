# Staged-action command runtime

Pending previews and plan approval finalize through the special commands implemented in `packages/coding-agent/src/tools/resolve.ts`. `specialToolCommands(session)` returns the tools behind them: `resolve`, `reject`, `propose`, and `report_issue` when Auto-QA is enabled. Each has one required string field, so the command form is:

- `resolve "<reason>"` — apply the pending staged preview
- `reject "<reason>"` — discard the pending staged preview
- `propose "<slug>"` — submit a plan for approval while plan mode is active; the slug matches `local://<slug>-plan.md`
- `report_issue "<tool>: <concise description>"` — the Auto-QA report command, at the `write` tier

A call runs one of these either directly (a top-level tool call, matched by its own name) or as a `bash` line whose leading word is the command: `toolCommandCallName(toolCall)` returns that word for a `bash` call, and `isPreviewResolutionToolCall`, `isProposeToolCall`, and `isReportIssueToolCall` apply the rule to a specific command. When the `bash` tool is active in a session they run as commands; otherwise the same Tool objects are registered as ordinary top-level tools, so the names work either way.

`resolveDispatchDetails(toolName, result)` reads a completed `resolve`/`reject` from whichever surface ran it: a direct result carries `ResolveDetails` on `details`, and a `bash` result is searched backwards through its `details.toolCommands` records for the last `execute` dispatch of `resolve`/`reject`, parsed from that record's `inner`. `ResolveDetails` holds `action` (`apply` or `discard`), `reason`, the pending action's `label`, its `sourceToolName`, and any `sourceResultDetails` from the wrapped tool result.

## Preview flows

Preview producers call `queueResolveHandler(...)` with `apply(reason)` and optional `reject(reason)` callbacks. Each preview receives a unique pending-invoker ID in `ToolChoiceQueue`, so stacked previews do not overwrite one another.

When no hard tool-choice directive takes precedence, a pending preview makes `AgentSession.nextToolChoiceDirective()` return a soft requirement:

- `toolName: "bash"` while tool commands are active, else `resolve`
- `satisfies: isPreviewResolutionToolCall`
- reminder from `resolve-reminder.md`

The model complies by running only `resolve` or `reject` in that turn, as the command while tool commands are mounted or as the tool otherwise. A different call, or one of those batched with a detour, is noncompliant: the calls are skipped and the next turn forces the tool that would run the resolution (`bash`, else `resolve`). Repeated noncompliance eventually aborts rather than looping indefinitely.

Dispatch selects the in-flight queue invoker first, then the pending-preview head, and invokes its callback through `runResolveInvocation(...)`. `queueResolveHandler(...)` needs a session tool-choice queue; without one, it does not register a preview.

- A successful apply or discard consumes that pending invoker exactly once.
- If apply throws, the same preview is re-registered so the model can reject it or retry after fixing the cause.
- Rejecting with no pending action succeeds with `Nothing to reject; no pending action remains.`
- Resolving with no pending action throws `No pending action to apply — …`.
- An apply callback's ordinary error becomes `ToolError("Apply failed: ...")`; an existing `ToolError` is preserved.

## Plan approval

Plan mode installs a separate proposal handler through `setPlanProposalHandler(...)`.

- Interactive mode hands `PlanApprovalDetails` to the plan-review UI.
- ACP mode runs elicitation/approval and emits mode updates.
- PlanYolo auto-approves and switches to the execution target.

`propose` is valid only while plan mode is active; with no handler it fails with `No plan is awaiting approval — …`. The session resolves the proposed slug once, falling back from the supplied slug to the recorded plan path and then the newest plan file, and rejects the proposal before any handler runs if no real plan artifact exists. The installed plan proposal handler then receives the resolved `{ planFilePath, planContent, title }`. Slug-based `local://<slug>-plan.md` lookup follows the same fallbacks; proposal does not rename the file.

With `plan.review.enabled`, the session reviews the resolved plan before the handler runs. A REJECT verdict returns a refine result to the planner instead of reaching the handler; after two rejected rounds the third proposal goes to approval with a warning. The round counter lives in memory and resets when a session is resumed. `propose` must run as a top-level call (a direct `propose` call or a `bash` call whose command starts with `propose`) and be the last tool call of its message, so the reviewer sees a plan that is final. Reviewer failures (no eligible cross-family reviewer, missing agent, timeout, unusable output) never block approval; only structural proposal refusals still do. Reviewer output is untrusted. Each review appends a `plan-review` audit entry to the session recording reviewer identities, outcome, and plan hash, but not blockers or notes.

Ordinary print mode has no interactive review surface and ignores `plan.defaultOnStartup`; use `--plan-yolo` for the supported headless approval-and-execution flow.

## Command availability

`bash` is the command transport, so the mount decision follows it. With `restrictToolNames` unset and `tools.commands` enabled, `createTools(...)` registers the special tools and presents them as commands while `bash` is enabled; when `bash` is off, `specialToolApplies(name, { tools, planModeEnabled })` keeps only those with something to act on top-level — `resolve`/`reject` need a deferrable tool, `propose` needs active plan mode, and `report_issue` always applies. `SPECIAL_TOOL_NAMES` is the set of these names.

## Rendering

The TUI renders each command through its own renderer in `packages/tui/src/tools/resolve.ts`. `resolveRenderer` and `rejectRenderer` draw a pending `Resolve` line with the `proposed -> resolved` / `proposed -> rejected` badge and the reason, then a framed `Accept` / `Discard` / `Failed` block built from `ResolveDetails` (label, optional source tool badge, reason). `proposeRenderer` draws `Propose` with the plan title and then the approval outcome, and `reportIssueRenderer` draws `Report Tool Issue`. A command run inside `bash` draws the same card through its dispatch record: the bash renderer feeds each `details.toolCommands` entry to `renderToolCommandDispatch`, which resolves the tool's own renderer and hands it the dispatch's parsed `args` as the call and `inner` as the result.

## Custom tools

Custom tools stage previews through `pushPendingAction(...)`; the loader forwards them into `queueResolveHandler(...)`. The custom-tool preview API is unchanged except for the model-facing finalization step: follow up with the `resolve` or `reject` command (or top-level tool).
