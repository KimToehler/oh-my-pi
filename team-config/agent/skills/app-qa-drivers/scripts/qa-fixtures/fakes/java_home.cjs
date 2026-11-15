// Fake guest java_home: prints the fake JDK directory (FAKE_JAVA_HOME) for -v 21.
const fs = require('fs');
fs.appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify({ tool: 'java_home', argv: process.argv.slice(2) })}\n`);
process.stdout.write(`${process.env.FAKE_JAVA_HOME}\n`);
