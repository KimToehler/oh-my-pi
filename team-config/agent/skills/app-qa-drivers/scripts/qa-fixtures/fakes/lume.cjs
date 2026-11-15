// Fake lume 0.7.2 for qa.test.mjs: a clone list in the state file FAKE_LUME_STATE, every call logged to FAKE_CALLS.
// state.guestWipe: directories emptied when a clone is deleted (the clone's disk).
// state.deleteFails: `delete` exits 1 and keeps the clone.
// state.hold.{stop,delete,clone,run,lsAfterDelete}: the call writes FAKE_HOLD_DIR/<name>.held and waits for <name>.release.
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const sp = process.env.FAKE_LUME_STATE;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const log = (rec) => fs.appendFileSync(process.env.FAKE_CALLS, JSON.stringify({ tool: 'lume', argv, ...rec }) + '\n');
const lockDir = `${sp}.lock`;
function locked(fn) {
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      sleep(5);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}
const load = () => JSON.parse(fs.readFileSync(sp, 'utf8'));
const mutate = (fn) =>
  locked(() => {
    const st = load();
    const r = fn(st);
    fs.writeFileSync(sp, JSON.stringify(st));
    return r;
  });
const out = (s) => process.stdout.write(s.endsWith('\n') ? s : `${s}\n`);
function hold(name, target) {
  const want = load().hold?.[name];
  if (!want || (typeof want === 'string' && want !== target)) return;
  const dir = process.env.FAKE_HOLD_DIR;
  fs.writeFileSync(path.join(dir, `${name}.held`), String(process.pid));
  while (!fs.existsSync(path.join(dir, `${name}.release`))) sleep(20);
}
const [cmd] = argv;
const name = argv.filter((a) => !a.startsWith('--')).at(-1);
if (argv[0] === '--version') {
  log({});
  out(load().version ?? '0.7.2');
} else if (cmd === 'ls') {
  log({});
  const st = load();
  if (st.hold?.lsAfterDelete && st.afterDelete) {
    mutate((s) => {
      s.afterDelete = false;
    });
    hold('lsAfterDelete');
  }
  out(JSON.stringify(load().vms.map((v) => ({ name: v.name, status: v.status, ipAddress: v.ipAddress, os: 'macOS' })), null, 2));
} else if (cmd === 'clone') {
  log({});
  hold('clone', argv[2]);
  const failed = mutate((st) => {
    if (!st.vms.some((v) => v.name === argv[1]) || st.vms.some((v) => v.name === argv[2])) return true;
    st.vms.push({ name: argv[2], status: 'stopped', ipAddress: null });
    return false;
  });
  if (failed) process.exit(1);
} else if (cmd === 'run') {
  log({});
  hold('run', name);
  const failed = mutate((st) => {
    const vm = st.vms.find((v) => v.name === name);
    if (!vm || st.runFails) return true;
    vm.status = 'running';
    vm.ipAddress = `192.168.64.${10 + st.vms.indexOf(vm)}`;
    return false;
  });
  if (failed) process.exit(1);
} else if (cmd === 'stop') {
  log({});
  hold('stop', name);
  mutate((st) => {
    const vm = st.vms.find((v) => v.name === name);
    if (vm) {
      vm.status = 'stopped';
      vm.ipAddress = null;
    }
  });
} else if (cmd === 'delete') {
  // The slot directories that exist when the delete starts, so a test can tell a clone is deleted before its slot is freed.
  const dir = process.env.FAKE_VM_DIR;
  log({ slots: dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((e) => /^slot-\d+$/.test(e)) : [] });
  hold('delete', name);
  if (load().deleteFails) process.exit(1);
  mutate((st) => {
    st.vms = st.vms.filter((v) => v.name !== name);
    st.afterDelete = true;
  });
  // A deleted clone takes its disk with it: the directories the test lists as the guest's HOME and TMPDIR are emptied.
  for (const dir of load().guestWipe ?? []) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
} else {
  log({});
  process.exit(64);
}
