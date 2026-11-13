# Design

## Context

See proposal.md - Why. Today `showPatch` (`gate-convergence.mjs:219-221`) is `git show --format=fuller --no-renames
--patch <sha>`; `patch` (`:379-398`) writes one read-only file per commit of `revList(base, head)` and a manifest of
`{ base_sha, head_sha, commits[{ sha, subject, patch, sha256 }] }`; `verifyDeltaDir` (`:223-262`) recomputes every
patch with `showPatch` and compares hashes, for `delta` (`:404`) and `accept` (`:436`). The evidence directory is
`EVIDENCE_DIR` in `gate-layout.mjs:20` (`.omp/team-config/evidence`): QA captures, RED/GREEN records, trailers and
gate records below it. Delta directories live under the ignored `.omp/team-config/gate-deltas/`.

## Goals / Non-Goals

Goals: a fix-delta range that carries its evidence fits a reviewer's reading budget; the reviewer still sees every
code, plan and spec hunk, knows which evidence changed and can read any left-out hunk, as of its commit, with the tools
the `plan-reviewer` agent has (`read`, `grep`, `glob`; `packages/coding-agent/src/prompts/agents/plan-reviewer.md:4`;
no shell, so no `git`); the left-out form is fixed by the script, not chosen per dispatch.

Non-goals: changing which commits a range covers, how a verdict decides them, `GC exempt`, the ledger, the gate record
or its validator; leaving out anything outside the evidence directory; a size threshold.

## Decisions

### D-1 Leave out by path, the whole evidence directory

The left-out set is every file under `EVIDENCE_DIR`, whatever its size or kind. Measured on the weaver range of the
proposal: leaving out evidence files above a size threshold still keeps 851 KB at 4 KB, 1.8 MB at 16 KB and 3.4 MB at
64 KB, because a fix round adds thousands of small hierarchy dumps and node lists; leaving out the directory keeps
251 KB. The delta reviewer judges fix rows and the carry reasons of QA rows; the QA evidence itself is judged in the
wave (`review-work` Phase 1 and the wave QA matrix). Gate records and trailers sit in the same directory and are not
fix-delta inputs either.

Alternative rejected: leave out only commits `GC exempt` recorded. The exemption is the orchestrator's own claim, so
the reviewer would lose a commit on that claim alone; the weaver range's 4.8 MB commit mixes code with a logcat and is
not exemptible; and the ledger state at dispatch would become an input of the patch bytes, which `verifyDeltaDir`
would then have to reproduce.

Alternative rejected: a `--leave-out <path>` option. Any path chosen per dispatch can hide code; one fixed directory,
checked again on verification (D-3), cannot.

### D-2 Patch form

A commit that changes no file under `EVIDENCE_DIR` (`git show --numstat --format= <sha> -- ':(top)<EVIDENCE_DIR>/'`
prints nothing) gets exactly today's `showPatch` bytes, so a range without evidence reads as before; this includes
every merge commit, whose combined diff `--numstat` does not list, so merges keep today's combined diff. Any other
commit gets `git show -s --format=fuller <sha>`, a blank line, `git show --format= --no-renames --patch <sha> -- ':(top)'
':(top,exclude)<EVIDENCE_DIR>/'` (empty for an evidence-only commit), and then:

```
Left out by GC patch: the hunks of files under .omp/team-config/evidence/, in <NNN>.evidence.patch beside this patch
<files> files, +<added> -<removed>	<directory>/
```

one line per directory that holds a changed file, sorted by directory, a binary file counted as a file with no lines.
`<NNN>` is the patch's own number, so `045.patch` names `045.evidence.patch`. That evidence file is
`git show --format= --no-renames --patch <sha> -- ':(top)<EVIDENCE_DIR>/'`: every left-out hunk with its `diff --git`
line, as of that commit, so a capture a later commit overwrote or deleted stays readable. The reviewer opens it with
`read` (paged by line range) or searches it with `grep` only when a fix row or carried QA row depends on it; the brief
does not ask for it to be read whole, so it does not count against the reading budget. A binary capture appears there
as git's `Binary files ... differ` line only; its bytes stay out of reach of a text reader, as they are today.
The header comes from its own `git show -s` because `git show` with a pathspec prints nothing at all for a commit
whose diff the pathspec empties (seen on weaver `73abbb05`, an evidence-only commit, and `27b6af20`, a merge); header,
blank line and unfiltered diff are byte-identical to today's single call (checked on weaver `bd88c757`).
A per-file listing was measured at 284 KB for the weaver range (2555 files), more than the code it accompanies; per
directory it is 24 KB. The file names of one directory are the `diff --git` lines of the evidence file, which `grep`
finds.

### D-3 Manifest field and verification

`gate-layout.mjs` exports one value, `LEFT_OUT_DIR`, the `EVIDENCE_DIR` string plus `/`, so `.omp/team-config/evidence/`: the
trailing slash keeps the pathspec to the directory and is the spelling the manifest stores. `patch` writes
`"left_out": LEFT_OUT_DIR` and builds its pathspecs from it; `verifyDeltaDir` compares the manifest's value with the
same constant, so writer and verifier cannot disagree on its spelling. `verifyDeltaDir` recomputes each patch with the
form the manifest names: no `left_out` key gives the full patch (delta directories written before this change, so a
gate in flight can still record a verdict from a dispatch made before the deploy), a value equal to `LEFT_OUT_DIR`
gives the D-2 form, and any other value (`src/`, the directory without its slash, `null`, a number) fails with
`patch artifacts changed since dispatch: manifest.json` before anything is appended. The hash check of every patch is
otherwise unchanged. A commit entry whose patch has a listing also carries `"evidence": "<NNN>.evidence.patch"` and
`"evidence_sha256"`, and `patch` makes that file read-only like the patch. `verifyDeltaDir` recomputes the evidence
bytes of every commit in the new form and refuses, as changed since dispatch, an entry whose evidence file is missing,
differs from the recomputed bytes or from its recorded hash, an entry that names an evidence file for a commit with no
evidence change, and an entry without one for a commit that has any.

### D-4 Brief text

Fix waves step 5a becomes this one line, the rest of the step list unchanged:

   a. `GC patch --base <base> --head <head> --out .omp/team-config/gate-deltas/F2-<first row>-<head12>-<UTC yyyymmddHHMMSS>`. It writes one read-only patch per commit plus a manifest, and prints the manifest path. Each patch leaves out the hunks of files under `.omp/team-config/evidence/`; when its commit changes any, they go to `<NNN>.evidence.patch` beside it and the patch ends with their listing by directory and that file's name.

The fenced delta brief becomes this block; only its last paragraph changes:

```
Review this fix delta. Workspace root: {REPO ROOT}. Plan: {PLAN PATH}.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
{PLAN INVARIANTS}
Fix entries this delta implements, verbatim from the plan's ## TODOs:
{FIX ROWS}
QA rows carried across this range, each with its one-line reason (reject a carry when the diff can change the behaviour that row observed, and name the row):
{CARRIED ROWS}
Commit range {BASE SHA}..{HEAD SHA}, commits {FIX SHAS}.
The diff is one patch file per commit, in commit order, each with its commit header. Hunks of files under .omp/team-config/evidence/ (QA captures, RED and GREEN records, trailers) are left out of the patches: a patch whose commit changes any ends with their listing by directory and the name of its evidence file, which holds those hunks as of that commit. When a fix entry or a carried QA row depends on a capture, read that evidence file, or the part of it you need; you need not read evidence files whole. Read {MANIFEST PATH}, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
```

### Build vs. adopt: path filtering of a commit diff

- Repository: none; `gate-convergence.mjs` uses `git show` only for whole patches (`:219-221`), and no other team-config
  script filters a diff by path (searched `team-config/agent/skills/*/scripts`, `team-config/tests`).
- Platform: https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec (pathspec magic
  `top` and `exclude`) and https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---numstat (`--numstat`).
- Candidates: not searched, covered above.
- Decision: adopt git's `:(top,exclude)` pathspec and `--numstat`; the script only formats the per-directory sum.

## Risks / Trade-offs

- [A QA harness script under the evidence directory changes in a fix round and the reviewer only sees its directory
  line in the patch] → its hunk is in the commit's evidence file, which the listing names; the brief keeps "judge the
  cumulative effect"; the harness's output is judged as a QA row in the wave. Accepted.
- [A reviewer that used to check RED/GREEN figures against captures inline now has to open them] → the listing names
  the evidence file and the brief says when to read it; `read` and `grep` reach it. Accepted.
- [A reviewer skips an evidence file it needed] → the brief ties reading one to a fix entry or carried row that
  depends on a capture; F1 row m4 runs a fresh reviewer on a range where only an evidence file holds the content a fix
  entry cites. Accepted beyond that, as reviewer judgement.
- [Two forms of delta directory coexist during a gate that spans the deploy] → D-3 verifies each by its own manifest;
  covered by a test that writes an old-form directory by hand.

## Migration Plan

Merge, then `scripts/deploy-local.sh`; restart running sessions so they read the new brief. In-flight gates keep their
ledger and delta directories. Rollback: revert the merge and redeploy; a delta directory written in the new form then
fails verification, because the old script ignores `left_out` and recomputes full patches, and its range is
re-dispatched.
