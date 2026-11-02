The Negative control forbids reasons for `design.md` that omit covered mechanisms, so that a single-module checksum change skips `design.md`.

The `design.md` list reads: "When to include design.md (create only if any apply):", followed by four bullets. The bullets are:
- "Cross-cutting change (multiple services/modules) or new architectural pattern"
- "New external dependency or significant data model changes"
- "Security, performance, or migration complexity"
- "Ambiguity that benefits from technical decisions before coding"

None of these four bullets lists introducing a covered mechanism. The opening line says "create only if any apply", which makes the list exclusive. A single-module CRC-32 checksum change could fail all four bullets. It adds no external dependency if built, and it is not cross-cutting. Security, performance and migration complexity are not clearly present. Ambiguity is not clearly present either. Under the exclusive list the planner would skip `design.md`, which is exactly the forbidden behaviour.

The Build vs. adopt paragraph does not close this gap. It says what a covered mechanism is and what to record "under Decisions". It never says that introducing one is a reason to create `design.md`. The sentence "Record one subsection per covered mechanism under Decisions" presupposes that `design.md` exists. It does not require creating it.

The sentences that permit the forbidden behaviour are therefore:

1. "When to include design.md (create only if any apply):". Because of "only", the list is exhaustive.
2. The four bullets quoted above. Together they omit covered mechanisms.

No single sentence says a checksum change may skip `design.md`. The permission comes from the exclusive list lacking a covered-mechanism reason, and the Build vs. adopt paragraph does not fill it.

The fix is to add a bullet such as "Introducing a covered mechanism (built, adopted or reused), even within one module".
