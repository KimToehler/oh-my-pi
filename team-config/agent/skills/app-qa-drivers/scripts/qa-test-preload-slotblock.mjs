// Test-only preload (node --import) for qa.test.mjs: after the driver creates a vm slot directory it writes
// QA_TEST_BLOCK_MARKER and blocks until QA_TEST_BLOCK_RELEASE exists, so a test can kill it between the creation of
// slot-N and the write of its record (task 2.2, interrupted publication). Never loaded by the deployed driver.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const original = fs.mkdirSync;
fs.mkdirSync = function mkdirSync(path, ...rest) {
  const result = original.call(this, path, ...rest);
  if (process.env.QA_TEST_BLOCK_MARKER && /[\\/]vm[\\/]slot-\d+$/.test(String(path))) {
    fs.writeFileSync(process.env.QA_TEST_BLOCK_MARKER, String(process.pid));
    while (!fs.existsSync(process.env.QA_TEST_BLOCK_RELEASE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  return result;
};
syncBuiltinESMExports();
