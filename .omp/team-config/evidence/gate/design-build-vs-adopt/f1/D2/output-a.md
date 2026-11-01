Negative control forbids: reasons for `design.md` that omit covered mechanisms, so a single-module checksum change skips `design.md`.

Sentences checked:

- "When to include design.md (create only if any apply):" followed by the four generic bullets. These alone would skip design.md for a single-module checksum, but the fifth bullet closes that gap. "create only if any apply" is a gate on the list, and the list includes the covered-mechanism bullet, so it is not flagged.
- "The change introduces a mechanism the `Build vs. adopt` paragraph below covers, even inside one module". This lists covered mechanisms as a reason, including inside one module, so it is not flagged.
- "a mechanism the change introduces (one the changed code does not use today, whether it ends up built, adopted or reused) is covered when it implements a published protocol, format or algorithm (OAuth/OIDC, JWT, a crypto primitive, a wire or file format) …". A CRC-32 checksum is a published algorithm or file-format element, so it is covered. One possible gap: "one the changed code does not use today" excludes a mechanism the code already uses. That is not the checksum scenario, because the checksum is new, so it is not flagged.
- "Project-specific logic and glue between existing components are not covered." A checksum is not project-specific logic or glue, so it is not flagged.
- "Record one subsection per covered mechanism under Decisions:" This presupposes design.md, and it matches the scenario's `Build vs. adopt` decision, so it is not flagged.
- "Before designing a covered mechanism, search … stop at the first stage that covers it". This limits the search, not the creation of design.md, so it is not flagged.
- The Decision, gap, search-failure and research-tool sentences, and the data-not-instructions sentence, say nothing about whether design.md is created, so they are not flagged.

None of these sentences lets a single-module covered-mechanism change skip `design.md`.

**none found**
