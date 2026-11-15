// Fake guest java: logs its command line, working directory and a credentials property, then stays alive until killed.
const fs = require('fs');
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'java', argv, cwd: process.cwd(), pid: process.pid })}\n`);
process.on('SIGTERM', () => process.exit(143));
setInterval(() => {}, 1 << 30);
