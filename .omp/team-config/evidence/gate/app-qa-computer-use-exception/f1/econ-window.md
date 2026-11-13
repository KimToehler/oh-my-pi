# F1 row econ-window

- Head under test: 220924a05c (skill and rule deployed from 220924a05c; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp)
- Sessions: omp 18.19.0 -p --mode json --no-session; computer.enabled true unless the capture says otherwise
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Observation

Attempt 10, head 220924a05c deployed (deployed skill and rule compared equal with `cmp` at the start and end of the unlocked batch). PASS for `econ-filter`, `econ-window` and `econ-nc`; judged over the captures of attempt 10.

- `econ-filter` (`ce-voiceover-a10`): no call printed a whole tree; the session kept `ax()` in a variable and printed filtered lines (the call failed with `AxFailed`); no `observe()`.
- `econ-window` (`ce-voiceover-a10`): every capture was `screenshot({ silent: true })` on the caption panel window resolved by app; no display or desktop capture.
- `econ-nc` (every capture): no whole-tree print, no `observe()`, no display or desktop capture. `ce-dialog-a10` and `ce-hostmenu-a10` kept trees in variables and printed filtered lines; `evid-nc-a10` printed its two caption-panel screenshots (not `silent`), a window capture of a target, noted in `evid-nc`.
