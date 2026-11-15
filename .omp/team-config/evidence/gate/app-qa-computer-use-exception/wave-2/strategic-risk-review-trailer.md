No substantiated blocker at the stated threshold.

## 1. Architecture and cross-module seams

The change holds together architecturally. It reuses the existing computer prelude rather than introducing another automation stack, while keeping tag-addressable actions on the shared driver.

The important seams are:

- **Rule activation → instruction loading.** The two rule files separate credential/workflow routing from evidence-search protection. That separation matters because TTSR’s once-only gate is keyed by rule name (`packages/coding-agent/src/export/ttsr.ts:586-595`); loading the credential rule must not consume the evidence rule’s interrupt.
- **Prelude definition → bridge status → session persistence.** `statusError` is optional (`packages/coding-agent/src/eval/preludes.ts:66-73`), the computer prelude opts into `"failed"` (`packages/coding-agent/src/tools/computer.ts:159-161`), and both thrown failures and error results use it (`packages/coding-agent/src/eval/js/tool-bridge.ts:170-174,254-261`). The original exception/result still reaches the cell. This fixes the unwanted persistence channel without changing normal error recovery or other preludes’ defaults.
- **JavaScript/Python → shared bridge.** Both transports call `callSessionTool`; Python does not have a separate status formatter that would bypass this fix (`packages/coding-agent/src/eval/py/tool-bridge.ts:127-133`).
- **Host-menu instructions → shared device lock.** The skill requires atomic acquisition, confirmation inside the lock, and ownership-checked cleanup (`team-config/agent/skills/app-qa-drivers/SKILL.md:99`). It does not substitute a check-then-act lock test.

The added tests exercise actual bridge behavior, including preserved full errors and a real computer prelude over the fake native session—not merely instruction wording.

## 2. Inconsistency, duplication, and simplification

**Note N1 — Dense operational instructions.** The “One target window” bullet combines candidate discovery, root-reference parsing, dialog classification, handle retention, error suppression, terminal-stop behavior, and host-window restrictions in one paragraph (`team-config/agent/skills/app-qa-drivers/SKILL.md:96`). Splitting it into ordered resolution/use/failure steps would make future changes easier to reason about. **Non-blocking:** the required behavior is explicit, and the supplied wave-2 captures demonstrate the previously missing terminal-stop behavior.

**Note N2 — Duplicated evidence contracts.** Output-folder ownership and search exclusions appear in both the skill and `app-qa-evidence.md:14`; configuration-existence sequencing appears in both rule files (`ui-automation-credentials.md:19`, `app-qa-evidence.md:12`). Some duplication is justified because an interrupt must supply usable instructions before the skill is read. Keep those copies deliberately synchronized rather than expanding them independently. **Non-blocking:** I found no conflicting current instructions.

The plan also retains superseded procedures—for example, menu-state confirmation through another `menu.items` call in design D8/D18, explicitly replaced by D21(c). A short current-state summary separate from decision history would simplify maintenance. **Non-blocking:** the delivered skill uses device-setting confirmation, not the superseded procedure.

## 3. Highest-consequence failure

The worst failure is irreversible disclosure into the transcript: a real password, private window title, or unrelated application content escaping through capture, accessibility output, or an auxiliary status record.

The change addresses the principal new paths:

- Credential-configured and unconfigured apps receive no computer-use exception.
- Simulator/emulator host windows are menu-only, not capture or accessibility targets.
- Screen readers remain a human step.
- Window lookup failures are caught without printing their messages.
- The bridge now prevents caught computer failures from leaking their messages through status events.
- A fixed failure message terminates the check rather than authorizing retries through stale handles.

The wave-2 missing-window captures support the last two points: successful resolution followed by disappearance, fixed failure output, no subsequent computer call, and the recorded absence of the unrelated-title sentinel.

This is **not an absolute security boundary**. Configuration omission cannot prove an app never authenticates, uncaught errors still retain their full text intentionally, and the instructions depend on agent compliance. Those limitations are disclosed in `gate.md`, rather than concealed by the status fix.

## 4. What a line-level diff reading would miss

Four system-level properties matter more than the small code delta:

1. **Caught exceptions can still leak through progress persistence.** Reviewing only printed cell output would miss the original defect.
2. **An interrupted skill read is not a completed skill read.** Rule delivery and successful instruction loading are separate events.
3. **Repository-local configuration does not isolate a shared simulator.** That explains both the host-window read prohibition and host-wide locking.
4. **A safe-looking failure message is insufficient without termination.** The previous wave demonstrated this; the new captures exercise the corrected continuation behavior.

The standalone CLI setting check is also not authoritative for every running-session overlay. The staged mismatch test documents detection **after** a takeover outcome, not prevention of that first action. The skill correctly requires stopping afterward; the settings/defaults mechanism remains outside this change’s scope.

### Evidence and limits

Reviewed the supplied complete implementation diff, all eight plan files, the QA matrix, selected retained dialog/host-menu/takeover observations, the wave-2 missing-window captures, and relevant bridge/prelude/transport/TTSR source. No commands, tests, network requests, edits, or sub-reviewers were used. Test totals and raw-stream sentinel checks are supplied QA evidence, not checks I independently executed. The targeted reruns and documented carries are consistent with the narrow wave-2 instruction change.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-6.1-sol
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A secondary progress channel must not defeat a caller's decision to suppress a host exception.
  positive_witness: A caught computer failure retains the complete exception inside the cell while its persisted failure status contains only fixed text.
  negative_control: The cell prints a harmless failure marker but an eval status event persists an unrelated application's title from the exception.
  observable: Compare the exception received by the cell, emitted status events, and serialized raw session output with a synthetic private-title marker.
  boundary: Host prelude failure through the shared eval bridge into status persistence.
END-REVIEW-TRAILER
