# F1 inspection — publication of the sanitized result (task 3.1)

Published directory: `.omp/team-config/evidence/gate/plan-review-loop-measurement/experiment/`.

```
$ ls -1
RESULT.md
dataset.json
input-manifest.json
protocol.md
report.md
scoring-contract.md
summary.json
```

## Task status: complete under its own criterion

Task 3.1 requires completion of the 20 intended reviewer cells. All 20 ran on their intended pin (S 15/15, T 5/5) after the authorised resume wave (`f1/replays.md`), and every one is followed by a verifier pass. No number in `RESULT.md` rests on a partial arm.

## Sanitization applied

`protocol.md:46` governs publication: generic mechanism descriptions, relative evidence coordinates, normalized numeric rows, source digests and counts; no private code, no complete historical claims.

Of the five plan items, `Spt` (strength-progression-targets) and `Fmp` (finish-modality-program-route) come from a private repository; `Smt`, `App` and `Rtr` are plans of this repository.

| field | public items (Smt/App/Rtr) | private items (Spt/Fmp) |
|---|---|---|
| finding `description` | replaced by `Fresh finding <id> (item <code>); claim text retained locally.` | same |
| adjudication / triage / target `reason` | kept, absolute paths rewritten to repository-relative | replaced by `… retained locally; private-repository claim text is not published.` |
| `evidence` coordinates | kept as repository-relative `path:line` | replaced by `private-repository-coordinate:<n>`, preserving the count |
| historical finding text | already placeholders; never extracted | same |
| `sources[]` | digest, id and provenance kept; `path` nulled, `provided` false | same |

Fresh claim text is withheld for every item, not only the private ones: it is reviewer prose about unmerged plans and adds nothing the mechanism labels and numeric rows do not carry.

## Leak scan of every staged file

```
$ grep -c -E "backend_kt|nutritrain|/Users/|sk-|ghp_|api[_-]?key" dataset.json input-manifest.json summary.json RESULT.md report.md protocol.md scoring-contract.md
dataset.json:2
input-manifest.json:0
summary.json:0
RESULT.md:0
report.md:0
protocol.md:0
scoring-contract.md:0
```

The two `dataset.json` hits are substring false positives of the `sk-` secret pattern:

```
$ grep -o -E "backend_kt|nutritrain|/Users/|sk-[A-Za-z-]{0,12}|ghp_|api[_-]?key" dataset.json | sort | uniq -c
      1 sk-child
      1 sk-review
```

(`task-child`, `risk-review`.) No private repository path, no home-directory path, no credential pattern survives in any published file. The remaining occurrences of `onara` are model-routing identifiers such as `onara/cx/gpt-6.1-sol`, which are provider pins, not private code.

## Committed-format reproduction without local raw sessions

The published dataset carries digests but no input bytes, so `report` is the reproduction surface and `check` stays with the local run directory. Run from the published directory:

```
$ bun scripts/score-plan-review-replay.ts report dataset.json --format json | cmp - summary.json
cmp ok
```

(`cmp` printed nothing and exited 0; `cmp ok` is the shell's confirmation.) The Markdown rendering of the same dataset is published as `report.md`; its arm table is identical to the local run's, for example `S | 15/15 | … | 12.67/85 = 14.9% | 12.33/85 = 14.5% | … | 0/36 = 0.0% | 7/75 = 9.3%`.

## Content coverage

`RESULT.md` carries: all 20 intended cells on their intended pin, the current ledger denominators (85 targets; 24 blocking, 60 below threshold, 1 unresolved) with the 83/85 round-2 repeat agreement, the historical reference denominators, the empty round-record set with `measuredRoundsSaved: not-measured`, stage costs (reviewer 47.26, verifier 4.08, adjudicator 19.90, unsuccessful 31.97, total 71.25 USD), the 19,466,782 ms wall envelope with the note that concurrent stage times are not wall time, and the design D6 limitations (no causal claim, no model ranking, loop shape unmeasured, historical arms reference only, target ledger a lower bound, adjudication a model judgment).
