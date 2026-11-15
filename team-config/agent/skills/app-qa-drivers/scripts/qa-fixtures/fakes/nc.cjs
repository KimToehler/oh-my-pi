// Fake guest nc: `nc -z 127.0.0.1 PORT` succeeds unless the guest state says nothing listens.
const fs = require('fs');
const st = JSON.parse(fs.readFileSync(process.env.FAKE_STATE, 'utf8'));
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'nc', argv: process.argv.slice(2) })}\n`);
process.exit(st.ncFails ? 1 : 0);
