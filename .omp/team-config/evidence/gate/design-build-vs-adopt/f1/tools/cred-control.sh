#!/bin/bash
# Sentinel controls for credscan.ts. (a) every source format yields its sentinel;
# (b) a sentinel planted in a scratch copy of each retained file kind gives exactly one hit.
# usage: cred-control.sh <retained file>...   (one per kind: lens output, call log, artifact, screen capture)
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd)
S=$(mktemp -d /tmp/dba-f1-sentinel.XXXXXX)
SENT="SENTINEL$(openssl rand -hex 16)"
mkdir -p "$S/home/.omp/agent" "$S/home/.aws/sso/cache" "$S/fx"
printf 'providers:\n  demo:\n    apiKey: "%s-yaml"\n' "$SENT" > "$S/home/.omp/agent/models.yml"
sqlite3 "$S/home/.omp/agent/agent.db" "create table auth_credentials(id integer primary key, provider text, credential_type text, data text); insert into auth_credentials(provider, credential_type, data) values('demo','oauth','{\"access\":\"$SENT-db\"}');"
printf 'DEMO_API_KEY=%s-fixturedotenv\n' "$SENT" > "$S/fx/.env"
printf 'OTHER_TOKEN="%s-homedotenv"\n' "$SENT" > "$S/home/.env"
printf '{"accessToken":"%s-sso"}\n' "$SENT" > "$S/home/.aws/sso/cache/demo.json"
echo "== (a) per-source loading (expect one sentinel-bearing value per source)"
for suffix in yaml db fixturedotenv homedotenv sso env; do
  out=$(DEMO_SENTINEL_TOKEN="$SENT-env" bun "$D/credscan.ts" --home "$S/home" --fixture "$S/fx" --expect "$SENT-$suffix" "$S/fx/.env" 2>&1 || true)
  echo "$out" | grep -E "sentinel=yes" | sed "s/^/[$suffix] /" || echo "[$suffix] NOT LOADED"
done
echo "== (b) planted copies (expect exactly 1 hit each)"
mkdir -p "$S/planted"
i=0
for f in "$@"; do
  i=$((i+1))
  cp "$f" "$S/planted/$i-$(basename "$f")"
  printf '\n%s-yaml\n' "$SENT" >> "$S/planted/$i-$(basename "$f")"
done
bun "$D/credscan.ts" --home "$S/home" --fixture "$S/fx" "$S/planted" | grep -E '^(FILE|SCANNED)' | sed "s|$S/planted/||" || true
rm -rf "$S"
