// Fake build tool for qa.test.mjs, the argv of a vm build: node fake-build.mjs CONTROL TARGET [PORT]. CONTROL is a JSON
// file: print/printErr (lines per target), hold (wait after printing until CONTROL.release exists), exit (per target),
// noArtifact (per target), artifacts (per target: {path, files}), watch ({untilTool, untilVerb, calls, rewrite: {path, content}}: a
// detached child rewrites that artifact file once the call log CALLS holds an entry of that tool with that verb). Every run is logged to
// CONTROL.runs with whether its stdout and stderr are pipes.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, fstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [control, target, port] = process.argv.slice(2);
// The worktree root: the nearest folder above the working directory holding .omp/app-qa.json.
let root = process.cwd();
while (!existsSync(join(root, '.omp', 'app-qa.json'))) root = dirname(root);
const cfg = JSON.parse(readFileSync(control, 'utf8'));
const pipe = (fd) => {
  const st = fstatSync(fd);
  return st.isFIFO() || st.isSocket();
};
appendFileSync(control + '.runs', `${JSON.stringify({ target, root, port: port ?? null, cwd: process.cwd(), argv: process.argv.slice(2), pipes: [pipe(1), pipe(2)] })}\n`);
for (const line of cfg.print?.[target] ?? []) process.stdout.write(`${line}\n`);
for (const line of cfg.printErr?.[target] ?? []) process.stderr.write(`${line}\n`);
while (cfg.hold && !existsSync(`${control}.release`)) {
  writeFileSync(`${control}.held`, String(process.pid));
  await new Promise((r) => setTimeout(r, 20));
}
if (cfg.exit?.[target]) process.exit(cfg.exit[target]);
if (cfg.noArtifact?.[target]) process.exit(0);
const art = cfg.artifacts[target];
for (const [rel, content] of Object.entries(art.files)) {
  const file = join(root, art.path, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content.replaceAll('{port}', port ?? ''));
}
if (cfg.watch) {
  const script = `
    const fs = require('fs');
    const { untilTool, untilVerb, calls, file, content } = ${JSON.stringify({ ...cfg.watch, file: join(root, art.path, cfg.watch.rewrite.path), content: cfg.watch.rewrite.content })};
    const deadline = Date.now() + 20000;
    const seen = () => fs.existsSync(calls) && fs.readFileSync(calls, 'utf8').split('\\n').some((l) => { if (!l) return false; const c = JSON.parse(l); return c.tool === untilTool && c.argv?.[0] === untilVerb; });
    const tick = () => { if (seen()) { fs.writeFileSync(file, content); process.exit(0); } if (Date.now() > deadline) process.exit(1); setTimeout(tick, 10); };
    tick();`;
  spawn(process.execPath, ['-e', script], { detached: true, stdio: 'ignore' }).unref();
}
