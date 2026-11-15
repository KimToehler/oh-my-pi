// Fake guest sudo: drops `-u USER` and `-n`, then runs the rest.
const fs = require('fs');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'sudo', argv })}\n`);
let i = 0;
while (argv[i]?.startsWith('-')) i += argv[i] === '-u' ? 2 : 1;
const r = spawnSync(argv[i], argv.slice(i + 1), { stdio: 'inherit' });
process.exit(r.status ?? 1);
