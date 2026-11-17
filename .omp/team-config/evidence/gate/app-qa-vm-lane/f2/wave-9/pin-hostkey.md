# pin-hostkey

vm-image.md step 11 ("Pin the host key") run on this machine before wave 9 against the build VM `app-qa-build` (no credential, no repository inside), by `/tmp/aqvl/w9/pin-hostkey.sh`; home paths written as `~`.

```
$ lume run app-qa-build --detach --display none --vnc disabled
[exit 0]
ADDRESS=192.168.64.3
previous pin kept as ~/.omp/agent/app-qa-vm_known_hosts.pre-wave-9: 192.168.64.3 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID8iuWBMVmZ3jvg1zZ/vcxWu9h7e2vcoT40MXxtcH9Uz
$ ssh-keyscan -t ed25519 192.168.64.3 2>/dev/null | awk '{print "app-qa-golden", $2, $3}' > ~/.omp/agent/app-qa-vm_known_hosts
[exit 0]
$ cat ~/.omp/agent/app-qa-vm_known_hosts
app-qa-golden 192.168.64.3:22 SSH-2.0-OpenSSH_10.5
app-qa-golden ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID8iuWBMVmZ3jvg1zZ/vcxWu9h7e2vcoT40MXxtcH9Uz
$ ssh -i KEY -o StrictHostKeyChecking=yes -o UserKnownHostsFile=~/.omp/agent/app-qa-vm_known_hosts -o HostKeyAlias=app-qa-golden lume@192.168.64.3 true
[exit 0]
$ ssh ... 'sudo shutdown -h now'
status=stopped
```

Finding (wave 9, while assembling the matrix): the pin file above holds a second line, `app-qa-golden 192.168.64.3:22 SSH-2.0-OpenSSH_10.5`. `ssh-keyscan` (OpenSSH_10.5p1) prints its `# ADDRESS:22 SSH-...` banner on stdout, so step 11's `awk` turned it into a malformed known-hosts entry. ssh skips such a line (its key type field is not a key type), so the file pinned exactly one key either way. Reproduced on the host with `ssh-keyscan -t ed25519 github.com 2>/dev/null | awk '{print "app-qa-golden", $2, $3}'` (two lines out) against `awk '!/^#/ {...}'` (one line). Machine state: a two-line copy of the file is kept as `~/.omp/agent/app-qa-vm_known_hosts.pre-step11-20261117` (written 13:31 local); the pin file the lane reads held only the key line when checked at 19:33 local, after the last wave-9 lane row. Not fixed in this wave (the tree stays at the snapshot head until the wave is recorded): step 11's `awk` needs `!/^#/`, reported as a wave-9 finding.
