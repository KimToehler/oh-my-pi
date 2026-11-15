// Fake guest driver for qa.test.mjs, installed as the guest's scripts/qa.mjs. It logs its call and acts as the guest's
// ~/fake-driver.json says: lines (out or err, with $OUT, $TMP and $CWD tokens), files to write, a kept flow root,
// a pause until a file exists, a started marker and the exit code. `vm ...` goes to the real driver (qa-real.mjs).
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
if (argv[0] === 'vm') {
  const r = spawnSync(process.execPath, [join(here, 'qa-real.mjs'), ...argv], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const cfgPath = join(process.env.HOME, 'fake-driver.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const outIndex = argv.indexOf('--out');
const tokens = { $OUT: outIndex >= 0 ? argv[outIndex + 1] : '', $TMP: process.env.TMPDIR, $CWD: process.cwd(), $HOME: process.env.HOME };
const sub = (s) => Object.entries(tokens).reduce((t, [k, v]) => t.split(k).join(v), s);
appendFileSync(
  process.env.FAKE_CALLS,
  `${JSON.stringify({ tool: 'guest-driver', argv, cwd: process.cwd(), flowFile: argv[0] === 'flow' ? { path: resolve(argv[2]), exists: existsSync(resolve(argv[2])) } : null, env: { TMPDIR: process.env.TMPDIR, MAESTRO_DRIVER_STARTUP_TIMEOUT: process.env.MAESTRO_DRIVER_STARTUP_TIMEOUT ?? null } })}\n`,
);
if (cfg.started) writeFileSync(sub(cfg.started), String(process.pid));
for (const f of cfg.files ?? []) {
  const file = join(sub(f.dir), f.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(f.content, f.base64 ? 'base64' : 'utf8'));
}
for (const l of cfg.lines ?? []) (l.s === 'err' ? process.stderr : process.stdout).write(`${sub(l.t)}\n`);
while (cfg.pause && !existsSync(sub(cfg.pause))) await new Promise((r) => setTimeout(r, 20));
for (const l of cfg.linesAfter ?? []) (l.s === 'err' ? process.stderr : process.stdout).write(`${sub(l.t)}\n`);
process.exit(cfg.exit ?? 0);
