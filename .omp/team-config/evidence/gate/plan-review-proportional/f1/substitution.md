# F1-I: a dispatch that ran on another model than its pin

Date: 2026-11-01. Deployment as in F1-G (`.../f1/failed-triage.md`): the branch installed into the
disposable profile `prp`, every session run as
`env -u PI_PROFILE -u OMP_PROFILE omp --profile prp` in the fixture repository.

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs`:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

That is `git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`
in this repository.

## Fixture and the substituted pin

`$TMPDIR/prp-fix/repo-f1i`, change `f1i`: the `standard` glossary plan of F1-A (class `none`,
Depth `standard`), with its one planted defect restored — task 1.1 verifies only
`test -f docs/glossary.md` and no task exercises the glossary's content, while the spec's
requirement and its Negative control demand all three definitions.

The substituted model is **`openai/gpt-5.1`**, written into
`~/.omp/profiles/prp/agent/config.yml` under `task.agentModelOverrides`. The profile's
`models.yml` configures only the `onara` and `onara-bifrost` providers, so `openai` has no
credentials there. No credential value was read, written, copied or logged; only the model id was
set, and the file was restored from its backup afterwards.

The parent session of both runs is the ordinary session model of the profile,
`onara/cc/claude-opus-5-5`.

## (a) The reviewer pin points at the uncredentialed model

`task.agentModelOverrides.plan-reviewer: openai/gpt-5.1`, `blocker-verifier` untouched.

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1i/2026-11-01T19-12-05-496Z_01a19886-ad78-71b9-9523-42896adfe1a4`,
435.64 s. Digest `2bb2078b07161f189efddad02004526bcb8c09985c2230a91d921eea6b5fb33c`.

The D10 check, run on each child's own session file:

```
$ jq -r 'select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model' <child>.jsonl | sort -u
SaltyErmine       -> onara/cc/claude-opus-5-5
CompactPrimate    -> onara/cc/claude-opus-5-5     (the retry)
```

Child session files:
`…/2026-11-01T19-12-05-496Z_01a19886-ad78-71b9-9523-42896adfe1a4/SaltyErmine.jsonl` and
`…/CompactPrimate.jsonl`.

Both attempts ran on the **parent session's model**, not on the pin. Both returned OKAY with no
blockers, and **neither verdict counted**. With only one reviewer, no other scope's blockers and
nothing carried, the session wrote **no `review.md`**, made no commit, dispatched no verifier and
stopped:

```
$ git status --porcelain      (empty)
$ git log --oneline -1
7e88986 fixture change f1i (standard) on the current schema
```

Its answer named the pin (`openai/gpt-5.1`), the model each attempt actually ran on
(`onara/cc/claude-opus-5-5`), that neither result counted, and what has to change before the review
can finish.

## (b) The verifier pin points at the uncredentialed model

Reviewer pin restored to `onara/cx/gpt-6.1-sol:high`,
`task.agentModelOverrides.blocker-verifier: openai/gpt-5.1`.

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1i/2026-11-01T19-19-47-943Z_01a1988d-bbe7-7370-9212-f88002e46d54`,
279.57 s. Digest `b1d2262287b59ec39319524bbea27790691ed5322fc9249ebd8f1d635127be71` (the fixture
carries the restored defect, so the digest differs from (a)).

```
$ jq -r 'select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model' <child>.jsonl | sort -u
OldSalmon          -> onara/cx/gpt-6.1-sol        (the reviewer, on its pin)
SpatialTarantula   -> onara/cc/claude-opus-5-5    (verifier, first attempt)
ObviousPheasant    -> onara/cc/claude-opus-5-5    (verifier, retry)
```

Child session files under
`…/2026-11-01T19-19-47-943Z_01a1988d-bbe7-7370-9212-f88002e46d54/`: `OldSalmon.jsonl`,
`SpatialTarantula.jsonl`, `ObviousPheasant.jsonl`.

The reviewer ran on its pin and found the planted defect (CHECK 4: task 1.1 verifies only the
file's existence, so an empty glossary passes every listed check). Both verifier attempts ran on
the parent session's model and **returned "confirmed, blocking" both times** — and both results
were discarded, which is exactly the route the rule has to stop.

Record (commit `9a27e17`):

```
- **Verdict**: REJECT
- **Reviewed digest**: b1d22622…be71
- **Depth**: standard
- **Reviewer**: plan-reviewer, OldSalmon
- **Verifier**: blocker-verifier, ObviousPheasant
- **Models**: OldSalmon onara/cx/gpt-6.1-sol; SpatialTarantula onara/cc/claude-opus-5-5 (no verdict); ObviousPheasant onara/cc/claude-opus-5-5 (no verdict)
- **Round**: 1
- **Awaiting**: triage
```

The `Models` line lists **every dispatch of the round**, with `(no verdict)` on both verifier
attempts and none on the reviewer. The blocker stands verbatim under `## Blockers` ending
`- **Verifier**: not triaged: the verifier failed twice`; Residuals `none`; `--reviewed` exits 1
with `Verdict: REJECT without a user override`. No fix, no ask, no further dispatch.

## What the QA lane judges

- A dispatch whose session file records a model other than its pin yields no result, whatever it
  returned — proven here on a reviewer that returned OKAY and on a verifier that returned
  "confirmed, blocking" twice.
- Two such reviewer attempts leave the round incomplete with no record written at all.
- Two such verifier attempts produce the committed REJECT with Awaiting `triage` and a `Models`
  line that names every dispatch, its model and `(no verdict)`.

## Text basis, and what covers this scenario on the current head

Both runs above are from 2026-11-01 and used the instruction of blob
`f7ad8d3534d80e841900f9d9cb878514945da9d4`. Rows 5.30 and 5.31 changed the text afterwards: a
round's blockers are now committed **before** the verifier is dispatched, and a post-budget Fix is
bounded to one delta check. Neither touches the pin rule this scenario tests (route 11, lines
94-106 and 155-158 of the current instruction, see `.../f1/instruction-review.md`), so the rule is
unchanged — but the record shape in (b) is the pre-5.30 one: today the same run would commit a
pre-triage record first.

That newer shape is witnessed live on the current blob
(`b0f3c2009a7bd3d89e60438b34011efdbdbaff0b`) by three re-run scenarios, all of which hit off-pin
dispatches without anyone planting them:

- `.../f1/failed-triage.md`: two verifier attempts `(no verdict)`, pre-triage record first, then
  `not triaged: the verifier failed twice` on the same digest.
- `.../f1/risky.md` and `.../f1/security.md`: six off-pin reviewer and verifier dispatches
  discarded and retried across the two scenarios, including both delta-check attempts of one
  session, which ended the session instead of recording an uncounted OKAY.
- `.../f1/seeded.md` leg (b): four off-pin verifier attempts across two rounds, each recorded and
  resumable.

## Honest notes

- The substitution is a real fallback: the router has no `openai` credentials in this profile, so
  the child runs on the parent session's model. Nothing in the harness forces the swap; the
  sessions observed it through the D10 jq check the instruction prescribes.
- `~/.omp/profiles/prp/agent/config.yml` was restored from `config.yml.bak` after run (b), so the
  profile carries its ordinary pins again.
- Scenario (3) of F1-H (`.../f1/partial-round.md`) shows the same rule firing **unplanned**, on a
  router fallback mid-dispatch: `FastNightingale onara/cx/gpt-6.1-sol onara/cc/claude-opus-5 (no
  verdict)`.
