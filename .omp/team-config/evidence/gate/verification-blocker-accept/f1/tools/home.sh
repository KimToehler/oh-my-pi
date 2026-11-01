#!/bin/bash
# Per-row HOME for an F1 session (one-off evidence helper). Every entry is a symlink into the real HOME
# (no file copied, credentials included), except ~/.omp/agent/skills/review-work/SKILL.md, which is a
# symlink to the fixture's own .omp/skills/review-work/SKILL.md, so a read through ~ reads the fixture copy.
# usage: home.sh <row>   -> prints the HOME path
set -euo pipefail
R=$1 H=/tmp/vba-f1/home/$1 REAL=$HOME
rm -rf "$H"
link_except() { # <src dir> <dst dir> <name kept as a real directory>
	mkdir -p "$2"
	for e in "$1"/.[!.]* "$1"/*; do
		[ -e "$e" ] || [ -L "$e" ] || continue
		b=$(basename "$e")
		[ "$b" = "$3" ] && continue
		ln -s "$e" "$2/$b"
	done
}
link_except "$REAL" "$H" .omp
link_except "$REAL/.omp" "$H/.omp" agent
link_except "$REAL/.omp/agent" "$H/.omp/agent" skills
link_except "$REAL/.omp/agent/skills" "$H/.omp/agent/skills" review-work
link_except "$REAL/.omp/agent/skills/review-work" "$H/.omp/agent/skills/review-work" SKILL.md
ln -s "/tmp/vba-f1/$R/.omp/skills/review-work/SKILL.md" "$H/.omp/agent/skills/review-work/SKILL.md"
rm "$H/.omp/agent/skills/review-work/openspec"
ln -s "/tmp/vba-f1/$R/.omp/skills/review-work/openspec" "$H/.omp/agent/skills/review-work/openspec"
echo "$H"
