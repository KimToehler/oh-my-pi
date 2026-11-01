# F1-A: a `standard` review end to end

Date: 2026-11-01, re-run for row 4.11 on the delivered text of this head (the earlier runs of this
file are superseded; rows 2.4-2.6 changed the instruction, the template and the validator tests
they observed).

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs` and
committed there as `f25e354`:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`.)

## Deployment deviation from the task text (and why)

The task prescribed `PI_CODING_AGENT_DIR=$TMPDIR/prp-agent`. That variable does not redirect
**subagent discovery**: `getConfigDirs` builds its user-level roots from
`path.join(os.homedir(), getConfigAgentDirName())`
(`packages/coding-agent/src/config.ts:84-88`), so a session started with the variable still looked
only in `~/.omp/agent/agents` and failed with
`Unknown agent "blocker-verifier". … Searched: ~/.omp/agent/agents`.

`getConfigAgentDirName()` is profile-aware (`packages/utils/src/dirs.ts:334-337`), so every run
uses a disposable **profile** instead: the branch installed with
`PI_CODING_AGENT_DIR=$HOME/.omp/profiles/prp/agent bun scripts/install-team-config.ts`, and every
session run as `env -u PI_PROFILE -u OMP_PROFILE omp --profile prp`. That agent directory is
disposable and separate from the user's own; `~/.omp/agent` was never written to.

## Fixture

`$TMPDIR/prp-fix/repo-f1a`, change `f1a`, class `none`, Depth `standard` in `gate.md`: add
`docs/glossary.md` defining `entry`, `day total` and `minutes`, linked from `README.md`. Digest
`b1d2262287b59ec39319524bbea27790691ed5322fc9249ebd8f1d635127be71`.

One defect is planted and nothing else: task 1.1's Verify is `test -f docs/glossary.md`, which
passes for an empty file, and task 2.1's manual QA only follows the README link. The spec's
requirement and its Negative control demand all three definitions.

## Run 1 — the reviewer finds the planted defect, the triage fails twice

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1a/…T19-26…`, 2140 s.

- Depth `standard` read from `gate.md`; one reviewer, `EldestQuokka`, **on its pin**
  `onara/cx/gpt-6.1-sol`: REJECT with one blocker, CHECK 4, exactly the planted gap.
- Verifier attempt `VagueGull`: 8 turns on the pin, 2 on `onara/cc/claude-opus-5`.
- Retry `PriorTrout`: 10 turns on the pin, 1 on `onara/cc/claude-opus-5`.

Both said "confirmed, blocking", and **neither counted** — the D10 rule of row 2.4. Record
committed as `2fdae29` before any edit:

```
- **Verdict**: REJECT
- **Depth**: standard
- **Reviewer**: plan-reviewer, EldestQuokka
- **Verifier**: blocker-verifier, PriorTrout
- **Models**: EldestQuokka onara/cx/gpt-6.1-sol; VagueGull … onara/cc/claude-opus-5 (no verdict); PriorTrout … onara/cc/claude-opus-5 (no verdict)
- **Round**: 1
- **Awaiting**: triage
```

The blocker stands verbatim under `## Blockers` with `not triaged: the verifier failed twice`;
`--reviewed` exits 1. No fix, no ask, no further dispatch.

## Run 2 — the resume triages it, and the verifier refutes it

Session `…T19-5…`, 1093 s. No reviewer dispatched, no finding added; the recorded finding went to
a fresh verifier.

- `FragileLlama`: again partly on `onara/cc/claude-opus-5` — `(no verdict)`, one retry.
- `EnergeticMole`: only on the pin, exactly one result for finding 1 — **refuted**, not blocking,
  not protected. Its reason: task F2 (`tasks.md:14-15`) runs review-work's real-surface QA against
  every success criterion, and an empty glossary would fail there.

Record `aadc8e2`: Verdict OKAY, same digest, Depth `standard`, Round 1, Awaiting `none`, Blockers
none, the finding under `## Residuals` with the verifier's reason, and a `Models` line naming all
five dispatches of the round with `(no verdict)` on the three off-pin ones. `--reviewed` printed
`reviewed: OKAY in round 1`.

## What this run does and does not show

Shown: depth read from `gate.md`; the reviewer on its pin; the record written and committed
**before** any artifact edit; a refuted finding under `## Residuals` with its reason; **no ask**,
because nothing was confirmed; and the model rule firing four times on a real router fallback.

**Not shown here: the fix and the delta check.** The verifier refuted the planted finding, so the
review ended in round 1 with nothing to fix. The fixture was left as it is rather than re-cut until
a model confirms — tuning a fixture to the answer would make the evidence worthless. The
`standard` fix path (REJECT → fix → one delta check → the budget's end) is covered on the same
delivered text by **F1-C** (`.../f1/security.md`): round 1 REJECT with four confirmed blockers,
fixes in the change folder only, one delta check as round 2, and then the exhaustion ask.

## Honest notes

- Three of the five dispatches of this round left their pinned model mid-run. That is the router's
  own fallback, not a planted substitution, and it is why the review needed two sessions. The rule
  behaved exactly as row 2.4 specifies — and it also shows the rule's cost: an unlucky fallback
  burns a dispatch.
- The reviewer's original output was no longer addressable in the second session, so the finding
  was copied to the verifier from the verbatim copy in the committed record, as the instruction's
  resume rule prescribes.
