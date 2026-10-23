Bottom line: The migration is coherent across the validator, stop hook, convergence state, installer, ignore policy, and shipped guidance, but the new whole-diff-report exemption has one architectural trust-boundary flaw. Because record locations remain unrestricted, “inside the record directory” does not ensure that an exempt report is evidence-only; a root-level record makes that condition cover the entire repository.

Blocker B1: class: `build-visible-report-admitted-as-post-review-evidence`; trigger: a repository stores its gate record at the root or beneath a build-consumed tree—both permitted by the documented “any tracked path” contract—and commits a new marked `.md` report after `reviewed_sha`; preconditions: the report has the marker, matching digest, and is beneath the unconstrained record directory; impact: `reportMayBePinned` admits the file and `commitsTouchOnlyEvidence` exempts it, allowing a documentation page, generated-site input, or other Markdown consumer input to change outside the reviewed diff while the gate validates; this breaks the gate’s core claim that only non-behavioural evidence changed after review; damage is reversible by reverting the evidence commit. Sites: `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs` symbols `reportMayBePinned`, `validateRecord`, and `commitsTouchOnlyEvidence`; the unrestricted-location contract is stated in `team-config/README.md` and `team-config/agent/skills/review-work/SKILL.md`. Single instance: the validator centralizes whole-diff-report admission in `reportMayBePinned`, with one admission call from `validateRecord` and one exemption consumer in `commitsTouchOnlyEvidence`; repository search was prohibited by the brief.

1. **Architecture:** Apart from B1, the change holds together architecturally. The independent schema constant in `extensions/lib/gate-record.ts` preserves stop-hook load isolation, while `scripts/gate-layout.mjs` centralizes script-side state paths; the migration is consistently reflected in the installer, convergence tool, rules, templates, and documentation.

2. **What the line-level audit misses:** It verifies each local predicate—extension, marker, digest, novelty, and directory containment—but not the composition of those predicates with the unrestricted record-location contract. Containment beneath an arbitrary directory is not a semantic guarantee that the file is inert evidence; for a root record it supplies no meaningful restriction at all.

3. **Most harmful production failure:** The highest-impact remaining failure is a post-review file being classified as evidence while also serving as build or published-content input. The byte-integrity and rename protections do not address this because the file can be genuinely new, correctly staged, digest-matched, and marker-bearing; the failure is semantic rather than a path or byte forgery.

4. **Auditor false positives:** None. The implementation audit reported no findings to classify. Its positive assessment of raw-byte equality, retired-record refusal, and rename handling is consistent with the supplied implementation.

Note N1: Raw working-tree/index equality intentionally rejects normal `core.autocrlf` normalization and custom clean filters; this does not block because D12 and its regression test explicitly require those bytes to be rejected, but supported platforms should be told to keep gate artifacts byte-stable.

Note N2: `RECORD_SCHEMA` is deliberately duplicated between the stop hook and script layer; this is not a current defect because both copies are v3 and the separation prevents a skill import failure from opening the stop hook, though a parity assertion would reduce future drift risk.

## Action plan

1. Change report admission so a post-review-exempt report must reside beneath the dedicated `.omp/team-config/evidence/gate/` boundary, independent of where the record itself is stored.
2. Preserve the existing contract that the record may live at any tracked repository path; only the report’s exemption boundary needs tightening.
3. Add a negative regression with a root or `docs/` record and a new marker-bearing `docs/**/*.md` report; validation must produce a `reviewed_sha` finding.
4. Add a positive regression where that non-default record refers to a report beneath `.omp/team-config/evidence/gate/`, proving arbitrary record locations still work.
5. Update `review-work/SKILL.md`, `integration-review/SKILL.md`, the OpenSpec schema/template, and the README so the fixed report boundary is unambiguous.

Effort: Short (1–4h).

Confidence: medium — the defect follows directly from the supplied validator and guidance, but the brief prohibited whole-tree searches and runtime verification.

Watch out for:
- Do not solve this by restricting record locations; that would regress the explicitly supported repository convention.
- Extension, marker, and digest checks prove identity, not that a path is non-behavioural.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A file exempted as post-review whole-diff evidence cannot also occupy a repository path intended for build, runtime, or published-content inputs.
  positive_witness: A record at a repository-specific tracked path refers to a marked report under `.omp/team-config/evidence/gate/`; committing only the record, trailers, and that report after `reviewed_sha` validates.
  negative_control: A root-level or `docs/` record refers to a new marker-bearing `docs/new-page.md`; the post-review commit MUST fail with a `reviewed_sha` finding even when its digest and staged bytes match.
  observable: Validator exit status and the presence or absence of a `reviewed_sha` finding for otherwise byte-identical reports at the two locations.
  boundary: The validator’s report-admission and post-review exemption boundary between `reportMayBePinned` and `commitsTouchOnlyEvidence`.
END-REVIEW-TRAILER
