// Fake ssh for qa.test.mjs: a port forward (-N) stays alive until killed; any other call runs the joined remote command
// through `sh -c` (as sshd does) in a local guest directory with the guest's environment. state (FAKE_SSH_STATE):
// guestDir, env, exit255 ('before' | 'after'), connectFails.
// watchPeer: the state is read again every 25 ms while the command runs; once peerGone is true the guest has vanished
// without closing the connection: its command is killed, nothing more arrives, and ssh exits 255 only after
// ServerAliveInterval x ServerAliveCountMax seconds (aliveSecondMs ms each, default 1000), as OpenSSH's keepalive
// does; without both options it never exits, since a vanished peer sends no close.
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const readState = () => JSON.parse(fs.readFileSync(process.env.FAKE_SSH_STATE, 'utf8'));
const st = readState();
const withValue = new Set(['-i', '-o', '-R', '-L', '-p', '-l', '-F', '-J']);
let i = 0;
while (i < argv.length && argv[i].startsWith('-')) i += withValue.has(argv[i]) ? 2 : 1;
const host = argv[i];
const command = argv.slice(i + 1).join(' ');
const forward = argv.includes('-N');
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'ssh', argv, pid: process.pid, forward })}\n`);
/** The value of `-o NAME=VALUE` as a number, or null when absent. */
function option(name) {
  for (let k = 0; k < argv.length - 1; k++) {
    if (argv[k] === '-o' && argv[k + 1].startsWith(`${name}=`)) return Number(argv[k + 1].slice(name.length + 1));
  }
  return null;
}
if (forward) {
  process.on('SIGTERM', () => process.exit(143));
  setInterval(() => {}, 1 << 30);
} else if (st.exit255 === 'before' || st.connectFails) {
  process.stderr.write(`ssh: connect to host ${host} port 22: Connection refused\n`);
  process.exit(255);
} else if (st.watchPeer) {
  const child = spawn('/bin/sh', ['-c', command], { cwd: st.guestDir, env: st.env, stdio: 'inherit', detached: true });
  child.on('close', (code) => process.exit(code ?? 1));
  const watch = setInterval(() => {
    if (!readState().peerGone) return;
    clearInterval(watch);
    child.removeAllListeners('close');
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
    const interval = option('ServerAliveInterval');
    const count = option('ServerAliveCountMax');
    if (!(interval > 0 && count > 0)) return setInterval(() => {}, 1 << 30);
    setTimeout(() => {
      process.stderr.write(`Timeout, server ${host} not responding.\n`);
      process.exit(255);
    }, interval * count * (st.aliveSecondMs ?? 1000));
  }, 25);
} else {
  const r = spawnSync('/bin/sh', ['-c', command], { cwd: st.guestDir, env: st.env, stdio: 'inherit' });
  process.exit(st.exit255 === 'after' ? 255 : (r.status ?? 1));
}
