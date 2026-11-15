// Fake ssh for qa.test.mjs: a port forward (-N) stays alive until killed; any other call runs the joined remote command
// through `sh -c` (as sshd does) in a local guest directory with the guest's environment. state (FAKE_SSH_STATE):
// guestDir, env, exit255 ('before' | 'after'), connectFails.
const fs = require('fs');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const st = JSON.parse(fs.readFileSync(process.env.FAKE_SSH_STATE, 'utf8'));
const withValue = new Set(['-i', '-o', '-R', '-L', '-p', '-l', '-F', '-J']);
let i = 0;
while (i < argv.length && argv[i].startsWith('-')) i += withValue.has(argv[i]) ? 2 : 1;
const host = argv[i];
const command = argv.slice(i + 1).join(' ');
const forward = argv.includes('-N');
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'ssh', argv, pid: process.pid, forward })}\n`);
if (forward) {
  process.on('SIGTERM', () => process.exit(143));
  setInterval(() => {}, 1 << 30);
} else if (st.exit255 === 'before' || st.connectFails) {
  process.stderr.write(`ssh: connect to host ${host} port 22: Connection refused\n`);
  process.exit(255);
} else {
  const r = spawnSync('/bin/sh', ['-c', command], { cwd: st.guestDir, env: st.env, stdio: 'inherit' });
  process.exit(st.exit255 === 'after' ? 255 : (r.status ?? 1));
}
