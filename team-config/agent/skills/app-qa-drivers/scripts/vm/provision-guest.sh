#!/bin/bash
# Provisions the golden image's guest: pinned tools, passwordless sudo, quiet Setup Assistant, key-only sshd.
# Runs once, as the lane user, inside the guest, over SSH key login (see vm-image.md). It touches no repository.
# The guest user's login password reaches it only through GUEST_SUDO_PASSWORD, for the first sudo call.
# Xcode and the iOS runtime are streamed in from the host first (vm-image.md); this script does not fetch them.
set -euo pipefail

SPECTRE_VERSION=0.9.0
SPECTRE_SHA256=7bee663dbf4e7b8b089bd989cf93c327a2dbc4afa894c997f4407e18ad73371b
SPECTRE_URL="https://github.com/rock3r/spectre/releases/download/v${SPECTRE_VERSION}/spectre-macosArm64.zip"
MAESTRO_VERSION=2.12.1
NODE_VERSION=26.13.0
NODE_BASE="https://nodejs.org/dist/v${NODE_VERSION}"
NODE_DIST="node-v${NODE_VERSION}-darwin-arm64"
JDK_ASSETS_URL='https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=aarch64&image_type=jdk&os=mac&vendor=eclipse'

TOOLS="$HOME/tools"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "provision-guest: $*" >&2; exit 1; }

sudo_() {
  if sudo -n true 2>/dev/null; then sudo "$@"
  elif [ -n "${GUEST_SUDO_PASSWORD:-}" ]; then printf '%s\n' "$GUEST_SUDO_PASSWORD" | sudo -S -p '' "$@"
  else fail "set GUEST_SUDO_PASSWORD for the first run"; fi
}

check_sha256() { # file expected
  [ "$(shasum -a 256 "$1" | cut -d' ' -f1)" = "$2" ] || fail "sha256 mismatch for $1"
}

sudo_passwordless() {
  local f=/etc/sudoers.d/app-qa-lane tmp="$WORK/sudoers"
  printf '%s ALL=(ALL) NOPASSWD: ALL\n' "$(id -un)" > "$tmp"
  sudo_ visudo -cf "$tmp" >/dev/null
  sudo_ install -m 440 -o root -g wheel "$tmp" "$f"
  sudo -n true || fail "passwordless sudo is not active"
  echo "sudo: passwordless for $(id -un)"
}

install_node() {
  mkdir -p "$TOOLS"
  curl -fsSL -o "$WORK/node.tar.gz" "$NODE_BASE/$NODE_DIST.tar.gz"
  curl -fsSL -o "$WORK/SHASUMS256.txt" "$NODE_BASE/SHASUMS256.txt"
  check_sha256 "$WORK/node.tar.gz" "$(awk -v f="$NODE_DIST.tar.gz" '$2 == f {print $1}' "$WORK/SHASUMS256.txt")"
  rm -rf "${TOOLS:?}/$NODE_DIST"
  tar -xzf "$WORK/node.tar.gz" -C "$TOOLS"
  echo "node: $("$TOOLS/$NODE_DIST/bin/node" --version)"
}

install_jdk() { # the newest Temurin 21 build, sha256 from the release metadata; needs the node installed above
  local node="$TOOLS/$NODE_DIST/bin/node" link sum
  curl -fsSL -o "$WORK/jdk.json" "$JDK_ASSETS_URL"
  link=$("$node" -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1]));process.stdout.write(a[0].binary.package.link)' "$WORK/jdk.json")
  sum=$("$node" -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1]));process.stdout.write(a[0].binary.package.checksum)' "$WORK/jdk.json")
  curl -fsSL -o "$WORK/jdk.tar.gz" "$link"
  check_sha256 "$WORK/jdk.tar.gz" "$sum"
  rm -rf "${TOOLS:?}"/jdk-21*
  tar -xzf "$WORK/jdk.tar.gz" -C "$TOOLS"
  # /usr/libexec/java_home finds only JDKs below a JavaVirtualMachines folder; the lane's start script asks it for 21
  sudo_ mkdir -p /Library/Java/JavaVirtualMachines
  sudo_ rm -rf /Library/Java/JavaVirtualMachines/app-qa-jdk-21
  sudo_ cp -R "$(echo "$TOOLS"/jdk-21*)" /Library/Java/JavaVirtualMachines/app-qa-jdk-21
  /usr/libexec/java_home -v 21 >/dev/null || fail "java_home finds no JDK 21"
  echo "jdk: $(/usr/libexec/java_home -v 21)"
}

install_spectre() {
  curl -fsSL -o "$WORK/spectre.zip" "$SPECTRE_URL"
  check_sha256 "$WORK/spectre.zip" "$SPECTRE_SHA256"
  rm -rf "$TOOLS/spectre"
  mkdir -p "$TOOLS/spectre"
  unzip -q "$WORK/spectre.zip" -d "$TOOLS/spectre"
  [ -x "$TOOLS/spectre/spectre-cli-$SPECTRE_VERSION/Spectre.app/Contents/MacOS/spectre" ] || fail "spectre binary not found after unzip"
  echo "spectre: $SPECTRE_VERSION"
}

install_maestro() {
  rm -rf "$HOME/.maestro"
  curl -fsSL https://get.maestro.mobile.dev | MAESTRO_VERSION="$MAESTRO_VERSION" JAVA_HOME="$(/usr/libexec/java_home -v 21)" bash >/dev/null
  [ -x "$HOME/.maestro/bin/maestro" ] || fail "maestro not installed"
  echo "maestro: $MAESTRO_VERSION"
}

write_shell_env() { # SSH commands run as non-interactive zsh, which reads ~/.zshenv
  local jdk
  jdk=$(/usr/libexec/java_home -v 21)
  cat > "$HOME/.zshenv" <<ENV
export JAVA_HOME="$jdk"
export PATH="$TOOLS/$NODE_DIST/bin:\$JAVA_HOME/bin:\$HOME/.maestro/bin:$TOOLS/spectre/spectre-cli-$SPECTRE_VERSION/Spectre.app/Contents/MacOS:\$PATH"
ENV
  mkdir -p "$HOME/.omp/agent/skills" "$HOME/work"
}

quiet_setup_assistant() { # the post-update screens would otherwise cover the console session
  local build d=com.apple.SetupAssistant
  build=$(sw_vers -buildVersion)
  defaults write "$d" LastSeenBuddyBuildVersion -string "$build"
  defaults write "$d" MiniBuddyShouldLaunchToResumeSetup -bool false
  for k in DidSeeSyncSetup DidSeeSyncSetup2 DidSeeCloudSetup DidSeeSiriSetup DidSeeAvatarSetup DidSeeScreenTime \
    DidSeeApplePaySetup DidSeeTouchIDSetup DidSeeAccessibility DidSeeAppearanceSetup DidSeeActivationLock; do
    defaults write "$d" "$k" -bool true
  done
  echo "setup assistant: post-update screens off for build $build"
}

sshd_key_only() {
  local f=/etc/ssh/sshd_config.d/100-app-qa-lane.conf
  [ -s "$HOME/.ssh/authorized_keys" ] || fail "no authorized key for $(id -un): install the lane key before provisioning"
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' | sudo_ tee "$f" >/dev/null
  local out
  out=$(sudo_ sshd -T)
  grep -qx 'passwordauthentication no' <<<"$out" || fail "sshd still accepts passwords"
  grep -qx 'kbdinteractiveauthentication no' <<<"$out" || fail "sshd still accepts keyboard-interactive logins"
  grep -qx 'pubkeyauthentication yes' <<<"$out" || fail "sshd does not accept keys"
  echo "sshd: key login only"
}

sudo_passwordless
install_node
install_jdk
install_spectre
install_maestro
write_shell_env
quiet_setup_assistant
sshd_key_only
echo "provision-guest: ok; next: grant-screen-capture.sh with SIP off (vm-image.md)"
