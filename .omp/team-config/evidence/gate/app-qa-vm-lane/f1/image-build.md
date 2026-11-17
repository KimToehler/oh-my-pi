# Golden image build (task 5.4), 2026-11-15

Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

Host: Apple M5 Pro, macOS 27.2.1, lume 0.7.2, Xcode 27.2 (27B52). Guest: macOS 27.2.1 (26B131), unattended preset `tahoe`, 8 CPU, 16 GB, 160 GB.

| vm-image.md step | Result |
|---|---|
| PoC VMs | `qa-mac` and `qa-mac-golden` deleted before the build |
| 1-2 create, boot headless | done, address 192.168.64.3 |
| 3 lane key | key login works |
| 4 provision-guest.sh | done (Spectre 0.9.0, Maestro 2.12.1, JDK 21, Node, passwordless sudo, key-only sshd) |
| 5 Xcode over tar/SSH | `xcodebuild -version` hangs until step 7 |
| 6 iOS runtime | iOS 26.4.1 (23E254a), the only iOS runtime |
| 7 reboot | `Xcode 27.2 / Build version 27B52` |
| 8 SIP off | first manual try ended with `lume stop` and did not persist (normal boot: `enabled`; boot-time disk password prompt and Setup Assistant MiniBuddy, clicked through over VNC). `lume sip off` failed three times (password SSH needed for its preflight; Recovery German even with `prev-lang:kbd=en-US:0`). Second manual try, ended with `shutdown -h now` in Recovery Terminal: `System Integrity Protection status: disabled.` |
| 9 Screen Recording | `spectre permissions check` unpacked the helper (`spectre --help` did not); grant script wrote 3 rows; over SSH `Screen Recording: granted` |
| 10 console | Finder desktop, no MiniBuddy, no login window (VNC capture, then VNC off) |
| 11 leftovers | `/tmp` emptied by the reboot; lume's `~/.vnc.env` removed; no repository or credentials in the guest; clean `shutdown -h now` |
| 12 clone | `app-qa-golden` cloned from `app-qa-build` |
| 13 lane file | `~/.omp/agent/app-qa-vm.json`: image `app-qa-golden`, slots 2, idleMinutes 30, `iPhone 17 Pro` |

The corrections to vm-image.md that this build found are in commit bf025c25e3. Passwords appear only as `<preset>` or `<throwaway>`.

## Raw log

```text
2026-11-15T09:34:35Z
+ lume ls (before)
["qa-mac","qa-mac-golden"]
+ lume delete qa-mac --force
[2026-11-15T09:34:35Z] INFO: VM deleted successfully name=qa-mac
+ lume delete qa-mac-golden --force
[2026-11-15T09:34:37Z] INFO: VM deleted successfully name=qa-mac-golden
[]
+ lume create app-qa-build --ipsw latest --unattended tahoe --cpu 8 --memory 16 --disk-size 160
[2026-11-15T09:46:09Z] INFO: Running SSH health check host=192.168.64.3 retries=60 timeout=5s user=lume
[2026-11-15T09:46:09Z] INFO: SSH health check attempt attempt=1/60
[2026-11-15T09:46:13Z] INFO: Wrote VNC config to VM via SSH name=app-qa-build port=52542
[2026-11-15T09:46:13Z] INFO: Wrote VNC config to VM via SSH name=app-qa-build port=52543
[2026-11-15T09:46:13Z] INFO: SSH health check passed attempt=1 host=192.168.64.3
[2026-11-15T09:46:13Z] INFO: Finalizing guest system setup via SSH host=192.168.64.3 user=lume
[2026-11-15T09:46:16Z] INFO: Guest system setup finalized via SSH host=192.168.64.3
[2026-11-15T09:46:16Z] INFO: Offline unattended setup verified - stopping VM
[2026-11-15T09:46:16Z] INFO: Attempting to stop VM force=false name=app-qa-build
[2026-11-15T09:46:16Z] INFO: Stopping VM via virtualization service name=app-qa-build
[2026-11-15T09:46:16Z] ERROR: Failed in VM.run error=The operation couldn’t be completed. (Swift.CancellationError error 1.) errorType=CancellationError name=app-qa-build
[2026-11-15T09:46:16Z] INFO: VM stopped successfully via virtualization service name=app-qa-build
[2026-11-15T09:46:16Z] INFO: VM stopped name=app-qa-build
[2026-11-15T09:46:16Z] INFO: Offline unattended setup completed name=app-qa-build
[2026-11-15T09:46:16Z] INFO: Provisioning marker cleared name=app-qa-build
exit=0
+ lume run app-qa-build --detach --display none --vnc disabled
Log: ~/Library/Logs/lume/app-qa-build.log
address: 192.168.64.3
+ lume ssh app-qa-build (append lane public key)
+ ssh -i KEY lume@ADDRESS true
Warning: Permanently added '192.168.64.3' (ED25519) to the list of known hosts.
27.2.1
lume
exit=0
+ scp -r scripts/vm lume@ADDRESS:/tmp/app-qa-vm (from worktree head 030ab05d32)
ok
+ ssh 'GUEST_SUDO_PASSWORD=<preset> bash /tmp/app-qa-vm/provision-guest.sh'
sudo: passwordless for lume
node: v26.13.0
jdk: /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home
spectre: 0.9.0
#=#=#                                                                          

                                                                           0.1%
#                                                                          1.5%
##                                                                         2.8%
###                                                                        4.6%
####                                                                       6.0%
#####                                                                      7.2%
######                                                                     8.6%
#######                                                                   10.4%
########                                                                  11.9%
#########                                                                 13.5%
##########                                                                15.0%
###########                                                               16.5%
#############                                                             18.1%
##############                                                            19.6%
###############                                                           21.0%
################                                                          22.4%
#################                                                         24.0%
##################                                                        25.7%
###################                                                       27.4%
####################                                                      28.9%
#####################                                                     30.5%
#######################                                                   32.1%
########################                                                  33.8%
#########################                                                 35.6%
##########################                                                37.1%
###########################                                               38.5%
############################                                              40.1%
#############################                                             41.2%
##############################                                            42.0%
###############################                                           43.7%
################################                                          45.2%
#################################                                         46.9%
##################################                                        48.4%
###################################                                       49.9%
#####################################                                     51.5%
######################################                                    53.1%
#######################################                                   54.8%
########################################                                  56.2%
#########################################                                 57.8%
##########################################                                59.5%
############################################                              61.1%
#############################################                             62.8%
##############################################                            64.4%
###############################################                           65.9%
################################################                          67.2%
#################################################                         68.8%
##################################################                        70.6%
####################################################                      72.2%
#####################################################                     73.8%
######################################################                    75.4%
#######################################################                   77.1%
########################################################                  78.5%
#########################################################                 80.2%
##########################################################                80.9%
###########################################################               82.0%
###########################################################               82.7%
############################################################              83.5%
############################################################              84.2%
#############################################################             85.2%
#############################################################             86.0%
##############################################################            86.7%
##############################################################            87.4%
###############################################################           88.5%
################################################################          89.5%
#################################################################         90.3%
#################################################################         91.5%
##################################################################        91.8%
##################################################################        92.9%
##################################################################        93.0%
##################################################################        93.0%
###################################################################       93.1%
###################################################################       93.4%
####################################################################      94.5%
####################################################################      95.5%
#####################################################################     96.5%
######################################################################    97.4%
######################################################################    98.3%
#######################################################################   99.2%
######################################################################## 100.0%
maestro: 2.12.1
setup assistant: post-update screens off for build 26B131
provision-guest: sshd still accepts passwords
exit=1
+ provision-guest.sh fixed (sshd -T keywords are capitalised on macOS; maestro installer output silenced); copy again and rerun
ok
+ ssh 'bash /tmp/app-qa-vm/provision-guest.sh'
sudo: passwordless for lume
node: v26.13.0
jdk: /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home
spectre: 0.9.0
maestro: 2.12.1
setup assistant: post-update screens off for build 26B131
sshd: key login only
provision-guest: ok; next: grant-screen-capture.sh with SIP off (vm-image.md)
exit=0
+ tar -C /Applications -cf - Xcode.app | ssh 'sudo tar -C /Applications -xpf -'
exit=0
+ ssh 'sudo xcode-select -s ...; sudo xcodebuild -license accept; sudo xcodebuild -runFirstLaunch'
Install Started
1%.........20.........40.........60.........80.........Install Succeeded
exit=0
+ scp ios-runtime-23E254a.dmg (iOS 26.4.1 runtime of the host) lume@ADDRESS:/tmp/ios-runtime.dmg
exit=0
+ ssh 'xcrun simctl runtime add /tmp/ios-runtime.dmg && xcrun simctl runtime list'
D: 103CF687-3F36-44DC-815F-4174E073F3AC iOS (26.4.1 - 23E254a) (Ready)

-- iOS --
iOS 26.4.1 (23E254a) - 103CF687-3F36-44DC-815F-4174E073F3AC (Ready)

Total Disk Images: 1 (7.9G)
exit=0
+ lume stop app-qa-build; lume run app-qa-build --detach --display none --vnc disabled
[2026-11-15T09:51:13Z] INFO: VM stopped successfully name=app-qa-build
Log: ~/Library/Logs/lume/app-qa-build.log
address: 192.168.64.3
+ ssh 'xcodebuild -version'
Xcode 27.2
Build version 27B52
exit=0
+ lume stop app-qa-build; lume run app-qa-build --recovery-mode true --display none --vnc-port 5939 --vnc-password <throwaway>
[2026-11-15T09:51:36Z] INFO: VM stopped successfully name=app-qa-build
Started 'app-qa-build' in the background (PID 36479).
Log: ~/Library/Logs/lume/app-qa-build.log
+ Recovery over VNC (localhost:5939, throwaway password): Options, language English, Utilities > Terminal, csrutil disable, y, admin password -> 'System Integrity Protection is off.'
+ lume stop app-qa-build; lume run app-qa-build --detach --display none --vnc disabled
[2026-11-15T09:56:04Z] INFO: VM stopped successfully name=app-qa-build
Log: ~/Library/Logs/lume/app-qa-build.log
address: 192.168.64.3
+ ssh 'csrutil status'
ssh: connect to host 192.168.64.3 port 22: Connection refused
+ manual Recovery csrutil disable did not persist (normal boot: 'System Integrity Protection status: enabled.'); Setup Assistant MiniBuddy appeared after reboot and was completed over VNC (sign in later, adult, no analytics, FileVault not now, updates download-only)
+ lume stop app-qa-build; printf '<preset>\n' | lume sip off app-qa-build --yes --admin-user lume --admin-password-stdin
[2026-11-15T10:06:23Z] INFO: VM stopped successfully name=app-qa-build
[2026-11-15T10:06:23Z] INFO: Using vncdotool path=~/.local/bin/vncdo
[2026-11-15T10:06:23Z] INFO: Booting normally to validate admin credentials vm=app-qa-build
Error: Admin credential preflight failed: SSH authentication failed for 'lume': The operation couldn’t be completed. (NIOCore.ChannelError error 9.)
+ guest: 100-app-qa-lane.conf moved aside (password SSH on for lume sip preflight only)
+ lume stop app-qa-build; printf '<preset>\n' | lume sip off app-qa-build --yes --admin-user lume --admin-password-stdin
[2026-11-15T10:07:11Z] INFO: VM stopped successfully name=app-qa-build
[2026-11-15T10:07:11Z] INFO: Using vncdotool path=~/.local/bin/vncdo
[2026-11-15T10:07:11Z] INFO: Booting normally to validate admin credentials vm=app-qa-build
[2026-11-15T10:07:17Z] INFO: Admin credential preflight passed vm=app-qa-build
[2026-11-15T10:07:17Z] INFO: Stopping normal boot operation=credential preflight vm=app-qa-build
[2026-11-15T10:07:17Z] INFO: Booting recovery vm=app-qa-build vnc_port=5999
[2026-11-15T10:07:32Z] INFO: Framebuffer ready label=picker png_bytes=79517
[2026-11-15T10:08:41Z] INFO: Framebuffer ready label=language png_bytes=222153
Error: VNC driver timeout: Framebuffer for 'csrutil prompt' did not contain expected text; last OCR text: wiederher tellung ablage bearbeiten dienstprogramme fenster wiederherstellung version 1.0 (531) te auf webbrowser durchsuche den apple support, um hilfe für deinen mac zu finden. festplattendienstprogramm hiermit reparierst oder löschst du eine festplatte. fortfahren
+ lume sip off failed: Recovery came up German (OCR 'wiederherstellung ... dienstprogramme'); guest had no prev-lang:kbd
+ ssh 'sudo nvram prev-lang:kbd=en-US:0'
+ lume stop app-qa-build; printf '<preset>\n' | lume sip off app-qa-build --yes --admin-user lume --admin-password-stdin
[2026-11-15T10:10:41Z] INFO: VM stopped successfully name=app-qa-build
[2026-11-15T10:10:41Z] INFO: Using vncdotool path=~/.local/bin/vncdo
[2026-11-15T10:10:41Z] INFO: Booting normally to validate admin credentials vm=app-qa-build
[2026-11-15T10:10:47Z] INFO: Admin credential preflight passed vm=app-qa-build
[2026-11-15T10:10:47Z] INFO: Stopping normal boot operation=credential preflight vm=app-qa-build
[2026-11-15T10:10:47Z] INFO: Booting recovery vm=app-qa-build vnc_port=5999
[2026-11-15T10:11:01Z] INFO: Framebuffer ready label=picker png_bytes=79517
[2026-11-15T10:12:09Z] INFO: Framebuffer ready label=language png_bytes=222153
Error: VNC driver timeout: Framebuffer for 'csrutil prompt' did not contain expected text; last OCR text: wiederher tellung ablage bearbeiten dienstprogramme fenster wiederherstellung version 1.0 (531) te auf webbrowser durchsuche den apple support, um hilfe für deinen mac zu finden. festplattendienstprogramm hiermit reparierst oder löschst du eine festplatte. fortfahren
+ lume sip off failed twice more: after 'sudo nvram prev-lang:kbd=en-US:0' Recovery still came up German (same OCR); its preflight needs SSH password auth, so 100-app-qa-lane.conf was moved aside for it
+ manual Recovery over VNC again: Options, English, Utilities > Terminal, csrutil disable, y, admin password -> 'System Integrity Protection is off.'; csrutil status in Recovery -> disabled; then 'shutdown -h now' in Recovery Terminal (the first attempt ended with lume stop and did not persist)
+ lume run app-qa-build --detach --display none --vnc-port 5939 (throwaway password, console check only)
+ ssh 'csrutil status'
System Integrity Protection status: disabled.
+ ssh: restore 100-app-qa-lane.conf; sshd -T
PasswordAuthentication no
KbdInteractiveAuthentication no
setup assistant: not running
lume             console      Nov 15 02:17 
+ console capture over VNC: Finder desktop, no MiniBuddy, no login window
+ scp scripts/vm -> /tmp/app-qa-vm
exit=0
+ ssh 'sudo launchctl asuser $(id -u) sudo -u lume spectre --help'
ls: /Users/lume/Library/Application Support/spectre/helpers/spectre-screencapture/SpectreCaptureHelper.app: No such file or directory
+ 'spectre --help' did not unpack the capture helper; 'sudo launchctl asuser $(id -u) sudo -u lume spectre permissions check' did (Screen Recording: DENIED)
+ ssh 'zsh /tmp/app-qa-vm/grant-screen-capture.sh'
/usr/libexec/sshd-keygen-wrapper|1|2
com.apple.sshd-keygen-wrapper|0|2
dev.sebastiano.spectre.screencapture|0|2
exit=0
+ ssh 'spectre permissions check' (from SSH)
Screen Recording: granted
+ ssh 'rm -rf /tmp/app-qa-vm /tmp/ios-runtime.dmg /tmp/sa-*.txt'; look for repositories or credentials
zsh:1: no matches found: /tmp/sa-*.txt
Desktop
Documents
Downloads
Library
tools
work
leftovers removed
+ ssh 'sudo shutdown -h now' (clean shutdown; also ends the VNC-on console-check boot)
+ step 11: /tmp was emptied by the reboot (/tmp/app-qa-vm and /tmp/ios-runtime.dmg gone); ~/Desktop ~/Documents ~/Downloads ~/work empty
+ a VNC-on boot makes lume write ~/.vnc.env (VNC_PORT, VNC_PASSWORD) into the guest over SSH; ssh 'rm -f ~/.vnc.env'
ls: /Users/lume/.vnc.env: No such file or directory
+ ssh 'sudo shutdown -h now'
app-qa-build stopped
+ lume clone app-qa-build app-qa-golden
[2026-11-15T10:19:58Z] INFO: Cloning VM destLocation=default destination=app-qa-golden source=app-qa-build sourceLocation=default
[2026-11-15T10:19:59Z] INFO: VM cloned successfully destination=app-qa-golden source=app-qa-build
{"name":"app-qa-build","status":"stopped","cpuCount":8,"memorySize":17179869184,"diskSize":{"total":171798691840,"allocated":51195314176}}
{"name":"app-qa-golden","status":"stopped","cpuCount":8,"memorySize":17179869184,"diskSize":{"allocated":51195314176,"total":171798691840}}
+ step 13: wrote ~/.omp/agent/app-qa-vm.json (image app-qa-golden, user lume, slots 2, idleMinutes 30, ios.deviceType 'iPhone 17 Pro', a device type of host Xcode 27.2)
```


## Image update: Spotlight indexing off (vm-image.md "Updating the image", 2026-11-15)

After F1 found a fresh clone's load at 76 on 8 vCPUs, `provision-guest.sh` gained `spotlight_off` (`mdutil -a -i off`). Applied to `app-qa-build` by the update procedure: boot headless, run the step over the lane key, check steps 7 and 10 (xcodebuild returns; Dock and Finder run, no MiniBuddy, screen not locked) and the step 11 leftovers, stop, delete `app-qa-golden`, clone again. No lease was held.

```
+ lume run app-qa-build --detach --display none --vnc disabled
+ ssh 'sudo -n mdutil -a -i off; mdutil -s / /System/Volumes/Data; sysctl -n hw.ncpu vm.loadavg'
+ ssh step 7/10/11 checks
+ lume stop app-qa-build; lume delete app-qa-golden --force; lume clone app-qa-build app-qa-golden
Started 'app-qa-build' in the background (PID 31460).
Log: ~/Library/Logs/lume/app-qa-build.log
ip=192.168.64.3
2026-11-15 08:45:32.051 mdutil[589:4229] mdutil disabling Spotlight: / -> kMDConfigSearchLevelFSSearchOnly
2026-11-15 08:45:32.123 mdutil[589:4229] mdutil disabling Spotlight: /System/Volumes/Data -> kMDConfigSearchLevelFSSearchOnly
2026-11-15 08:45:32.218 mdutil[589:4229] mdutil disabling Spotlight: /System/Volumes/Preboot -> kMDConfigSearchLevelFSSearchOnly
/:
	Indexing disabled.
/System/Volumes/Data:
	Indexing disabled.
/System/Volumes/Preboot:
	Indexing disabled.
---
/:
	Indexing disabled.
/System/Volumes/Data:
	Indexing disabled.
8
{ 27.78 5.80 2.05 }
step7
Xcode 27.2
step10
dock-running
finder-running
no-minibuddy
not-locked
ls: /Users/lume/.vnc.env: No such file or directory
ls: /tmp/app-qa-vm: No such file or directory
ls: /tmp/ios-runtime.dmg: No such file or directory
[2026-11-15T16:45:45Z] INFO: Stopping VM force=false name=app-qa-build
[2026-11-15T16:45:45Z] INFO: Attempting to stop VM force=false name=app-qa-build
[2026-11-15T16:45:45Z] INFO: Resolving process holding the config-file run lock name=app-qa-build path=~/.lume/app-qa-build/config.json
[2026-11-15T16:45:45Z] INFO: Found process 31460 holding lock on config file name=app-qa-build
[2026-11-15T16:45:46Z] INFO: Sent SIGTERM to VM process 31460 for graceful shutdown name=app-qa-build
[2026-11-15T16:45:46Z] INFO: Process 31460 exited after graceful shutdown name=app-qa-build
[2026-11-15T16:45:46Z] INFO: VM stopped successfully via process termination name=app-qa-build
[2026-11-15T16:45:46Z] INFO: VM stopped successfully name=app-qa-build
[2026-11-15T16:45:46Z] INFO: Deleting VM location=home name=app-qa-golden
[2026-11-15T16:45:47Z] INFO: VM deleted successfully name=app-qa-golden
[2026-11-15T16:45:47Z] INFO: Cloning VM destLocation=default destination=app-qa-golden source=app-qa-build sourceLocation=default
[2026-11-15T16:45:48Z] INFO: VM cloned successfully destination=app-qa-golden source=app-qa-build
name status
app-qa-build stopped
app-qa-golden stopped
1794761145 2026-11-15 17:45:45.803129657 +0100
```
