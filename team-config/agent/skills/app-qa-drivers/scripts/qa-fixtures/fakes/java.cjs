// Fake guest java: logs its command line, working directory and a credentials property, then stays alive until killed.
// On SIGTERM it exits at once, after the state's `javaTermMs` milliseconds, or never (`javaTermMs: "ignore"`), and logs a
// `java-exit` record just before a SIGTERM exit.
const fs = require('fs');
const argv = process.argv.slice(2);
const log = (record) => fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify(record)}\n`);
log({ tool: 'java', argv, cwd: process.cwd(), pid: process.pid });
const termMs = () => {
  try {
    return JSON.parse(fs.readFileSync(process.env.FAKE_STATE, 'utf8')).javaTermMs ?? 0;
  } catch {
    return 0;
  }
};
const exit = () => {
  log({ tool: 'java-exit', pid: process.pid });
  process.exit(143);
};
process.on('SIGTERM', () => {
  const ms = termMs();
  if (ms === 'ignore') return;
  if (ms > 0) setTimeout(exit, ms);
  else exit();
});
setInterval(() => {}, 1 << 30);
