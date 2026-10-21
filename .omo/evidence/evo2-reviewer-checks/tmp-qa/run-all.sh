#!/bin/bash
# Usage: run-all.sh <attempt> [fixture...]   Runs the named fixtures (default: all except F-D1), 6 in parallel.
set -uo pipefail
A="$1"; shift
cd /tmp/evo2-qa/fixtures
if [ "$#" -gt 0 ]; then printf '%s\n' "$@"; else ls *.md | sed 's/\.md$//' | grep -v '^F-D1$'; fi |
	xargs -P 6 -I{} /tmp/evo2-qa/run-fixture.sh {} "$A"
