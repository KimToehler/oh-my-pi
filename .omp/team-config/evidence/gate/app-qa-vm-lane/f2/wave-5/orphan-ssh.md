# orphan-ssh (parent observation after orphan-kill)

Run 2026-11-16T16:03:35Z on head `71072693cc0f650f4ff974c31f164907f4b89d70` (deployed). Home paths are written as `~`.

```
$ ps -o pid,ppid,etime,args -p 51049 | cut -c1-330
  PID PPID ELAPSED COMMAND
51049    1 50:31   /usr/bin/ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 lume@192.168.64.79 printf '%s\n' '@@app-qa-lane-env@@' "$HOME" "${TMPDIR:-/tmp}" nc -z 127.0.0.1 8081 >/dev/null 2>&1 || { printf '%s\n' '@
$ lume ls (name, status)
name status
app-qa-build stopped
app-qa-golden stopped
$ route 192.168.64.79 reachable? (nc -z -G 3 192.168.64.79 22)
[exit 1]
```

```
$ kill 51049; sleep 1; ps -p 51049
PID TTY TIME CMD
[exit 1]
```

Observation: after `orphan-kill` (its host driver pid 51028 was killed with SIGKILL at about 15:13Z and the next `vm up` deleted and recreated `app-qa-slot-1`), the routed command's host ssh child (pid 51049, re-parented to pid 1) was still alive about 50 minutes later, connected to the deleted clone's address `192.168.64.79`, which no longer answers. The ssh options (`sshBase` in `qa.mjs`) set `ConnectTimeout` but no `ServerAliveInterval`, so an ssh whose guest vanished never notices. Each routed command killed without its `finally` leaves one such host process indefinitely. Killed here after recording.

Verdict: FAIL (leaked host ssh process; finding for the next round)
