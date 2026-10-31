# Design

## Context

`skills/release-notes/SKILL.md` is model-read instruction text: frontmatter (`name`, `description`), a `# Release notes` heading, then four numbered steps (list merged PRs, one bullet per user-visible change, breaking changes first under `### Breaking`, leave out internal changes). Nothing in the skill mentions packages today. Motivation: see proposal.md - Why. Requirements: see `specs/release-notes/spec.md`.

The user fixed the exact sentence and delegated every other decision to the author ("decide yourself"); the decisions below were taken by the author of this change on that delegation and need no further user sign-off before implementation.

## Goals / Non-Goals

**Goals:**
- Ship the sentence verbatim, once, in a position an agent reads before it starts writing bullets.
- Keep the diff to that one paragraph so the delivered-text check is a byte comparison.

**Non-Goals:**
- Defining "package" inside the skill, or adding examples or a heading format for package groups.
- Changing how breaking changes are placed (step 3) or any other existing step.
- Back-filling specs for the existing steps 1-4.

## Decisions

1. **Placement: own paragraph between `# Release notes` and step 1.** The sentence says "before listing changes", so it belongs ahead of the steps that list them; as a preamble it frames all four steps.
   - Alternative: a new step 2, renumbering steps 2-4. Rejected: it rewrites three existing lines for no behavioural gain and breaks the "other lines unchanged" byte check.
   - Alternative: append after step 4. Rejected: an agent reading top-down has already been told to write a flat bullet list before meeting it.
   - Alternative: add it to the frontmatter `description`. Rejected: that text drives skill discovery, not drafting, and the user asked for a sentence in the skill.
2. **Sentence verbatim, no definition of "package".** The user gave the exact text; adding a definition widens the change beyond the request. The spec defines conformance as grouping by the repository's own unit (workspace package, module or top-level component), which an agent can read from the repository it drafts for.
3. **Breaking-change placement is not decided here.** Step 3 stays byte-identical. Whether a draft puts `### Breaking` before the package groups or splits breaking changes per package is outside this change; `gate.md` lists it as out of scope for blocking.
4. **Verification split.** Delivered text: deterministic checks (`grep -cxF` for exactly one exact line; `diff` of the file with the inserted paragraph removed against the base revision). Drafting behaviour: fresh ordinary agent sessions that follow the skill on a disposable two-package git fixture, with the session transcript and drafted notes kept as evidence and judged directly. No script infers or re-scores model output.
5. **Scope check.** One file in one subsystem (the release-notes skill); no split needed.

## Risks / Trade-offs

- [An agent groups by directory or by PR label instead of by the repository's package unit] → The QA fixture uses an unambiguous workspace layout (`packages/<name>/`) so a wrong grouping is visible; ambiguous layouts are accepted residual risk.
- [Agent drops the `### Breaking` section in favour of per-package groups] → Out of scope for blocking (Decision 3); the QA run notes the observed placement so a follow-up can decide it.
- [Single-package or package-less repositories] → The spec does not constrain them; QA names them as unexercised rather than passed.

## Migration Plan

Developers receive the skill on their next team-skill sync; no state migrates. Rollback: revert the commit that inserts the paragraph.
