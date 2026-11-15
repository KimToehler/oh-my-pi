# Building the golden VM image

Read this when `vm up` reports a missing or broken image, or when the image needs rebuilding. `SKILL.md` ("VM lane") says how to use the lane; this file says how a person builds its image, once per machine. The driver only clones the image (`app-qa-slot-N`) and never boots it, so every step here is manual or a script run by hand. Run nothing here during a QA session.

The image holds no repository and no credential. The driver copies the worktree, the built artifacts, itself and the credentials file into a clone at `vm up` and deletes the clone at `vm down`.

## Prerequisites

- Apple-silicon Mac, at most two macOS guests at a time (Apple's limit; the lane file's `slots` is 1 or 2).
- lume 0.7.2, the pinned version (`lume --version`); `vm up` refuses another.
- Xcode on the host with the iOS simulator runtime you want, as an `.dmg` for `xcrun simctl runtime add`.
- An SSH key pair for the lane, for example `~/.omp/agent/app-qa-vm_ed25519`. Its public half goes into the guest in step 3.
- The skill's scripts: `scripts/vm/provision-guest.sh` and `scripts/vm/grant-screen-capture.sh` under `~/.omp/agent/skills/app-qa-drivers/`.

## Host steps

Use one VM name for the build, `app-qa-build`, and the golden name `app-qa-golden`. Never name an image `app-qa-slot-...`: that namespace belongs to the lane's clones, and the lane file's `image` refuses it.

1. **Create the VM**, unattended:
   ```
   lume create app-qa-build --ipsw latest --unattended tahoe --cpu 8 --memory 16 --disk-size 160
   ```
   Sizes the lane was tested with; smaller memory is untested. The guest gets the same Node major version as the host driver's tests.
   The preset makes user `lume` with autologin and no sleep, and sets the login password to the preset's. Autologin needs that password, so keep it. SSH password login is turned off in step 4, and the VM is reachable from this Mac only (NAT, 192.168.64.x).
2. **Boot it headless**: `lume run app-qa-build --detach --display none --vnc disabled`. Read its address with `lume get app-qa-build --format json` (`ipAddress`).
3. **Install the lane key.** Use the password login once: `ssh-copy-id -i KEY.pub lume@ADDRESS`. Then check `ssh -i KEY -o IdentitiesOnly=yes lume@ADDRESS true`.
4. **Provision the guest.** Copy the two scripts over and run the first one with the login password in `GUEST_SUDO_PASSWORD`:
   ```
   scp -i KEY -r ~/.omp/agent/skills/app-qa-drivers/scripts/vm lume@ADDRESS:/tmp/app-qa-vm
   ssh -i KEY lume@ADDRESS 'GUEST_SUDO_PASSWORD=... bash /tmp/app-qa-vm/provision-guest.sh'
   ```
   It installs Spectre 0.9.0 (sha256 checked), Maestro 2.12.1, JDK 21 and Node, gives the lane user passwordless sudo (the driver's guest scripts use `sudo launchctl asuser`), turns off Setup Assistant's post-update screens, and checks that sshd accepts keys only. It touches no repository.
5. **Stream Xcode in with `tar` over SSH**, never through the shared folder (virtiofs breaks Xcode's framework symlinks; a `ditto` from it fails):
   ```
   tar -C /Applications -cf - Xcode.app | ssh -i KEY lume@ADDRESS 'sudo tar -C /Applications -xpf -'
   ssh -i KEY lume@ADDRESS 'sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch'
   ```
6. **Add the iOS runtime** with `xcrun simctl runtime add`. Copy the `.dmg` with `scp`, then `ssh -i KEY lume@ADDRESS 'xcrun simctl runtime add /tmp/ios-runtime.dmg && xcrun simctl runtime list'`. The guest must end with exactly one iOS runtime: `vm up` creates its simulator on the guest's only iOS runtime.
7. **Reboot once**: `lume stop app-qa-build`, then boot as in step 2. Right after the Xcode copy, Gatekeeper blocks every `xcodebuild` exec (log line `ASP: Security policy would not allow process`) and the process hangs in `_dyld_start`; one reboot clears it. Check `ssh ... 'xcodebuild -version'` returns.
8. **Turn SIP off, by hand** (below). Then boot normally and check `csrutil status` prints `disabled`.
9. **Grant Screen Recording.** Run `spectre permissions check` once in the guest's console session so Spectre unpacks its capture helper (`sudo launchctl asuser $(id -u) sudo -u lume spectre permissions check`; it prints `Screen Recording: DENIED`, and `spectre --help` unpacks nothing), then `ssh -i KEY lume@ADDRESS 'zsh /tmp/app-qa-vm/grant-screen-capture.sh'`. It writes two `kTCCServiceScreenCapture` rows with their code requirements: Spectre's capture helper and `sshd-keygen-wrapper`. TCC attributes a capture started over SSH to `sshd-keygen-wrapper`, so the helper's row alone is not enough. `ssh ... 'spectre permissions check'` then prints `Screen Recording: granted`.
10. **Check the guest's console session**: the guest must show its desktop, not the login window or a Setup Assistant "MiniBuddy" window. Killing that window logs the session out and the VM then stays on the login window; `lume stop` and `lume run` bring autologin back, so leave the window alone and let provisioning's Setup Assistant settings prevent it.
11. **Remove build leftovers**: `ssh ... 'rm -rf /tmp/app-qa-vm /tmp/ios-runtime.dmg ~/.vnc.env'`. A boot with VNC on makes lume write `~/.vnc.env` (port and VNC password) into the guest over SSH, so the SIP step leaves one. Put no repository, credentials file or token into the VM. Then shut the guest down cleanly (`ssh ... 'sudo shutdown -h now'`) and wait until `lume ls` shows it stopped.
12. **Clone to the golden name**: `lume clone app-qa-build app-qa-golden`. Keep `app-qa-build` for the next image update, or delete it.
13. **Write the lane file** `~/.omp/agent/app-qa-vm.json`:
   ```
   {
     "schema": "app-qa-vm/1",
     "image": "app-qa-golden",
     "user": "lume",
     "sshKey": "/Users/YOU/.omp/agent/app-qa-vm_ed25519",
     "slots": 2,
     "idleMinutes": 30,
     "ios": { "deviceType": "iPhone 17 Pro" }
   }
   ```
   `ios.deviceType` is a simulator device type name of the installed Xcode. The file is yours: a team config deploy never touches it.

## The manual SIP step

Screen Recording for SSH sessions needs a TCC row that only exists with SIP off. `lume sip off` (0.7.2) fails when Recovery's language screen comes up in a language other than English (it can follow the host's locale; setting `nvram prev-lang:kbd=en-US:0` in the guest does not change it), because its English text search then misses the `csrutil` prompt. Do it over VNC instead, once per image:

1. `lume stop app-qa-build`, then `lume run app-qa-build --recovery-mode true --display none --vnc-port 5939 --vnc-password PASSWORD` with a throwaway password. VNC listens on all interfaces when enabled, so connect to `localhost` only and keep the window short.
2. In a VNC client (for example `vncdo`) press Options (right, right, Enter). On the language screen click **English**, then continue. Recovery's language must be English.
3. Menu Utilities, Terminal. Run `csrutil disable`, answer `y`, and give the admin user's password when asked. Check `csrutil status` prints `disabled`.
4. Shut Recovery down from its Terminal with `shutdown -h now` and wait until `lume ls` shows the VM stopped. Never end Recovery with `lume stop`: with lume 0.7.2 that can drop the change; the next normal boot then still prints `enabled`.
5. Boot normally once with VNC on (`--vnc-port 5939 --vnc-password PASSWORD`) and look at the console. If the change was lost, the boot shows a boot-time password prompt for the disk and then Setup Assistant's MiniBuddy; enter the preset password there, and click MiniBuddy through (sign in later, no analytics, no FileVault, updates download only) rather than killing it (step 10). Every later boot passes `--vnc disabled`.

The step is manual because it depends on Recovery's screen geometry.

## Security residuals

- **SIP is off** in the golden image and every clone. A clone is a test box: use dev accounts only, never a real account.
- **Every SSH session may record the guest's screen.** `sshd-keygen-wrapper` holds Screen Recording, so anything running in the guest can capture it.
- **NAT only.** The guest has an address in 192.168.64.x, reachable from this Mac only. Never bridge it.
- **Key-only SSH.** Password login is off. The login password stays the unattended preset's, because autologin needs it; SSH never accepts it.
- **VNC off.** Boot with `--vnc disabled`. Only the SIP step enables VNC, briefly and on a throwaway password.
- **Credentials live only in leased clones**, copied at `vm up` and deleted with the clone at `vm down`. The golden image never holds one; do not copy a credentials file or a repository into `app-qa-build`.

## Pitfalls

1. **Shared folder.** virtiofs breaks Xcode's framework symlinks. Stream with `tar` over SSH (step 5), and treat `--shared-dir` as unused.
2. **Gatekeeper after the Xcode copy.** `xcodebuild` hangs in `_dyld_start` until one reboot (step 7).
3. **GUI processes need the console session.** A JVM or `open` started straight from SSH has no WindowServer (`java.awt.HeadlessException`, launchd error 125). The driver's guest start script uses `sudo launchctl asuser UID sudo -u USER`, which is why the lane user has passwordless sudo.
4. **Setup Assistant's MiniBuddy window** stays open after a boot unless the settings of `provision-guest.sh` are in place. Killing it logs the session out (step 10). It can still appear after a reboot that follows a lost SIP change (`MiniBuddyLaunchReason = 13`); clicking it through over VNC ends it for good.
5. **Clean simulator for sign-in.** A signed-in app skips the sign-in entry, and the browser's live identity-provider session skips the form, so the sign-in subflow fails (the intended safe failure). `vm up` therefore creates a fresh simulator every time. The first web view after a boot needs about 40 s, longer than the subflow waits, so `vm up` opens the health URL once to warm WebKit.
6. **Maestro's iOS driver startup.** One run failed with `Unknown application display identifier dev.mobile.maestro-driver-iosUITests.xctrunner`; a retry with `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` passed. Routed flow runs set it.
7. **The Compose distributable's runtime lacks `java.instrument`**, so Spectre's agent cannot load (`Module java.instrument not found`). The driver starts the app's jars on the guest's JDK 21 with the launcher's options from `Contents/app/*.cfg`, which is why `provision-guest.sh` installs a full JDK 21 where `/usr/libexec/java_home -v 21` finds it.
8. **`lume sip off` fails** on a Recovery whose language is not English (see the SIP step). Its credential preflight also needs SSH password login, which step 4 turns off.
9. **Screen Recording rows.** Without both rows, `preflight desktop` in the guest prints `screen capture: denied`.

## Updating the image

Boot `app-qa-build` again (`lume run app-qa-build --detach --display none --vnc disabled`), change it, check steps 7 and 10, stop it, then `lume delete app-qa-golden` and `lume clone app-qa-build app-qa-golden`. Do it with no lease held: a clone is a copy, so running leases keep the old image.
