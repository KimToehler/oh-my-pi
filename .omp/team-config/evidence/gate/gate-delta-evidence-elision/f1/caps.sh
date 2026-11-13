#!/usr/bin/env bash
# Prints one "Capture: FILE sha256:HEX" line per argument (paths relative to f1/), hashed from disk.
set -eu
cd "$(dirname "$0")"
for f in "$@"; do printf 'Capture: %s sha256:%s\n' "$f" "$(shasum -a 256 "$f" | cut -d' ' -f1)"; done
