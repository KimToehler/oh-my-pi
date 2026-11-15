// Fake guest plutil: `plutil -extract KEY raw -o - FILE` prints the value of a `bundle=VALUE` line of FILE for
// CFBundleIdentifier and exits 1 when there is none.
const fs = require('fs');
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'plutil', argv })}\n`);
const file = argv.at(-1);
const m = argv[1] === 'CFBundleIdentifier' && fs.existsSync(file) ? /^bundle=(.+)$/m.exec(fs.readFileSync(file, 'utf8')) : null;
if (!m) process.exit(1);
process.stdout.write(`${m[1]}\n`);
