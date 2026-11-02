# F1-G: a failed triage, its resume, and the retry that recovers

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head (row 5.30 changed when a
round's blockers are committed, which this scenario exercises twice). Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into each fixture with `install-openspec-workflow.mjs` and
committed there as `4b9b366`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture, the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head,
committed as `b7cd4fd13a`.)

## Fixture

Change `f1g`, Depth `risky`, digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`, carrying a **current OKAY
`review.md`** on that digest. Two substitutions: the round's two reviewer results come from a
payload file, and the first `blocker-verifier` attempt returns a structurally incomplete result
(one entry for a two-blocker brief). Leg (a) feeds that incomplete payload to **every** verifier
attempt; leg (b) feeds it to the **first** attempt only and dispatches the retry for real.

## (a) The triage fails twice, then a later session resumes it

Fixture `$TMPDIR/prp-fix/repo-f1g3`. Sessions under
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1g3/`.

**Session 1** (`2026-11-02T06-41-14-526Z_01a19afd-9d1e-7471-b602-7175c5c71f1c`, 17 calls, 68 s), in
order: `bash openspec instructions review --change f1g --json` ×2; `read` of the delivered
instruction in two halves and of the record template; `bash ls openspec/changes/f1g && git status
--porcelain && git log`; `bash cat gate.md && cat <payload>`; `bash git status --porcelain --
openspec/changes/f1g; omp config get task.agentModelOverrides`; `grep` the profile's `agents/`
directory for the verifier pin; `bash V openspec/changes/f1g` (validator) and `V --digest`;
`read history://SeedG1ScopeA`; `glob openspec/changes/*/review.md`;
**`write review.md`**; `bash git add -- review.md && git commit` (`02fbb36`); two `edit` calls
adding the `Models` bullet and the second blocker's fields; `bash git add && git commit`
(`e098e70`).

- `02fbb36` **before any verifier attempt**: Verdict REJECT, Round 1, Awaiting `triage`, Verifier
  `none`, both findings verbatim, each marked
  `- **Verifier**: not triaged: the verifier has not returned` (two occurrences).
- Both attempts (`SeedG1Verify1`, `SeedG1Verify2`) returned a result missing an index.
- `e098e70` on the same digest: Verifier still `none`, Models lists both attempts as
  `(no verdict)`, both findings carry `not triaged: the verifier failed twice` (two occurrences).
- `--reviewed` fails:
  `review.md Verdict: REJECT without a user override; fix the blockers and re-run the review, or ask the user`,
  exit 1.

**Session 2** (`2026-11-02T06-42-30-157Z_01a19afe-c48d-7222-be6f-4c9b1b7bc49b`, 21 calls, 140 s),
resumed with a plain instruction, in order: `read skill://openspec`; `bash openspec instructions
review` ×2; `read` of the instruction in two halves plus two ranges and of the template;
`bash ls && git log && git status`; `bash V --digest`; `bash omp config get
task.agentModelOverrides; omp config path`; `read agent://SeedG1ScopeA`;
`bash sed -n '1,15p' blocker-verifier.md` (the pin); **`task F1gTriage1`**; `wait`;
`read history://F1gTriage1`; `bash jq … provider + model` (the D10 check);
`bash sed -n '28,36p' spec.md`; **`write review.md`**; `bash V --reviewed`;
`write xd://report_issue`.

- Exactly **one** `task` call, and it is the verifier: no reviewer is dispatched on a resume.
- Both findings refuted. `d2f44f2`: Verdict **OKAY**, Round 1, Awaiting `none`, both findings under
  `## Residuals`, the two failed attempts still `(no verdict)` in Models.
  `--reviewed` printed `reviewed: OKAY in round 1`, exit 0.

## (b) Retry recovery inside the same round

Fixture `$TMPDIR/prp-fix/repo-f1g3c`, session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1g3c/2026-11-02T07-39-47-779Z_01a19b33-38c3-76a3-88c8-fc9c2e130d1a`
(29 calls, 178 s), in order: `bash openspec instructions review` ×2; `read` of the instruction in
four ranges and of the template; `write xd://report_issue`; `bash ls && git status && git log`;
`read gate.md`; `bash git status --porcelain -- openspec/changes/f1g`; `bash cat <payload>`;
`bash omp config get task.agentModelOverrides; omp config path`; `grep` the profile's `agents/`;
`read history://SeedG1ScopeA`; two `grep` calls on `validate-openspec-change.mjs`;
**`write review.md`**; `bash git log -3 --format=%s`; `bash git add && git commit` (`97df342`);
**`task blocker-verifier`** (the retry, dispatched for real); `wait`; `read history://AwareGecko`;
`bash jq … provider + model`; `read spec.md:28-36`; `read tasks.md`; **`write review.md`**;
`bash git add && git commit` (`2e6210c`).

- `97df342` is again the pre-dispatch record (REJECT, Awaiting `triage`, both findings untriaged).
- The retry `AwareGecko` ran on the pin and refuted both findings.
- `2e6210c`: Verdict **OKAY**, Round 1, **`Verifier: blocker-verifier, AwareGecko`** — the record
  names the retry, not the failed first attempt, which stays in Models as
  `SeedG1Verify1 onara/cx/gpt-6.1-sol (no verdict)`. `--reviewed` printed `reviewed: OKAY in round
  1`, exit 0.

## Honest note

A first attempt at leg (b) (`repo-f1g3b`, 1122 s) ended with both attempts uncounted: the real
retry `RelevantWhale` left the pinned model mid-run
(`RelevantWhale onara/cx/gpt-6.1-sol onara/cc/claude-opus-5 (no verdict)`), so that run witnessed
the twice-failed branch again instead of recovery. It is left in place; the leg was re-run on a
fresh copy of the same fixture, and `repo-f1g3c` above is the counted run.

## What these runs show

- An incomplete verifier result is never read as a refutation: it gets one fresh retry, and a
  successful retry's id becomes the record's Verifier while the failed attempt stays visible.
- A twice-failed triage is a committed, resumable state that blocks apply; the session stops rather
  than guessing a verdict.
- The resume triages exactly the untriaged findings and dispatches no reviewer.
