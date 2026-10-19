# ACP steering: run builtin slash commands (`/compact`) instead of queueing them as text

## Context
IntelliJ (ACP) sends mid-turn input through `_session/steering`. `AcpAgent.#steer` (`packages/coding-agent/src/modes/acp/acp-agent.ts`, ~1337) handles it. While the prompt turn is open (`turn !== undefined && !turn.settled && !turn.cancelRequested`), it does `record.pendingSteers++`, calls `await record.session.steer(text, images)`, then decrements in `finally`. `AgentSession.steer` (`src/session/agent-session.ts`, ~8819) only rejects extension commands and expands prompt templates. It never dispatches builtin slash commands, so a steered `/compact` reaches the model as the literal user text `/compact` and nothing is compacted.

Goal: a steered builtin slash command runs immediately, the way the TUI runs builtins while streaming. `/compact` should compact mid-turn, resume the interrupted work in the same ACP turn, and the open ACP prompt must always settle.

Facts the design relies on, all read in code:
- `isAcpSessionQuiescent` (~249) requires `record.pendingSteers === 0`, `!session.isStreaming`, `!session.hasAdmittedSubmission`, `!session.hasPostPromptWork`, and `!session.hasPendingAsyncWork()`. The `agent_end` branch of `#handlePromptEvent` (~1662–1681) sets `promptTurn.lastAgentEnd`, then starts at most one `promptTurn.quiescenceWait = this.#waitForAcpPromptIdle(record, promptTurn, token)`. When it resolves, it calls `#finishPrompt`. A later `agent_end` that finds `quiescenceWait` already set returns early.
- `SessionMaintenance.compact` (`src/session/session-maintenance.ts`, ~1133) calls `disconnectFromAgent()` and then `abort({ preserveCompaction: true })` on the live run. The aborted run's `agent_end` therefore never reaches ACP. In `finally` it reconnects, re-drains preserved queues, and schedules the interrupted-turn resume as tracked post-prompt work (`hasPostPromptWork`) when the run was live and `compaction.autoContinue` is not false. With no resume, no `agent_end` arrives at all.
- Manual compaction preserves the agent's steer/follow-up queues across the abort and re-drains them afterwards (`session-maintenance.ts`, ~1608–1614). A plain-text steer that lands during compaction is therefore delivered after it, so text steers need no new ordering.
- A second `compact()` while one is running throws `"Compaction already in progress"` (~1141–1146), and `/model` mutates `session.setModel` (`builtin-modes.ts`, ~477). Steered builtins must not overlap each other.
- The ACP `/compact` handler awaits `session.compact()` inline, because ACP provides no `runCommandInBackground` (`builtin-lifecycle.ts`, ~226–263). The handler returns only after the pass has finished and any resume has been scheduled.

## Approach
Work in the worktree `.worktrees/acp-steer-builtin-commands` (`git worktree add .worktrees/acp-steer-builtin-commands -b acp-steer-builtin-commands`). Paths below are relative to `packages/coding-agent/` inside it. Re-read each anchor before editing, because this file changes often upstream. Every step leaves the tree building with existing tests green.

### 1. One resolver for ACP builtin dispatch (`src/slash-commands/acp-builtins.ts`)
Replace the inline parse, lookup, and handle check in `executeAcpBuiltinSlashCommand` (~59–70) with a resolver plus a runner. Keep its doc comment.
```ts
/** A slash invocation that dispatches to an ACP builtin `handle`. */
export interface ResolvedAcpBuiltinSlashCommand {
	parsed: ParsedSlashCommand;
	handle: NonNullable<SlashCommandSpec["handle"]>;
}

/** Resolve `text` to an ACP builtin; `undefined` for non-slash text, unknown names, and TUI-only entries. */
export function resolveAcpBuiltinSlashCommand(text: string): ResolvedAcpBuiltinSlashCommand | undefined {
	const parsed = parseSlashCommand(text);
	if (!parsed) return undefined;
	const handle = lookupBuiltinSlashCommand(parsed.name)?.handle;
	return handle ? { parsed, handle } : undefined;
}

export async function runAcpBuiltinSlashCommand(
	resolved: ResolvedAcpBuiltinSlashCommand,
	runtime: SlashCommandRuntime,
): Promise<Exclude<AcpBuiltinSlashCommandResult, false>> {
	const result = await resolved.handle(resolved.parsed, runtime);
	return result === undefined ? { consumed: true } : result;
}

export async function executeAcpBuiltinSlashCommand(
	text: string,
	runtime: SlashCommandRuntime,
): Promise<AcpBuiltinSlashCommandResult> {
	const resolved = resolveAcpBuiltinSlashCommand(text);
	return resolved ? runAcpBuiltinSlashCommand(resolved, runtime) : false;
}
```
Add the type imports `ParsedSlashCommand` and `SlashCommandSpec` from `./types`. Detaching `handle` from its spec is safe because every spec's `handle` is an arrow-function property and nothing uses `this`. The existing callers of `executeAcpBuiltinSlashCommand` stay as they are.

### 2. Shared ACP slash runtime (`acp-agent.ts`)
Move the `SlashCommandRuntime` object literal that `#runPromptOrCommand` passes inline (~1075–1116) into a new method:
```ts
#buildSlashCommandRuntime(record: ManagedSessionRecord, signal: AbortSignal | undefined): SlashCommandRuntime
```
Move it verbatim with all comments: `session`, `sessionManager`, `settings`, `cwd`, `signal`, `output`, `refreshCommands`, `reloadPlugins`, `keepTurnOpenUntilIdle`, `notifyTitleChanged`, `notifyConfigChanged`. `#runPromptOrCommand` then calls `executeAcpBuiltinSlashCommand(text, this.#buildSlashCommandRuntime(record, promptTurn?.abortController.signal))`. Add `import type { SlashCommandRuntime } from "../../slash-commands/types";` and import `resolveAcpBuiltinSlashCommand`, `runAcpBuiltinSlashCommand`, and `type ResolvedAcpBuiltinSlashCommand` from `../../slash-commands/acp-builtins`. This step is a pure refactor.

### 3. Shared "finish when quiescent" (`acp-agent.ts`)
Extract lines ~1673–1680 of the `agent_end` branch into:
```ts
/** Finish `promptTurn` once the session is quiescent; one waiter per prompt (later callers return immediately). */
async #finishPromptWhenQuiescent(record: ManagedSessionRecord, promptTurn: PromptTurnState, token: symbol): Promise<void> {
	if (promptTurn.quiescenceWait) return;
	promptTurn.quiescenceWait = this.#waitForAcpPromptIdle(record, promptTurn, token);
	await promptTurn.quiescenceWait;
	if (record.promptTurn !== promptTurn || promptTurn.settled) return;
	this.#finishPrompt(record, {
		stopReason: promptTurn.lastAgentEnd
			? this.#resolveStopReason(promptTurn.lastAgentEnd, promptTurn.cancelRequested)
			: promptTurn.cancelRequested
				? "cancelled"
				: "end_turn",
		usage: this.#buildTurnUsage(promptTurn.usageBaseline, record.session.sessionManager.getUsageStatistics()),
	});
}
```
The `agent_end` branch keeps `promptTurn.lastAgentEnd = event;` and the flush/reset lines, then ends with `await this.#finishPromptWhenQuiescent(record, promptTurn, token);`. Behaviour is identical, because `lastAgentEnd` is always set before this call on that path.

### 4. Steered builtins (`acp-agent.ts`)
- Add `builtinSteerLane: Promise<void>` to `ManagedSessionRecord` (~200–235) with the doc `/** Serializes steered builtin slash commands; each starts after the previous one finished. */`, and set it to `Promise.resolve()` in `#createManagedSessionRecord` (~1505–1523).
- In the open-turn branch of `#steer` (~1350), after `#convertPromptBlocks`:
  ```ts
  const builtin = resolveAcpBuiltinSlashCommand(text);
  if (builtin) {
  	// Reserve now: pendingSteers keeps isAcpSessionQuiescent false, so the
  	// turn cannot finish between this request and the lane running it.
  	record.pendingSteers++;
  	const run = record.builtinSteerLane.then(() => this.#runSteeredBuiltin(record, turn, builtin, images, blocks));
  	record.builtinSteerLane = run.catch(() => undefined);
  	void run.catch((error: unknown) => logger.warn("ACP steered command failed", { sessionId, error }));
  	return { outcome: "injected" };
  }
  ```
  The existing text path (`pendingSteers++`, `session.steer`, `finally` decrement) stays unchanged, and so does the not-open branch (`startedNewTurn` through `this.prompt`, which already dispatches builtins via `#runPromptOrCommand`). The request returns immediately, so a compaction never blocks the steering response. Results reach the client as `agent_message_chunk` output inside the open turn, e.g. `Compaction complete. Tokens: A -> B (saved N).` or `Compaction failed: …`.
- New method:
  ```ts
  async #runSteeredBuiltin(
  	record: ManagedSessionRecord,
  	turn: PromptTurnState,
  	builtin: ResolvedAcpBuiltinSlashCommand,
  	images: AgentImageContent[],
  	blocks: PromptRequest["prompt"],
  ): Promise<void> {
  	let reserved = true;
  	const release = (): void => {
  		if (!reserved) return;
  		reserved = false;
  		record.pendingSteers--;
  	};
  	try {
  		if (record.promptTurn !== turn || turn.settled || turn.cancelRequested) {
  			// Cancelled while queued behind another command: run it as its own
  			// prompt, exactly like an idle steer.
  			release();
  			void this.prompt({ sessionId: record.session.sessionId, prompt: blocks }).catch((error: unknown) =>
  				logger.warn("ACP steering turn failed", { sessionId: record.session.sessionId, error }),
  			);
  			return;
  		}
  		const result = await runAcpBuiltinSlashCommand(
  			builtin,
  			this.#buildSlashCommandRuntime(record, turn.abortController.signal),
  		);
  		// Residual text (e.g. `/force <tool> <prompt>`) is ordinary steer input.
  		if ("prompt" in result) await record.session.steer(result.prompt, images);
  		await this.#emitUsageUpdate(record);
  	} finally {
  		release();
  	}
  	if (record.promptTurn !== turn || turn.settled) return;
  	// `/compact` aborts the live run with the agent disconnected, so that run's
  	// agent_end never arrives; without a resume nothing else would finish the
  	// turn. A resumed run's agent_end finds this waiter and leaves it in charge.
  	void this.#finishPromptWhenQuiescent(record, turn, Symbol("acp-steered-command")).catch((error: unknown) =>
  		logger.warn("ACP steered command settle failed", { sessionId: record.session.sessionId, error }),
  	);
  }
  ```
  The settle waiter is not awaited, so the lane frees up as soon as the command returns. If a `quiescenceWait` already exists (the turn already had its `agent_end` and is waiting on background work), the call is a no-op and the existing waiter finishes the turn once `pendingSteers` drops to 0.

### Entry-path inventory (after the change)
| Entry | Builtin resolution | Runtime | Settlement |
|---|---|---|---|
| `session/prompt` (any state) | `executeAcpBuiltinSlashCommand` → `resolveAcpBuiltinSlashCommand` | `#buildSlashCommandRuntime(record, promptTurn signal)` | existing `#runPromptOrCommand` finish, or `agent_end` → `#finishPromptWhenQuiescent` |
| `_session/steering`, no open turn | via `this.prompt` → row above | as above | as above |
| `_session/steering`, open turn, builtin | `resolveAcpBuiltinSlashCommand` + `runAcpBuiltinSlashCommand` in `builtinSteerLane` | `#buildSlashCommandRuntime(record, turn signal)` | `pendingSteers` held until the command returns, then `#finishPromptWhenQuiescent` (shared with a resumed run's `agent_end`) |
| `_session/steering`, open turn, cancelled while queued | (re-check in `#runSteeredBuiltin`) | via `this.prompt` | as first row |
| `_session/steering`, open turn, text | resolver → `undefined` | n/a | unchanged (`pendingSteers` around `session.steer`) |

### 5. Tests
`test/acp-builtins.test.ts`: add `describe("resolveAcpBuiltinSlashCommand")` with one assertion per parse branch:
- `/models` (alias): `parsed.name === "models"` and `handle === lookupBuiltinSlashCommand("model")!.handle` (import from `@oh-my-pi/pi-coding-agent/slash-commands/builtin-registry`).
- `/compact:soft` (colon): `parsed` matches `{ name: "compact", args: "soft" }`.
- `/` and `compact` (no slash) → `undefined`.
- `/quit` (TUI-only, no `handle`) → `undefined`.
- `/not-a-real-command-xyz` → `undefined`.

`test/acp-agent.test.ts`, next to the `_session/steering` tests (~1745–1793):
- Extend `FakeAgentSession` (~133; `compact` ~462). Add `compactCalls: Array<string | undefined> = []` and `compactImpl: (() => Promise<void>) | undefined`. `compact(instructions)` pushes `instructions`, then runs `await this.compactImpl?.()`.
- Add a local `async function waitUntil(predicate: () => boolean)` that loops `await Bun.sleep(0)` at most 200 times and throws `new Error("condition not reached")`.
- **A. Running `/compact` executes, and the resumed run settles the turn.** Hold the turn with `session.promptGate = gate.promise`. Steer `/compact` and expect `{ outcome: "injected" }`. `waitUntil(() => session.compactCalls.length === 1)`. Expect `session.steerCalls` toEqual `[]`, and a session `agent_message_chunk` with text `Compaction complete.` (fake `contextUsage` is undefined, so the short form). Race `prompt` against `Bun.sleep(20)` and expect it still open: `isStreaming` is still true, which models the resumed run. `gate.resolve()` (the fake emits `agent_end`); `(await prompt).stopReason` toBe `"end_turn"`.
- **B. Running `/compact` with no resume still settles.** `promptGate` is never resolved. `compactImpl = async () => { session.isStreaming = false; }`. Steer `/compact`, then `await Promise.race([prompt, Bun.sleep(1000).then(() => "timeout")])` toMatchObject `{ stopReason: "end_turn" }`.
- **C. Ordering, no overlap, and admission holds the turn across the original `agent_end`.** `const compactGate = Promise.withResolvers<void>()`; `compactImpl = () => compactGate.promise`; turn held by `gate`. Steer `/compact first`, and `waitUntil(() => compactCalls.length === 1)`. Steer `/compact second` (expect `injected`). Resolve `gate` so the fake emits the original `agent_end` and sets `isStreaming = false`. Sleep `Bun.sleep(20)`. Expect `compactCalls` toEqual `["first"]` and `prompt` still unsettled (race against `Bun.sleep(0)`). `compactGate.resolve()`. `(await prompt).stopReason` toBe `"end_turn"` and `compactCalls` toEqual `["first", "second"]`.
- **D. Idle steered builtin.** On an idle session, steer `/compact` and expect `{ outcome: "startedNewTurn" }`. `waitUntil(() => compactCalls.length === 1)`. Expect a `Compaction complete.` chunk and `promptCalls` toEqual `[]`. Then `harness.agent.prompt({ …, text: "next" })` resolves `end_turn` and `promptCalls` toEqual `["next"]`, which proves the command's own turn settled and released the prompt queue.
- Keep `"injects _session/steering into a running turn"` and `"injects _session/steering while the open prompt waits on background work"` unchanged. They are the text-steer negative controls.

## Critical files & anchors
- `src/modes/acp/acp-agent.ts`: `#steer` (~1337), `#runPromptOrCommand` runtime literal (~1075), `agent_end` branch of `#handlePromptEvent` (~1662), `#waitForAcpPromptIdle` (~1775), `isAcpSessionQuiescent` (~249), `ManagedSessionRecord` (~200), `#createManagedSessionRecord` (~1505).
- `src/slash-commands/acp-builtins.ts`: `executeAcpBuiltinSlashCommand` (~59).
- `src/session/session-maintenance.ts`: `compact()` (~1133–1635), reference only for the abort, resume, and "already in progress" semantics. Do not edit it.
- `test/acp-agent.test.ts`: `FakeAgentSession` and the steering tests.

## Verification
- From `packages/coding-agent` in the worktree, run `bun test test/acp-agent.test.ts test/acp-builtins.test.ts test/slash-commands/compact.test.ts`. All must pass.
- RED check: temporarily replace the step-4 `if (builtin) { … }` block with nothing, so builtins take the text path. Confirm A, B, and C fail. D keeps passing, because the idle path already works; it guards the step-2 refactor. Restore the block. Then remove only the reservation line `record.pendingSteers++` and its `release` calls, and confirm C fails because the prompt settles before `second` runs. Restore again.
- Run `bun check` from the repo root.
- Manual QA (F1) on the real surface: point IntelliJ's ACP agent at `bun <worktree>/packages/coding-agent/src/cli.ts acp`.
  1. During a long multi-tool turn, steer `/compact`. Expected: chunk `Compaction complete. Tokens: <before> -> <after> (saved N).`, the context meter drops, the agent continues the interrupted work in the same turn, and the turn ends `end_turn`.
  2. With `compaction.autoContinue: false`, repeat. Expected: the completion chunk appears and the turn closes instead of hanging.
  3. Steer `/compact` twice quickly. Expected: both run in order and never overlap (no `Compaction failed: Compaction already in progress`). The first prints `Compaction complete. …`; the second prints `Compaction failed: Already compacted`, which is the existing `/compact` no-op when nothing new follows a compaction (amended after F1: the original text expected two completion chunks, which contradicts that no-op rule).
  4. Steer `also check X` mid-turn. Expected: it is injected as user text with no command output.

## TODOs
F2 round 1 (strategic-risk-review FAIL, `onara/cx/gpt-5.6-sol`) fixes, applied on top of `1665179a64`:
1. B1, settlement survives command failure: in `#runSteeredBuiltin`, catch a rejecting handler, residual `session.steer`, or usage update, log it, report `Command /<name> failed: <message>` through the turn's output, and arm `#finishPromptWhenQuiescent` from `finally` (after releasing the reservation) whenever the same turn is still open. Test: a `/compact` handler that leaves the session idle and throws still settles the prompt `end_turn` and shows the failure chunk.
2. B2, steered builtins are owned by their prompt turn: move the lane and the reservation counter from `ManagedSessionRecord` to `PromptTurnState` (`builtinSteerLane`, `pendingBuiltinSteers`). `isAcpSessionQuiescent(record, promptTurn)` additionally requires `promptTurn.pendingBuiltinSteers === 0`. A queued command whose turn was cancelled is dropped (logged). A queued command whose turn ended any other way is re-admitted through the shared `#admitSteer` path (into the prompt open now, or as a new prompt only when none is open, so it never implicitly cancels a later prompt). Command output from a settled or cancelled turn is dropped instead of leaking into a later prompt. Tests: (a) cancel prompt A with one gated and one queued `/compact`, start prompt B, release the gate: the queued command is dropped, B is not cancelled and ends `end_turn`; (b) a never-resolving command from cancelled prompt A does not block a `/compact` steered into prompt B.
3. Coverage, auditor adversarial criterion: a steered `/force read <text>` with an image attachment steers `<text>` with the image into the open turn and starts no extra prompt.
F2 round 2 (implementation-audit FAIL, `onara/cx/gpt-5.6-terra`) fix, applied on top of `377a26a7c5`:
4. Residual input stays in its prompt: after a steered builtin returns `{ prompt }`, `#runSteeredBuiltin` steers the residual text and the original images only if the originating prompt is still current and live; otherwise it drops them, logging the drop. A command that already started is not re-admitted. The runtime's state callbacks (`refreshCommands`, `reloadPlugins`, `notifyTitleChanged`, `notifyConfigChanged`) stay unguarded. They publish session-scoped state (command list, title, model/mode config), which is correct whichever prompt is open, and they carry no turn content. Test: hold `/force read secret-from-a` with an image on its status output, cancel prompt A, start prompt B, then release the output. No `session.steer` happens, and B ends `end_turn`.
F2 round 3 (strategic-risk-review FAIL, `onara/cx/gpt-5.6-sol`) fix, applied on top of `6cd5877b79`:
5. No builtin handler overlaps a steered one across prompts. Every builtin handler, whether sent as a prompt (`#runPromptOrCommand`) or steered in (`#runSteeredBuiltin`), runs through `#runBuiltin`. While it runs, `#runBuiltin` registers the handler in `ManagedSessionRecord.runningBuiltins` with its prompt and a `steered` flag. Handlers mutate shared session state, and a cancelled prompt's handler can ignore its advisory abort signal, so these rules apply:
   - A handler of the same prompt is waited out.
   - A handler of another prompt is never waited on. When either the new command or that running handler is steered, the new command is not run. Its prompt gets `Command /<name> not run: /<holder> from an earlier reply is still running.` and settles normally, so later prompts stay usable and no second handler runs beside a steered one.
   - Two commands that were both sent as prompts keep their previous behaviour. The existing test "keeps a cancelled bare rename from updating or settling its successor" requires that a cancelled `/rename` not block the next one.
   - Registration ends in `finally`.
   Test: the "stuck command" scenario now expects the opposite of the overlap. Neither a builtin steered into prompt B nor a builtin sent as prompt C calls `compact()` a second time while A's steered handler is pending. Both get the not-run chunk, and both settle `end_turn`.
   F1 adds a real-surface cancel scenario: steer `/compact`, cancel, then send a new prompt. The new prompt answers, and no "already in progress" appears.
F2 round 4 (implementation-audit FAIL, `onara/cx/gpt-5.6-terra`) fixes, applied on top of `f623d43475`:
6. A steered builtin belongs to the prompt it was steered into:
   - After waiting out its own prompt's earlier handler, `#runBuiltin` re-checks that the prompt is still current, live, and not cancelled. If not, it returns `undefined` (the handler never ran), and the command is dropped. The same check covers a prompt-sent builtin.
   - `#runSteeredBuiltin` no longer re-admits a command whose prompt ended. It drops it, so old blocks or images can never move to another prompt. The `#admitSteer` indirection is removed.
   - Every direct finish path of a locally handled prompt now waits for that prompt's steered builtins before calling `#finishPrompt` (`#awaitSteeredBuiltins`): the residual-prompt path, the consumed-builtin path, the local-command path, and the error path. If a steered command already armed the quiescence waiter, the local path leaves finishing to that waiter.
   Tests: (a) prompt A is a slow `/compact` that ignores cancel, a `/compact` is steered behind it, A is cancelled and B starts, then A's handler is released. Only A's own compact ran, and no steer happened. (b) Prompt A is a slow `/compact` with `/force read secret-from-a` plus an image steered in. A stays open until the `/force` ran inside A, and the next prompt B receives nothing from A.

## Final verification wave
- [x] F3. Whole-diff review: not needed. The change spans 2 modules (`modes/acp`, `slash-commands`) plus their tests; tick with that reason.
- [x] F1. Manual QA on the real surface (IntelliJ ACP, scenarios 1–4 above), one evidence path per scenario, on the head after the last code commit.
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated (mandatory class `concurrency-state`, so both reviewers run).

## Merge gate
- Author's risk assessment: wrong settlement leaves an ACP `session/prompt` hanging forever (client spinner stuck), or finishes it early so resumed-turn output is dropped. Wrong serialization makes a second steered `/compact` fail with "already in progress", or races `/model` against compaction. Severity: medium (only ACP steering; recoverable via cancel).
- Mandatory class: concurrency-state
- Whole-diff review: not needed: 2 modules (`modes/acp`, `slash-commands`) and tests
- Feature-specific criteria:
  - Invariant: A steered builtin executes as a command, never as model text.
    Positive witness: test A, where `compactCalls === [undefined]` and `steerCalls === []` after steering `/compact` into a running turn.
    Negative control: with the step-4 block removed, `steerCalls` contains `{ text: "/compact" }` and `compactCalls` is empty, so test A fails.
    Observable: `FakeAgentSession.compactCalls` / `steerCalls`, plus the `agent_message_chunk` "Compaction complete.".
    Boundary: `AcpAgent.extMethod("_session/steering")` → `#steer` → `#runSteeredBuiltin`.
  - Invariant: An open ACP prompt settles exactly once after a steered command, whether or not the interrupted run resumes.
    Positive witness: test B resolves `end_turn` with no `agent_end`. Test A resolves only after the resumed run's `agent_end`.
    Negative control: without the `#finishPromptWhenQuiescent` call in `#runSteeredBuiltin`, test B hits the 1000 ms timeout.
    Observable: `PromptResponse.stopReason` and settle timing relative to the gate.
    Boundary: `#runSteeredBuiltin` → `#finishPromptWhenQuiescent` → `#waitForAcpPromptIdle`/`isAcpSessionQuiescent`.
  - Invariant: Steered builtins run strictly in arrival order without overlap, and a queued builtin keeps the turn open across the original run's `agent_end`.
    Positive witness: test C, where `compactCalls === ["first"]` while the first command is gated, the prompt is still open after the original `agent_end`, and the final order is `["first", "second"]`.
    Negative control: without the `record.pendingSteers++` reservation, the prompt settles after the original `agent_end` before `second` runs, so test C fails. Without the lane, `compactCalls` shows both calls before `compactGate` resolves.
    Observable: `compactCalls` sequence and the prompt-settled flag.
    Boundary: `#steer` reservation + `builtinSteerLane`, and the `isAcpSessionQuiescent` gate in `#waitForAcpPromptIdle`.
  - Mechanical: `resolveAcpBuiltinSlashCommand` is the single resolution source.
    Invariant: alias, colon, no-slash, TUI-only, and unknown inputs resolve as specified in step 5. `executeAcpBuiltinSlashCommand` returns `false` exactly when the resolver returns `undefined`.
    Observable: the `acp-builtins.test.ts` resolver cases, plus the existing `executeAcpBuiltinSlashCommand` "/not-a-real-command-xyz" → `false` case.
    Boundary: `src/slash-commands/acp-builtins.ts` exports.

## Assumptions & contingencies
- Every ACP builtin, not only `/compact`, executes immediately when steered, which matches the TUI while streaming. If only `/compact` is wanted, change the step-4 condition to `builtin?.parsed.name === "compact"`. Nothing else changes.
- Plain-text steers bypass the builtin lane, because compaction preserves and re-drains the agent queues. If QA scenario 4 shows a text steer sent during a compaction getting lost, route text steers through `builtinSteerLane` too (same reservation pattern) and add a test like C with a text steer as the second item.
- If QA scenario 1 shows the resumed run's output never reaches the client (the turn closes right after the completion chunk), the "resume streams into the subscribed turn" fact is wrong for real `AgentSession`. Keep the fix, add a reproducing test with a real `AgentSession`, and report it instead of patching around it in ACP.
