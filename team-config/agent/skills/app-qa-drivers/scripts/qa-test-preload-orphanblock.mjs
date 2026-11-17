// Test-only preload (node --import) for qa.test.mjs: before the driver publishes a lease record that marks the lease
// `orphaned`, it writes its pid to QA_TEST_BLOCK_MARKER and blocks until QA_TEST_BLOCK_RELEASE exists, so a test can kill
// a sweeper between finding a dead busy marker and recording it (task 7.8). Never loaded by the deployed driver.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const original = fs.renameSync;
fs.renameSync = function renameSync(from, to, ...rest) {
  if (/[\\/]lease\.json$/.test(String(to)) && fs.readFileSync(from, 'utf8').includes('"orphaned"')) {
    fs.writeFileSync(process.env.QA_TEST_BLOCK_MARKER, String(process.pid));
    while (!fs.existsSync(process.env.QA_TEST_BLOCK_RELEASE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  return original.call(this, from, to, ...rest);
};
syncBuiltinESMExports();
