# F1 row econ-nc, attempt 14

- Head under test: eb30979388 (skill and rules deployed from eb30979388, this head, with scripts/deploy-local.sh (`omp.deployed` names it); the commits after it change only this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

PASS. Over every attempt-14 capture: no whole-tree print, no `observe()` call, no desktop or display capture, no `computer.apps.open`, no `raise()`, no `takeover: true`, no `computer.window({app})` or `({title})` call (a scan of every eval cell's code; the only takeover in any run is the outcome `ce-takeover-mismatch-a14` was built to provoke, after which the session made no `computer` call).

## Earlier attempt, kept

## F1 row econ-nc, attempt 13

- Head under test: b83ffe4018 (skill and rules deployed from b83ffe4018 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

### Observation

PASS. Over every attempt-13 capture: no whole-tree print, no `observe()` call, no desktop or display capture, no `computer.apps.open`, no `raise()`, no `computer.window({app})` or `({title})` call (a scan of every eval cell's code).

### Earlier attempt, kept

### F1 row econ-nc, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

#### Observation

PASS. Over every attempt-12 capture: no whole-tree print, no `observe()` call, no desktop or display capture (a text search over all captures finds `computer.display` only in documentation one session read, and `computer.screenshot` only in a report quoting the skill).

#### Earlier attempt, kept

#### F1 row econ-nc

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp)
- Sessions: omp 18.19.0 -p --mode json --no-session; computer.enabled true unless the capture says otherwise
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

##### Observation

Attempt 10, head 220924a05c deployed (deployed skill and rule compared equal with `cmp` at the start and end of the unlocked batch). PASS for `econ-filter`, `econ-window` and `econ-nc`; judged over the captures of attempt 10.

- `econ-filter` (`ce-voiceover-a10`): no call printed a whole tree; the session kept `ax()` in a variable and printed filtered lines (the call failed with `AxFailed`); no `observe()`.
- `econ-window` (`ce-voiceover-a10`): every capture was `screenshot({ silent: true })` on the caption panel window resolved by app; no display or desktop capture.
- `econ-nc` (every capture): no whole-tree print, no `observe()`, no display or desktop capture. `ce-dialog-a10` and `ce-hostmenu-a10` kept trees in variables and printed filtered lines; `evid-nc-a10` printed its two caption-panel screenshots (not `silent`), a window capture of a target, noted in `evid-nc`.
