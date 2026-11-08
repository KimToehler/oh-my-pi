// Tests of the shared app QA driver qa.mjs (openspec change app-qa-shared-driver): fake spectre, maestro, xcrun, adb,
// ioreg, ps and lsof on a test PATH, a local HTTP server for backend health, three fixture configurations (onara,
// foreign, minimal) written into each test's temporary Git repository, and synthetic credentials files only.
//   node --test team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs
// QA_UNDER_TEST=<file> runs the suite against another copy of qa.mjs (the broken variants of the negative controls).
// Test names start with their area (config, preflight, desktop, flow, lock, scan) so a run can select one.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const QA_SOURCE = process.env.QA_UNDER_TEST ?? join(HERE, 'qa.mjs');
const FIXTURES = join(HERE, 'qa-fixtures');
const qa = await import(pathToFileURL(QA_SOURCE).href);
// The git binary itself, not a launcher that could look up the fake xcrun on the test PATH.
const GIT = join(spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout.trim(), 'git');
// The driver is deployed for node; under `bun test` (test:team-config) the spawned driver and fakes still run on node,
// so a runtime cache bun writes into HOME never shows up as a file the driver touched. `bun run` puts a `node` shim
// pointing at bun first on PATH, so the first `node` that is not bun itself is taken.
const NODE = process.versions.bun ? realNode() : process.execPath;

function realNode() {
  const bun = realpathSync(process.execPath);
  for (const dir of (process.env.PATH ?? '').split(':')) {
    const candidate = join(dir, 'node');
    if (existsSync(candidate) && realpathSync(candidate) !== bun) return candidate;
  }
  throw new Error('qa.test.mjs: no node on PATH besides bun');
}

// Synthetic accounts only. PW2 holds a quote and a backslash, so its JSON-escaped form differs from the raw one.
const USER1 = 'qa-user-one@example.test';
const PW1 = 'Synthetic-Pw-One-7f3a';
const USER2 = 'qa-user-two@example.test';
const PW2 = 'Synth"Pw\\Two-9c1e';
// The foreign fixture's accounts; the passwords hold a quote, an ampersand and a backslash.
const ALPHA_USER = 'alpha.login@example.test';
const ALPHA_PW = 'Alpha&Secret"31d\\x';
const BETA_USER = 'beta.login@example.test';
const BETA_PW = "Beta'Secret&5e\\a\"q";
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9abcd';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001', 'hex');
const PNG_B = Buffer.from('89504e470d0a1a0a0000000d4948445200000002', 'hex');
const REPLY_SENTINEL = 'SENTINELREPLY-4b7e';
const CANARY = 'CANARY-7d1f';
const ALL_VALUES = [USER1, PW1, USER2, PW2, ALPHA_USER, ALPHA_PW, BETA_USER, BETA_PW];
const CREDS = { users: [USER1, USER2], passwords: [PW1, PW2] };

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const jsonEscape = (s) => JSON.stringify(s).slice(1, -1);
/** Every configured value found in `text`, raw, JSON-escaped or XML-escaped, and the token. */
const leaks = (text, values = ALL_VALUES) =>
  values.flatMap((v) => [...new Set([v, jsonEscape(v), xmlEscape(v), xmlEscape(jsonEscape(v))])]).concat(TOKEN).filter((v) => text.includes(v));

// ---------- fixture configurations (design D7) ----------

const CONFIGS = {
  onara: {
    schema: 'app-qa/1',
    name: 'onara',
    desktop: { mainClass: 'eu.onara.app.MainKt', launchHint: './gradlew :desktopApp:run in app_kmp/' },
    backend: {
      healthUrl: 'http://127.0.0.1:{port}/actuator/health',
      defaultPort: 8080,
      portProperty: { file: 'app_kmp/gradle.properties', key: 'onara.devBackendPort' },
      startHint: 'SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)',
    },
    credentials: {
      file: '.dev-credentials.env',
      accounts: {
        1: { user: 'DEV_TEST_USERNAME', password: 'DEV_TEST_PASSWORD' },
        2: { user: 'DEV_TEST_USERNAME_2', password: 'DEV_TEST_PASSWORD_2' },
      },
      defaultAccount: '1',
    },
    expect: { default: 'home', tags: { home: 'home', onboarding: 'onboarding-welcome' } },
    android: { sdkProperties: 'app_kmp/local.properties' },
    scan: { sentinels: ['SENTINEL'] },
  },
  foreign: {
    schema: 'app-qa/1',
    name: 'foreign',
    desktop: { mainClass: 'org.example.foreign.DeskKt', launchHint: 'make desk in client/' },
    backend: {
      healthUrl: 'http://127.0.0.1:{port}/healthz',
      defaultPort: 9,
      portProperty: { file: 'config/dev.properties', key: 'foreign.port' },
      startHint: 'make serve in server/',
    },
    credentials: {
      file: 'secrets/qa-accounts.env',
      accounts: {
        alpha: { user: 'QA_ALPHA_LOGIN', password: 'QA_ALPHA_SECRET' },
        beta: { user: 'QA_BETA_LOGIN', password: 'QA_BETA_SECRET' },
      },
      defaultAccount: 'beta',
    },
    expect: { default: 'start', tags: { start: 'start-screen', welcome: 'welcome-card' } },
    android: { sdkProperties: 'mobile/local.properties' },
    scan: { sentinels: ['CANARY'] },
  },
  minimal: {
    schema: 'app-qa/1',
    name: 'minimal',
    desktop: { mainClass: 'com.example.minimal.MainKt', launchHint: './gradlew :app:run' },
  },
};

/** Credentials file lines per fixture; the foreign file also holds an onara key that its configuration does not name. */
const CREDENTIAL_LINES = {
  onara: {
    DEV_TEST_USERNAME: USER1,
    DEV_TEST_PASSWORD: `"${PW1}"`,
    DEV_TEST_USERNAME_2: USER2,
    DEV_TEST_PASSWORD_2: `'${PW2}'`,
  },
  foreign: {
    QA_ALPHA_LOGIN: ALPHA_USER,
    QA_ALPHA_SECRET: ALPHA_PW,
    QA_BETA_LOGIN: BETA_USER,
    QA_BETA_SECRET: BETA_PW,
    DEV_TEST_PASSWORD: PW1,
  },
};

// ---------- health server ----------

let health = { code: 200, body: '{"status":"UP"}', hang: false };
const server = createServer((req, res) => {
  if (health.hang) return;
  res.statusCode = health.code;
  res.end(health.body);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const PORT = server.address().port;

const roots = [];
after(() => {
  server.closeAllConnections?.();
  server.close();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

// ---------- fakes ----------

const PRELUDE = `
const fs = require('fs');
const path = require('path');
const statePath = process.env.FAKE_STATE;
const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const save = () => fs.writeFileSync(statePath, JSON.stringify(st));
const argv = process.argv.slice(2);
const fx = (n) => fs.readFileSync(path.join(process.env.FAKE_FIXTURES, n), 'utf8');
const log = (rec) => fs.appendFileSync(process.env.FAKE_CALLS, JSON.stringify(rec) + '\\n');
const out = (s) => process.stdout.write(s.endsWith('\\n') ? s : s + '\\n');
`;

const FAKES = {
  spectre: `
process.stderr.write(fx('spectre-warnings.stderr.txt'));
if (st.extraStderr) process.stderr.write(st.extraStderr + '\\n');
log({ tool: 'spectre', argv });
const [cmd] = argv;
const nodes = (tag) => {
  const tpl = JSON.parse(fx('spectre-find.json')).nodes[0];
  return Array.from({ length: st.tags[tag] ?? 0 }, (_, i) => ({
    ...tpl, key: tag + ':' + i, testTag: tag, texts: [tag],
    editableText: tag in st.text ? st.text[tag] : null, isFocused: st.focused === tag,
  }));
};
if (cmd === '--version') { out('spectre ' + st.spectreVersion); process.exit(0); }
if (cmd === 'permissions') { const p = JSON.parse(fx('spectre-permissions.json')); p.granted = st.granted; out(JSON.stringify(p)); process.exit(0); }
if (cmd === 'ps') {
  const p = JSON.parse(fx('spectre-ps.json'));
  const tpl = p.processes.find((x) => x.pid === 17059);
  p.processes = p.processes.filter((x) => x !== tpl);
  for (const j of st.jvms) p.processes.push({ ...tpl, pid: j.pid, displayName: j.mainClass });
  out(JSON.stringify(p)); process.exit(0);
}
if (cmd === 'attach') { const a = JSON.parse(fx('spectre-attach.json')); a.pid = Number(argv[1]); a.id = a.sessionId = 'pid-' + argv[1]; out(JSON.stringify(a)); process.exit(0); }
if (cmd === 'find') { out(JSON.stringify({ version: 1, nodes: nodes(argv[2]) })); process.exit(0); }
if (cmd === 'wait-for-node') {
  const tag = argv[argv.indexOf('--tag') + 1];
  if ((st.tags[tag] ?? 0) > 0) { out(JSON.stringify({ version: 1, nodes: nodes(tag) })); process.exit(0); }
  process.stderr.write(fx('spectre-wait-timeout.stderr.txt')); process.exit(5);
}
if (cmd === 'click') { st.focused = argv[2].split(':')[0]; st.selected = false; save(); out(fx('spectre-click.json')); process.exit(0); }
if (cmd === 'press-key') {
  if (argv[2] === 'Cmd+A' && !st.append) st.selected = true;
  if (argv[2] === 'BackSpace' && st.selected) { st.text[st.focused] = ''; st.selected = false; }
  save(); out(fx('spectre-press-key.json')); process.exit(0);
}
if (cmd === 'type') {
  let t = argv[2];
  if (st.corrupt) t = t.slice(1) + t[0];
  st.text[st.focused] = (st.text[st.focused] ?? '') + t; save(); out(fx('spectre-type.json')); process.exit(0);
}
if (cmd === 'capture') {
  const dir = path.join(argv[argv.indexOf('--out-dir') + 1], '0001-20261107-120000');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'screenshot.png'), Buffer.from('${PNG.toString('hex')}', 'hex'));
  fs.writeFileSync(path.join(dir, 'capture.json'), '{"schemaVersion":1}\\n');
  const c = JSON.parse(fx('spectre-capture.json'));
  c.directory = dir; c.captureJson = path.join(dir, 'capture.json'); c.screenshotPng = path.join(dir, 'screenshot.png');
  out(JSON.stringify(c)); process.exit(0);
}
if (cmd === 'detach') { out(fx('spectre-detach.json')); process.exit(0); }
process.stderr.write('Spectre daemon error: unexpected command\\n'); process.exit(1);
`,
  lsof: `
log({ tool: 'lsof', argv });
const pid = Number(argv[argv.indexOf('-p') + 1]);
const jvm = st.jvms.find((j) => j.pid === pid);
if (!jvm || jvm.cwd === null) { process.stderr.write('lsof: permission denied\\n'); process.exit(1); }
out('p' + pid + '\\nfcwd\\nn' + jvm.cwd);
`,
  maestro: `
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
if (argv[0] === '--version') { process.stderr.write('WARNING: a JVM warning\\n'); out(st.maestroVersion); process.exit(0); }
if (argv[0] !== 'test') process.exit(64);
const tty = [0, 1, 2].map((fd) => require('tty').isatty(fd));
const env = {};
for (const k of ['MAESTRO_DEV_USER', 'MAESTRO_DEV_PW', 'MAESTRO_EXPECT_TAG']) if (k in process.env) env[k] = process.env[k];
const lockPath = path.join(process.env.TMPDIR, 'app-qa', 'flow.lock');
let lock = null;
let lockName = null;
try { lock = fs.readFileSync(path.join(lockPath, 'pid'), 'utf8'); } catch {}
try { lockName = fs.readFileSync(path.join(lockPath, 'name'), 'utf8'); } catch {}
log({ tool: 'maestro', argv, env, tty, lock, lockName, pid: process.pid });
const m = st.maestro;
process.on('SIGTERM', () => { log({ tool: 'maestro', signal: 'SIGTERM' }); process.exit(143); });
const debug = flag('--debug-output') ?? path.join(process.cwd(), '.maestro-debug');
const outDir = flag('--test-output-dir') ?? path.join(process.cwd(), '.maestro-out');
const report = flag('--output');
const name = path.basename(argv.at(-1), path.extname(argv.at(-1)));
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const png = Buffer.from('${PNG.toString('hex')}', 'hex');
const pngB = Buffer.from('${PNG_B.toString('hex')}', 'hex');
const user = env.MAESTRO_DEV_USER ?? '';
const pw = env.MAESTRO_DEV_PW ?? '';
(async () => {
  if (m.chmodOut) fs.chmodSync(m.chmodOut, 0o555);
  if (m.echo) {
    process.stdout.write('Input text ' + user + '\\n');
    process.stdout.write('Input text ' + pw.slice(0, 4));
    await new Promise((r) => setTimeout(r, 50));
    process.stdout.write(pw.slice(4) + '\\n');
    process.stderr.write('typed ' + user + ' and ' + pw + '\\n');
  }
  const leak = m.leak ?? [];
  for (const v of leak) { process.stdout.write('value ' + v + '\\n'); process.stderr.write('value ' + v + '\\n'); }
  const record = 'INFO Input text ' + user + '\\nINFO Input text ' + pw + '\\n' + leak.map((v) => 'INFO ' + v + '\\n').join('');
  const logDir = path.join(debug, '.maestro', 'tests', '2026-11-07_120000');
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, 'maestro.log'), record);
  const caseDir = path.join(outDir, '2026-11-07_120000', name);
  for (const d of ['screenshots', 'screen-hierarchy']) fs.mkdirSync(path.join(caseDir, d), { recursive: true });
  fs.writeFileSync(path.join(caseDir, 'commands-(' + name + ').json'), JSON.stringify([{ inputText: user }, { inputText: pw }, ...leak.map((v) => ({ inputText: v }))]));
  fs.writeFileSync(path.join(caseDir, 'maestro.log'), record);
  fs.writeFileSync(path.join(caseDir, 'screenshots', 'step-001-tapOn.png'), png);
  fs.writeFileSync(path.join(caseDir, 'screen-hierarchy', 'step-001-tapOn.json'), '{"text":"' + user + '"}');
  // A JVM puts its temporary files (the iOS driver's .xctestrun, xcodebuild's derived data) in java.io.tmpdir.
  const jvmTmp = (/(?:^|\\s)"?-Djava\\.io\\.tmpdir=([^"\\s]+)/.exec(process.env.MAESTRO_OPTS ?? '') ?? [])[1] ?? process.env.TMPDIR;
  const derived = path.join(jvmTmp, 'maestro_xctestrunner_xcodebuild_output' + process.pid);
  fs.mkdirSync(derived, { recursive: true });
  fs.writeFileSync(path.join(derived, 'info.plist'), 'derived data\\n' + leak.join('\\n'));
  const shot = (dir, file, bytes) => { const d = path.join(outDir, '2026-11-07_120000', dir, 'takeScreenshot'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, file), bytes); };
  if (m.named) shot(name, 'home.png', png);
  for (const s of m.shots ?? []) {
    const bytes = s.data === 'pw' ? Buffer.concat([png, Buffer.from(pw)]) : s.data === 'b' ? pngB : png;
    shot(s.dir ?? name, s.file, bytes);
  }
  if (leak.length) shot(name, 'leak.png', Buffer.concat([png, Buffer.from([0]), Buffer.from(leak.join(' '))]));
  if (m.escapedOnly) fs.writeFileSync(path.join(caseDir, 'state.json'), JSON.stringify({ field: pw }));
  if (m.binaryLeak) fs.writeFileSync(path.join(caseDir, 'blob.bin'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(pw)]));
  if (m.wordLog) fs.writeFileSync(path.join(caseDir, 'notes.log'), m.wordLog);
  if (m.startedMarker) fs.writeFileSync(m.startedMarker, String(process.pid));
  if (m.sleepMs) await new Promise((r) => setTimeout(r, m.sleepMs));
  if (!m.noReport) {
    // Maestro 2.12.1 writes the failure text as the element's body, not as a message attribute.
    const failure = m.fail ? '<failure>' + xml(m.failMessage.replace('$PW', pw)) + '</failure>' : '';
    const sysout = leak.length ? '<system-out>' + leak.map(xml).join(' ') + '</system-out>' : '';
    fs.writeFileSync(report, '<?xml version="1.0"?><testsuites><testsuite name="Test Suite" tests="1"><testcase id="' + name +
      '" name="' + name + '" classname="' + name + '" time="3.25">' + failure + sysout + '</testcase></testsuite></testsuites>');
  }
  process.exit(m.fail ? 1 : 0);
})();
`,
  xcrun: `
log({ tool: 'xcrun', argv });
const devices = st.iosDevices.map((d) => ({ udid: d.udid, name: d.name, state: 'Booted', isAvailable: true }));
out(JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-4': devices } }));
`,
  adb: `
log({ tool: 'adb', argv });
if (argv[0] === 'devices') out('List of devices attached\\n' + st.androidDevices.map((d) => d + '\\tdevice\\n').join(''));
`,
  ioreg: `
log({ tool: 'ioreg', argv });
out('+-o Root  <class IORegistryEntry, id 0x100000100, retain 31>\\n    {\\n      "IOConsoleUsers" = ({"kCGSSessionUserNameKey"="qa",' +
  (st.locked ? '"CGSSessionScreenIsLocked"=Yes,' : '') + '"kCGSessionLoginDoneKey"=Yes})\\n    }');
`,
  ps: `
log({ tool: 'ps', argv });
out(st.ps.join('\\n'));
`,
};

const DEFAULT_STATE = {
  spectreVersion: '0.9.0',
  granted: true,
  locked: false,
  jvms: [],
  tags: { 'sign-in': 1, home: 1, 'chat-input': 1 },
  text: { 'chat-input': '' },
  corrupt: false,
  maestroVersion: '2.12.1',
  iosDevices: [{ udid: 'SIM-AAAA-1', name: 'iPhone 17 Pro' }],
  androidDevices: ['emulator-5554'],
  // Process lines that are not Maestro test runs: this script, an app's onboarding runner, a Maestro hierarchy read.
  ps: [
    '100 node qa.mjs flow ios maestro/signin-ios.yaml',
    '101 bash scripts/maestro-onboarding.sh',
    '102 /usr/bin/java -classpath /x/lib/* maestro.cli.AppKt hierarchy',
  ],
  maestro: { fail: false, failMessage: 'Assertion is false: id: home is visible', echo: false, named: false },
};

function git(cwd, ...args) {
  const r = spawnSync(GIT, ['-c', 'user.name=qa', '-c', 'user.email=qa@example.test', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

const writeConfig = (repo, config) => writeFileSync(join(repo, '.omp', 'app-qa.json'), JSON.stringify(config, null, 2) + '\n');

/** Writes a fixture's credentials file (or `lines`) at `dir`/its configured name and returns its path. */
function credentials(dir, fixture = 'onara', { omit = [], name = CONFIGS[fixture].credentials.file, lines = CREDENTIAL_LINES[fixture] } = {}) {
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Object.entries(lines).filter(([k]) => !omit.includes(k)).map(([k, v]) => `${k}=${v}\n`).join(''));
  return file;
}

/** A committed Git repository holding a fixture configuration, its port property and `app/` (where a JVM runs). */
function makeRepo(repo, fixture, config = CONFIGS[fixture]) {
  mkdirSync(join(repo, '.omp'), { recursive: true });
  mkdirSync(join(repo, 'app'), { recursive: true });
  writeConfig(repo, config);
  const prop = config.backend?.portProperty;
  if (prop) {
    mkdirSync(dirname(join(repo, prop.file)), { recursive: true });
    writeFileSync(join(repo, prop.file), `${prop.key}=${PORT}\n`);
  }
  writeFileSync(join(repo, '.gitignore'), '.worktrees/\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'init');
  if (config.credentials && CREDENTIAL_LINES[fixture]) credentials(repo, fixture);
  return realpathSync(repo);
}

function layout({ fixture = 'onara', config, fakes = ['spectre', 'lsof', 'maestro', 'xcrun', 'adb', 'ioreg', 'ps'], state = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'qa-test-'));
  roots.push(root);
  const repo = makeRepo(join(root, 'repo'), fixture, config);
  const driverDir = join(root, 'driver');
  mkdirSync(driverDir);
  copyFileSync(QA_SOURCE, join(driverDir, 'qa.mjs'));
  const L = {
    root: realpathSync(root),
    repo,
    fixture,
    config: config ?? CONFIGS[fixture],
    qa: join(driverDir, 'qa.mjs'),
    bin: join(root, 'bin'),
    tmp: join(root, 'tmp'),
    home: join(root, 'home'),
    stateFile: join(root, 'state.json'),
    callFile: join(root, 'calls.jsonl'),
  };
  for (const d of [L.bin, L.tmp, L.home]) mkdirSync(d);
  symlinkSync(GIT, join(L.bin, 'git'));
  const mainClass = L.config.desktop?.mainClass ?? 'none';
  const initial = { ...structuredClone(DEFAULT_STATE), jvms: [{ pid: 17059, mainClass, cwd: join(repo, 'app') }], ...state };
  writeFileSync(L.stateFile, JSON.stringify(initial));
  writeFileSync(L.callFile, '');
  L.env = { PATH: L.bin, HOME: L.home, TMPDIR: L.tmp, FAKE_STATE: L.stateFile, FAKE_CALLS: L.callFile, FAKE_FIXTURES: FIXTURES };
  L.state = () => JSON.parse(readFileSync(L.stateFile, 'utf8'));
  L.set = (patch) => writeFileSync(L.stateFile, JSON.stringify({ ...L.state(), ...patch }));
  L.maestro = (patch) => L.set({ maestro: { ...L.state().maestro, ...patch } });
  L.calls = (tool) => readFileSync(L.callFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((c) => !tool || c.tool === tool);
  L.fake = (name, dir = L.bin) => {
    writeFileSync(join(dir, name), `#!${NODE}\n${PRELUDE}\n${FAKES[name]}`);
    chmodSync(join(dir, name), 0o755);
  };
  L.unfake = (name) => rmSync(join(L.bin, name), { force: true });
  /** Another committed repository under this layout's root, sharing its fakes, state and temporary directory. */
  L.repoAt = (name, fx = fixture, cfg) => makeRepo(join(L.root, name), fx, cfg);
  /** A linked worktree of `repo` at `path` on a new branch. */
  L.worktree = (repo, path) => {
    git(repo, 'worktree', 'add', '-q', path, '-b', `wt-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`);
    mkdirSync(join(path, 'app'), { recursive: true });
    return realpathSync(path);
  };
  for (const f of fakes) L.fake(f);
  return L;
}

function startQa(L, args, { cwd = L.repo, env = {}, argv0, qaPath = L.qa } = {}) {
  const [cmd, argv] = argv0 ? argv0(qaPath, args) : [NODE, [qaPath, ...args]];
  const child = spawn(cmd, argv, { cwd, env: { ...L.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end();
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => (stdout += c));
  child.stderr.on('data', (c) => (stderr += c));
  const done = new Promise((ok) =>
    child.on('close', (status) => ok({ status, stdout, stderr, lines: stdout.split(/\r?\n/).filter(Boolean), pid: child.pid })),
  );
  return { child, done };
}

const runQa = (L, args, opts) => startQa(L, args, opts).done;

const lineWith = (r, prefix) => r.lines.find((l) => l.startsWith(prefix));
const valueAfter = (r, prefix) => lineWith(r, prefix)?.slice(prefix.length);

function filesBelow(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out.push(join(e.parentPath, e.name));
  }
  return out.sort();
}

const hashes = (dir) => Object.fromEntries(filesBelow(dir).map((f) => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));

async function waitFor(path, ms = 10000) {
  const end = Date.now() + ms;
  while (!existsSync(path)) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${path}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

function flowFile(L, name = 'scenario') {
  const f = join(L.root, `${name}.yaml`);
  writeFileSync(f, 'appId: org.example.app\n---\n- assertVisible:\n    id: home\n');
  return f;
}

const flow = (L, extra = [], opts) => runQa(L, ['flow', 'ios', flowFile(L), ...extra], opts);
const maestroRuns = (L) => L.calls('maestro').filter((c) => c.argv?.[0] === 'test');
const qaDir = (L) => join(L.tmp, 'app-qa');
const lockPath = (L) => join(qaDir(L), 'flow.lock');
const sessionPath = (L, worktree) =>
  join(qaDir(L), 'sessions', `${createHash('sha256').update(worktree).digest('hex').slice(0, 16)}.json`);

// ---------- config ----------

test('config: preflight in a subdirectory of a linked worktree uses that worktree configuration', async () => {
  const L = layout();
  const wt = L.worktree(L.repo, join(L.root, 'wt'));
  const { backend, ...noBackend } = CONFIGS.onara;
  writeConfig(wt, noBackend);
  const sub = join(wt, 'app', 'shell');
  mkdirSync(sub, { recursive: true });
  const inWorktree = await runQa(L, ['preflight', 'desktop'], { cwd: sub });
  assert.equal(inWorktree.status, 0, inWorktree.stdout + inWorktree.stderr);
  assert.deepEqual(inWorktree.lines, ['PASS driver: spectre 0.9.0', 'PASS screen capture: granted', 'PASS screen: unlocked']);
  const inMain = await runQa(L, ['preflight', 'desktop'], { cwd: join(L.repo, 'app') });
  assert.equal(inMain.status, 0, inMain.stdout + inMain.stderr);
  assert.equal(inMain.lines.length, 4);
  assert.match(inMain.lines[3], /^PASS backend: /);
});

test('config: --config names the file in force, also outside a git checkout', async () => {
  const L = layout();
  const file = join(L.root, 'other.json');
  writeFileSync(file, JSON.stringify(CONFIGS.minimal));
  const r = await runQa(L, ['preflight', 'desktop', '--config', file], { cwd: L.root });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.lines.length, 3);
  const none = await runQa(L, ['preflight', 'desktop'], { cwd: L.root });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /not in a git checkout; pass --config FILE/);
  assert.deepEqual(none.lines, []);
});

test('config: a newer schema id names the file, both ids and the redeploy', async () => {
  const L = layout({ config: { ...CONFIGS.minimal, schema: 'app-qa/2' }, fixture: 'minimal' });
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 2);
  assert.deepEqual(r.lines, []);
  const file = join(L.repo, '.omp', 'app-qa.json');
  assert.ok(r.stderr.includes(file), r.stderr);
  assert.match(r.stderr, /app-qa\/2/);
  assert.match(r.stderr, /app-qa\/1/);
  assert.match(r.stderr, /redeploy team config/);
  assert.equal(L.calls().length, 0);
});

/** Malformed configurations, each with the cause its refusal must name. */
const BROKEN_CONFIGS = [
  ['a misspelled key', (c) => ({ ...c, desktop: { mainClas: c.desktop.mainClass, launchHint: c.desktop.launchHint } }), /desktop\.mainClas: unknown key/],
  ['the misspelled key also misses the required one', (c) => ({ ...c, desktop: { mainClas: 'x', launchHint: 'y' } }), /desktop\.mainClass: missing/],
  ['an unknown top-level key', (c) => ({ ...c, extra: true }), /extra: unknown key/],
  ['an unknown nested key', (c) => ({ ...c, backend: { ...c.backend, portProperty: { ...c.backend.portProperty, kind: 'x' } } }), /backend\.portProperty\.kind: unknown key/],
  ['an unknown schema id', (c) => ({ ...c, schema: 'other/1' }), /schema "?other\/1"?.*app-qa\/1/],
  ['a missing schema', ({ schema, ...c }) => c, /schema/],
  ['a missing name', ({ name, ...c }) => c, /name: missing/],
  ['a name with capitals', (c) => ({ ...c, name: 'Onara' }), /name: /],
  ['a wrong type', (c) => ({ ...c, backend: { ...c.backend, defaultPort: '8080' } }), /backend\.defaultPort: /],
  ['a section of the wrong type', (c) => ({ ...c, desktop: 'eu.onara.app.MainKt' }), /desktop: expected an object/],
  ['a missing required value in a section', (c) => ({ ...c, credentials: { ...c.credentials, accounts: { 1: { user: 'DEV_TEST_USERNAME' } } } }), /credentials\.accounts\.1\.password: missing/],
  ['a health URL without {port}', (c) => ({ ...c, backend: { ...c.backend, healthUrl: 'http://127.0.0.1:8080/actuator/health' } }), /backend\.healthUrl: .*\{port\}/],
  ['a default account the map lacks', (c) => ({ ...c, credentials: { ...c.credentials, defaultAccount: '3' } }), /credentials\.defaultAccount: .*3/],
  ['a default screen the map lacks', (c) => ({ ...c, expect: { ...c.expect, default: 'settings' } }), /expect\.default: .*settings/],
  ['an absolute credentials path', (c) => ({ ...c, credentials: { ...c.credentials, file: '/etc/creds.env' } }), /credentials\.file: .*relative/],
  ['a .. in the SDK properties path', (c) => ({ ...c, android: { sdkProperties: '../local.properties' } }), /android\.sdkProperties: .*\.\./],
  ['an empty sentinel', (c) => ({ ...c, scan: { sentinels: [''] } }), /scan\.sentinels/],
];

test('config: each malformed configuration is refused with exit 2 naming the file and the cause', async () => {
  const L = layout();
  const file = join(L.repo, '.omp', 'app-qa.json');
  for (const [label, mutate, cause] of BROKEN_CONFIGS) {
    writeConfig(L.repo, mutate(structuredClone(CONFIGS.onara)));
    const r = await runQa(L, ['preflight', 'desktop']);
    assert.equal(r.status, 2, label);
    assert.deepEqual(r.lines, [], label);
    assert.ok(r.stderr.includes(file), `${label}: ${r.stderr}`);
    assert.match(r.stderr, cause, label);
  }
  for (const [label, content, cause] of [
    ['not JSON', '{ "schema": "app-qa/1",', /not valid JSON/],
    ['a JSON array', '[]', /expected an object/],
  ]) {
    writeFileSync(file, content);
    const r = await runQa(L, ['preflight', 'desktop']);
    assert.equal(r.status, 2, label);
    assert.ok(r.stderr.includes(file), label);
    assert.match(r.stderr, cause, label);
  }
  rmSync(file);
  const missing = await runQa(L, ['preflight', 'desktop']);
  assert.equal(missing.status, 2);
  assert.ok(missing.stderr.includes(file));
  assert.match(missing.stderr, /missing/);
  assert.equal(L.calls().length, 0);
});

test('config: a refusal touches no device, lock or file', async () => {
  const L = layout();
  writeConfig(L.repo, { ...CONFIGS.onara, desktop: { mainClas: 'eu.onara.app.MainKt', launchHint: 'x' } });
  const evidence = join(L.root, 'evidence');
  mkdirSync(evidence);
  writeFileSync(join(evidence, 'leak.log'), `typed ${PW1}\n`);
  const before = hashes(L.root);
  const out = join(L.root, 'new-out');
  for (const args of [
    ['flow', 'ios', flowFile(L), '--out', out],
    ['desktop', 'attach'],
    ['desktop', 'capture', 'home', '--out', out],
    ['preflight', 'android'],
    ['scan', evidence],
  ]) {
    const r = await runQa(L, args);
    assert.equal(r.status, 2, args.join(' '));
    assert.deepEqual(r.lines, [], args.join(' '));
  }
  assert.equal(L.calls().length, 0);
  assert.deepEqual(readdirSync(L.tmp), []);
  assert.equal(existsSync(out), false);
  const after = hashes(L.root);
  delete before[join(L.root, 'scenario.yaml')];
  delete after[join(L.root, 'scenario.yaml')];
  assert.deepEqual(after, before);
});

// ---------- preflight ----------

const BACKEND_PASS = `PASS backend: http://127.0.0.1:${PORT}/actuator/health UP`;
const ONARA_HINT = 'start the backend (SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)) or pass --port';

test('preflight: desktop ready prints four passing lines and exits 0', async () => {
  const L = layout();
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(r.lines, ['PASS driver: spectre 0.9.0', 'PASS screen capture: granted', 'PASS screen: unlocked', BACKEND_PASS]);
});

test('preflight: desktop without a backend section prints three passing lines and exits 0', async () => {
  const L = layout({ fixture: 'minimal' });
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(r.lines, ['PASS driver: spectre 0.9.0', 'PASS screen capture: granted', 'PASS screen: unlocked']);
});

test('preflight: ios and android ready, maestro found in ~/.maestro/bin', async () => {
  const L = layout();
  const ios = await runQa(L, ['preflight', 'ios']);
  assert.equal(ios.status, 0, ios.stdout);
  assert.deepEqual(ios.lines, ['PASS driver: maestro 2.12.1', 'PASS tools: xcrun simctl', 'PASS device: SIM-AAAA-1', BACKEND_PASS]);
  L.unfake('maestro');
  mkdirSync(join(L.home, '.maestro', 'bin'), { recursive: true });
  L.fake('maestro', join(L.home, '.maestro', 'bin'));
  const android = await runQa(L, ['preflight', 'android']);
  assert.equal(android.status, 0, android.stdout);
  assert.deepEqual(android.lines, [
    'PASS driver: maestro 2.12.1',
    `PASS tools: adb ${join(L.bin, 'adb')}`,
    'PASS device: emulator-5554',
    BACKEND_PASS,
  ]);
});

test('preflight: --port overrides the port property', async () => {
  const L = layout();
  writeFileSync(join(L.repo, 'app_kmp', 'gradle.properties'), 'onara.devBackendPort=1\n');
  const configured = await runQa(L, ['preflight', 'desktop']);
  assert.equal(configured.status, 1);
  assert.equal(lineWith(configured, 'FAIL backend:'), `FAIL backend: http://127.0.0.1:1/actuator/health unreachable -- fix: ${ONARA_HINT}`);
  const given = await runQa(L, ['preflight', 'desktop', '--port', String(PORT)]);
  assert.equal(given.status, 0, given.stdout);
  assert.equal(given.lines.at(-1), BACKEND_PASS);
});

test('preflight: the port comes from the port property, else the default port, and the hint from the configuration', async () => {
  const L = layout({ fixture: 'foreign' });
  const property = await runQa(L, ['preflight', 'ios']);
  assert.equal(property.status, 0, property.stdout);
  assert.equal(property.lines.at(-1), `PASS backend: http://127.0.0.1:${PORT}/healthz UP`);
  rmSync(join(L.repo, 'config', 'dev.properties'));
  const fallback = await runQa(L, ['preflight', 'ios']);
  assert.equal(fallback.status, 1);
  assert.equal(fallback.lines.at(-1), 'FAIL backend: http://127.0.0.1:9/healthz unreachable -- fix: start the backend (make serve in server/) or pass --port');
});

test('preflight: a 2xx health answer passes only when a JSON status, if present, is exactly UP', async () => {
  const L = layout({ fixture: 'foreign' });
  const url = `http://127.0.0.1:${PORT}/healthz`;
  try {
    for (const [body, expected] of [
      ['{"status":"DOWN"}', `FAIL backend: ${url} DOWN`],
      ['{"status":"up"}', `FAIL backend: ${url} up`],
      ['{"status":null}', `FAIL backend: ${url} status null`],
      ['{"status":false}', `FAIL backend: ${url} status false`],
      ['{"status":1}', `FAIL backend: ${url} status 1`],
      ['{"status":"UP"}', `PASS backend: ${url} UP`],
      ['{}', `PASS backend: ${url} HTTP 200`],
      ['[]', `PASS backend: ${url} HTTP 200`],
      ['ok', `PASS backend: ${url} HTTP 200`],
    ]) {
      health = { code: 200, body, hang: false };
      const r = await runQa(L, ['preflight', 'ios']);
      const line = r.lines.at(-1);
      assert.ok(line === expected || line.startsWith(`${expected} -- fix: `), `${body}: ${line}`);
      assert.equal(r.status, expected.startsWith('PASS') ? 0 : 1, body);
    }
    health = { code: 503, body: '{"status":"UP"}', hang: false };
    const unavailable = await runQa(L, ['preflight', 'ios']);
    assert.equal(unavailable.status, 1);
    assert.match(unavailable.lines.at(-1), new RegExp(`^FAIL backend: ${url.replace(/\./g, '\\.')} HTTP 503 -- fix: `));
  } finally {
    health = { code: 200, body: '{"status":"UP"}', hang: false };
  }
});

test('preflight: a health check that times out fails', async () => {
  const L = layout({ fixture: 'foreign' });
  health = { code: 200, body: '', hang: true };
  try {
    const r = await runQa(L, ['preflight', 'ios']);
    assert.equal(r.status, 1);
    assert.match(r.lines.at(-1), /^FAIL backend: http:\/\/127\.0\.0\.1:\d+\/healthz unreachable -- fix: start the backend \(make serve in server\/\)/);
  } finally {
    health = { code: 200, body: '{"status":"UP"}', hang: false };
    server.closeAllConnections?.();
  }
});

test('preflight: missing driver', async () => {
  const L = layout();
  L.unfake('spectre');
  const desktop = await runQa(L, ['preflight', 'desktop']);
  assert.equal(desktop.status, 1);
  assert.equal(desktop.lines.length, 4);
  assert.match(desktop.lines[0], /^FAIL driver: spectre not found -- fix: download spectre-macosArm64\.zip .*v0\.9\.0.*7bee663dbf4e7b8b089bd989cf93c327a2dbc4afa894c997f4407e18ad73371b/);
  assert.match(desktop.lines[1], /^FAIL screen capture: not checked/);
  assert.deepEqual(desktop.lines.slice(2), ['PASS screen: unlocked', BACKEND_PASS]);
  L.unfake('maestro');
  const ios = await runQa(L, ['preflight', 'ios']);
  assert.equal(ios.status, 1);
  assert.equal(ios.lines[0], 'FAIL driver: maestro not found -- fix: curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash');
  assert.deepEqual(ios.lines.slice(1), ['PASS tools: xcrun simctl', 'PASS device: SIM-AAAA-1', BACKEND_PASS]);
});

test('preflight: other driver version', async () => {
  const L = layout({ state: { spectreVersion: '0.9.1', maestroVersion: '2.13.0' } });
  const desktop = await runQa(L, ['preflight', 'desktop']);
  assert.equal(desktop.status, 1);
  assert.match(desktop.lines[0], /^FAIL driver: spectre 0\.9\.1 \(tested 0\.9\.0\) -- fix: download spectre-macosArm64\.zip .*7bee663dbf4e7b8b/);
  assert.deepEqual(desktop.lines.slice(1), ['PASS screen capture: granted', 'PASS screen: unlocked', BACKEND_PASS]);
  const android = await runQa(L, ['preflight', 'android']);
  assert.equal(android.status, 1);
  assert.equal(android.lines[0], 'FAIL driver: maestro 2.13.0 (tested 2.12.1) -- fix: curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash');
  assert.deepEqual(android.lines.slice(1), [`PASS tools: adb ${join(L.bin, 'adb')}`, 'PASS device: emulator-5554', BACKEND_PASS]);
});

test('preflight: unparseable maestro version line', async () => {
  const L = layout({ state: { maestroVersion: '2.12.1\nMaestro is up to date' } });
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 1);
  assert.equal(r.lines[0], 'FAIL driver: maestro version line unreadable -- fix: curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash');
  assert.deepEqual(r.lines.slice(1), ['PASS tools: xcrun simctl', 'PASS device: SIM-AAAA-1', BACKEND_PASS]);
});

test('preflight: denied screen capture', async () => {
  const L = layout({ state: { granted: false } });
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 1);
  assert.match(r.lines[1], /^FAIL screen capture: denied -- fix: System Settings > Privacy & Security > Screen Recording: allow it for \//);
  assert.deepEqual([r.lines[0], ...r.lines.slice(2)], ['PASS driver: spectre 0.9.0', 'PASS screen: unlocked', BACKEND_PASS]);
});

test('preflight: locked screen', async () => {
  const L = layout({ state: { locked: true } });
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [
    'PASS driver: spectre 0.9.0',
    'PASS screen capture: granted',
    'FAIL screen: locked -- fix: unlock the screen',
    BACKEND_PASS,
  ]);
});

test('preflight: missing xcrun', async () => {
  const L = layout();
  L.unfake('xcrun');
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [
    'PASS driver: maestro 2.12.1',
    'FAIL tools: xcrun simctl unavailable -- fix: xcode-select --install',
    'FAIL device: not checked, xcrun unavailable -- fix: fix xcrun first',
    BACKEND_PASS,
  ]);
});

test('preflight: missing adb names the configured SDK properties file', async () => {
  const L = layout();
  L.unfake('adb');
  const r = await runQa(L, ['preflight', 'android']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [
    'PASS driver: maestro 2.12.1',
    'FAIL tools: adb unavailable -- fix: put adb on PATH, set ADB, or set sdk.dir in app_kmp/local.properties',
    'FAIL device: not checked, adb unavailable -- fix: fix adb first',
    BACKEND_PASS,
  ]);
});

test('preflight: adb from ADB, else PATH, else sdk.dir of the configured properties file', async () => {
  const L = layout();
  L.unfake('adb');
  const sdk = join(L.root, 'sdk');
  mkdirSync(join(sdk, 'platform-tools'), { recursive: true });
  L.fake('adb', join(sdk, 'platform-tools'));
  writeFileSync(join(L.repo, 'app_kmp', 'local.properties'), `sdk.dir=${sdk}\n`);
  const fromSdk = await runQa(L, ['preflight', 'android']);
  assert.equal(fromSdk.status, 0, fromSdk.stdout);
  assert.equal(fromSdk.lines[1], `PASS tools: adb ${join(sdk, 'platform-tools', 'adb')}`);
  const other = join(L.root, 'adb-bin');
  mkdirSync(other);
  L.fake('adb', other);
  const fromEnv = await runQa(L, ['preflight', 'android'], { env: { ADB: join(other, 'adb') } });
  assert.equal(fromEnv.lines[1], `PASS tools: adb ${join(other, 'adb')}`);
});

test('preflight: no usable device', async () => {
  const L = layout({ state: { iosDevices: [], androidDevices: [] } });
  const ios = await runQa(L, ['preflight', 'ios']);
  assert.equal(ios.status, 1);
  assert.equal(ios.lines[2], 'FAIL device: no booted device -- fix: boot a simulator (xcrun simctl boot NAME)');
  assert.deepEqual([...ios.lines.slice(0, 2), ios.lines[3]], ['PASS driver: maestro 2.12.1', 'PASS tools: xcrun simctl', BACKEND_PASS]);
  const android = await runQa(L, ['preflight', 'android']);
  assert.equal(android.status, 1);
  assert.equal(android.lines[2], 'FAIL device: no booted device -- fix: start an emulator');
  assert.equal(android.lines.length, 4);
});

test('preflight: two usable devices', async () => {
  const L = layout({
    state: {
      iosDevices: [{ udid: 'SIM-1', name: 'A' }, { udid: 'SIM-2', name: 'B' }],
      androidDevices: ['emulator-5554', 'emulator-5556'],
    },
  });
  const ios = await runQa(L, ['preflight', 'ios']);
  assert.equal(ios.status, 1);
  assert.equal(ios.lines[2], 'FAIL device: 2 booted devices (SIM-1 (A), SIM-2 (B)); pass --device ID -- fix: pass --device ID');
  assert.equal(ios.lines.length, 4);
  const android = await runQa(L, ['preflight', 'android']);
  assert.equal(android.status, 1);
  assert.match(android.lines[2], /^FAIL device: 2 booted devices \(emulator-5554, emulator-5556\)/);
  const given = await runQa(L, ['preflight', 'android', '--device', 'emulator-5556']);
  assert.equal(given.status, 0, given.stdout);
  assert.equal(given.lines[2], 'PASS device: emulator-5556 (given)');
});

test('preflight: unhealthy backend', async () => {
  const L = layout();
  health = { code: 503, body: '{"status":"DOWN"}', hang: false };
  try {
    const r = await runQa(L, ['preflight', 'desktop']);
    assert.equal(r.status, 1);
    assert.deepEqual(r.lines.slice(0, 3), ['PASS driver: spectre 0.9.0', 'PASS screen capture: granted', 'PASS screen: unlocked']);
    assert.equal(r.lines[3], `FAIL backend: http://127.0.0.1:${PORT}/actuator/health DOWN -- fix: ${ONARA_HINT}`);
  } finally {
    health = { code: 200, body: '{"status":"UP"}', hang: false };
  }
});

// ---------- desktop ----------

async function attached(state, opts = {}) {
  const L = layout({ state, ...opts });
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return L;
}

const clicks = (L) => L.calls('spectre').filter((c) => c.argv[0] === 'click');
const spectreCalls = (L, verb) => L.calls('spectre').filter((c) => c.argv[0] === verb);

test('desktop: attach picks the JVM of the configured main class in this worktree and stores the session', async () => {
  const L = layout();
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.lines, ['attach: pid=17059 session=pid-17059']);
  const file = sessionPath(L, L.repo);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), {
    root: L.repo,
    config: join(L.repo, '.omp', 'app-qa.json'),
    mainClass: 'eu.onara.app.MainKt',
    pid: 17059,
    session: 'pid-17059',
  });
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(file)).mode & 0o777, 0o700);
});

test('desktop: attach with no JVM or two JVMs of this worktree is refused', async () => {
  const L = layout({ fixture: 'foreign', state: { jvms: [] } });
  const none = await runQa(L, ['desktop', 'attach']);
  assert.equal(none.status, 2);
  assert.equal(none.lines[0], `attach: no org.example.foreign.DeskKt JVM in this worktree (${L.repo}); start it with make desk in client/`);
  L.set({ jvms: [17059, 17060].map((pid) => ({ pid, mainClass: 'org.example.foreign.DeskKt', cwd: join(L.repo, 'app') })) });
  const two = await runQa(L, ['desktop', 'attach']);
  assert.equal(two.status, 2);
  assert.match(two.lines[0], /^attach: 2 org\.example\.foreign\.DeskKt JVMs in this worktree \(pids 17059, 17060\); pass --pid N/);
  assert.equal(spectreCalls(L, 'attach').length, 0);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
});

test('desktop: --pid chooses one of two JVMs of this worktree', async () => {
  const L = layout();
  L.set({ jvms: [17059, 17060].map((pid) => ({ pid, mainClass: 'eu.onara.app.MainKt', cwd: join(L.repo, 'app') })) });
  const r = await runQa(L, ['desktop', 'attach', '--pid', '17060']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(r.lines, ['attach: pid=17060 session=pid-17060']);
  assert.equal(JSON.parse(readFileSync(sessionPath(L, L.repo), 'utf8')).pid, 17060);
});

test('desktop: two repositories attached at once each tap their own app', async () => {
  const L = layout();
  const other = L.repoAt('other', 'foreign');
  L.set({
    jvms: [
      { pid: 17059, mainClass: 'eu.onara.app.MainKt', cwd: join(L.repo, 'app') },
      { pid: 18000, mainClass: 'org.example.foreign.DeskKt', cwd: join(other, 'app') },
    ],
  });
  assert.deepEqual((await runQa(L, ['desktop', 'attach'])).lines, ['attach: pid=17059 session=pid-17059']);
  assert.deepEqual((await runQa(L, ['desktop', 'attach'], { cwd: other })).lines, ['attach: pid=18000 session=pid-18000']);
  assert.equal((await runQa(L, ['desktop', 'tap', 'sign-in'])).status, 0);
  assert.equal((await runQa(L, ['desktop', 'tap', 'home'], { cwd: other })).status, 0);
  assert.deepEqual(clicks(L).map((c) => c.argv.slice(1, 3)), [['pid-17059', 'sign-in:0'], ['pid-18000', 'home:0']]);
});

test('desktop: only another repository app of the same main class running is refused with its pid listed', async () => {
  const L = layout();
  const other = L.repoAt('other', 'onara');
  L.set({ jvms: [{ pid: 18000, mainClass: 'eu.onara.app.MainKt', cwd: join(other, 'app') }] });
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 2);
  assert.match(r.lines[0], /^attach: no eu\.onara\.app\.MainKt JVM in this worktree .*start it with \.\/gradlew :desktopApp:run in app_kmp\/.*18000/);
  assert.equal(spectreCalls(L, 'attach').length, 0);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
});

test('desktop: two worktrees whose configurations share one name each attach and act on their own JVM', async () => {
  const L = layout();
  const second = L.worktree(L.repo, join(L.root, 'second'));
  L.set({
    jvms: [
      { pid: 17059, mainClass: 'eu.onara.app.MainKt', cwd: join(L.repo, 'app') },
      { pid: 17070, mainClass: 'eu.onara.app.MainKt', cwd: join(second, 'app') },
    ],
  });
  assert.deepEqual((await runQa(L, ['desktop', 'attach'])).lines, ['attach: pid=17059 session=pid-17059']);
  assert.deepEqual((await runQa(L, ['desktop', 'attach'], { cwd: second })).lines, ['attach: pid=17070 session=pid-17070']);
  const secondRecord = readFileSync(sessionPath(L, second), 'utf8');
  assert.equal((await runQa(L, ['desktop', 'tap', 'sign-in'])).status, 0);
  assert.equal((await runQa(L, ['desktop', 'detach'])).status, 0);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
  assert.equal(readFileSync(sessionPath(L, second), 'utf8'), secondRecord);
  assert.equal((await runQa(L, ['desktop', 'tap', 'home'], { cwd: second })).status, 0);
  assert.deepEqual(clicks(L).map((c) => c.argv[1]), ['pid-17059', 'pid-17070']);
  assert.deepEqual(spectreCalls(L, 'detach').map((c) => c.argv[1]), ['pid-17059']);
});

test('desktop: only another worktree JVM of the main class running is refused with its pid listed', async () => {
  const L = layout();
  const second = L.worktree(L.repo, join(L.root, 'second'));
  L.set({ jvms: [{ pid: 17070, mainClass: 'eu.onara.app.MainKt', cwd: join(second, 'app') }] });
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 2);
  assert.match(r.lines[0], /start it with \.\/gradlew :desktopApp:run in app_kmp\/.*17070/);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
});

test('desktop: a linked worktree below the main checkout is another worktree', async () => {
  const L = layout();
  const b = L.worktree(L.repo, join(L.repo, '.worktrees', 'B'));
  L.set({ jvms: [{ pid: 17080, mainClass: 'eu.onara.app.MainKt', cwd: join(b, 'app') }] });
  const onlyB = await runQa(L, ['desktop', 'attach']);
  assert.equal(onlyB.status, 2);
  assert.match(onlyB.lines[0], /^attach: no eu\.onara\.app\.MainKt JVM in this worktree .*17080/);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
  L.set({
    jvms: [
      { pid: 17059, mainClass: 'eu.onara.app.MainKt', cwd: join(L.repo, 'app') },
      { pid: 17080, mainClass: 'eu.onara.app.MainKt', cwd: join(b, 'app') },
    ],
  });
  assert.deepEqual((await runQa(L, ['desktop', 'attach'])).lines, ['attach: pid=17059 session=pid-17059']);
  assert.deepEqual((await runQa(L, ['desktop', 'attach'], { cwd: join(b, 'app') })).lines, ['attach: pid=17080 session=pid-17080']);
  const record = readFileSync(sessionPath(L, L.repo), 'utf8');
  const explicit = await runQa(L, ['desktop', 'attach', '--pid', '17080']);
  assert.equal(explicit.status, 2);
  assert.match(explicit.lines[0], /^attach: pid 17080 is not a eu\.onara\.app\.MainKt JVM of this worktree/);
  assert.equal(readFileSync(sessionPath(L, L.repo), 'utf8'), record);
});

test('desktop: an unreadable working directory is not attached and its pid is listed', async () => {
  const L = layout({ state: { jvms: [{ pid: 17090, mainClass: 'eu.onara.app.MainKt', cwd: null }] } });
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 2);
  assert.match(r.lines[0], /^attach: no eu\.onara\.app\.MainKt JVM in this worktree .*17090 \(working directory unreadable\)/);
  assert.equal(spectreCalls(L, 'attach').length, 0);
});

test('desktop: --pid naming a JVM outside the worktree is refused', async () => {
  const L = layout();
  const other = L.repoAt('other', 'onara');
  L.set({
    jvms: [
      { pid: 17059, mainClass: 'eu.onara.app.MainKt', cwd: join(L.repo, 'app') },
      { pid: 18000, mainClass: 'eu.onara.app.MainKt', cwd: join(other, 'app') },
    ],
  });
  const r = await runQa(L, ['desktop', 'attach', '--pid', '18000']);
  assert.equal(r.status, 2);
  assert.equal(spectreCalls(L, 'attach').length, 0);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
});

test('desktop: a command with another configuration or main class than the attached one is refused', async () => {
  const L = await attached({ tags: { 'sign-in': 1, home: 1, 'chat-input': 1 } });
  const record = readFileSync(sessionPath(L, L.repo), 'utf8');
  const foreignConfig = join(L.root, 'foreign.json');
  writeFileSync(foreignConfig, JSON.stringify(CONFIGS.foreign));
  const before = L.calls('spectre').length;
  const config = join(L.repo, '.omp', 'app-qa.json');
  const other = await runQa(L, ['desktop', 'tap', 'sign-in', '--config', foreignConfig]);
  assert.equal(other.status, 2);
  assert.deepEqual(other.lines, [`tap: attached with ${config} for eu.onara.app.MainKt; attach again`]);
  writeConfig(L.repo, { ...CONFIGS.onara, desktop: { ...CONFIGS.onara.desktop, mainClass: 'eu.onara.app.OtherKt' } });
  for (const verb of [['tap', 'sign-in'], ['detach']]) {
    const r = await runQa(L, ['desktop', ...verb]);
    assert.equal(r.status, 2, verb[0]);
    assert.deepEqual(r.lines, [`${verb[0]}: attached with ${config} for eu.onara.app.MainKt; attach again`]);
  }
  assert.equal(L.calls('spectre').length, before);
  assert.equal(readFileSync(sessionPath(L, L.repo), 'utf8'), record);
});

test('desktop: commands without a desktop section are refused', async () => {
  const { desktop, ...noDesktop } = CONFIGS.minimal;
  const L = layout({ fixture: 'minimal', config: noDesktop });
  for (const args of [['attach'], ['tap', 'home']]) {
    const r = await runQa(L, ['desktop', ...args]);
    assert.equal(r.status, 2);
    assert.match(r.lines[0], /no desktop section/);
  }
  assert.equal(L.calls('spectre').length, 0);
});

test('desktop: tap clicks the one node carrying the tag', async () => {
  const L = await attached();
  const r = await runQa(L, ['desktop', 'tap', 'sign-in']);
  assert.equal(r.status, 0);
  assert.deepEqual(r.lines, ['tap: tag=sign-in']);
  assert.deepEqual(clicks(L).map((c) => c.argv.slice(1, 3)), [['pid-17059', 'sign-in:0']]);
});

test('desktop: tap with no node carrying the tag clicks nothing', async () => {
  const L = await attached();
  const r = await runQa(L, ['desktop', 'tap', 'no-such-tag']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['tap: tag=no-such-tag count=0']);
  assert.equal(clicks(L).length, 0);
});

test('desktop: two nodes carry the tag', async () => {
  const L = await attached({ tags: { 'sign-in': 2, home: 1, 'chat-input': 2 } });
  const tap = await runQa(L, ['desktop', 'tap', 'sign-in']);
  assert.equal(tap.status, 1);
  assert.deepEqual(tap.lines, ['tap: tag=sign-in count=2']);
  const type = await runQa(L, ['desktop', 'type', 'chat-input', 'x']);
  assert.equal(type.status, 1);
  assert.deepEqual(type.lines, ['type: tag=chat-input count=2']);
  const find = await runQa(L, ['desktop', 'find', 'sign-in']);
  assert.equal(find.status, 1);
  assert.deepEqual(find.lines, ['find: tag=sign-in count=2']);
  assert.equal(clicks(L).length, 0);
  assert.equal(spectreCalls(L, 'type').length, 0);
});

test('desktop: wait returns once one node carries the tag', async () => {
  const L = await attached();
  const r = await runQa(L, ['desktop', 'wait', 'home', '--timeout', '2']);
  assert.equal(r.status, 0);
  assert.deepEqual(r.lines, ['wait: tag=home count=1']);
  const call = spectreCalls(L, 'wait-for-node')[0];
  assert.deepEqual(call.argv, ['wait-for-node', 'pid-17059', '--tag', 'home', '--timeout-ms', '2000', '--json']);
});

test('desktop: wait timing out names the tag and the last count', async () => {
  const L = await attached();
  const r = await runQa(L, ['desktop', 'wait', 'welcome', '--timeout', '1.5']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['wait: tag=welcome timed out after 1.5s, last count=0']);
});

test('desktop: wait ending on two nodes fails', async () => {
  const L = await attached({ tags: { home: 2 } });
  const r = await runQa(L, ['desktop', 'wait', 'home']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['wait: tag=home count=2']);
});

test('desktop: type replaces the text and ends with the exact text', async () => {
  const L = await attached({ text: { 'chat-input': 'draft' } });
  const r = await runQa(L, ['desktop', 'type', 'chat-input', 'Add a health endpoint']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(r.lines, ['type: tag=chat-input textLength=21']);
  assert.equal(L.state().text['chat-input'], 'Add a health endpoint');
  const steps = L.calls('spectre').map((c) => c.argv.slice(0, 3)).filter(([c]) => ['click', 'press-key', 'type'].includes(c));
  assert.deepEqual(steps, [
    ['click', 'pid-17059', 'chat-input:0'],
    ['press-key', 'pid-17059', 'Cmd+A'],
    ['press-key', 'pid-17059', 'BackSpace'],
    ['type', 'pid-17059', 'Add a health endpoint'],
  ]);
});

test('desktop: type fails with both lengths when the field ends with other text', async () => {
  const corrupt = await attached({ corrupt: true });
  const r = await runQa(corrupt, ['desktop', 'type', 'chat-input', 'Add a health endpoint']);
  assert.equal(corrupt.state().text['chat-input'], 'dd a health endpointA');
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['type: tag=chat-input text differs: expected length 21, actual length 21']);
  const appended = await attached({ text: { 'chat-input': 'draft' }, append: true });
  const a = await runQa(appended, ['desktop', 'type', 'chat-input', 'Add a health endpoint']);
  assert.equal(appended.state().text['chat-input'], 'draftAdd a health endpoint');
  assert.equal(a.status, 1);
  assert.deepEqual(a.lines, ['type: tag=chat-input text differs: expected length 21, actual length 26']);
});

test('desktop: find prints one line only and never the node text', async () => {
  const L = await attached({ tags: { 'chat-input': 1, 'chat-send': 1 }, text: { 'chat-input': 'Add a health endpoint' } });
  const r = await runQa(L, ['desktop', 'find', 'chat-input', '--equals', 'Add a health endpoint']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'tag=chat-input count=1 enabled=true focused=false textLength=21 equals=true\n');
  assert.equal(r.stderr, '');
});

test('desktop: find --equals with other text exits 1', async () => {
  const L = await attached({ text: { 'chat-input': 'Add a health endpoint' } });
  const r = await runQa(L, ['desktop', 'find', 'chat-input', '--equals', 'Add a health endpointX']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['tag=chat-input count=1 enabled=true focused=false textLength=21 equals=false']);
  assert.doesNotMatch(r.stdout + r.stderr, /health/);
  const plain = await runQa(L, ['desktop', 'find', 'sign-in']);
  assert.equal(plain.status, 0);
  assert.deepEqual(plain.lines, ['tag=sign-in count=1 enabled=true focused=false textLength=7']);
});

test('desktop: capture writes NAME.png and NAME.json into --out', async () => {
  const L = await attached();
  const out = join(L.root, 'evidence');
  const r = await runQa(L, ['desktop', 'capture', 'home', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.lines, [`capture: ${join(out, 'home.png')}`, `capture: ${join(out, 'home.json')}`]);
  assert.deepEqual(readFileSync(join(out, 'home.png')), PNG);
  assert.equal(readFileSync(join(out, 'home.json'), 'utf8'), '{"schemaVersion":1}\n');
  assert.deepEqual(readdirSync(L.tmp).filter((n) => n.startsWith('app-qa-capture-')), []);
  const again = await runQa(L, ['desktop', 'capture', 'home', '--out', out]);
  assert.equal(again.status, 2);
  assert.deepEqual(readFileSync(join(out, 'home.png')), PNG);
  assert.equal(spectreCalls(L, 'capture').length, 1);
});

test('desktop: capture without a session writes nothing', async () => {
  const L = await attached();
  assert.equal((await runQa(L, ['desktop', 'detach'])).status, 0);
  assert.equal(existsSync(sessionPath(L, L.repo)), false);
  const out = join(L.root, 'evidence');
  mkdirSync(out);
  const r = await runQa(L, ['desktop', 'capture', 'x', '--out', out]);
  assert.equal(r.status, 2);
  assert.deepEqual(readdirSync(out), []);
  assert.equal(spectreCalls(L, 'capture').length, 0);
});

test('desktop: restricted-method warnings are dropped from stderr, other stderr passes', async () => {
  const L = await attached({ extraStderr: 'Spectre: something else' });
  const r = await runQa(L, ['desktop', 'find', 'home']);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, 'Spectre: something else\n');
});

// ---------- flow: credentials, expected screen, redaction ----------

test('flow: credentials parsing trims, strips one pair of matching quotes and keeps the last non-empty definition', () => {
  const parsed = qa.parseCredentials(
    [
      '# comment',
      '  QA_BETA_LOGIN = first@example.test  ',
      'QA_BETA_LOGIN=second@example.test',
      'QA_BETA_LOGIN=',
      `QA_BETA_SECRET="'quoted'"`,
      `QA_ALPHA_SECRET="unbalanced'`,
      'no equals sign',
    ].join('\n'),
  );
  assert.equal(parsed.QA_BETA_LOGIN, 'second@example.test');
  assert.equal(parsed.QA_BETA_SECRET, "'quoted'");
  assert.equal(parsed.QA_ALPHA_SECRET, `"unbalanced'`);
  assert.deepEqual(qa.credentialValues(CONFIGS.foreign, { ...parsed, OTHER: 'x', DEV_TEST_PASSWORD: 'y' }), {
    users: ['second@example.test'],
    passwords: [`"unbalanced'`, "'quoted'"],
  });
  assert.deepEqual(qa.credentialValues(CONFIGS.minimal, parsed), { users: [], passwords: [] });
});

test('flow: credentials parsing keeps a value with a space and a hash whole', () => {
  const parsed = qa.parseCredentials(['PW=pa ss #x', 'PW=', "PW=''"].join('\n'));
  assert.equal(parsed.PW, 'pa ss #x');
});

test('flow: redact replaces a token', () => {
  const line = `Authorization: Bearer ${TOKEN}.payload_part.sig-nature end`;
  const out = qa.redact(line, { users: [], passwords: [] });
  assert.equal(out, 'Authorization: Bearer [redacted] end');
  assert.doesNotMatch(out, /eyJ/);
});

test('flow: redact replaces raw and JSON-escaped values', () => {
  const out = qa.redact(`raw ${PW2} json "${jsonEscape(PW2)}" user ${USER1}`, CREDS);
  assert.equal(out, 'raw [redacted] json "[redacted]" user [redacted]');
});

test('flow: credentials of the default account and the default screen without flags', async () => {
  const L = layout({ fixture: 'foreign' });
  const r = await flow(L);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.lines.includes(`credentials: ${join(L.repo, 'secrets', 'qa-accounts.env')}`), r.stdout);
  const [run] = maestroRuns(L);
  assert.deepEqual(run.env, { MAESTRO_DEV_USER: BETA_USER, MAESTRO_DEV_PW: BETA_PW, MAESTRO_EXPECT_TAG: 'start-screen' });
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
});

test('flow: credentials of --account alpha with --expect welcome', async () => {
  const L = layout({ fixture: 'foreign' });
  const r = await flow(L, ['--account', 'alpha', '--expect', 'welcome']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const [run] = maestroRuns(L);
  assert.deepEqual(run.env, { MAESTRO_DEV_USER: ALPHA_USER, MAESTRO_DEV_PW: ALPHA_PW, MAESTRO_EXPECT_TAG: 'welcome-card' });
});

test('flow: credentials only in the environment, never in argv', async () => {
  for (const account of ['1', '2']) {
    const L = layout();
    const r = await flow(L, ['--account', account]);
    assert.equal(r.status, 0, r.stdout);
    const [run] = maestroRuns(L);
    assert.deepEqual(run.env, {
      MAESTRO_DEV_USER: account === '1' ? USER1 : USER2,
      MAESTRO_DEV_PW: account === '1' ? PW1 : PW2,
      MAESTRO_EXPECT_TAG: 'home',
    });
    assert.deepEqual(leaks(run.argv.join('\u0000')), []);
    assert.deepEqual(run.argv.slice(0, 4), ['test', '--no-ansi', '--udid', 'SIM-AAAA-1']);
    assert.equal(run.argv.includes('-e') || run.argv.includes('--env'), false);
    assert.deepEqual(leaks(r.stdout + r.stderr), []);
  }
});

test('flow: credentials with a missing key stop the run before maestro starts and name the key', async () => {
  const L = layout({ fixture: 'foreign' });
  const creds = credentials(L.root, 'foreign', { omit: ['QA_ALPHA_SECRET'], name: 'creds.env' });
  const r = await flow(L, ['--account', 'alpha', '--credentials', creds]);
  assert.equal(r.status, 2);
  assert.deepEqual(r.lines, [`credentials: ${creds}`, `flow: QA_ALPHA_SECRET is missing in ${creds}`]);
  assert.equal(maestroRuns(L).length, 0);
  assert.deepEqual(readdirSync(L.tmp).filter((n) => n.startsWith('app-qa-flow-')), []);
  const unknown = await flow(L, ['--account', 'gamma']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.lines.at(-1), /account gamma .*alpha, beta/);
  assert.equal(maestroRuns(L).length, 0);
});

test('flow: credentials of a linked worktree come from the main checkout file of the working directory', async () => {
  const L = layout({ fixture: 'foreign' });
  const wt = L.worktree(L.repo, join(L.root, 'wt'));
  credentials(wt, 'foreign', { lines: { QA_BETA_LOGIN: 'worktree@example.test', QA_BETA_SECRET: 'Worktree-Only-5d2b' } });
  // The driver runs from another Git repository with its own credentials file, as the deployed skill would.
  const driverRepo = join(L.root, 'skills');
  mkdirSync(driverRepo);
  git(driverRepo, 'init', '-q');
  credentials(driverRepo, 'foreign', { lines: { QA_BETA_LOGIN: 'skills@example.test', QA_BETA_SECRET: 'Skills-Only-8e1c' } });
  const driver = join(driverRepo, 'qa.mjs');
  copyFileSync(QA_SOURCE, driver);
  const r = await flow(L, [], { cwd: join(wt, 'app'), qaPath: driver });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.lines.includes(`credentials: ${join(L.repo, 'secrets', 'qa-accounts.env')}`), r.stdout);
  assert.deepEqual(maestroRuns(L)[0].env, { MAESTRO_DEV_USER: BETA_USER, MAESTRO_DEV_PW: BETA_PW, MAESTRO_EXPECT_TAG: 'start-screen' });
  const evidence = join(L.root, 'evidence');
  mkdirSync(evidence);
  writeFileSync(join(evidence, 'a.log'), 'mentions Worktree-Only-5d2b and Skills-Only-8e1c\n');
  writeFileSync(join(evidence, 'b.log'), `typed ${ALPHA_PW}\n`);
  const scan = await runQa(L, ['scan', evidence], { cwd: wt, qaPath: driver });
  assert.equal(scan.status, 1, scan.stderr);
  assert.deepEqual(scan.lines, [join(evidence, 'b.log')]);
  assert.equal(scan.stderr, `credentials: ${join(L.repo, 'secrets', 'qa-accounts.env')}\n`);
});

/** Asserts that no configured value of either foreign account, in any form, reached a sink of design D3. */
function assertNoForeignLeak(L, r, out) {
  const values = [ALPHA_USER, ALPHA_PW, BETA_USER, BETA_PW];
  assert.deepEqual(leaks(r.stdout + r.stderr, values), [], 'driver output');
  const root = valueAfter(r, 'root: ');
  for (const f of [...filesBelow(root), ...filesBelow(out)]) {
    const bytes = readFileSync(f, 'latin1');
    assert.deepEqual(leaks(bytes, values.map((v) => Buffer.from(v, 'utf8').toString('latin1'))), [], f);
  }
}

test('flow: credentials sentinel run across every sink leaves no value of either account, failing and passing', async () => {
  for (const fail of [true, false]) {
    const L = layout({ fixture: 'foreign' });
    L.maestro({ fail, failMessage: 'Input text $PW was not accepted', echo: true, leak: [ALPHA_USER, ALPHA_PW, BETA_USER, BETA_PW] });
    const out = join(L.root, 'evidence');
    const r = await flow(L, ['--out', out]);
    assert.equal(r.status, 1, r.stdout);
    assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
    assertNoForeignLeak(L, r, out);
    if (fail) assert.ok(existsSync(join(valueAfter(r, 'root kept: '), 'console.log')));
    else assert.equal(existsSync(valueAfter(r, 'root: ')), false);
  }
});

test('flow: credentials without a credentials section carry none, even when the caller exports them', async () => {
  const L = layout({ fixture: 'minimal' });
  const r = await flow(L, [], { env: { MAESTRO_DEV_USER: USER1, MAESTRO_DEV_PW: PW1, MAESTRO_EXPECT_TAG: 'home' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.lines.some((l) => l.startsWith('credentials:')), false);
  assert.deepEqual(maestroRuns(L)[0].env, {});
});

test('flow: credentials and expect flags without their sections are refused before maestro starts', async () => {
  const L = layout({ fixture: 'minimal' });
  const creds = credentials(L.root, 'onara', { name: 'creds.env' });
  for (const extra of [['--account', '1'], ['--credentials', creds], ['--expect', 'home']]) {
    const r = await flow(L, extra);
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.lines.at(-1), new RegExp(`${extra[0]} needs an? \\w+ section`));
  }
  assert.equal(maestroRuns(L).length, 0);
  assert.deepEqual(readdirSync(L.tmp), []);
});

test('flow: expect onboarding sets its configured tag, an unmapped screen is refused', async () => {
  const L = layout();
  assert.equal((await flow(L)).status, 0);
  assert.equal((await flow(L, ['--expect', 'onboarding'])).status, 0);
  assert.deepEqual(maestroRuns(L).map((c) => c.env.MAESTRO_EXPECT_TAG), ['home', 'onboarding-welcome']);
  const settings = await flow(L, ['--expect', 'settings']);
  assert.equal(settings.status, 2);
  assert.match(settings.lines.at(-1), /screen settings .*home, onboarding/);
  const foreign = layout({ fixture: 'foreign' });
  const home = await flow(foreign, ['--expect', 'home']);
  assert.equal(home.status, 2);
  assert.equal(maestroRuns(L).length + maestroRuns(foreign).length, 2);
});

test('flow: redact driver output, a password split across two writes included', async () => {
  const L = layout({ fixture: 'foreign', state: { maestro: { ...DEFAULT_STATE.maestro, echo: true, fail: true } } });
  const r = await flow(L);
  assert.equal(r.status, 1);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  const kept = readFileSync(join(valueAfter(r, 'root kept: '), 'console.log'), 'utf8');
  assert.deepEqual(leaks(kept), []);
  assert.deepEqual(kept.split('\n').filter(Boolean).sort(), ['Input text [redacted]', 'Input text [redacted]', 'typed [redacted] and [redacted]']);
});

test('flow: redact a driver on a terminal fails', async () => {
  const L = layout();
  const harness = join(L.root, 'pty.py');
  writeFileSync(
    harness,
    [
      'import os, subprocess, sys',
      'm, s = os.openpty()',
      'p = subprocess.Popen(sys.argv[1:], stdin=s, stdout=s, stderr=s, close_fds=True)',
      'os.close(s)',
      'while True:',
      '    try:',
      '        b = os.read(m, 4096)',
      '    except OSError:',
      '        break',
      '    if not b:',
      '        break',
      '    sys.stdout.buffer.write(b)',
      'sys.exit(p.wait())',
    ].join('\n'),
  );
  const r = await runQa(L, ['flow', 'ios', flowFile(L)], {
    argv0: (script, args) => ['/usr/bin/python3', [harness, NODE, script, ...args]],
  });
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(maestroRuns(L)[0].tty, [false, false, false]);
});

test('flow: redact a printed credential in the failure message and the report', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, failMessage: 'Input text $PW was not accepted' } } });
  const r = await flow(L, ['--account', '2']);
  assert.equal(r.status, 1);
  assert.equal(lineWith(r, 'FAIL '), 'FAIL scenario 3.3s: Input text [redacted] was not accepted');
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  const report = readFileSync(join(valueAfter(r, 'root kept: '), 'report.xml'), 'utf8');
  assert.match(report, /<failure>Input text \[redacted\] was not accepted<\/failure><\/testcase>/);
  assert.deepEqual(leaks(report), []);
});

// ---------- flow: device, root, sweep, interrupt ----------

test('flow: device explicit wins, else the one booted device is used', async () => {
  const L = layout({ state: { iosDevices: [{ udid: 'SIM-1', name: 'A' }, { udid: 'SIM-2', name: 'B' }] } });
  const given = await flow(L, ['--device', 'SIM-2']);
  assert.equal(given.status, 0);
  assert.ok(given.lines.includes('device: SIM-2'));
  L.set({ iosDevices: [{ udid: 'SIM-1', name: 'A' }] });
  const single = await flow(L);
  assert.equal(single.status, 0);
  assert.ok(single.lines.includes('device: SIM-1'));
  assert.deepEqual(maestroRuns(L).map((c) => c.argv[c.argv.indexOf('--udid') + 1]), ['SIM-2', 'SIM-1']);
  const r = await runQa(L, ['flow', 'android', flowFile(L)]);
  assert.equal(r.status, 0, r.stdout);
  assert.ok(r.lines.includes('device: emulator-5554'));
});

test('flow: device two booted or none are refused', async () => {
  const L = layout({ state: { iosDevices: [{ udid: 'SIM-1', name: 'A' }, { udid: 'SIM-2', name: 'B' }] } });
  const two = await flow(L);
  assert.equal(two.status, 2);
  assert.equal(two.lines.at(-1), 'flow: 2 booted devices (SIM-1 (A), SIM-2 (B)); pass --device ID');
  L.set({ iosDevices: [] });
  const none = await flow(L);
  assert.equal(none.status, 2);
  assert.equal(none.lines.at(-1), 'flow: no booted device');
  assert.equal(maestroRuns(L).length, 0);
});

test('flow: root the result line comes from the junit report', async () => {
  const L = layout();
  const pass = await flow(L);
  assert.equal(pass.lines.at(-1), 'PASS scenario 3.3s');
  L.maestro({ noReport: true });
  const unreadable = await flow(L);
  assert.equal(unreadable.status, 1);
  assert.ok(unreadable.lines.includes('FAIL scenario: unreadable report'), unreadable.stdout);
});

test('flow: root is private and in the temporary directory', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true } } });
  const r = await flow(L);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  assert.equal(dirname(root), L.tmp);
  assert.match(root, /\/app-qa-flow-[^/]+$/);
  assert.equal(statSync(root).mode & 0o777, 0o700);
  const [run] = maestroRuns(L);
  const flag = (n) => run.argv[run.argv.indexOf(n) + 1];
  assert.deepEqual(
    [flag('--debug-output'), flag('--test-output-dir'), flag('--format'), flag('--output')],
    [join(root, 'debug'), join(root, 'out'), 'junit', join(root, 'report.xml')],
  );
});

test('flow: root holds every driver file, none below the repository', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true } } });
  const before = filesBelow(L.repo);
  const r = await flow(L);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(filesBelow(L.repo), before);
  const [run] = maestroRuns(L);
  for (const n of ['--debug-output', '--test-output-dir', '--output']) {
    assert.ok(run.argv[run.argv.indexOf(n) + 1].startsWith(`${L.tmp}/`), n);
  }
});

test('flow: root keeps driver temporary files out of the temporary directory', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true } } });
  const before = readdirSync(L.tmp).filter((n) => n !== 'app-qa').sort();
  const r = await flow(L, ['--out', join(L.root, 'shots')]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(readdirSync(L.tmp).filter((n) => n !== 'app-qa').sort(), before);
});

test('flow: root refuses an existing output directory', async () => {
  const L = layout();
  const existing = join(L.root, 'existing');
  mkdirSync(existing);
  writeFileSync(join(existing, 'run.log'), `typed ${PW1}\n`);
  const before = hashes(existing);
  const r = await flow(L, ['--out', existing]);
  assert.equal(r.status, 2);
  assert.equal(r.lines.at(-1), `flow: --out ${existing} exists; name a directory that does not exist yet`);
  assert.equal(maestroRuns(L).length, 0);
  assert.deepEqual(hashes(existing), before);
});

test('flow: root creates an absent --out, and without --out prints a temporary one', async () => {
  const L = layout();
  const out = join(L.root, 'new-out');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 0);
  assert.ok(statSync(out).isDirectory());
  assert.ok(r.lines.includes(`out: ${out}`));
  const tmpOut = valueAfter(await flow(L), 'out: ');
  assert.equal(dirname(tmpOut), L.tmp);
  assert.match(tmpOut, /\/app-qa-out-[^/]+$/);
  assert.ok(statSync(tmpOut).isDirectory());
});

test('flow: root keeps no step screenshot after a pass or a failure', async () => {
  const L = layout();
  const out = join(L.root, 'out-pass');
  const pass = await flow(L, ['--out', out]);
  assert.equal(pass.status, 0);
  assert.deepEqual(readdirSync(out), []);
  assert.equal(existsSync(valueAfter(pass, 'root: ')), false);
  L.maestro({ fail: true });
  const fail = await flow(L);
  const root = valueAfter(fail, 'root kept: ');
  assert.deepEqual(filesBelow(root).filter((f) => /\/(screenshots|screen-hierarchy)\//.test(f)), []);
});

test('flow: root keeps no image after a failing run, only the console log and the report', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true, fail: true } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  assert.equal(root, valueAfter(r, 'root: '));
  assert.deepEqual(readdirSync(out), []);
  assert.deepEqual(filesBelow(root).filter((f) => f.endsWith('.png')), []);
  assert.ok(existsSync(join(root, 'console.log')));
  assert.ok(existsSync(join(root, 'report.xml')));
  assert.ok(r.lines.includes('FAIL scenario 3.3s: Assertion is false: id: home is visible'));
});

test('flow: sweep redacts text and deletes binary hits', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, binaryLeak: true } } });
  const r = await flow(L, ['--account', '2']);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  const sweep = r.lines.filter((l) => l.startsWith('sweep: ')).sort();
  const caseDir = join('out', '2026-11-07_120000', 'scenario');
  assert.deepEqual(sweep, [
    `sweep: deleted ${join(caseDir, 'blob.bin')}`,
    `sweep: deleted ${join(caseDir, 'commands-(scenario).json')}`,
    `sweep: redacted ${join('debug', '.maestro', 'tests', '2026-11-07_120000', 'maestro.log')}`,
    `sweep: redacted ${join(caseDir, 'maestro.log')}`,
  ]);
  assert.equal(readFileSync(join(root, caseDir, 'maestro.log'), 'utf8'), 'INFO Input text [redacted]\nINFO Input text [redacted]\n');
  assert.deepEqual(filesBelow(root).filter((f) => /commands.*\.json$|blob\.bin$/.test(f)), []);
  assert.deepEqual(qa.scanPaths(root, CREDS), []);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
});

test('flow: sweep redacts an XML-escaped password in the report', async () => {
  const L = layout({ fixture: 'foreign', state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, failMessage: 'typed $PW' } } });
  const r = await flow(L);
  assert.equal(r.status, 1);
  const report = readFileSync(join(valueAfter(r, 'root kept: '), 'report.xml'), 'utf8');
  assert.match(report, /<failure>typed \[redacted\]<\/failure>/);
  assert.deepEqual(leaks(report), []);
  assert.ok(r.lines.includes('sweep: redacted report.xml'), r.stdout);
});

test('flow: sweep keeps a file with a username inside a longer word', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, wordLog: WORDS } } });
  const creds = shortUserCredentials(L.root);
  const r = await flow(L, ['--credentials', creds]);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  const caseDir = join('out', '2026-11-07_120000', 'scenario');
  assert.equal(r.lines.some((l) => l.startsWith('sweep: ') && l.endsWith('notes.log')), false);
  assert.equal(readFileSync(join(root, caseDir, 'notes.log'), 'utf8'), WORDS);
  assert.equal(readFileSync(join(root, caseDir, 'maestro.log'), 'utf8'), 'INFO Input text [redacted]\nINFO Input text [redacted]\n');
});

test('flow: sweep redacts a JSON-escaped password left in a kept file', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, escapedOnly: true } } });
  const r = await flow(L, ['--account', '2']);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  const state = readFileSync(join(root, 'out', '2026-11-07_120000', 'scenario', 'state.json'), 'utf8');
  assert.equal(state, '{"field":"[redacted]"}');
  for (const f of filesBelow(root)) assert.deepEqual(leaks(readFileSync(f, 'latin1')), [], f);
});

test('flow: sweep redacts a bare token prefix in a kept text file', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, fail: true, wordLog: 'cut at eyJ.\n' } } });
  const r = await flow(L);
  assert.equal(r.status, 1);
  const root = valueAfter(r, 'root kept: ');
  assert.equal(readFileSync(join(root, 'out', '2026-11-07_120000', 'scenario', 'notes.log'), 'utf8'), 'cut at [redacted]\n');
  assert.deepEqual(qa.scanPaths(root, CREDS), []);
});

test('flow: sweep ignores a scan sentinel', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-sweep-'));
  roots.push(root);
  const file = join(root, 'maestro.log');
  writeFileSync(file, `reply ${REPLY_SENTINEL}\n`);
  assert.deepEqual(qa.sweepRoot(root, CREDS, false), []);
  assert.equal(readFileSync(file, 'utf8'), `reply ${REPLY_SENTINEL}\n`);
});

test('flow: interrupt by SIGTERM sweeps and removes the root and releases the lock', async () => {
  const marker = join(tmpdir(), `qa-test-started-${process.pid}`);
  rmSync(marker, { force: true });
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, sleepMs: 20000, startedMarker: marker } } });
  const run = startQa(L, ['flow', 'ios', flowFile(L)]);
  await waitFor(marker);
  rmSync(marker);
  assert.equal(existsSync(lockPath(L)), true);
  run.child.kill('SIGTERM');
  const r = await run.done;
  assert.equal(r.status, 143);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
  assert.equal(existsSync(lockPath(L)), false);
  assert.ok(r.lines.includes('flow: interrupted (SIGTERM); root removed'));
  assert.deepEqual(L.calls('maestro').filter((c) => c.signal), [{ tool: 'maestro', signal: 'SIGTERM' }]);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
});

// ---------- flow: named screenshots ----------

test('flow: screenshot a named screenshot is copied to --out and the root removed after a pass', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(readdirSync(out), ['home.png']);
  assert.deepEqual(readFileSync(join(out, 'home.png')), PNG);
  assert.ok(r.lines.includes(`screenshot: ${join(out, 'home.png')}`));
  assert.equal(r.lines.at(-1), 'PASS scenario 3.3s');
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
});

const caseShot = (dir, file) => join('out', '2026-11-07_120000', dir, 'takeScreenshot', file);

test('flow: screenshot the flow and its subflow both naming home copy neither and fail the run', async () => {
  const L = layout({
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { dir: 'signin', file: 'home.png', data: 'b' }, { file: 'menu.png' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  assert.ok(r.lines.includes(`flow: screenshot home.png taken 2 times (${caseShot('scenario', 'home.png')}, ${caseShot('signin', 'home.png')})`), r.stdout);
  assert.ok(r.lines.includes(`screenshot: ${join(out, 'menu.png')}`));
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
});

test('flow: screenshot a clash stays a clash when the sweep removed one of the images', async () => {
  const L = layout({
    fixture: 'foreign',
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { dir: 'signin', file: 'home.png', data: 'pw' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), []);
  assert.ok(r.lines.some((l) => l.startsWith('flow: screenshot home.png taken 2 times (')), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assertNoForeignLeak(L, r, out);
});

test('flow: screenshot a named screenshot the sweep removes fails the run', async () => {
  const L = layout({ fixture: 'foreign', state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png', data: 'pw' }, { file: 'menu.png' }] } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  assert.ok(r.lines.includes('flow: screenshot home.png removed by the sweep'), r.stdout);
  assert.ok(r.lines.includes(`sweep: deleted ${caseShot('scenario', 'home.png')}`), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
  assertNoForeignLeak(L, r, out);
});

test('flow: screenshot a copy failing with EACCES prints its code', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true } } });
  const out = join(L.root, 'evidence');
  L.maestro({ chmodOut: out });
  try {
    const r = await flow(L, ['--out', out]);
    assert.equal(r.status, 1, r.stdout);
    assert.ok(r.lines.includes('flow: screenshot home.png not copied: EACCES'), r.stdout);
    assert.equal(r.lines.some((l) => l.startsWith('PASS') || l.includes('exists')), false);
  } finally {
    if (existsSync(out)) chmodSync(out, 0o755);
  }
});

// ---------- lock ----------

test('lock: a live holder is refused with its pid and name', async () => {
  const L = layout();
  mkdirSync(lockPath(L), { recursive: true });
  writeFileSync(join(lockPath(L), 'pid'), `${process.pid}\n`);
  writeFileSync(join(lockPath(L), 'name'), 'weaver\n');
  const r = await flow(L);
  assert.equal(r.status, 2);
  assert.equal(r.lines.at(-1), `flow: another flow run holds the lock (pid ${process.pid}, weaver); wait for it to finish`);
  assert.equal(maestroRuns(L).length, 0);
  assert.equal(readFileSync(join(lockPath(L), 'pid'), 'utf8'), `${process.pid}\n`);
});

test('lock: the holder writes its decimal pid alone into pid and its configuration name into name', async () => {
  const L = layout({ fixture: 'foreign' });
  const r = await flow(L);
  assert.equal(r.status, 0, r.stdout);
  const [run] = maestroRuns(L);
  assert.match(run.lock, /^\d+\n$/);
  assert.equal(run.lockName, 'foreign\n');
  assert.equal(statSync(qaDir(L)).mode & 0o777, 0o700);
  assert.equal(existsSync(lockPath(L)), false);
});

test('lock: a run from another repository holds it and refuses this one naming its pid and name', async () => {
  const marker = join(tmpdir(), `qa-test-cross-${process.pid}`);
  rmSync(marker, { force: true });
  const L = layout();
  const other = L.repoAt('other', 'foreign');
  L.maestro({ sleepMs: 1500, startedMarker: marker });
  const holder = startQa(L, ['flow', 'ios', flowFile(L, 'long')], { cwd: other });
  await waitFor(marker);
  rmSync(marker);
  L.maestro({ sleepMs: 0, startedMarker: null });
  const r = await flow(L);
  assert.equal(r.status, 2);
  const first = await holder.done;
  assert.equal(first.status, 0, first.stdout);
  assert.equal(r.lines.at(-1), `flow: another flow run holds the lock (pid ${first.pid}, foreign); wait for it to finish`);
  assert.equal(maestroRuns(L).length, 1);
});

test('lock: a lock written as maestro-onboarding.sh writes it refuses as live, then is taken once its holder removed it', async () => {
  const L = layout();
  const script = join(L.root, 'holder.sh');
  writeFileSync(
    script,
    [
      'lock_dir="${TMPDIR%/}/app-qa/flow.lock"',
      'lock_held=0',
      'cleanup() { if [ "$lock_held" = 1 ] && [ "$(cat "$lock_dir/pid" 2>/dev/null)" = "$$" ]; then rm -rf "$lock_dir"; fi; }',
      'trap cleanup EXIT',
      "trap 'exit 143' TERM",
      '(umask 077 && mkdir -p "${lock_dir%/*}")',
      'mkdir "$lock_dir" || exit 2',
      'lock_held=1',
      `printf '%s\\n' "$$" > "$lock_dir/pid"`,
      'echo held',
      'sleep 30 >/dev/null 2>&1 & wait',
    ].join('\n'),
  );
  const holder = spawn('/bin/bash', [script], { env: { ...L.env, PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok) => holder.stdout.once('data', ok));
  const refused = await flow(L);
  assert.equal(refused.status, 2);
  assert.equal(refused.lines.at(-1), `flow: another flow run holds the lock (pid ${holder.pid}); wait for it to finish`);
  assert.equal(maestroRuns(L).length, 0);
  holder.kill('SIGTERM');
  await new Promise((ok) => holder.on('exit', ok));
  assert.equal(existsSync(lockPath(L)), false);
  const taken = await flow(L);
  assert.equal(taken.status, 0, taken.stdout);
  assert.equal(maestroRuns(L).length, 1);
  assert.equal(existsSync(lockPath(L)), false);
});

test('lock: a dead holder lock and an ownerless lock are refused as stale and left in place', async () => {
  const L = layout();
  const lock = lockPath(L);
  mkdirSync(lock, { recursive: true });
  const dead = spawnSync(NODE, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout;
  writeFileSync(join(lock, 'pid'), `${dead}\n`);
  const stale = await flow(L);
  assert.equal(stale.status, 2);
  assert.equal(stale.lines.at(-1), `flow: stale lock ${lock} (pid ${dead} is not running); remove it by hand: rm -r '${lock}'`);
  assert.equal(readFileSync(join(lock, 'pid'), 'utf8'), `${dead}\n`);
  rmSync(join(lock, 'pid'));
  const ownerless = await flow(L);
  assert.equal(ownerless.status, 2);
  assert.equal(ownerless.lines.at(-1), `flow: stale lock ${lock} (it names no pid); remove it by hand: rm -r '${lock}'`);
  assert.equal(existsSync(lock), true);
  assert.equal(maestroRuns(L).length, 0);
});

test('lock: simultaneous starts launch one driver', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, sleepMs: 1500 } } });
  const f = flowFile(L);
  const runs = [0, 1].map(() => startQa(L, ['flow', 'ios', f]));
  const results = await Promise.all(runs.map((r) => r.done));
  assert.deepEqual(results.map((r) => r.status).sort(), [0, 2]);
  const winner = results.find((r) => r.status === 0);
  const loser = results.find((r) => r.status === 2);
  assert.equal(loser.lines.at(-1), `flow: another flow run holds the lock (pid ${winner.pid}, onara); wait for it to finish`);
  const launched = maestroRuns(L);
  assert.equal(launched.length, 1);
  assert.equal(launched[0].lock, `${winner.pid}\n`);
  assert.equal(existsSync(lockPath(L)), false);
});

test('lock: an unlocked maestro test process is refused', async () => {
  const L = layout();
  L.set({ ps: [...DEFAULT_STATE.ps, '4242 /usr/bin/java -classpath /x/lib/* maestro.cli.AppKt test /x/flow.yaml'] });
  const r = await flow(L);
  assert.equal(r.status, 2);
  assert.equal(r.lines.at(-1), 'flow: a Maestro test run without the lock is running (pid 4242); wait for it or stop it');
  assert.equal(maestroRuns(L).length, 0);
  assert.equal(existsSync(lockPath(L)), false);
});

// ---------- scan ----------

test('scan: a password with a quote and a backslash is found inside a JSON file', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.json'), JSON.stringify({ field: 'nothing here' }));
  writeFileSync(join(folder, 'record.json'), JSON.stringify({ field: PW2 }));
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'record.json')]);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
});

test('scan: a token without a credential is a hit', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'chat: sent\n');
  writeFileSync(join(folder, 'token.log'), `access ${TOKEN}\n`);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'token.log')]);
  assert.doesNotMatch(r.stdout + r.stderr, /eyJ/);
});

test('scan: a file with the account 2 password is a hit and the value is never printed', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(join(folder, 'nested'), { recursive: true });
  writeFileSync(join(folder, 'clean.log'), 'chat: sent\n');
  writeFileSync(join(folder, 'nested', 'leak.log'), `password was ${PW2}\n`);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'nested', 'leak.log')]);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  assert.equal(r.stderr, `credentials: ${join(L.repo, '.dev-credentials.env')}\n`);
});

test('scan: a clean folder exits 0, an unreadable path or credentials file exits 2', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'chat: sent\n');
  assert.equal((await runQa(L, ['scan', folder])).status, 0);
  assert.equal((await runQa(L, ['scan', join(L.root, 'missing')])).status, 2);
  assert.equal((await runQa(L, ['scan', folder, '--credentials', join(L.root, 'missing.env')])).status, 2);
  const empty = join(L.root, 'empty.env');
  writeFileSync(empty, 'OTHER=x\n');
  const none = await runQa(L, ['scan', folder, '--credentials', empty]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /no configured credential value/);
});

test('scan: an XML-escaped password is a hit', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'chat: sent\n');
  writeFileSync(join(folder, 'named.xml'), `<failure>${PW2.replace('"', '&quot;')}</failure>\n`);
  writeFileSync(join(folder, 'numeric.xml'), `<failure>${PW2.replace('"', '&#x22;')}</failure>\n`);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'named.xml'), join(folder, 'numeric.xml')]);
});

test('scan: the bare token prefix in a text file is a hit, three chance bytes in a binary file are not', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'prefix.log'), 'cut at eyJ\n');
  writeFileSync(join(folder, 'chance.png'), Buffer.concat([PNG, Buffer.from('eyJ'), Buffer.from([0, 7])]));
  writeFileSync(join(folder, 'token.png'), Buffer.concat([PNG, Buffer.from(TOKEN), Buffer.from([0, 7])]));
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'prefix.log'), join(folder, 'token.png')]);
});

test('scan: a configured sentinel without a credential is a hit', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'chat: sent\n');
  writeFileSync(join(folder, 'logcat.txt'), `I chat: reply ${REPLY_SENTINEL} streamed\n`);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'logcat.txt')]);
  assert.doesNotMatch(r.stdout + r.stderr, /SENTINEL/);
});

// A synthetic three-letter username that occurs inside ordinary words, as a real short one does.
const SHORT_USER = 'ram';
const WORDS = 'program frame grammar ramp\n';
const standsAlone = (text) => /(^|[^A-Za-z0-9])ram($|[^A-Za-z0-9])/.test(text);

function shortUserCredentials(dir) {
  const file = join(dir, 'short.env');
  writeFileSync(file, `DEV_TEST_USERNAME=${SHORT_USER}\nDEV_TEST_PASSWORD=${PW1}\n`);
  return file;
}

test('scan: a username inside a longer word is not a hit', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'words.log'), WORDS);
  const r = await runQa(L, ['scan', folder, '--credentials', shortUserCredentials(L.root)]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(r.lines, []);
});

test('scan: a username between a slash and a space is a hit', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'words.log'), WORDS);
  writeFileSync(join(folder, 'home.log'), `cwd /Users/${SHORT_USER} ok\n`);
  const r = await runQa(L, ['scan', folder, '--credentials', shortUserCredentials(L.root)]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, 'home.log')]);
  assert.equal(standsAlone(r.stdout + r.stderr), false);
});

test('scan: redaction keeps a username inside a longer word', () => {
  const out = qa.redact(`program by ${SHORT_USER}, "${SHORT_USER}" and ${SHORT_USER}1`, { users: [SHORT_USER], passwords: [] });
  assert.equal(out, `program by [redacted], "[redacted]" and ${SHORT_USER}1`);
});

test('scan: the foreign accounts and sentinel are hits, a value no account names is not', async () => {
  const L = layout({ fixture: 'foreign', fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  const files = {
    'alpha-user.log': `login ${ALPHA_USER}\n`,
    'alpha-pw.log': `secret ${ALPHA_PW}\n`,
    'beta-user.log': `login ${BETA_USER}\n`,
    'beta-pw.json': JSON.stringify({ secret: BETA_PW }),
    'canary.log': `reply ${CANARY}\n`,
    'onara-value.log': `typed ${PW1}\n`,
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(folder, name), content);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, ['alpha-pw.log', 'alpha-user.log', 'beta-pw.json', 'beta-user.log', 'canary.log'].map((n) => join(folder, n)));
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  assert.doesNotMatch(r.stdout + r.stderr, /CANARY/);
});

test('scan: without a credentials section only tokens and sentinels are hits', async () => {
  const L = layout({ fixture: 'minimal', fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), `typed ${PW1}\n`);
  writeFileSync(join(folder, 'token.log'), `access ${TOKEN}\n`);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1, r.stderr);
  assert.deepEqual(r.lines, [join(folder, 'token.log')]);
  assert.equal(r.stderr, '');
  const flagged = await runQa(L, ['scan', folder, '--credentials', join(L.root, 'any.env')]);
  assert.equal(flagged.status, 2);
  assert.match(flagged.stderr, /--credentials needs a credentials section/);
});

// ---------- CLI ----------

test('config: usage lines name the deployed driver', async () => {
  const L = layout({ fakes: [] });
  const r = await runQa(L, ['nonsense']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage: node ~\/\.omp\/agent\/skills\/app-qa-drivers\/scripts\/qa\.mjs /);
});
