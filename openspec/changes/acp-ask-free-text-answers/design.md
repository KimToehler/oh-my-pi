# Design

## Context

For the motivation and the evidence, see proposal.md (Why). The requirements are in specs/acp-ask-dialog/spec.md.

Current code, `packages/coding-agent/src/modes/acp/acp-agent.ts`:
- `createAcpExtensionUiContext` → `askDialog` (lines 654-739) builds one form. For question `i` with options it adds `q<i>` (single: `string` with `oneOf` and an optional `default`; multi: `array` with `items.anyOf`). For every question, it then adds `q<i>__other` (`{ type: "string", title: OTHER_OPTION }`, line 688).
- The decoding (lines 712-738) reads `customInput` only from `q<i>__other`. `selectedOptions` keeps only exact option labels: line 724 for multi, lines 726-727 for single. A single-select free answer from the companion field clears the selection (line 726).
- `elicitFormFromAcpClient` (lines 489-543) returns the accepted `content` unchanged. ACP v1 sends through `sendV1FormElicitation` (`acp-surface-v1.ts:51-61`). ACP v2 sends through `AcpSurfaceV2.elicitForm` (`acp-surface-v2.ts:453-463`), which maps the properties with `toV2Properties` and returns `content ?? {}` for `accept`. Both versions therefore reach the same decoding.
- `AskTool` (`packages/coding-agent/src/tools/ask.ts:840-853`) aborts the turn with `ToolAbortError("Ask tool was cancelled by the user")` when a lone single-select question comes back with no selection and no `customInput`. For several questions, `formatQuestionResult` (`ask.ts:483-495`) prints such a question as `(cancelled)`.

How JetBrains Air handles the form (read from the installed plugin's bytecode, `~/Library/Application Support/JetBrains/IntelliJIdea2026.2/plugins/air-plugin/lib/modules/`):
- `intellij.air.frontend.session.view.gui.jar`, `ElicitationCustomAnswerFieldsKt.isCustomAnswerFieldFor(field, selectField)`. A field counts as the custom answer of a SingleSelect or MultiSelect field when it is a String field whose id is `selectField.id + "__other"` or that is flagged `isCustomAnswer`. It must also be optional and carry no default, options, format, length, pattern or range. `ElicitationFormModelKt.mergedCustomAnswerFields` folds such a field into the select directly before it (`copy(isCustomAnswer = true)`) and drops the companion from the form.
- `ElicitationFormModel.submitValues` writes each field's values under that field's own id. A folded select therefore returns the typed text under `q<i>`, and `q<i>__other` never receives a value.
- `intellij.air.backend.acp.jar`, `V1AcpElicitationSchemaAdapter.isCustomAnswerProperty`, also recognises a property `_meta` marker (`_meta.jetbrains.customAnswer`, `_meta._askUserQuestionCustomAnswer`, `isCustomAnswer`). We do not need it: the id suffix already matches.

## Goals / Non-Goals

**Goals:**
- One decoding rule for every client and both protocol versions: typed text from the select field or the companion field reaches the model as free text.
- Keep the change local to the decoding, so it ports to upstream `main` as a self-contained diff.

**Non-Goals:**
- Client detection or client profiles (user decision 2026-10-27, see D3).
- Changing the outgoing request schema, including sending `_meta` custom-answer markers.
- Changing `AskTool`'s cancellation rule for an empty answer, or the TUI, RPC and collab ask paths.
- Free text for the extension `select()` dialog, which offers no companion field.

## Decisions

### D1: A select value outside the options is free text

`askDialog` decodes each question through one local pure function in `acp-agent.ts`. It takes the question, its key `q<i>` and the accepted `content`, and returns `{ selectedOptions, customInput }`:
- `labels` = the question's option labels (raw, as sent in `oneOf.const` / `anyOf.const`).
- Select-field texts:
  - single: when `content[q<i>]` is a string not in `labels`, its trimmed value, if non-blank.
  - multi: every string item of the array that is not in `labels`, trimmed, non-blank, in array order.
- Companion text: `content[q<i>__other]` trimmed, if a non-blank string.
- `customInput` = the select-field texts followed by the companion text, joined by `"\n"`. Each exact text is kept once, at its first position, across this whole list: a repeat inside a multi-select array and a companion that repeats a select text are dropped the same way. One rule for both cases; a repeated line carries nothing for the model. It is `undefined` when nothing is left.
- `selectedOptions`:
  - multi: the array items that are labels, in array order, as today.
  - single: `[value]` when `value` is a label and `customInput` is `undefined`, otherwise `[]`. This keeps line 726's rule that a free answer is exclusive.

Matching stays exact, with no trim before the comparison, because clients echo `const` verbatim. A padded label therefore counts as free text, which is harmless because the model still reads the user's words.

Alternatives considered:
- *Keep dropping off-list values and fix only Air through client detection.* Rejected (D3): the drop loses user input from any client that folds the companion field the way Air does, and Air is evidence that clients do this.
- *Treat an off-list value as invalid and re-ask.* Rejected: the user did answer. Re-asking repeats the question for an answer the form explicitly invited.
- *Companion text replaces select text (`__other` wins).* Rejected: the spec requires that no typed text is lost. Air sends only one of the two, and for other clients a concatenation is the lossless choice.
- *Join with `", "`.* Rejected: `"\n"` keeps separate entries apart, and `formatSingleQuestionResponse` (`ask.ts:512-520`) already indents multi-line custom input.

### D2: The request schema stays as it is

The `q<i>` / `q<i>__other` pair, the order of the two properties and the companion's shape are the contract Air keys on (see Context): the id suffix, adjacency, and optional with no constraints. The spec pins this contract (requirement "Each question with options offers a companion free-text field"), so a later refactor cannot silently break the Air fold. Adding `_meta` markers was considered and rejected: they would be JetBrains-specific wire data with no behaviour gain.

### D3: No client detection

The user decided this on 2026-10-27, after weighing three options: generic decoding; decoding plus a client-profile registry that would also absorb the existing JetBrains quirks; detection only. The decoding rule is correct for any client, because the form offers free text for every question with options, so a free answer is within what was asked. Upstream `main` has no client detection at all (no `clientInfo` use in `acp-agent.ts` at `0838d2ab44`), so a profile registry would also make the upstream port larger.

### D4: Test surface

- Decoding contract: `createAcpExtensionUiContext(...).askDialog` with the existing mock `unstable_createElicitation` connection in `test/acp-agent.test.ts` ("ACP elicitation bridge" block). These tests own the spec scenarios for single-select, multi-select, combined text and request shape.
- Reported failure path: one test that runs the real `AskTool` (`src/tools/ask.ts`) with the ACP bridge's `askDialog` as its UI context and the Air-shaped content. It asserts the tool result text and that `context.abort` was not called. This test reproduces the "cancelled" turn end; the bridge tests alone cannot.
- v2 transport: one test in `test/acp-v2.test.ts` with the existing `startReal` harness and a tool that calls `toolUi.current.askDialog`. The client answers `accept` with an off-list `q0`, and the test checks the free text the tool receives. It also checks the emitted v2 `requestedSchema`: the property order `q0`, `q0__other`, the exact companion object, and that the companion is not required. This covers `AcpSurfaceV2.elicitForm`'s property mapping (`toV2Properties`) and content mapping, which v1 tests do not reach.
- The existing test "drops ask values the client was never offered" (`acp-agent.test.ts:4502-4512`) asserts the bug and is replaced by the single-select free-text test, not kept beside it.

## Risks / Trade-offs

- [A client sends a stale or garbled select value that is not what the user meant] → The model now reads it as the user's text, instead of the turn ending as cancelled. The model sees exactly what the client sent. Earlier, such input became a cancellation or `(cancelled)`, which was wrong in the same way and also hid it.
- [A client that folds the companion field may change its submit shape later, for example writing to `q<i>__other`] → Already handled: the companion text path is unchanged, and both paths combine.
- [A future refactor reorders the properties or renames the companion] → Air would stop folding and show a second plain text field. The request-shape requirement and its test catch this.

## Migration Plan

No data or configuration migration. Rollback is a revert of the decoding commit: the request side does not change, so clients see no difference either way.
