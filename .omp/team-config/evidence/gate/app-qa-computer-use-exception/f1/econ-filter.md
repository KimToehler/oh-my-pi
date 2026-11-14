# F1 row econ-filter, attempt 14

- Head under test: eb30979388 (skill and rules deployed from eb30979388, this head, with scripts/deploy-local.sh (`omp.deployed` names it); the commits after it change only this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

PASS. Over every attempt-14 capture with an eval cell (`ce-dialog-a14`, `-mainfirst`, `-dialogfirst`, `-open`, `evid-nc-a14`, the `ce-window-miss` runs, `ce-takeover-mismatch-a14`, `ce-host-absent-a14` and the host-menu runs): tree reads were kept in variables and only filtered lines were printed (button lines, role counts, line counts, attribute objects of single elements, menu item titles and enabled states); no cell prints a whole `ax()` result (the largest printed output of any eval cell is 74 lines, a list of single-button attribute objects; the dialog's own tree runs to the 800-node limit) and none calls `observe()` (scan of every eval cell's code).

## Earlier attempt, kept

## F1 row econ-filter, attempt 13

- Head under test: b83ffe4018 (skill and rules deployed from b83ffe4018 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

### Observation

PASS. Over every attempt-13 capture with an eval cell (`ce-dialog-a13`, `-mainfirst`, `-dialogfirst`, `-open`, `evid-nc-a13`, `ce-window-miss-*`, `ce-takeover-mismatch-a13`, the host-menu runs): tree reads were kept in variables and only filtered lines were printed (button lines, role counts, line counts, sliced neighbourhoods, attribute objects of single elements, a shallow role skeleton built from `children()`); no cell prints a whole `ax()` result and none calls `observe()`.

### Earlier attempt, kept

### F1 row econ-filter, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

#### Observation

PASS. Over `ce-dialog-a12`: the cells that read trees printed only filtered button lines, role counts, line counts or attribute objects of buttons; no call printed a whole tree and no `observe()` was called (same over `ce-dialog-dialogfirst-a12`, `ce-dialog-open-a12`, `evid-nc-a12`).

#### Earlier attempt, kept

#### F1 row econ-filter

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp)
- Sessions: omp 18.19.0 -p --mode json --no-session; computer.enabled true unless the capture says otherwise
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

##### Observation

Attempt 10, head 220924a05c deployed (deployed skill and rule compared equal with `cmp` at the start and end of the unlocked batch). PASS for `econ-filter`, `econ-window` and `econ-nc`; judged over the captures of attempt 10.

- `econ-filter` (`ce-voiceover-a10`): no call printed a whole tree; the session kept `ax()` in a variable and printed filtered lines (the call failed with `AxFailed`); no `observe()`.
- `econ-window` (`ce-voiceover-a10`): every capture was `screenshot({ silent: true })` on the caption panel window resolved by app; no display or desktop capture.
- `econ-nc` (every capture): no whole-tree print, no `observe()`, no display or desktop capture. `ce-dialog-a10` and `ce-hostmenu-a10` kept trees in variables and printed filtered lines; `evid-nc-a10` printed its two caption-panel screenshots (not `silent`), a window capture of a target, noted in `evid-nc`.
