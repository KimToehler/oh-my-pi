#!/bin/bash
# Build omp from a git ref (default: main) into a standalone binary and install
# it as $OMP_BIN_DIR/omp. Only this script changes what `omp` runs; edits in any
# checkout have no effect until the next deploy.
#
# Usage: scripts/deploy-local.sh [ref]
#   OMP_BIN_DIR       install dir (default ~/.local/bin)
#   CARGO_TARGET_DIR  defaults to the main checkout's target/ so Rust deps are reused
#
# The build runs in a dedicated detached worktree (.worktrees/omp-deploy), so
# uncommitted work in the main checkout never leaks into the binary.
# Rollback: mv ~/.local/bin/omp.prev ~/.local/bin/omp
set -euo pipefail

REF="${1:-main}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${OMP_BIN_DIR:-$HOME/.local/bin}"
WT="$REPO/.worktrees/omp-deploy"
TARGET="$BIN_DIR/omp"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$REPO/target}"
# Non-login launchers (IDE terminals, ACP hosts) often omit rustup's bin dir.
if [ -d "$HOME/.cargo/bin" ] && [[ ":$PATH:" != *":$HOME/.cargo/bin:"* ]]; then
	export PATH="$HOME/.cargo/bin:$PATH"
fi

log() { printf '\n==> %s\n' "$*"; }

COMMIT="$(git -C "$REPO" rev-parse --verify "$REF^{commit}")"
log "Deploying $REF ($COMMIT)"

if [ ! -d "$WT" ]; then
	git -C "$REPO" worktree add --detach "$WT" "$COMMIT"
else
	DIRTY="$(git -C "$WT" status --porcelain --untracked-files=no)"
	if [ -n "$DIRTY" ]; then
		printf 'Build worktree %s has tracked changes; refusing to overwrite:\n%s\n' "$WT" "$DIRTY" >&2
		exit 1
	fi
	git -C "$WT" switch --detach --quiet "$COMMIT"
fi

log "Installing dependencies"
(cd "$WT" && bun install --frozen-lockfile)

# Cargo is incremental: an unchanged crates/ tree rebuilds in seconds.
log "Building native addon"
(cd "$WT" && bun --cwd=packages/natives run build)

log "Compiling omp binary"
(cd "$WT/packages/coding-agent" && bun run build)
BUILT="$WT/packages/coding-agent/dist/omp"

log "Smoke testing $BUILT"
(cd /tmp && "$BUILT" --version && "$BUILT" --smoke-test)

log "Installing to $TARGET"
mkdir -p "$BIN_DIR"
cp "$BUILT" "$TARGET.new"
if [ -f "$TARGET" ]; then
	mv -f "$TARGET" "$TARGET.prev"
fi
mv -f "$TARGET.new" "$TARGET"
printf '%s %s %s\n' "$COMMIT" "$REF" "$(date '+%Y-%m-%dT%H:%M:%S%z')" >"$BIN_DIR/omp.deployed"

log "Deployed $(cat "$BIN_DIR/omp.deployed")"
echo "Restart running omp sessions (e.g. IntelliJ ACP) to pick up the new binary."
