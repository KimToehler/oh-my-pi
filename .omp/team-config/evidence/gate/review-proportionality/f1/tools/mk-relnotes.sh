#!/bin/bash
# F1-A fixture: a repo shipping a release-notes skill; delivered files from <sha>.
# usage: mk-relnotes.sh <dest> <sha>
set -euo pipefail
DEST=$1 SHA=$2
python3 /tmp/rp-f1/fixture.py build "$DEST" "$SHA"
mkdir -p "$DEST/skills/release-notes"
cat > "$DEST/skills/release-notes/SKILL.md" <<'EOF'
---
name: release-notes
description: Draft release notes for a tagged release from the merged pull requests since the previous tag.
---

# Release notes

1. List the pull requests merged since the previous tag (`git log --merges <prev>..<tag>`).
2. Write one bullet per user-visible change, in the past tense, linking the pull request.
3. Put breaking changes first under a `### Breaking` heading.
4. Leave out internal refactors, CI changes and dependency bumps without user impact.
EOF
cat > "$DEST/README.md" <<'EOF'
# Team skills

Agent skills this team ships to every developer's omp installation (`skills/<name>/SKILL.md`).
EOF
git -C "$DEST" add -A >/dev/null
git -C "$DEST" -c user.name=f1 -c user.email=f1@example.invalid commit -q -m "fixture"
echo "fixture $DEST ready"
