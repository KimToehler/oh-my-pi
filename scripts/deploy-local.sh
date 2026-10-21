#!/usr/bin/env bash
# Build omp from a git ref (default: main) into a standalone binary, install it
# as $OMP_BIN_DIR/omp, and sync the team config (team-config/) of the same ref
# into the omp agent dir. Only this script changes what `omp` runs; edits in any
# checkout have no effect until the next deploy.
#
# Usage: scripts/deploy-local.sh [ref]   (run it directly, not via `nix develop -c`)
#   OMP_BIN_DIR       install dir (default ~/.local/bin)
#   OMP_SKIP_TEAM_CONFIG=1  install only the binary, leave ~/.omp/agent untouched
#   CARGO_TARGET_DIR  defaults to the main checkout's target/ so Rust deps are reused
#
# The build runs in a dedicated detached worktree (.worktrees/omp-deploy), so
# uncommitted work in the main checkout never leaks into the binary.
# Rollback: mv ~/.local/bin/omp.prev ~/.local/bin/omp. Team config: restore from the
# backups/team-config-* dirs the installer reports. A ref that predates team-config/
# has no installer, so roll back to it with OMP_SKIP_TEAM_CONFIG=1.
set -euo pipefail

REF="${1:-main}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Without bun on PATH (e.g. NixOS), re-run inside the flake dev shell. --profile
# pins its closure as a GC root: the built binary and addon link against its
# /nix/store glibc/libgcc, so a garbage collection would otherwise break omp.
if ! command -v bun >/dev/null && command -v nix >/dev/null && [ -z "${IN_NIX_SHELL:-}" ]; then
	exec nix develop "$REPO" --profile "$REPO/.worktrees/omp-dev-profile" -c "$0" "$@"
fi
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
	# The native build regenerates these bindings, and on Linux they differ from
	# the committed (macOS-generated) copy; that is build output, not local work.
	git -C "$WT" checkout --quiet -- packages/natives/native/index.d.ts
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

if [ "${OMP_SKIP_TEAM_CONFIG:-}" != 1 ]; then
	log "Syncing team config"
	(cd "$WT" && bun scripts/install-team-config.ts)
fi

log "Deployed $(cat "$BIN_DIR/omp.deployed")"
case ":$PATH:" in
*":$BIN_DIR:"*) ;;
*) echo "Add $BIN_DIR to your PATH to run omp." ;;
esac
echo "Restart running omp sessions (e.g. IntelliJ ACP) to pick up the new binary and config."
