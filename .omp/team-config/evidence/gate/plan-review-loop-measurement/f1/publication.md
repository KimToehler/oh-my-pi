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

Since F2 wave 5 the published dataset is **derived** from the local one by a committed, tested command, so the rules below are executable rather than narrated:

```
bun scripts/score-plan-review-replay.ts publish <run-dir> \
  --private strength-progression-targets,finish-modality-program-route > experiment/dataset.json
```

The rules are field-wise, never item-wise: a value is withheld because it carries private repository content, not because its item is private.

| field | public items (Smt/App/Rtr) | private items (Spt/Fmp) |
|---|---|---|
| fresh finding `description` | published as reviewed | replaced by `Fresh finding <id> (item <code>); claim text retained locally.` |
| adjudication / triage / target `reason` | kept, local paths redacted | replaced by `… retained locally; private-repository claim text is not published.`, except an `annotated` adjudication, whose rationale is the historical-annotation template and quotes nothing |
| `evidence` coordinates | kept as repository-relative `path:line` | the item's own `openspec/changes/<item>/…` coordinates and the experiment's own `annotation:`/`trial:`/`finding:` references are kept; a private source path becomes `private-source:<ext>#<sha256-8>:<lines>` |
| historical finding text | already placeholders; never extracted | same |
| `sources[]` | digest, id and provenance kept; `path` nulled, `provided` false | same |

The coordinate pseudonym is a digest of the file path: two distinct private files differ, the same file repeats identically across rows, and the line range survives, so a reader can count and align the evidence of a private-item judgment without learning a private file name. A coordinate in a different OpenSpec change than the item's own is pseudonymized too. Fresh private claim text and fresh private adjudication prose stay withheld, because they quote private implementation identifiers; the per-row `mechanism` label carries the published identity of each judgment.

## Leak scan of every staged file

The first scan covered the seven `experiment/` artifacts only. F2 wave 2 widened it to every file of this evidence directory — `experiment/`, `f1/`, the stored reviewer trailers in `f2/` and the QA captures in `wave-1/` and `wave-2/` — and that pass found one local path in `f1/adjudication.md` (a `sed` command quoting the snapshot worktree), which is now written as `<local snapshot worktree>/…`. The current state, run from the evidence directory:

```
$ grep -rn -E "backend_kt|nutritrain|ghp_|api[_-]?key|/Users/[a-z]+/" . | grep -v -E "grep -c|grep -o|grep -rn|grep -r "
(no output)
$ grep -ro -E "sk-[A-Za-z-]{0,12}" . | sort | uniq -c
      1 ./experiment/dataset.json:sk-child
      1 ./experiment/dataset.json:sk-review
      1 ./f1/inputs.md:sk-owned
      3 ./f1/publication.md:sk-
      3 ./f1/publication.md:sk-child
      2 ./f1/publication.md:sk-owned
      3 ./f1/publication.md:sk-review
      2 ./wave-1/qa5-publication-leak-scan.txt:sk-
      1 ./wave-1/qa5-publication-leak-scan.txt:sk-child
      1 ./wave-1/qa5-publication-leak-scan.txt:sk-review
      1 ./wave-2/qa5-publication-leak-scan.txt:sk-
      1 ./wave-2/qa5-publication-leak-scan.txt:sk-child
      1 ./wave-2/qa5-publication-leak-scan.txt:sk-review
```

The first grep excludes the lines that quote the scan commands themselves; every `sk-` hit is a substring false positive of the secret pattern: `task-child`, `risk-review`, `task-owned`, plus this file and the QA captures quoting the pattern. No private repository path, no home-directory path, no credential pattern survives in any published file. The remaining occurrences of `onara` are model-routing identifiers such as `onara/cx/gpt-6.1-sol`, which are provider pins, not private code.

## Committed-format reproduction without local raw sessions

The published dataset carries digests but no input bytes, so `report` is the reproduction surface and `check` stays with the local run directory. Run from the published directory:

```
$ cd <repo>/.omp/team-config/evidence/gate/plan-review-loop-measurement/experiment
$ bun <repo>/scripts/score-plan-review-replay.ts report dataset.json --format json | cmp - summary.json
cmp ok
```

(`cmp` printed nothing and exited 0; `cmp ok` is the shell's confirmation. `<repo>` is the repository root; the scorer path is the only one that is not relative to this directory.) The Markdown rendering of the same dataset is published as `report.md`; its arm table is identical to the local run's, for example `S | 15/15 | … | 12.67/85 = 14.9% | 12/85 = 14.1% | … | 0/36 = 0.0% | 7/75 = 9.3%`.

## Content coverage

`RESULT.md` carries: all 20 intended cells on their intended pin, the current ledger denominators (85 targets; 24 blocking, 60 below threshold, 1 unresolved) with the 83/85 round-2 repeat agreement now derived by the scorer from published `targetRepeats` rows, the historical reference denominators without a precision figure (their rows are `annotated`, never adjudicated), the five recorded last rounds with pinned revisions alongside `measuredRoundsSaved: not-measured`, stage costs (reviewer 47.26, verifier 4.08, adjudicator 19.90, unsuccessful 31.97, total 71.25 USD), the 19,466,782 ms wall envelope with the note that concurrent stage times are not wall time, the post-freeze amendments to the scorer, and the design D6 limitations (no causal claim, no model ranking, loop shape unmeasured, historical arms reference only, target ledger a lower bound, adjudication a model judgment).
