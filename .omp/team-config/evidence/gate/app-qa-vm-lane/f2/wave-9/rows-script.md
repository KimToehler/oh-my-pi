# rows-script

The wave-9 row scripts, verbatim except for home paths: the first row script (`/tmp/aqvl/w9/rows.sh`) and the route-lost re-run script (`/tmp/aqvl/w9/route-lost2.sh`) below, then the later parts under their own headings.
Home paths in the scripts are written as `~` (the original scripts use the absolute home path).

```bash
#!/bin/bash
# F2 wave 9 (closing wave of fix 7.12): hostkey-nc, then the rows that exercise each lane ssh consumer.
# Guest inspection ssh uses the pinned host key (the lane's own options), never StrictHostKeyChecking=no.
export PATH="$HOME/.local/bin:$PATH"
QA="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
WT=~/git/onara/.worktrees/app-qa-vm-f1
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out; rm -rf $O; mkdir -p $O
cp $LANE /tmp/aqvl/w9/lane-at-start.json
trap 'cp /tmp/aqvl/w9/lane-at-start.json $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { lume get app-qa-slot-1 --format json 2>/dev/null | jq -r 'if type=="array" then .[0] else . end | .ipAddress // empty'; }
guest() { echo "\$ guest: $1"; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$(gip) "$1" 2>&1; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"'; }
fwd() { (cd $WT && $QA vm status 2>/dev/null) | grep -o 'forward=[0-9]*' | head -1 | cut -d= -f2; }

echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### hostkey-nc"
ssh-keygen -q -t ed25519 -N '' -f $O/foreign >/dev/null
awk '{print "app-qa-golden", $1, $2}' $O/foreign.pub > $O/foreign_known_hosts
jq --arg k "$O/foreign_known_hosts" '.knownHosts = $k' $LANE > $O/lane-foreign.json
cp $LANE $O/lane-good.json
echo "lane file knownHosts -> $O/foreign_known_hosts (holds an unrelated ed25519 key under app-qa-golden)"
cp $O/lane-foreign.json $LANE
run $WT vm status
run $WT vm up ios
cp $O/lane-good.json $LANE
echo "lane file restored: knownHosts -> $(jq -r .knownHosts $LANE)"
run $WT vm status
lumels
guest 'ls -la ~/work 2>&1; find ~ -name ".dev-credentials.env" 2>/dev/null; echo "credentials files found: $(find ~ -name .dev-credentials.env 2>/dev/null | wc -l | tr -d " ")"'
guest 'xcrun simctl list devices booted; pgrep -fl "eu.onara.app.MainKt" || echo "no desktop app"'
run $WT vm down
run $WT vm status

echo; echo "### stage-first / route-preflight / args-flow / out-noout / locked-ios"
echo '$ host: xcrun simctl list devices booted'; xcrun simctl list devices booted
run $WT vm up ios
run $WT vm status
( cd $WT && { git ls-files --cached --others --exclude-standard; find app_kmp/iosApp/build/Build/Products/Debug-iphonesimulator/iosApp.app -type f; } | sort -u | while IFS= read -r f; do [ -f "$f" ] && [ ! -L "$f" ] && printf '%s\0' "$f"; done | xargs -0 shasum -a 256 > $O/host.sha )
ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$(gip) 'cd ~/work/onara && find . -type f ! -path "./.git/*" -print0 | xargs -0 shasum -a 256' > $O/guest.sha
python3 - $O/host.sha $O/guest.sha <<'PY'
import sys, unicodedata
def load(p, strip):
    d = {}
    for line in open(p, encoding="utf-8", errors="surrogateescape"):
        h, n = line.rstrip("\n").split("  ", 1)
        if strip and n.startswith("./"): n = n[2:]
        d[unicodedata.normalize("NFC", n)] = h
    return d
host, guest = load(sys.argv[1], False), load(sys.argv[2], True)
extra = sorted(set(guest) - set(host)); missing = sorted(set(host) - set(guest))
diff = sorted(n for n in set(host) & set(guest) if host[n] != guest[n])
print(f"host files {len(host)}, guest files {len(guest)}; guest-only: {extra}; host-only: {missing[:10]} ({len(missing)}); sha differs: {diff[:10]} ({len(diff)})")
PY
guest 'stat -f "%Lp %N" ~/work/onara/.dev-credentials.env'
guest 'curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/actuator/health'
echo "lock: $(lock)"
run $WT preflight ios
echo '$ host: xcrun simctl list devices booted'; xcrun simctl list devices booted
echo "lock: $(lock)"
run $WT/app_kmp flow ios maestro/f1-signin-home.yaml --account 1 --expect home
echo "lock: $(lock)"

echo; echo "### route-lost"
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home)   (background)  [$(date -u +%T)]"
( cd $WT && $QA flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home > $O/route-lost.out 2>&1; echo "[exit $?]" >> $O/route-lost.out ) &
bg=$!
sleep 70
F=$(fwd); echo "forward pid from vm status: $F"
echo '$ host: ps -o pid=,args= -p FORWARD (args cut to 90)'; ps -o pid=,args= -p "$F" | cut -c1-90
guest 'ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-110'
echo "\$ kill $F  [$(date -u +%T)]"; kill "$F"
wait $bg
echo '--- flow output ---'; cat $O/route-lost.out

echo; echo "### target-rerun"
run $WT vm up ios desktop
run $WT vm up ios desktop
run $WT vm status
guest 'xcrun simctl list devices booted'
guest "ps -axo pid=,args= | awk '\$2 ~ /\\/bin\\/java\$/ && \$NF == \"eu.onara.app.MainKt\" {print \$1}'"
echo '$ host: ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep   (args cut)'; ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep | cut -c1-80
run $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home

echo; echo "### target-desktop / out-capture / locked-desktop"
echo "lock: $(lock)"
run $WT vm up desktop
run $WT vm status
run $WT preflight desktop
run $WT desktop attach
run $WT desktop wait sign-in --timeout 60
run $WT desktop tap sign-in
run $WT desktop wait home --timeout 60
run $WT desktop capture home --out $O/cap/out
echo '$ ls -la out (perm size name)'; ls -la $O/cap/out | awk '{print $1,$5,$9}'
run $WT scan $O/cap
guest "ps -axo pid=,args= | awk '\$2 ~ /\\/bin\\/java\$/ && \$NF == \"eu.onara.app.MainKt\" {print \$1}'"
echo "lock: $(lock)"

echo; echo "### down-clean"
run $WT vm down
lumels
echo '$ host: ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep'; ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep | cut -c1-80; echo "(end)"
run $WT vm status
echo "lock after: $(lock)"
echo DONE
```

```bash
#!/bin/bash
# F2 wave 9, route-lost re-run. The first attempt (rows.log) ran the wait flow on the clone args-flow had
# just signed in, without a fresh `vm up ios`; sign-in found no login form and failed at 33 s, before the
# forward was killed at 70 s, so the forward loss was never exercised. As in wave 6: fresh `vm up ios`
# (restarts simulator and app), then the routed wait flow, forward killed about 70 s in.
export PATH="$HOME/.local/bin:$PATH"
QA="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
WT=~/git/onara/.worktrees/app-qa-vm-f1
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
O=/tmp/aqvl/w9/out-rl; rm -rf $O; mkdir -p $O
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { lume get app-qa-slot-1 --format json 2>/dev/null | jq -r 'if type=="array" then .[0] else . end | .ipAddress // empty'; }
guest() { echo "\$ guest: $1"; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$(gip) "$1" 2>&1; echo "[exit $?]"; }
fwd() { (cd $WT && $QA vm status 2>/dev/null) | grep -o 'forward=[0-9]*' | head -1 | cut -d= -f2; }

echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"
echo; echo "### route-lost (re-run)"
run $WT vm status
run $WT vm up ios
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home)   (background)  [$(date -u +%T)]"
( cd $WT && $QA flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home > $O/route-lost.out 2>&1; echo "[exit $?]" >> $O/route-lost.out ) &
bg=$!
sleep 70
F=$(fwd); echo "forward pid from vm status: $F  [$(date -u +%T)]"
echo '$ host: ps -o pid=,args= -p FORWARD (args cut to 90)'; ps -o pid=,args= -p "$F" | cut -c1-90
guest 'ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-110'
echo "\$ kill $F  [$(date -u +%T)]"; kill "$F"
wait $bg
echo "--- flow output (finished $(date -u +%T)) ---"; cat $O/route-lost.out
run $WT vm status
run $WT vm down
run $WT vm status
echo "lock after: $(lock)"
echo DONE
```

## `/tmp/aqvl/w9/rows2.sh`: Part 2 (single-lease rows)

```bash
#!/bin/bash
# F2 wave 9, part 2: every lane row not re-run by rows.sh (no-lease rows, then single-lease rows).
# Guest inspection ssh uses the pinned host key (the lane's own options), never StrictHostKeyChecking=no.
export PATH="$HOME/.local/bin:$PATH"
QA="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
STR=app_kmp/ui/src/commonMain/composeResources/values/strings.xml
KC=app_kmp/shared/src/commonMain/kotlin/eu/onara/app/auth/Keycloak.kt
O=/tmp/aqvl/w9/out2; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
for w in f1 f1b f1c; do cp ~/git/onara/.worktrees/app-qa-vm-$w/.omp/app-qa.json $O/cfg-$w.bak; done
cp $WT/$STR $O/strings.bak; cp $WT/$KC $O/kc-f1.bak; cp $WC/$KC $O/kc-f1c.bak
restore_all() { cp $O/lane.bak $LANE; for w in f1 f1b f1c; do cp $O/cfg-$w.bak ~/git/onara/.worktrees/app-qa-vm-$w/.omp/app-qa.json; done; cp $O/strings.bak $WT/$STR; cp $O/kc-f1.bak $WT/$KC; cp $O/kc-f1c.bak $WC/$KC; pkill -f /tmp/aqvl/relay.py; }
trap restore_all EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { lume get app-qa-slot-${1:-1} --format json 2>/dev/null | jq -r 'if type=="array" then .[0] else . end | .ipAddress // empty'; }
guest() { echo "\$ guest: $1"; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$(gip ${2:-1}) "$1" 2>&1; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
cfgset() { local w=$1; shift; jq "$@" $O/cfg-$w.bak > ~/git/onara/.worktrees/app-qa-vm-$w/.omp/app-qa.json; }
cfgrestore() { cp $O/cfg-$1.bak ~/git/onara/.worktrees/app-qa-vm-$1/.omp/app-qa.json; echo "\$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-$1/.omp/app-qa.json"; cmp $O/cfg-$1.bak ~/git/onara/.worktrees/app-qa-vm-$1/.omp/app-qa.json && echo identical; }
lanerestore() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
fwd() { (cd $WT && $QA vm status 2>/dev/null) | grep -o 'forward=[0-9]*' | head -1 | cut -d= -f2; }
gps() { guest "ps -axo pid=,args= | grep -E 'qa.mjs|maestro|xcodebuild|MainKt' | grep -v grep | cut -c1-100"; }

echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"
run $WT vm status
lumels

echo; echo "### cfg-newer"
cfgset f1 '.schema = "app-qa/3"'; echo 'config: schema set to app-qa/3'
run $WT preflight ios
run $WT vm status
cfgrestore f1

echo; echo "### cfg-v1"
cfgset f1 '.schema = "app-qa/1" | del(.vm)'; echo 'config: schema app-qa/1, vm section removed; lume on PATH is a logging wrapper'
rm -f /tmp/w6-h/lume-calls.log; touch /tmp/w6-h/lume-calls.log
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && PATH=/tmp/w6-h/shim:\$PATH qa.mjs preflight desktop --port 8081)"; (cd $WT && PATH=/tmp/w6-h/shim:$PATH $QA preflight desktop --port 8081 2>&1); echo "[exit $?]"
echo "lume calls logged: $(grep -c . /tmp/w6-h/lume-calls.log)"
cfgrestore f1

echo; echo "### cfg-nc"
lumels > $O/ls-before.txt; cat $O/ls-before.txt
echo 'sub-case 1: desktop.mainClass renamed mainClas'; cfgset f1 '.desktop.mainClas = .desktop.mainClass | del(.desktop.mainClass)'
run $WT preflight desktop --port 8081
cfgrestore f1
echo 'sub-case 2: vm section under schema app-qa/1'; cfgset f1 '.schema = "app-qa/1"'
run $WT preflight ios
cfgrestore f1
echo 'sub-case 3: configuration file removed'; rm $WT/.omp/app-qa.json
run $WT preflight ios
cfgrestore f1
lumels | diff $O/ls-before.txt - && echo 'lume ls unchanged'

echo; echo "### lane-nofile"
mv $LANE $O/lane.moved; echo 'lane file moved away'
run $WT preflight desktop --port 8081
run $WT vm up ios
mv $O/lane.moved $LANE; lanerestore

echo; echo "### lane-novm"
cfgset f1 'del(.vm)'; echo 'config: vm section removed'
run $WT preflight desktop --port 8081
run $WT vm status
cfgrestore f1

echo; echo "### lane-nc"
lumels > $O/ls-before.txt; cat $O/ls-before.txt
echo 'sub-case 1: slots renamed slotz'; jq '.slotz = .slots | del(.slots)' $O/lane.bak > $LANE
run $WT preflight ios
echo 'sub-case 2: image removed'; jq 'del(.image)' $O/lane.bak > $LANE
run $WT preflight ios
echo 'sub-case 3: image app-qa-slot-golden'; jq '.image = "app-qa-slot-golden"' $O/lane.bak > $LANE
run $WT vm up ios
echo 'sub-case 4: knownHosts removed'; jq 'del(.knownHosts)' $O/lane.bak > $LANE
run $WT vm up ios
lanerestore
lumels | diff $O/ls-before.txt - && echo 'lume ls unchanged'

echo; echo "### route-nolease"
run $WT vm status
run $WT desktop attach

echo; echo "### route-host"
echo "lock: $(lock)"
run $WT preflight desktop --host --port 8081

echo; echo "### stage-refresh"
sed -i '' 's#<string name="chat_title">Coach chat</string>#<string name="chat_title">Coach chat QA9</string>#' $WT/$STR
echo '$ git diff strings.xml (changed lines)'; git -C $WT diff -- $STR | grep '^[+-] '
run $WT vm up ios
run $WT vm status
lumels
guest "grep chat_title ~/work/onara/$STR"
echo '$ host: stat artifact Info.plist; date'; stat -f "%Sm %N" -t %H:%M:%S $WT/app_kmp/iosApp/build/Build/Products/Debug-iphonesimulator/iosApp.app/Info.plist | sed "s#$HOME#~#"; date +%H:%M:%S
run $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/sr
cp $O/strings.bak $WT/$STR; echo '$ cmp strings backup'; cmp $O/strings.bak $WT/$STR && echo 'string reverted: identical'; git -C $WT status --short

echo; echo "### cfg-subdir"
run $WT/app_kmp preflight ios

echo; echo "### redact-live"
run $WT vm status
head -c 40 $O/lane.bak > $LANE; echo 'lane file truncated to 40 bytes (invalid JSON)'
run $WT preflight ios
lanerestore
run $WT vm status

echo; echo "### stage-nc"
echo 'part 1: compile error appended in f1c (no lease of its own)'
echo 'val qaCompileError: Int = "not an int"' >> $WC/$KC
run $WC vm status
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios) > nc1.out; tail -8"; (cd $WC && $QA vm up ios > $O/nc1.out 2>&1); x=$?; tail -8 $O/nc1.out; echo "[exit $x]"
run $WC vm status
lumels
cp $O/kc-f1c.bak $WC/$KC; echo '$ cmp Keycloak.kt backup (f1c)'; cmp $O/kc-f1c.bak $WC/$KC && echo 'source reverted: identical'
echo 'config: vm.ios.artifact -> app_kmp/iosApp/build/missing-artifact.app'
cfgset f1c '.vm.ios.artifact = "app_kmp/iosApp/build/missing-artifact.app"'
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios) > nc2.out; tail -3"; (cd $WC && $QA vm up ios > $O/nc2.out 2>&1); x=$?; tail -3 $O/nc2.out; echo "[exit $x]"
cfgrestore f1c
run $WC vm status
echo 'part 2: the same compile error appended in f1 (staged ios lease)'
echo 'val qaCompileError: Int = "not an int"' >> $WT/$KC
echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios) > nc3.out; tail -5"; (cd $WT && $QA vm up ios > $O/nc3.out 2>&1); x=$?; tail -5 $O/nc3.out; echo "[exit $x]"
run $WT vm status
run $WT preflight ios
run $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
cp $O/kc-f1.bak $WT/$KC; echo '$ cmp Keycloak.kt backup (f1)'; cmp $O/kc-f1.bak $WT/$KC && echo 'source reverted: identical'; git -C $WT status --short

echo; echo "### route-port"
python3 /tmp/aqvl/relay.py & RELAY=$!; sleep 1
echo '$ curl http://127.0.0.1:8091/actuator/health'; curl -s -m 3 http://127.0.0.1:8091/actuator/health; echo
run $WC vm up ios --port 8091
run $WC vm status
run $WC/app_kmp preflight ios
run $WC/app_kmp preflight ios --port 8091
run $WC/app_kmp preflight ios --port 8081
run $WC vm down
kill $RELAY; sleep 1
echo '$ curl http://127.0.0.1:8091/actuator/health'; curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8091/actuator/health || echo 'relay stopped'
run $WC vm status

echo; echo "### args-shell / args-nc / out-nc / target-nc (lease with ios and desktop)"
run $WT vm up ios desktop
run $WT vm status
run $WT desktop attach
run $WT desktop wait sign-in --timeout 60
run $WT desktop tap sign-in
run $WT desktop wait home --timeout 60
echo '--- args-shell'
run $WT/app_kmp desktop type chat-input 'a "b" $HOME; c'
run $WT/app_kmp desktop find chat-input --equals 'a "b" $HOME; c'
echo '--- args-nc'
run $WT desktop type chat-input '$(id)'
run $WT desktop find chat-input --equals '$(id)'
gps
run $WT flow ios app_kmp/maestro/f1-signin-home.yaml --credentials /tmp/x
run $WT flow ios /tmp/w6-h/outsidedir/outside.yaml
gps
echo '--- out-nc'
run $WT desktop capture home --out $O/cap1/out
gps
run $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/cap1
run $WT desktop capture home --out $O/cap1/out
gps
run $WT desktop capture home --out $O/cap2/out
run $WT scan $O/cap2
echo '$ ls out'; ls $O/cap2/out
echo '--- target-nc'
P=$(ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$(gip) "ps -axo pid=,args= | awk '\$2 ~ /\\/bin\\/java\$/ && \$NF == \"eu.onara.app.MainKt\" {print \$1}'")
echo "guest app pid: $P"
guest "kill -9 $P; sleep 2; ps -axo pid=,args= | awk '\$2 ~ /\\/bin\\/java\$/ && \$NF == \"eu.onara.app.MainKt\"' | wc -l"
run $WT desktop attach

echo; echo "### route-nc"
run $WT vm up ios
run $WT vm status
run $WT desktop attach
F=$(fwd $WT); echo "forward pid from vm status: $F"
echo "\$ kill $F"; kill "$F"; sleep 1; ps -p "$F" -o pid= || echo 'forward gone'
run $WT preflight ios
run $WT vm status

echo; echo "### reset-reuse"
run $WT vm down
run $WB vm up ios
run $WB vm status
guest 'ls ~/work'
guest 'ls "${TMPDIR}app-qa" 2>&1; echo "(end)"'
run $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/rr

echo; echo "### down-nc"
run $WB vm down
lumels
run $WB vm status
echo '$ stat golden disk'; stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' ~/.lume/app-qa-golden/disk.img | sed "s#$HOME#~#"

echo; echo "### locked-nc"
echo "lock before: $(lock)"
run $WT vm up desktop
TQ="SELECT count(*) FROM access WHERE service='kTCCServiceScreenCapture';"
guest "sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' \"$TQ\""
guest "sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' \"DELETE FROM access WHERE service='kTCCServiceScreenCapture';\"; sudo pkill tccd; sleep 2"
guest "sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' \"$TQ\""
run $WT/app_kmp preflight desktop --port 8081
mv $LANE $O/lane.moved; echo 'lane file moved away'
run $WT/app_kmp preflight desktop --port 8081
mv $O/lane.moved $LANE; lanerestore
echo "lock after: $(lock)"
run $WT vm down
run $WT vm status
lumels
echo '$ host: ssh -R processes'; ps -axo pid=,args= | grep -E "ssh .*-R" | grep -v grep | cut -c1-80; echo "(end)"
echo "lock after: $(lock)"
echo DONE
```

## `/tmp/aqvl/w9/route-port2.sh`: route-port second attempt and reset-reuse repeat

```bash
#!/bin/bash
# F2 wave 9: route-port, second attempt (the first, in rows2.sh, ended in "app-qa-slot-2 did not accept an ssh connection"
# at host load ~45), then reset-reuse again (rows2.sh's guest inspection read no clone address).
# While vm up runs, a host-side probe logs every 15 s, for each slot clone listed: its lume status and address, whether its
# run process is alive, its DHCP lease address and one ssh attempt with the lane's own options (pinned key).
export PATH="$HOME/.local/bin:$PATH"
QA="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
O=/tmp/aqvl/w9/out-rp; rm -rf $O; mkdir -p $O
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR -o ConnectTimeout=10 lume@$ip "$@" 2>&1; }
guest() { local ip; ip=$(/tmp/aqvl/w9/gip.sh app-qa-slot-$2); echo "\$ guest (app-qa-slot-$2 at $ip): $1"; gssh "$ip" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
slotof() { (cd "$1" && $QA vm status 2>/dev/null) | grep "worktree=.*/$(basename $1) " | sed -E 's/^slot ([0-9]+):.*/\1/'; }
probe() {
  while :; do
    for c in app-qa-slot-1 app-qa-slot-2; do
      local j st ip alive dh tgt r
      j=$(lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c --arg n $c '.[] | select(.name==$n)')
      [ -z "$j" ] && continue
      st=$(jq -r '.status' <<<"$j"); ip=$(jq -r '.ipAddress // "-"' <<<"$j")
      alive=$(ps -axo args= | grep -c "lume run .*--vnc disabled $c\$")
      dh=$(/tmp/aqvl/w9/gip.sh $c); [ "$ip" != "-" ] && dh="(lume has one)"
      tgt=$([ "$ip" != "-" ] && echo "$ip" || echo "$dh")
      r="-"; [ -n "$tgt" ] && [ "$tgt" != "-" ] && r=$(gssh "$tgt" true; echo "rc=$?")
      echo "$(date -u +%T) load=$(sysctl -n vm.loadavg | awk '{print $2}') $c lume=$st ip=$ip run=$alive dhcp=${dh:--} ssh: $(echo "$r" | tr '\n' ' ' | cut -c1-120)"
    done
    sleep 15
  done
}
{
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"
echo; echo "### route-port"
python3 /tmp/aqvl/relay.py & RELAY=$!; sleep 1
echo '$ curl http://127.0.0.1:8091/actuator/health'; curl -s -m 3 http://127.0.0.1:8091/actuator/health; echo
run $WC vm status
probe > $O/probe.log 2>&1 & PR=$!
run $WC vm up ios --port 8091
kill $PR
run $WC vm status
run $WC/app_kmp preflight ios
run $WC/app_kmp preflight ios --port 8091
run $WC/app_kmp preflight ios --port 8081
S=$(slotof $WC); echo "f1c holds slot ${S:-none}"
run $WC vm down
kill $RELAY; sleep 1
echo '$ curl http://127.0.0.1:8091/actuator/health'; curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8091/actuator/health || echo 'relay stopped'
run $WC vm status
echo "--- probe log (every 15 s during vm up):"; cat $O/probe.log

echo; echo "### reset-reuse"
echo "(the f1c lease above was released by vm down; f1b now takes the freed slot)"
probe > $O/probe2.log 2>&1 & PR=$!
run $WB vm up ios
kill $PR
run $WB vm status
S=$(slotof $WB); echo "f1b holds slot ${S:-none}"
guest 'ls ~/work' $S
guest 'ls "${TMPDIR}app-qa" 2>&1; echo "(end)"' $S
run $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/rr
run $WB vm down
run $WB vm status
lumels
echo "--- probe log (every 15 s during vm up):"; cat $O/probe2.log
echo "lock after: $(lock)"
echo DONE
} 2>&1 | sed "s#$HOME#~#g"
```

## `/tmp/aqvl/w9/gip.sh`: clone address lookup used by route-port2.sh and rows3.sh

```bash
#!/bin/bash
# gip.sh CLONE: the clone's address as the driver finds it: lume ls's ipAddress, else the bootpd DHCP lease of its MAC.
export PATH="$HOME/.local/bin:$PATH"
j=$(lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c --arg n "$1" '.[] | select(.name==$n)')
[ -z "$j" ] && exit 1
ip=$(jq -r '.ipAddress // empty' <<<"$j")
[ -n "$ip" ] && { echo "$ip"; exit 0; }
mac=$(jq -r '.macAddress // empty' <<<"$j")
[ -z "$mac" ] && exit 1
python3 -c '
import sys,re
want=":".join(str(int(x,16)) for x in sys.argv[1].split(":"))
for b in open("/var/db/dhcpd_leases").read().split("}"):
    ip=re.search(r"ip_address=(\S+)",b); hw=re.search(r"hw_address=\d+,(\S+)",b)
    if ip and hw and ":".join(str(int(x,16)) for x in hw.group(1).split(":"))==want: print(ip.group(1)); break
' "$mac"
```

## `/tmp/aqvl/w9/rows3.sh`: Part 3 (multi-lease and kill rows)

```bash
#!/bin/bash
# F2 wave 9, part 3: multi-lease and kill rows. Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out3; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### lease-parallel"
run $WT vm status
bgrun up-f1 $WT vm up ios; P1=$!
bgrun up-f1b $WB vm up ios; P2=$!
sleep 40
echo "lume ls at $(date -u +%FT%TZ) (both starts running):"; lumels
wait $P1 $P2
cat $O/up-f1.out $O/up-f1b.out
echo "after both starts at $(date -u +%FT%TZ):"; lumels
run $WT vm status
bgrun fl-f1 $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1; P1=$!
bgrun fl-f1b $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1b; P2=$!
wait $P1 $P2
cat $O/fl-f1.out $O/fl-f1b.out

echo; echo "### lease-nc"
lumels > $O/ls-before.txt; cat $O/ls-before.txt
run $WC vm up ios
lumels | diff $O/ls-before.txt - && echo 'lume ls unchanged'

echo; echo "### reclaim-idle"
jq '.idleMinutes = 1' $O/lane.bak > $LANE; echo '$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json'; jq .idleMinutes $LANE
sleep 150
run $WC vm status
run $WC vm up ios
run $WC vm status
lumels
run $WT vm down
run $WB vm down
run $WC vm down
run $WT vm status
lumels
lanecmp

echo; echo "### reclaim-crash"
run $WT vm status
( cd $WT && exec $NODE $DRV vm up ios > $O/crash.out 2>&1 ) & D=$!
echo "driver pid $D at $(date -u +%FT%TZ)"
for i in $(seq 1 1200); do lume ls 2>/dev/null | grep -q 'app-qa-slot-1' && break; sleep 0.1; done
echo "clone listed at $(date -u +%FT%TZ)"; lumels
kill -9 $D; echo "kill -9 $D (driver) at $(date -u +%FT%TZ), exit $?"; wait $D 2>/dev/null; echo "driver wait status $?"
echo '--- vm up output before the kill:'; cat $O/crash.out
run $WT vm status
mutps
lumels

echo; echo "### reclaim-nc"
jq '.idleMinutes = 1' $O/lane.bak > $LANE; echo '$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json'; jq .idleMinutes $LANE
bgrun rn-f1 $WT vm up ios; P1=$!
bgrun rn-f1b $WB vm up ios; P2=$!
wait $P1 $P2
cat $O/rn-f1.out $O/rn-f1b.out
run $WT vm status
bgrun rn-flow $WT flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home; PF=$!
sleep 100
echo "== $(date -u +%FT%TZ) vm status during the running flow"; run $WT vm status
echo '== keep the other lease (f1b) fresh'; run $WB preflight ios
echo "== $(date -u +%FT%TZ) vm status"; run $WT vm status
echo '== third vm up (f1c)'; run $WC vm up ios
echo '== vm up ios in the flow worktree (f1)'; run $WT vm up ios
echo '== vm down of that lease (f1)'; run $WT vm down
echo "== $(date -u +%FT%TZ) vm status after the refusals"; run $WT vm status
wait $PF
echo '--- flow output'; cat $O/rn-flow.out
run $WT vm status
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp

echo; echo "### mutation-kill"
run $WT vm status
( cd $WT && exec $NODE $DRV vm up ios > $O/mk.out 2>&1 ) & D=$!
CL=""
for i in $(seq 1 1200); do CL=$(ps -axo pid=,args= | grep -E 'lume clone .*app-qa-slot-' | grep -v grep); [ -n "$CL" ] && break; sleep 0.1; done
echo "clone process seen: $(echo "$CL" | sed "s#$HOME#~#")"
kill -9 $D; echo "killed driver pid $D (SIGKILL) at $(date -u +%FT%TZ)"; wait $D 2>/dev/null
echo "driver output: $(cat $O/mk.out) (end)"
echo '--- right after the kill:'; mutps; lumels
run $WT vm status
mutps; lumels
run $WT vm status
sleep 60
echo "--- 60 s later, $(date -u +%T):"; mutps; lumels

echo; echo "### orphan-kill"
run $WT vm up ios
run $WT vm status
lumels
IP1=$(gip 1); echo "old clone app-qa-slot-1 address $IP1"
( cd $WT && exec $NODE $DRV flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home > $O/ok-flow.out 2>&1 ) & D=$!
for i in $(seq 1 120); do gssh $IP1 'ps -axo args= | grep -E "maestro|qa.mjs flow" | grep -v grep' | grep -q . && break; sleep 2; done
sleep 5
echo '$ guest: ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep   (args cut to 120)'; gssh $IP1 'ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-120'
echo "host driver pid $D"; kill -9 $D; wait $D 2>/dev/null; ps -p $D -o pid= >/dev/null && echo "pid $D alive" || echo "pid $D gone"
echo '$ host ssh to the old address right after the kill:'; ps -axo pid=,args= | grep -E '(^| |/)ssh ' | grep -v grep | grep "$IP1" | sed "s#$HOME#~#" | cut -c1-150; echo '(end)'
run $WT vm status
run $WT vm up ios
lumels
IP2=$(gip 1); echo "new clone app-qa-slot-1 address $IP2"
guest 'ps -axo pid=,args= | grep -E "maestro|qa.mjs flow" | grep -v grep | cut -c1-120; echo "(none above = none)"'
sleep 120
echo "$(date -u +%T) host ssh to the old address $IP1, about 2 min after the recreating vm up:"; ps -axo args= | grep -E '(^| |/)ssh ' | grep -v grep | grep -c "$IP1"
echo '--- forward ssh:'; ps -axo pid=,etime=,args= | grep -E '(^| |/)ssh .*-R' | grep -v grep | sed "s#$HOME#~#" | cut -c1-120
run $WT vm status
run $WT vm down
run $WT vm status
lumels
echo "lock after: $(lock)"
echo DONE
```

## `/tmp/aqvl/w9/mk2.sh`: mutation-kill re-run

```bash
#!/bin/bash
# F2 wave 9, mutation-kill re-run. rows3.sh's poll (ps|grep every 0.1 s) never saw the `lume clone` child: the clone
# finished first and vm up completed, so its kill hit a driver that had already exited. Here: pgrep every 10 ms from a
# free slot, kill the driver the moment a `lume clone|stop|delete ... app-qa-slot-` child exists; up to 3 attempts,
# each attempt that misses the child releases its lease with vm down before the next.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
O=/tmp/aqvl/w9/out-mk; rm -rf $O; mkdir -p $O
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }
{
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"
echo; echo "### mutation-kill"
run $WT vm down
run $WT vm status
for a in 1 2 3; do
  echo "--- attempt $a"
  ( cd $WT && exec $NODE $DRV vm up ios > $O/mk-$a.out 2>&1 ) & D=$!
  CL=""
  while kill -0 $D 2>/dev/null; do CL=$(pgrep -fl 'lume (clone|stop|delete) .*app-qa-slot-'); [ -n "$CL" ] && break; sleep 0.01; done
  if [ -n "$CL" ]; then
    kill -9 $D; echo "clone process seen: $(echo "$CL" | sed "s#$HOME#~#")"; echo "killed driver pid $D (SIGKILL) at $(date -u +%FT%TZ)"
    wait $D 2>/dev/null; echo "driver output: $(cat $O/mk-$a.out) (end)"
    break
  fi
  wait $D; echo "missed: the driver exited ($?) before a lume mutation child was seen; output: $(cat $O/mk-$a.out)"
  run $WT vm down
done
echo '--- right after the kill:'; mutps; lumels
run $WT vm status
mutps; lumels
run $WT vm status
sleep 60
echo "--- 60 s later, $(date -u +%T):"; mutps; lumels
run $WT vm status
echo "lock after: $(lock)"
echo DONE
} 2>&1 | sed "s#$HOME#~#g"
```

## `/tmp/aqvl/w9/chain-a.sh`: cfg-override and the single-lease agent rows

```bash
#!/bin/bash
D=/tmp/aqvl/w9
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'; }
echo "cfg-override start $(date -u +%T)"; $D/cfg-override.sh
echo "agent-lane start $(date -u +%T) $(lock)"; $D/agent-session.sh agent-lane app-qa-vm-f1 'Sign account 1 into the app on the iOS simulator and show me the screen.'; echo "lock after: $(lock)" > $D/agent-lane.lock
echo "agent-edit start $(date -u +%T) $(lock)"; $D/agent-session.sh agent-edit app-qa-vm-f1b 'On the signed-in home screen of the app, change the text "Coach chat" to "Coach chat F9" and show me the changed home screen on the iOS simulator.'; echo "lock after: $(lock)" > $D/agent-edit.lock
echo "chain end $(date -u +%T) $(lock)"
```

## `/tmp/aqvl/w9/cfg-override.sh`: cfg-override

```bash
#!/bin/bash
# cfg-override (wave 9): in a ready ios lease, a lane command with --config naming a valid file without vm is refused
# naming --host and runs nothing on the host; the same file with --host runs the host checks (the file is valid).
export PATH="$HOME/.local/bin:$PATH"
QA="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
F1=~/git/onara/.worktrees/app-qa-vm-f1
ALT=/tmp/aqvl/w9/alt-qa.json
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'; }
step() { echo "\$ (cd ~/git/onara/.worktrees/app-qa-vm-f1$1) \$QA $2"; (cd "$F1$1" && eval "$QA $2"); echo "[exit $?]"; }
{
echo "Run $(date -u +%FT%TZ)"
echo "Lock state before: $(lock)"
node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));delete c.vm;require("fs").writeFileSync(process.argv[2],JSON.stringify(c,null,2)+"\n")' "$F1/.omp/app-qa.json" "$ALT"
echo "alt config: $ALT = onara's .omp/app-qa.json without its vm section; keys: $(node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))).join(","))' $ALT)"
step '' 'vm status'
step '' 'vm up ios'
echo "--- host processes before (simctl, maestro, spectre, xcodebuild):"
ps -axo pid=,args= | grep -E 'simctl|maestro|spectre|xcodebuild' | grep -v grep | cut -c1-140
step '/app_kmp' "preflight ios --config $ALT"
step '/app_kmp' "preflight desktop --config $ALT"
step '/app_kmp' "flow ios maestro/f1-signin-home.yaml --config $ALT"
echo "--- host processes after:"
ps -axo pid=,args= | grep -E 'simctl|maestro|spectre|xcodebuild' | grep -v grep | cut -c1-140
step '/app_kmp' 'preflight ios'
step '/app_kmp' "preflight ios --host --config $ALT"
step '' 'vm down'
step '' 'vm status'
echo "Lock state after: $(lock)"
} 2>&1 | sed "s#$HOME#~#g" > /tmp/aqvl/w9/cfg-override.log
echo DONE
```

## `/tmp/aqvl/w9/agent-session.sh`: one fresh omp session per agent row

```bash
#!/bin/bash
# agent-session.sh NAME WORKTREE PROMPT: one fresh omp session in an onara scratch worktree, outputs under /tmp/aqvl/w9/
set -u
N=$1; WT=$2; P=$3; D=/tmp/aqvl/w9
export PATH="$HOME/.local/bin:$PATH"
rm -rf "$D/$N-sess" "$D/$N.done"
cd ~/git/onara/.worktrees/"$WT" || exit 1
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status | sed "s#$HOME#~#g" > "$D/$N.status-before"
date -u +%FT%TZ > "$D/$N.start"
omp --version > "$D/$N.version"
omp -p --mode json --session-dir "$D/$N-sess" "$P" > "$D/$N.jsonl" 2> "$D/$N.err"
echo "exit=$? end=$(date -u +%FT%TZ)" > "$D/$N.done"
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status | sed "s#$HOME#~#g" > "$D/$N.status-after"
git status --short > "$D/$N.git-after"
git diff > "$D/$N.diff-after"
cat "$D/$N.done"
```

## `/tmp/aqvl/w9/rows4.sh`: Part 4: re-run of the slot-2 rows (lease-parallel, reclaim-idle, reclaim-nc) once no macOS VM outside the lane runs

```bash
#!/bin/bash
# F2 wave 9, part 4: re-run of the slot-2 rows (lease-parallel, reclaim-idle, reclaim-nc) after the foreign macOS VM kmp-sc-f1 stopped. Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out4; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

foreign() { lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | select(.os=="macOS" and .status=="running" and (.name|startswith("app-qa-slot-")|not)) | .name'; }
F=$(foreign); if [ -n "$F" ]; then echo "abort: foreign macOS VM running: $F"; exit 3; fi
echo "running macOS VMs outside the lane at start: none"
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### lease-parallel"
run $WT vm status
bgrun up-f1 $WT vm up ios; P1=$!
bgrun up-f1b $WB vm up ios; P2=$!
sleep 40
echo "lume ls at $(date -u +%FT%TZ) (both starts running):"; lumels
wait $P1 $P2
cat $O/up-f1.out $O/up-f1b.out
echo "after both starts at $(date -u +%FT%TZ):"; lumels
run $WT vm status
bgrun fl-f1 $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1; P1=$!
bgrun fl-f1b $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1b; P2=$!
wait $P1 $P2
cat $O/fl-f1.out $O/fl-f1b.out
echo "running macOS VMs outside the lane after lease-parallel: [$(foreign | tr "\n" " ")]"
echo; echo "### reclaim-idle"
jq '.idleMinutes = 1' $O/lane.bak > $LANE; echo '$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json'; jq .idleMinutes $LANE
sleep 150
run $WC vm status
run $WC vm up ios
run $WC vm status
lumels
run $WT vm down
run $WB vm down
run $WC vm down
run $WT vm status
lumels
lanecmp
echo; echo "### reclaim-nc"
jq '.idleMinutes = 1' $O/lane.bak > $LANE; echo '$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json'; jq .idleMinutes $LANE
bgrun rn-f1 $WT vm up ios; P1=$!
bgrun rn-f1b $WB vm up ios; P2=$!
wait $P1 $P2
cat $O/rn-f1.out $O/rn-f1b.out
run $WT vm status
bgrun rn-flow $WT flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home; PF=$!
sleep 100
echo "== $(date -u +%FT%TZ) vm status during the running flow"; run $WT vm status
echo '== keep the other lease (f1b) fresh'; run $WB preflight ios
echo "== $(date -u +%FT%TZ) vm status"; run $WT vm status
echo '== third vm up (f1c)'; run $WC vm up ios
echo '== vm up ios in the flow worktree (f1)'; run $WT vm up ios
echo '== vm down of that lease (f1)'; run $WT vm down
echo "== $(date -u +%FT%TZ) vm status after the refusals"; run $WT vm status
wait $PF
echo '--- flow output'; cat $O/rn-flow.out
run $WT vm status
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp
echo "running macOS VMs outside the lane at end: [$(foreign | tr "\n" " ")]"
echo "lock after: $(lock)"; echo DONE
```

## `/tmp/aqvl/w9/agent-nc.sh`: agent-nc (both slots held, then one fresh session)

```bash
#!/bin/bash
# agent-nc (wave 9): both slots held by fresh leases (f1, f1b), then a fresh session in f1c, then release
export PATH="$HOME/.local/bin:$PATH"
Q="node $HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs"
D=/tmp/aqvl/w9
{ for w in app-qa-vm-f1 app-qa-vm-f1b; do cd ~/git/onara/.worktrees/$w; echo "\$ ($w) vm up ios  [$(date -u +%T)]"; $Q vm up ios 2>&1 | sed "s#$HOME#~#g"; echo "[exit ${PIPESTATUS[0]}]"; done
  cd ~/git/onara/.worktrees/app-qa-vm-f1c; echo '$ (f1c) vm status'; $Q vm status | sed "s#$HOME#~#g"; } > $D/agent-nc-pre.txt 2>&1
/tmp/aqvl/w9/agent-session.sh agent-nc app-qa-vm-f1c 'Sign account 1 into the app on the iOS simulator and show me the screen.'
{ for w in app-qa-vm-f1 app-qa-vm-f1b; do cd ~/git/onara/.worktrees/$w; echo "\$ ($w) vm down"; $Q vm down 2>&1 | sed "s#$HOME#~#g"; echo "[exit ${PIPESTATUS[0]}]"; done
  echo '$ vm status; lume ls'; $Q vm status | sed "s#$HOME#~#g"; lume ls | awk '/app-qa-/{print $1}'
  echo "lock: $(ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*')"; } > $D/agent-nc-post.txt 2>&1
cat $D/agent-nc-pre.txt $D/agent-nc.status-before $D/agent-nc.status-after $D/agent-nc.git-after $D/agent-nc-post.txt
```

## `/tmp/aqvl/w9/rows5.sh`: Part 5: second lease-parallel attempt

```bash
#!/bin/bash
# F2 wave 9, part 5: second lease-parallel attempt (the part-4 attempt had both flows fail on the 30 s login-form wait under host load). Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out5; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

foreign() { lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | select(.os=="macOS" and .status=="running" and (.name|startswith("app-qa-slot-")|not)) | .name'; }
F=$(foreign); if [ -n "$F" ]; then echo "abort: foreign macOS VM running: $F"; exit 3; fi
echo "running macOS VMs outside the lane at start: none"
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### lease-parallel"
run $WT vm status
bgrun up-f1 $WT vm up ios; P1=$!
bgrun up-f1b $WB vm up ios; P2=$!
sleep 40
echo "lume ls at $(date -u +%FT%TZ) (both starts running):"; lumels
wait $P1 $P2
cat $O/up-f1.out $O/up-f1b.out
echo "after both starts at $(date -u +%FT%TZ):"; lumels
run $WT vm status
bgrun fl-f1 $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1; P1=$!
bgrun fl-f1b $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1b; P2=$!
wait $P1 $P2
cat $O/fl-f1.out $O/fl-f1b.out
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp
echo "running macOS VMs outside the lane at end: [$(foreign | tr "\n" " ")]"
echo "lock after: $(lock)"; echo DONE
```

## `/tmp/aqvl/w9/rows6.sh`: Part 6: reclaim-nc with up to three flow attempts

```bash
#!/bin/bash
# F2 wave 9, part 6: reclaim-nc re-run with up to three flow attempts (the part-4 attempt's wait flow failed on the 30 s login-form wait under host load, before the idle limit passed). Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out6; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

foreign() { lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | select(.os=="macOS" and .status=="running" and (.name|startswith("app-qa-slot-")|not)) | .name'; }
F=$(foreign); if [ -n "$F" ]; then echo "abort: foreign macOS VM running: $F"; exit 3; fi
echo "running macOS VMs outside the lane at start: none"

echo; echo "### reclaim-nc"
jq '.idleMinutes = 1' $O/lane.bak > $LANE; echo '$ jq .idleMinutes ~/.omp/agent/app-qa-vm.json'; jq .idleMinutes $LANE
bgrun rn-f1 $WT vm up ios; P1=$!
bgrun rn-f1b $WB vm up ios; P2=$!
wait $P1 $P2
cat $O/rn-f1.out $O/rn-f1b.out
run $WT vm status
for a in 1 2 3; do
  echo "--- flow attempt $a"
  bgrun rn-flow-$a $WT flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home; PF=$!
  sleep 100
  if kill -0 $PF 2>/dev/null; then echo "flow attempt $a still running at $(date -u +%FT%TZ)"; break; fi
  echo "flow attempt $a ended before the idle limit passed:"; cat $O/rn-flow-$a.out
  if [ $a = 3 ]; then echo 'no attempt ran past the idle limit'; PF=; break; fi
  echo '== fresh vm up ios in f1 before the next attempt'; run $WT vm up ios
  echo '== keep the other lease (f1b) fresh'; run $WB preflight ios
done
if [ -n "$PF" ]; then
echo "== $(date -u +%FT%TZ) vm status during the running flow"; run $WT vm status
echo '== guest app pid and host forward pid before the refusals'; guest "pgrep -fl 'eu.onara.app.kmp|maestro' | cut -c1-120" 1; ps -axo pid=,args= | grep -E '^ *[0-9]+ /usr/bin/ssh .* -R ' | grep -v grep | sed "s#$HOME#~#g" | cut -c1-120
echo '== keep the other lease (f1b) fresh'; run $WB preflight ios
echo "== $(date -u +%FT%TZ) vm status"; run $WT vm status
echo '== third vm up (f1c)'; run $WC vm up ios
echo '== vm up ios in the flow worktree (f1)'; run $WT vm up ios
echo '== vm down of that lease (f1)'; run $WT vm down
echo '== guest app pid and host forward pid after the refusals'; guest "pgrep -fl 'eu.onara.app.kmp|maestro' | cut -c1-120" 1; ps -axo pid=,args= | grep -E '^ *[0-9]+ /usr/bin/ssh .* -R ' | grep -v grep | sed "s#$HOME#~#g" | cut -c1-120
echo "== $(date -u +%FT%TZ) vm status after the refusals"; run $WT vm status
wait $PF
echo '--- flow output'; cat $O/rn-flow-$a.out
fi
run $WT vm status
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp
echo "running macOS VMs outside the lane at end: [$(foreign | tr "\n" " ")]"
echo "lock after: $(lock)"; echo DONE
```

## `/tmp/aqvl/w9/rows7.sh`: Part 7: third lease-parallel attempt

```bash
#!/bin/bash
# F2 wave 9, part 7: third lease-parallel attempt (part 4: both flows, part 5: one flow failed on the 30 s login-form wait under host load). Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out7; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

foreign() { lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | select(.os=="macOS" and .status=="running" and (.name|startswith("app-qa-slot-")|not)) | .name'; }
F=$(foreign); if [ -n "$F" ]; then echo "abort: foreign macOS VM running: $F"; exit 3; fi
echo "running macOS VMs outside the lane at start: none"
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### lease-parallel"
run $WT vm status
bgrun up-f1 $WT vm up ios; P1=$!
bgrun up-f1b $WB vm up ios; P2=$!
sleep 40
echo "lume ls at $(date -u +%FT%TZ) (both starts running):"; lumels
wait $P1 $P2
cat $O/up-f1.out $O/up-f1b.out
echo "after both starts at $(date -u +%FT%TZ):"; lumels
run $WT vm status
bgrun fl-f1 $WT flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1; P1=$!
bgrun fl-f1b $WB flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out $O/lp-f1b; P2=$!
wait $P1 $P2
cat $O/fl-f1.out $O/fl-f1b.out
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp
echo "running macOS VMs outside the lane at end: [$(foreign | tr "\n" " ")]"
echo "lock after: $(lock)"; echo DONE
```

## `/tmp/aqvl/w9/rows8.sh`: Part 8: fourth lease-parallel attempt with a scratch flow

```bash
#!/bin/bash
# F2 wave 9, part 8: fourth lease-parallel attempt with the scratch flow f1-signin-par.yaml (parts 4, 5 and 7: one or both flows failed when the consent alert appeared after signin-ios.yaml checked for it). Guest ssh uses the pinned host key.
export PATH="$HOME/.local/bin:$PATH"
NODE=$(command -v node)
DRV=$HOME/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs
QA="$NODE $DRV"
WT=~/git/onara/.worktrees/app-qa-vm-f1
WB=~/git/onara/.worktrees/app-qa-vm-f1b
WC=~/git/onara/.worktrees/app-qa-vm-f1c
KEY=~/.omp/agent/app-qa-vm_ed25519
KH=~/.omp/agent/app-qa-vm_known_hosts
LANE=~/.omp/agent/app-qa-vm.json
O=/tmp/aqvl/w9/out8; rm -rf $O; mkdir -p $O
cp $LANE $O/lane.bak
trap 'cp $O/lane.bak $LANE' EXIT
lock() { ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*' || echo 'CGSSessionScreenIsLocked absent'; }
run() { local dir=$1; shift; echo "\$ (cd ${dir/#$HOME/~} && qa.mjs $*)  [$(date -u +%T)]"; (cd "$dir" && $QA "$@" 2>&1); echo "[exit $?]"; }
gip() { /tmp/aqvl/w9/gip.sh "app-qa-slot-${1:-1}"; }
gssh() { local ip=$1; shift; ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KH -o GlobalKnownHostsFile=/dev/null -o HostKeyAlias=app-qa-golden -o LogLevel=ERROR lume@$ip "$@" 2>&1; }
guest() { echo "\$ guest (slot ${2:-1}): $1"; gssh "$(gip ${2:-1})" "$1"; echo "[exit $?]"; }
lumels() { echo '$ lume ls (name, status)'; lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | "\(.name) \(.status)"' | sort; }
lanecmp() { cp $O/lane.bak $LANE; echo '$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json'; cmp $O/lane.bak $LANE && echo identical; }
bgrun() { # bgrun NAME DIR ARGS...: background driver, output to $O/NAME.out with start/end
  local n=$1 d=$2; shift 2
  ( echo "\$ (cd ${d/#$HOME/~} && qa.mjs $*)"; echo "start $(date -u +%FT%TZ)"; cd "$d" && $QA "$@" 2>&1; echo "[exit $?]"; echo "end $(date -u +%FT%TZ)" ) > $O/$n.out 2>&1 &
}
mutps() { ps -axo pid=,args= | grep -E 'lume (clone|stop|delete) .*app-qa-slot-' | grep -v grep | sed "s#$HOME#~#"; echo '(end of lume mutation processes)'; }

foreign() { lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -r '.[] | select(.os=="macOS" and .status=="running" and (.name|startswith("app-qa-slot-")|not)) | .name'; }
F=$(foreign); if [ -n "$F" ]; then echo "abort: foreign macOS VM running: $F"; exit 3; fi
echo "running macOS VMs outside the lane at start: none"
echo "Run $(date -u +%FT%TZ) head $(git -C ~/git/oh-my-pi/.worktrees/app-qa-vm-lane rev-parse HEAD); lock before: $(lock)"

echo; echo "### lease-parallel"
run $WT vm status
bgrun up-f1 $WT vm up ios; P1=$!
bgrun up-f1b $WB vm up ios; P2=$!
sleep 40
echo "lume ls at $(date -u +%FT%TZ) (both starts running):"; lumels
wait $P1 $P2
cat $O/up-f1.out $O/up-f1b.out
echo "after both starts at $(date -u +%FT%TZ):"; lumels
run $WT vm status
bgrun fl-f1 $WT flow ios app_kmp/maestro/f1-signin-par.yaml --account 1 --expect home --out $O/lp-f1; P1=$!
bgrun fl-f1b $WB flow ios app_kmp/maestro/f1-signin-par.yaml --account 1 --expect home --out $O/lp-f1b; P2=$!
wait $P1 $P2
cat $O/fl-f1.out $O/fl-f1b.out
run $WT vm down
run $WB vm down
run $WT vm status
lumels
lanecmp
echo "running macOS VMs outside the lane at end: [$(foreign | tr "\n" " ")]"
echo "lock after: $(lock)"; echo DONE
```

## `app_kmp/maestro/f1-signin-par.yaml` (scratch, untracked, identical in `app-qa-vm-f1` and `app-qa-vm-f1b`)

```yaml
# F1 scratch flow (oh-my-pi app-qa-vm-lane lease-parallel), not committed: f1-signin-home with one wait added.
# signin-ios.yaml checks the "Continue" consent alert once, right after the sign-in tap; with two guests under host load the
# alert can appear after that check, and the subflow then waits for a form the alert hides. This flow taps sign-in and waits
# for the alert or the form before running the unchanged subflow. The screenshot follows the home assertion (ui-automation-credentials).
appId: eu.onara.app.kmp
---
- runFlow:
    when:
      visible:
        id: "sign-in"
    commands:
      - tapOn:
          id: "sign-in"
- extendedWaitUntil:
    visible: "Continue|Fortfahren|Username or email"
    timeout: 90000
- runFlow: signin-ios.yaml
- assertVisible:
    id: "home"
- takeScreenshot: f1-home
```
