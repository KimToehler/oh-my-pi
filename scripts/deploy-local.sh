#!/usr/bin/env bash
# Build omp from a git ref (default: main) into a standalone binary, sync the
# team config (team-config/) of the same ref into the omp agent dir, and only
# then install the binary as $OMP_BIN_DIR/omp (and write omp.deployed). The binary
# is copied to omp.new first and that exact copy is smoke-tested and then
# published, so what ran is what is installed. A failed smoke test or config sync
# exits non-zero, removes omp.new and leaves the live binary untouched. Only this
# script changes what `omp` runs; edits in any checkout have no effect until the
# next deploy.
#
# Usage: scripts/deploy-local.sh [ref]   (run it directly, not via `nix develop -c`)
#   OMP_BIN_DIR       install dir (default ~/.local/bin)
#   OMP_SKIP_TEAM_CONFIG=1  install only the binary, leave ~/.omp/agent untouched
#   CARGO_TARGET_DIR  defaults to the main checkout's target/ so Rust deps are reused
#
# The build runs in a dedicated detached worktree (.worktrees/omp-deploy), so
# uncommitted work in the main checkout never leaks into the binary.
# Rollback: mv ~/.local/bin/omp.prev ~/.local/bin/omp. The backups/team-config-* dirs the
# installer reports hold only content it did not write (local edits, pre-existing files),
# not a full config snapshot. To roll the team config back, redeploy the older ref that
# contains team-config/; for a ref predating it, deploy with OMP_SKIP_TEAM_CONFIG=1 and
# restore local edits from the backups.
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

log "Staging $TARGET.new"
mkdir -p "$BIN_DIR"
rm -f "$TARGET.new"
cp "$BUILT" "$TARGET.new"
PUBLISHED=0
cleanup() { [ "$PUBLISHED" = 1 ] || rm -f "$TARGET.new"; }
trap cleanup EXIT ERR

# Smoke-test the exact copy that gets published, not the build output.
log "Smoke testing $TARGET.new"
(cd /tmp && "$TARGET.new" --version && "$TARGET.new" --smoke-test)

# Team config before publishing: an installer failure must leave the live
# binary and omp.deployed untouched. It may have applied part of the config.
if [ "${OMP_SKIP_TEAM_CONFIG:-}" != 1 ]; then
	log "Syncing team config"
	if ! (cd "$WT" && bun scripts/install-team-config.ts); then
		echo "Team config sync failed: the binary was NOT replaced, and the team config may be partially applied. Fix the cause and rerun the deploy." >&2
		exit 1
	fi
fi

log "Installing to $TARGET"
if [ -f "$TARGET" ]; then
	mv -f "$TARGET" "$TARGET.prev"
fi
mv -f "$TARGET.new" "$TARGET"
PUBLISHED=1
printf '%s %s %s\n' "$COMMIT" "$REF" "$(date '+%Y-%m-%dT%H:%M:%S%z')" >"$BIN_DIR/omp.deployed"

log "Deployed $(cat "$BIN_DIR/omp.deployed")"
case ":$PATH:" in
*":$BIN_DIR:"*) ;;
*) echo "Add $BIN_DIR to your PATH to run omp." ;;
esac
echo "Restart running omp sessions (e.g. IntelliJ ACP) to pick up the new binary and config."
