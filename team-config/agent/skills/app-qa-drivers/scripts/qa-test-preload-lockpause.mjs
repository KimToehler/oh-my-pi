// Test-only preload (node --import) for qa.test.mjs: the first rename or removal of QA_TEST_PAUSE_LOCK or of an entry in
// it writes QA_TEST_PAUSE_DIR/before and waits for go, runs, then writes after and waits for go2, so a test can let
// another process take the lock between a contender's read and its takeover (task 7.2). Never loaded by the deployed driver.
import fs from 'node:fs';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

const lock = process.env.QA_TEST_PAUSE_LOCK;
const dir = process.env.QA_TEST_PAUSE_DIR;
const waitFile = (name) => {
  while (!fs.existsSync(join(dir, name))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
};
let paused = false;
for (const fn of ['renameSync', 'rmSync', 'rmdirSync', 'unlinkSync']) {
  const original = fs[fn];
  fs[fn] = function wrapped(path, ...rest) {
    const p = String(path);
    if (paused || !(p === lock || p.startsWith(`${lock}/`))) return original.call(this, path, ...rest);
    paused = true;
    fs.writeFileSync(join(dir, 'before'), String(process.pid));
    waitFile('go');
    try {
      return original.call(this, path, ...rest);
    } finally {
      fs.writeFileSync(join(dir, 'after'), String(process.pid));
      waitFile('go2');
    }
  };
}
syncBuiltinESMExports();
