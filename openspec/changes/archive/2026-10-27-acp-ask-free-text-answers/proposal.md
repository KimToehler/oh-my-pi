# Proposal

## Why

Over ACP, a free-text answer typed into the `ask` dialog is lost. JetBrains Air (IntelliJ) recognises our `q<i>__other` companion field and folds it into its select as one "Other" choice. It then returns the typed text as the select's own value (`q<i>`) and leaves `q<i>__other` empty. The bridge drops any select value that is not one of the offered options. For a single question, the `ask` tool then treats the empty answer as a cancellation and aborts the turn ("Ask tool was cancelled by the user"). In a multi-question dialog that answer shows up as `(cancelled)`, and in a multi-select the typed text disappears without notice.

Evidence, as of 2026-10-27:
- The onara session `~/.omp/agent/sessions/-git-onara/2026-10-26T18-58-46-429Z_01a17994-….jsonl`, line 1118: the tool result is `Ask tool was cancelled by the user`, while the Air journal records the request as `accepted` with `q0 = "klar läuft hier docker …"` and `q0__other` empty.
- All Air journals on this machine: 140 of 140 `__other` fields were left empty, and 4 free-text answers arrived in `q<i>`.
- Air's own merge rule (`ElicitationCustomAnswerFieldsKt.isCustomAnswerFieldFor` in `intellij.air.frontend.session.view.gui.jar`) treats a string field whose id is the select's id plus `__other` as that select's custom answer, for single-select and multi-select fields alike.

## What Changes

- For every ask question that offers options, the ACP bridge treats a select value outside those options as the user's free-text answer. It no longer drops that value. This holds for single-select and multi-select questions, for every client, and for ACP v1 and v2.
- A non-blank `q<i>__other` keeps working as today. When both carry text, the answer keeps both, so no typed text is lost.
- No change to what omp sends: the requested schema, including the `q<i>__other` companion field, stays byte-identical.
- No per-client detection. The user chose the client-agnostic decoding on 2026-10-27, after the Air bytecode showed that a client profile would only be needed if omp stopped sending the companion field, and that change brings no benefit.

## Capabilities

### New Capabilities

- `acp-ask-dialog`: how omp's `ask` questions travel as an ACP form elicitation and how the client's answer becomes the result the model reads.

### Modified Capabilities

None. `acp-client-bridge` covers file and terminal routing for subagents, not elicitation.

## Impact

- Code: the `askDialog` answer decoding in `createAcpExtensionUiContext` (`packages/coding-agent/src/modes/acp/acp-agent.ts`), which ACP v1 and v2 share.
- Tests: `packages/coding-agent/test/acp-agent.test.ts`. The existing test "drops ask values the client was never offered" pins the bug and is replaced. `packages/coding-agent/test/acp-v2.test.ts` gets one v2 transport case.
- Docs: a `### Fixed` entry in `packages/coding-agent/CHANGELOG.md`.
- Upstream: `can1357/oh-my-pi` `main` (`0838d2ab44`) carries the same decoding (`acp-agent.ts:697`, `:723`), so the fix is a candidate for an upstream PR. Opening that PR is not part of this change (see tasks.md, Workflow follow-up).
