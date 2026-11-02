# F1-A: a `standard` review end to end

Date: 2026-11-01, re-run for row 5.32 on the delivered text of this head (the row 4.11 run of this
file is superseded; it ended with the planted finding refuted, so it was no witness for the
`standard` happy path, and rows 5.30-5.31 changed the instruction again afterwards).

**Required witness: present** — run C below: one planted defect confirmed, fixed in the artifacts,
one fix-delta check, `review.md` OKAY, no ask, `--reviewed` exit 0.

Schema the sessions ran on, installed into each fixture with `install-openspec-workflow.mjs`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture; the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head.)

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
session run as `env -u PI_PROFILE -u OMP_PROFILE omp --profile prp -p "<the prompt below>"`.
`~/.omp/agent` was never written to.

Prompt, identical for both runs apart from the change name (`$TMPDIR/prp-fix/f1a3-plain-prompt.md`):

```
Run the OpenSpec review for the change `f1a3` in this repository. Start with
`DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec instructions review --change f1a3 --json`, then
follow the returned instruction exactly and completely. Everything runs for real: the validator,
the digest, `git`, every dispatch, the commits, the record and `--reviewed`.

If the instruction tells you to ask me a question, print the question and its options verbatim and
stop; never answer it yourself. Implement nothing from the plan. Edit no file outside the change
folder.
```

## Run B — the fixture with a second, unplanted defect (`repo-f1a2`, change `f1a2`)

The first fixture promised a CLI flag (`--since`) in a repository that has no CLI. The reviewer
found that as well as the planted gap, so the round ended at a **scope ask** rather than at the
required fix. It is kept because it is the live witness for row 5.30:

- Reviewer `DecentHorse`, on its pin `onara/cx/gpt-6.1-sol`, REJECT with two findings.
- `f9a1c15` **before the verifier was dispatched**: Verdict REJECT, `- **Verifier**:
  blocker-verifier, none`, Awaiting `triage`, both findings verbatim under `## Blockers`. This is
  the record the old text did not write.
- `f15c9b2` after the triage: same digest, verifier `ExcessGuineafowl` on its pin, finding 1
  confirmed blocking, finding 2 refuted and moved to `## Residuals`, Awaiting `scope`.
- The session printed the scope ask (CHECK 6, CLI parity) with its two named alternatives and
  Stop, edited nothing and stopped. Wall time 1193 s.

The fixture was re-cut rather than answered, because the ask came from a fixture defect, not from
the planted one.

## Run C — the required witness (`repo-f1a3`, change `f1a3`)

Fixture: `standard`, class `none`, one optional cutoff parameter for `totalsByDay`. **One defect
is planted and nothing else**: task 1.1 is verified by `bun run format` (a Prettier check that
passes however the cutoff behaves — it passes on the unchanged repository, checked before the run),
task 1.2 greps the README, and the F1 row records only that a call returns a Map without throwing.
No check in the plan can fail when the cutoff is ignored, which is exactly what the spec's Negative
control demands.

Round 1, digest `4a388f6beb49d9a0aa00513aaa2b2e7879a24d4494731939e6ded6dcb2adee6b`:

- `d68c668` **before the verifier was dispatched**: REJECT, `Verifier: blocker-verifier, none`,
  Awaiting `triage`, both findings verbatim.
- Verifier `EagerSkunk`, on its pin: **both findings confirmed, blocking, not protected**. Finding
  2 is the planted one, in the verifier's words: "tasks.md:5 verifies implementation only with
  `bun run format`, which package.json:5 defines as a Prettier check".
- `5c44d1c` the triage record: same digest, Awaiting `none`, no ask — both findings are confirmed
  and the budget has a fix left.
- `cfa573b` the fixes, in the change folder only: task 1.1 gains exact-total tests and runs them,
  and the spec, proposal and design say the cutoff applies on top of the existing negative-minute
  skip.
- Round 2, the fix-delta check on the new digest
  `98c3d5fd68e0e70460f3b8a7d38083f3c0484b9d30f370ebeafbb382efa0d2e6`: one fresh `plan-reviewer`
  (`FreshPigeon`), on its pin, **OKAY with no blockers**. Record `a1d457f`: Verdict OKAY, Round 2,
  Awaiting `none`, Blockers none.
- `--reviewed openspec/changes/f1a3` printed `reviewed: OKAY in round 2`, exit 0.

Wall time 1819 s, one session, no ask at any point.

### Retained session and tool-call order (run C)

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1a3/2026-11-01T22-27-29-149Z_01a19939-90fd-709a-832c-696d68fbc65c`,
61 calls. The ordering that matters, with the call numbers of that session:

```
 1 read skill://openspec
 2-6 openspec instructions review --change f1a3 --json; read the instruction and the template
 7-9 ls change folder; git status --porcelain; validator; V --digest
10 task: plan-reviewer                      <- round 1, one reviewer (depth standard)
11 wait / 12 read history://GlamorousPig
13-14 jq provider+model on the child session  (off-pin -> discarded)
15 task: plan-reviewer                      <- retry (EthicalConstrictor)
16-18 wait; read history://EthicalConstrictor:1-3; jq provider+model  (on the pin)
19-20 grep the profile's agents/ for the verifier pin; jq .blockers from the child session
21-27 eval: build and write review.md from the delivered payload verbatim
28 bash git add review.md && git commit            <- PRE-TRIAGE RECORD (d68c668)
29-30 eval: build the verifier brief; dispatch blocker-verifier
31-36 wait; jq provider+model (first attempt off-pin, discarded); retry; jq again (EagerSkunk, on pin)
37 eval: write the triaged review.md / 38 git commit                (5c44d1c)
39-46 read proposal, spec, design, tasks, src/day-list.ts, test, package.json; grep the schema
47-53 edit: the fixes, change folder only
54-55 validator; git add -- <change folder files> && git commit      (cfa573b)
56 bash git diff <recording commit> -- openspec/changes/f1a3 ':!…/review.md'   <- delta base
57-59 eval: dispatch the delta reviewer; wait; jq provider+model (FreshPigeon, on pin)
60 write review.md / 61 git add && git commit                        (a1d457f)
```

Every edit (47-53) comes after the pre-triage record at 28 and the triage record at 38; the delta
diff at 56 is taken against the commit that recorded round 1, not against the branch point.

## What these runs show

- Depth `standard` read from `gate.md`; one reviewer per round; every counted dispatch on its pin.
- The round's rejection is committed **before** the verifier is dispatched (row 5.30), and the
  post-triage record replaces it on the same digest.
- A confirmed blocking finding is fixed inside the budget without asking, the delta check runs on
  the new digest, and the review ends OKAY in round 2 with `--reviewed` exit 0.
- A refuted finding becomes a residual (run B, finding 2).

## Honest notes

- Two of the five dispatches of run C left their pinned model mid-run (`GlamorousPig`,
  `RespectiveReptile`) and were discarded with `(no verdict)`, as row 2.4 requires. The `Models`
  line of the round records all of them. That is the router's own fallback, not a planted
  substitution, and it is the rule's running cost: an unlucky fallback burns a dispatch.
- The delta reviewer of run C also noted that the new capability's spec has no `## Purpose`
  section; the session recorded it and did not act on it, because the budget was spent and the
  finding was not blocking.
- The instruction's delta patch (`.omp/team-config/gate-deltas/f1a3-round1.patch`) is the only file
  the session wrote outside the change folder, as the instruction prescribes.
