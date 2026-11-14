# F1 row evid-stmt, attempt 13

- Head under test: b83ffe4018 (skill and rules deployed from b83ffe4018 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

PASS. `ce-dialog-a13` kept `qa-evidence/dialog-buttons/README.md` holding `Computer use: app dialog: button labels of the open panel` (so did `ce-dialog-open-a13` in `qa-evidence/dialog-buttons-2026-11-14/README.md`). Sessions that did not use the prelude wrote no such line: `ce-voiceover-a13`'s `qa-evidence-voiceover-check/README.md` and the driver capture folders of `rt-clean-a13`, `rt-folder-a13` and `ce-nc-screencapture-a13` hold none.

## Earlier attempt, kept

## F1 row evid-stmt, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

### Observation

PASS. `ce-dialog-a12` kept `qa-evidence/dialog-buttons/README.md` holding `Computer use: app dialog: button labels of the open panel`; `ce-typing-a12` kept no evidence and wrote no `Computer use:` line.

### Earlier attempt, kept

### F1 row evid-stmt

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp)
- Sessions: omp 18.19.0 -p --mode json --no-session; computer.enabled true unless the capture says otherwise
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

#### Observation

Attempt 10, head 220924a05c deployed (deployed skill and rule compared equal with `cmp` at the start and end of the unlocked batch). PASS.

- `ce-voiceover-a10` kept `qa-evidence/voiceover-check/README.md` holding `Computer use: screen reader: VoiceOver caption panel read for the Weaver desktop main screen's announcement`.
- `ce-typing-a10` kept no evidence and wrote no `Computer use:` line.
