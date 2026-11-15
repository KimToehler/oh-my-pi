// Fake tar for qa.test.mjs: runs /usr/bin/tar unchanged, with two test controls.
// FAKE_TAR_HOLD=before|after (host): an extraction (`-x...`) writes FAKE_HOLD_DIR/tar-x-<when>.held before or after it ran
// and waits for the matching .release. FAKE_PACK_EVIL=dotdot|absolute (guest): a create call renames its members to a
// path with `..` components or an absolute path (EVIL_ABS_DIR).
const fs = require('fs');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const hold = (when) => {
  const base = `${process.env.FAKE_HOLD_DIR}/tar-x-${when}`;
  fs.writeFileSync(`${base}.held`, '');
  while (!fs.existsSync(`${base}.release`)) sleep(20);
};
const extract = /^-x/.test(argv[0] ?? '');
const create = /^-c/.test(argv[0] ?? '');
let args = argv;
if (create && process.env.FAKE_PACK_EVIL === 'dotdot') args = ['-s', '|^\\./|../../escape/|', ...argv];
if (create && process.env.FAKE_PACK_EVIL === 'absolute') args = ['-P', '-s', `|^\\./|${process.env.EVIL_ABS_DIR}/|`, ...argv];
if (extract && process.env.FAKE_TAR_HOLD === 'before') hold('before');
const r = spawnSync('/usr/bin/tar', args, { stdio: 'inherit', env: process.env });
if (extract && process.env.FAKE_TAR_HOLD === 'after') hold('after');
process.exit(r.status ?? 1);
