---
name: release-notes
description: Draft release notes for a tagged release from the merged pull requests since the previous tag.
---

# Release notes

1. List the pull requests merged since the previous tag (`git log --merges <prev>..<tag>`).
2. Write one bullet per user-visible change, in the past tense, linking the pull request.
3. Put breaking changes first under a `### Breaking` heading.
4. Leave out internal refactors, CI changes and dependency bumps without user impact.
