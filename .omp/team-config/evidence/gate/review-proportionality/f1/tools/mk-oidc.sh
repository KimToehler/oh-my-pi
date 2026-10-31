#!/bin/bash
# Build an F1-D/F1-E OIDC fixture: delivered files from <sha>, scenario inputs from plan-adopt-and-cap@88a0cf257d.
# usage: mk-oidc.sh <dest> <sha> [--rename] [--no-review]
set -euo pipefail
DEST=$1 SHA=$2; shift 2
RENAME=0 NOREVIEW=0 RETRY=0
for a in "$@"; do case $a in --rename) RENAME=1;; --no-review) NOREVIEW=1;; --retry) RETRY=1;; esac; done
IN=/tmp/rp-f1/oidc
python3 /tmp/rp-f1/fixture.py build "$DEST" "$SHA"
C="$DEST/openspec/changes/oidc-sign-in"
mkdir -p "$C/specs/oidc-sign-in" "$DEST/shared/http"
cp "$IN/repo-oidc/shared/http/Client.kt" "$DEST/shared/http/Client.kt"
printf 'schema: omp-gated\n' > "$C/.openspec.yaml"
cp "$IN/change/proposal.md" "$C/proposal.md"
cp "$IN/change/specs/oidc-sign-in/spec.md" "$C/specs/oidc-sign-in/spec.md"
cp "$IN/design-missing.md" "$C/design.md"
cp "$IN/change/gate.md" "$C/gate.md"
cp "$IN/change/tasks-build.md" "$C/tasks.md"
if [ $RENAME = 1 ]; then
  # Independent rename in the same change: httpClient() -> apiClient(), no callers.
  cat >> "$C/proposal.md" <<'EOF'

## Also in this change

- Rename `httpClient()` to `apiClient()` in `shared/http/Client.kt` (it has no callers), so the HTTP entry point matches the API naming.
EOF
  cat > "$C/tasks.md.new" <<'EOF'
# Tasks

## 1. Rename

- [ ] 1.1 Rename `httpClient()` to `apiClient()` in `shared/http/Client.kt`; it has no callers. Verify: `grep -q 'fun apiClient()' shared/http/Client.kt`

EOF
  sed -e 's/^## 1\. Sign-in/## 2. Sign-in/' -e 's/^- \[ \] 1\.1 /- [ ] 2.1 /' -e 's/^- \[ \] 1\.2 /- [ ] 2.2 /' \
      -e 's/^## 2\. Final verification/## 3. Final verification/' -e 's/^- \[ \] 2\.1 F1/- [ ] 3.1 F1/' \
      -e '1,2d' -e 's/after 2\.1 and/after 3.1 and/' "$C/tasks.md" >> "$C/tasks.md.new"
  mv "$C/tasks.md.new" "$C/tasks.md"
fi
if [ $RETRY = 1 ]; then
  # Independent, useful second part: request timeout and one retry for idempotent GETs.
  cat >> "$C/proposal.md" <<'EOF'

## Also in this change

- Today the app hangs on the order screen whenever the orders API stalls, because `httpClient()` in `shared/http/Client.kt` has no timeout. Give every request a 10-second timeout and retry an idempotent GET once after a timeout, so a stalled request shows an error instead of hanging. This is independent of sign-in and helps signed-in and future anonymous screens alike.
EOF
  cat > "$C/specs/http-timeout/spec.md" 2>/dev/null || { mkdir -p "$C/specs/http-timeout"; }
  cat > "$C/specs/http-timeout/spec.md" <<'EOF'
## ADDED Requirements

### Requirement: Request timeout with one GET retry

Every request made through `httpClient()` SHALL time out after 10 seconds, and an idempotent GET SHALL be retried once after a timeout before the error reaches the screen.

#### Scenario: Stalled orders request

- **WHEN** the orders API does not answer a GET within 10 seconds and answers the retry
- **THEN** the order list shows the retried response

#### Scenario: Negative control

- **WHEN** a POST times out
- **THEN** retrying it MUST fail the scenario: the POST is not retried and the error is shown
EOF
  cat > "$C/tasks.md.new" <<'EOF'
# Tasks

## 1. Timeout and retry

- [ ] 1.1 Install Ktor `HttpTimeout` (10 s request timeout) and `HttpRequestRetry` (one retry, GET only, on timeout) in `httpClient()` in `shared/http/Client.kt`, with tests against a stalled mock engine. Verify: `./gradlew :shared:allTests --tests '*Client*'`

EOF
  sed -e 's/^## 1\. Sign-in/## 2. Sign-in/' -e 's/^- \[ \] 1\.1 /- [ ] 2.1 /' -e 's/^- \[ \] 1\.2 /- [ ] 2.2 /' \
      -e 's/^## 2\. Final verification/## 3. Final verification/' -e 's/^- \[ \] 2\.1 F1/- [ ] 3.1 F1/' \
      -e '1,2d' -e 's/after 2\.1 and/after 3.1 and/' "$C/tasks.md" >> "$C/tasks.md.new"
  mv "$C/tasks.md.new" "$C/tasks.md"
fi
if [ $NOREVIEW = 0 ]; then
  grep -v '^- \*\*Window\*\*' "$IN/review-round2.md" > "$C/review.md"
fi
git -C "$DEST" add -A >/dev/null
git -C "$DEST" -c user.name=f1 -c user.email=f1@example.invalid commit -q -m "fixture"
echo "fixture $DEST ready"
