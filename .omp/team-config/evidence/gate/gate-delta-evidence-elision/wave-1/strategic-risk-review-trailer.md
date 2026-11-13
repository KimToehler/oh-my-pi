## 1. Architecture and cross-module seams

The design holds together. The important seams are explicit:

- `gate-layout.mjs:20–23` defines the single permitted exclusion directory and its canonical manifest spelling.
- `gate-convergence.mjs:223–248` builds both artifacts together. Source hunks remain mandatory reading; historical evidence hunks remain available beside them.
- `gate-convergence.mjs:263–288` selects the legacy or new form from the manifest, rejects other exclusion values, and verifies both artifacts against Git.
- Both `delta` and `accept` call that verifier before appending their ledger event.
- `SKILL.md:494,512` explains the split and tells reviewers when to retrieve historical evidence.

Keeping the old form when `left_out` is absent is a reasonable deploy boundary. The hand-written legacy-directory test meaningfully checks compatibility rather than relying on the new writer to manufacture an “old” fixture.

No blocker substantiated.

## 2. Consistency, duplication, and simplification

Writer and verifier share `deltaArtifacts`, avoiding independent implementations drifting on patch bytes, numbering, or evidence selection. The independent `elidedFor` test helper is justified: it manufactures a plausible alternative exclusion form to challenge manifest validation. Sharing the production helper there would weaken that control.

**Note N1 — unusual filenames can produce an inaccurate directory listing.** At `gate-convergence.mjs:232`, `entry.trim().split("\t")` takes only the first filename segment after the numstat columns. An evidence directory containing a tab is therefore truncated before `dirname` runs. Preserve the filename by splitting only the two numstat column delimiters; avoid trimming the filename. This does not block: it requires an unusual local filename variant, affects the summary rather than the retained evidence hunks, and is reversible.

Beyond that parsing detail, I see no useful simplification that would justify introducing another abstraction or convention.

## 3. Highest-consequence failure mode

The worst downstream failure would be recording a fix commit as reviewed after silently hiding its source changes.

For ordinary paths, the implementation addresses that risk:

- Exclusion is fixed, not a dispatch option.
- Renames are disabled consistently, so a move across the boundary remains visible as the appropriate deletion and addition.
- Invalid manifest exclusion values fail before recording.
- Evidence contents are recomputed and hashed, not merely trusted because a filename appears in the manifest.
- Unexpected evidence declarations are refused.

The tests exercise real Git repositories and CLI behavior, including unchanged ledger bytes on refusal—not only mocks or prompt text.

A remaining architectural risk is intentional: executable QA helpers placed under the evidence directory become optional reading too. The plan explicitly accepts that trade-off. Artifact integrity proves what was supplied; it does not prove a reviewer recognized every relevant dependency.

## 4. What line-level review would miss

The value is reduced **mandatory reading**, not reduced artifact storage. The captured weaver measurements report 311,695 mandatory bytes versus 10,743,031 previously, while retaining approximately the same total evidence volume.

The behavioral evidence matters more than matching the brief text:

- The retained coverage report records complete reads of all 60 mandatory patches.
- The historical-evidence transcript records reads of `001.evidence.patch` and `003.evidence.patch`; its structured reply retrieves the deleted record’s 7867 ms figure.
- The suite capture records 826 passing tests and zero failures.

These support the intended workflow without proving every future reviewer will choose all necessary evidence. Carrying these rows across the final evidence-and-checkbox-only commit is consistent with the supplied diff.

I reviewed the supplied production/test diff, design and gate criteria, command callsites, selected evidence helpers, regression-failure record, suite output, measurements, and reviewer evidence. I ran no commands and did not independently recompute capture hashes.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Optional evidence remains integrity-bound even when a reviewer does not open it.
  positive_witness: An unchanged mixed-commit directory verifies and records its verdict.
  negative_control: Editing or removing its evidence artifact must refuse recording despite an unchanged mandatory patch.
  observable: Successful recording for the intact directory versus an artifact-change error and byte-unchanged ledger for the altered directory.
  boundary: verifyDeltaDir before delta or accept appends a ledger event.
END-REVIEW-TRAILER