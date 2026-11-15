// Fake guest launchctl: `asuser UID CMD...` runs CMD and waits for it.
const fs = require('fs');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'launchctl', argv })}\n`);
if (argv[0] !== 'asuser') process.exit(64);
const r = spawnSync(argv[2], argv.slice(3), { stdio: 'inherit' });
process.exit(r.status ?? 1);
