# F1 row econ-window, attempt 13

- Head under test: b83ffe4018 (skill and rules deployed from b83ffe4018 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

PASS. Over the attempt-13 dialog runs: every capture is `win.screenshot` or `win.zoom` on the resolved dialog's stored handle (`ce-dialog-a13` 1 + 2 zooms, `-mainfirst` 1 + 3, `-dialogfirst` 1 + 3, `-open` 1, `evid-nc-a13` 1, `ce-takeover-mismatch-a13` 1); no `computer.screenshot`, `computer.display` or `computer.zoom` call in any capture; the host-menu runs captured nothing of the host window.

## Earlier attempt, kept

## F1 row econ-window, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

### Observation

PASS. Over `ce-dialog-a12` and the other dialog runs: every capture call is a window capture through the resolved dialog's handle (`dlg.screenshot` in `evid-nc-a12`, one in `ce-dialog-dialogfirst-a12`); no `computer.screenshot`, `computer.display` or `computer.zoom` call in any attempt-12 capture.

### Earlier attempt, kept

### F1 row econ-window

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp)
- Sessions: omp 18.19.0 -p --mode json --no-session; computer.enabled true unless the capture says otherwise
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

#### Observation

Attempt 10, head 220924a05c deployed (deployed skill and rule compared equal with `cmp` at the start and end of the unlocked batch). PASS for `econ-filter`, `econ-window` and `econ-nc`; judged over the captures of attempt 10.

- `econ-filter` (`ce-voiceover-a10`): no call printed a whole tree; the session kept `ax()` in a variable and printed filtered lines (the call failed with `AxFailed`); no `observe()`.
- `econ-window` (`ce-voiceover-a10`): every capture was `screenshot({ silent: true })` on the caption panel window resolved by app; no display or desktop capture.
- `econ-nc` (every capture): no whole-tree print, no `observe()`, no display or desktop capture. `ce-dialog-a10` and `ce-hostmenu-a10` kept trees in variables and printed filtered lines; `evid-nc-a10` printed its two caption-panel screenshots (not `silent`), a window capture of a target, noted in `evid-nc`.
