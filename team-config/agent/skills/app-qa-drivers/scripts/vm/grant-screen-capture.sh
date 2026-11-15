#!/bin/zsh
# Grants Screen Recording in the guest's system TCC database. Needs SIP off (vm-image.md). Runs as the lane user in the guest,
# after provision-guest.sh (passwordless sudo) and after 'spectre permissions check' unpacked its capture helper.
# TCC attributes a capture to the responsible process: from an SSH session that is sshd-keygen-wrapper, so both
# Spectre's capture helper and sshd-keygen-wrapper need a kTCCServiceScreenCapture row, each with its own code requirement.
set -euo pipefail
HELPER="$HOME/Library/Application Support/spectre/helpers/spectre-screencapture/SpectreCaptureHelper.app"
DB="/Library/Application Support/com.apple.TCC/TCC.db"
REQ="$(mktemp)"
trap 'rm -f "$REQ"' EXIT

[[ "$(csrutil status)" == *disabled* ]] || { echo "grant-screen-capture: SIP is on; see vm-image.md" >&2; exit 1; }
[[ -d "$HELPER" ]] || { echo "grant-screen-capture: run 'spectre permissions check' once in the console session so Spectre unpacks its capture helper" >&2; exit 1; }

grant() { # client client_type code_path
  local req hex
  req=$(codesign -dr - "$3" 2>&1 | sed -n 's/^designated => //p')
  [[ -n "$req" ]] || { echo "grant-screen-capture: no code requirement for $3" >&2; exit 1; }
  csreq -r- -b "$REQ" <<<"$req"
  hex=$(xxd -p "$REQ" | tr -d '\n')
  sudo sqlite3 "$DB" "INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, csreq, indirect_object_identifier, flags, last_modified) VALUES ('kTCCServiceScreenCapture', '$1', $2, 2, 4, 1, X'$hex', 'UNUSED', 0, CAST(strftime('%s','now') AS INTEGER));"
}

# row 1: Spectre's capture helper, by bundle id
grant "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$HELPER/Contents/Info.plist")" 0 "$HELPER"
# row 2: sshd-keygen-wrapper, the responsible process of a capture started over SSH (by path, and by bundle id for newer macOS)
grant /usr/libexec/sshd-keygen-wrapper 1 /usr/libexec/sshd-keygen-wrapper
grant com.apple.sshd-keygen-wrapper 0 /usr/libexec/sshd-keygen-wrapper
sudo sqlite3 "$DB" "SELECT client, client_type, auth_value FROM access WHERE service = 'kTCCServiceScreenCapture';"
sudo pkill -x tccd || true
