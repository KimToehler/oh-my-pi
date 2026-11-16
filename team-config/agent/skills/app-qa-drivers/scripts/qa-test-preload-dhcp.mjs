// Test-only preload (node --import) for qa.test.mjs: reads of macOS's DHCP lease file /var/db/dhcpd_leases read
// QA_TEST_DHCP_LEASES instead, so a test controls the leases the driver sees (task 7.7). Never loaded by the deployed driver.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const original = fs.readFileSync;
fs.readFileSync = function readFileSync(path, ...rest) {
  if (String(path) === '/var/db/dhcpd_leases') return original.call(this, process.env.QA_TEST_DHCP_LEASES, ...rest);
  return original.call(this, path, ...rest);
};
syncBuiltinESMExports();
