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
  cpSync,
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
import { dirname, join, relative } from 'node:path';
import { after, afterEach, test } from 'node:test';
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

/** Pids of live processes whose command line names one of the test roots (the fakes run from `ROOT/bin`, `ROOT/guest/bin`). */
function processesIn(rootList) {
  if (!rootList.length) return [];
  const r = spawnSync('ps', ['-Ao', 'pid=,args='], { encoding: 'utf8' });
  const prefixes = rootList.flatMap((d) => [d, `/private${d}`]);
  const found = [];
  for (const line of r.stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m && Number(m[1]) !== process.pid && prefixes.some((p) => m[2].includes(p))) found.push(Number(m[1]));
  }
  return found;
}

/** Kills what the tests' fakes left running: the detached port forwards, fake JVMs and lume runs outlive the test that started them. */
function reapRoots() {
  for (const pid of processesIn(roots)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

// Every test is over before the next starts; a leftover process of an earlier test would only slow the later ones down.
afterEach(reapRoots);
after(() => {
  // Assert before reaping: reaping first made the assertion unable to fail. Only the per-test reaper above keeps this empty.
  // The server closes before the assertion: a hook that throws skips the later ones, and an open server hangs the run.
  const left = processesIn(roots);
  reapRoots();
  server.closeAllConnections?.();
  server.close();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  assert.deepEqual(left, [], 'processes of the tests are still alive after teardown');
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
  fs.writeFileSync(path.join(caseDir, 'maestro.log'), record);
  fs.writeFileSync(path.join(caseDir, 'screenshots', 'step-001-tapOn.png'), png);
  fs.writeFileSync(path.join(caseDir, 'screen-hierarchy', 'step-001-tapOn.json'), '{"text":"' + user + '"}');
  // A JVM puts its temporary files (the iOS driver's .xctestrun, xcodebuild's derived data) in java.io.tmpdir.
  const jvmTmp = (/(?:^|\\s)"?-Djava\\.io\\.tmpdir=([^"\\s]+)/.exec(process.env.MAESTRO_OPTS ?? '') ?? [])[1] ?? process.env.TMPDIR;
  const derived = path.join(jvmTmp, 'maestro_xctestrunner_xcodebuild_output' + process.pid);
  fs.mkdirSync(derived, { recursive: true });
  fs.writeFileSync(path.join(derived, 'info.plist'), 'derived data\\n' + leak.join('\\n'));
  // Maestro 2.12.1 writes every takeScreenshot of a flow and its subflows to the flow's one takeScreenshot/ folder, so a
  // repeated name overwrites the file; only the command record keeps each one, with its artifact path, step and depth.
  const entries = [];
  const entry = (command, depth, artifacts) =>
    entries.push({ command, metadata: { status: 'COMPLETED', ...(artifacts ? { artifacts } : {}), sequenceNumber: entries.length, depth } });
  const shot = (s, bytes) => {
    if (s.sub) entry({ runFlowCommand: { sourceDescription: s.sub + '.yaml' } }, 0);
    const rel = path.join(s.dir ?? '', 'takeScreenshot', s.file);
    if (!s.noFile) {
      fs.mkdirSync(path.dirname(path.join(caseDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(caseDir, rel), bytes);
    }
    entry({ takeScreenshotCommand: { path: path.basename(s.file, '.png') } }, s.sub ? 1 : 0, [{ type: 'TAKE_SCREENSHOT', path: rel }]);
  };
  if (m.named) shot({ file: 'home.png' }, png);
  const shotData = { pw: Buffer.concat([png, Buffer.from(pw)]), user: Buffer.concat([png, Buffer.from([0]), Buffer.from(user), Buffer.from([0])]), b: pngB };
  for (const s of m.shots ?? []) shot(s, shotData[s.data] ?? png);
  if (leak.length) shot({ file: 'leak.png' }, Buffer.concat([png, Buffer.from([0]), Buffer.from(leak.join(' '))]));
  for (const d of m.dirs ?? []) {
    fs.mkdirSync(path.join(caseDir, d), { recursive: true });
    fs.writeFileSync(path.join(caseDir, d, 'clean.log'), 'nothing to see\\n');
  }
  for (const v of [user, pw, ...leak]) entry({ inputTextCommand: { text: v } }, 0);
  fs.writeFileSync(path.join(caseDir, 'commands-(' + name + ').json'), m.badRecord ? '[{"command":' : JSON.stringify(entries));
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
// The lane's simulators (create, boot, install, openurl, terminate, delete) live in st.sims; st.iosDevices stay the
// booted devices of every other test.
const RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-4';
const sims = st.sims ?? [];
const [, sub, verb] = argv;
const simOf = (udid) => sims.find((d) => d.udid === udid);
if (sub === 'list' && verb === 'runtimes') {
  out(JSON.stringify({ runtimes: st.runtimes ?? [{ identifier: RUNTIME, name: 'iOS 26.4', platform: 'iOS', isAvailable: true }] }));
  process.exit(0);
}
if (sub === 'create') {
  const udid = 'LANE-SIM-' + (st.simSeq = (st.simSeq ?? 0) + 1);
  st.sims = [...sims, { udid, name: argv[2], deviceType: argv[3], runtime: argv[4], state: 'Shutdown', installed: [] }];
  save(); out(udid); process.exit(0);
}
if (sub === 'launch') {
  const udid = argv[2] === '--terminate-running-process' ? argv[3] : argv[2];
  if (st.launchFails || !simOf(udid) || simOf(udid).state !== 'Booted') { process.stderr.write('launch failed\\n'); process.exit(1); }
  process.exit(0);
}
if (['boot', 'delete', 'install', 'openurl', 'terminate'].includes(sub)) {
  const d = simOf(argv[2]);
  if (!d) { process.stderr.write('Invalid device: ' + argv[2] + '\\n'); process.exit(164); }
  if (sub === 'boot') d.state = 'Booted';
  if (sub === 'install') {
    if (d.state !== 'Booted' || !fs.existsSync(argv[3])) process.exit(1);
    d.installed.push(argv[3]);
  }
  if (sub === 'delete') st.sims = sims.filter((x) => x !== d);
  save(); process.exit(0);
}
const booted = st.iosDevices.map((d) => ({ udid: d.udid, name: d.name, state: 'Booted', isAvailable: true }));
const own = sims.filter((d) => !argv.includes('booted') || d.state === 'Booted').map((d) => ({ udid: d.udid, name: d.name, state: d.state, isAvailable: true }));
out(JSON.stringify({ devices: { [RUNTIME]: [...booted, ...own] } }));
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
  // `sysctl -n hw.ncpu vm.loadavg`: st.ncpu (default 8) and the next of st.loads (default 1), the last one repeating.
  sysctl: `
log({ tool: 'sysctl', argv });
const loads = st.loads ?? [1];
const load = loads.length > 1 ? loads.shift() : loads[0];
st.loads = loads;
save();
out((st.ncpu ?? 8) + '\\n{ ' + load.toFixed(2) + ' 1.00 1.00 }');
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

function layout({ fixture = 'onara', config: configOrMake, fakes = ['spectre', 'lsof', 'maestro', 'xcrun', 'adb', 'ioreg', 'ps'], state = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'qa-test-'));
  roots.push(root);
  // A function builds the configuration once the layout's real root is known (vm builds name files below it).
  const config = typeof configOrMake === 'function' ? configOrMake(realpathSync(root)) : configOrMake;
  const repo = makeRepo(join(root, 'repo'), fixture, config);
  // The deployed layout: <skill>/scripts/qa.mjs with the guest scripts in <skill>/scripts/vm/.
  const skillDir = join(root, 'driver');
  const driverDir = join(skillDir, 'scripts');
  mkdirSync(driverDir, { recursive: true });
  copyFileSync(QA_SOURCE, join(driverDir, 'qa.mjs'));
  // The guest scripts beside the driver under test, so a QA_UNDER_TEST copy of the whole folder also swaps vm/; a lone
  // qa.mjs variant gets this folder's vm/.
  const vmSource = [join(dirname(QA_SOURCE), 'vm'), join(HERE, 'vm')].find((d) => existsSync(d));
  if (vmSource) cpSync(vmSource, join(driverDir, 'vm'), { recursive: true });
  const L = {
    root: realpathSync(root),
    repo,
    fixture,
    config: config ?? CONFIGS[fixture],
    qa: join(driverDir, 'qa.mjs'),
    skillDir,
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

/** A flow file inside the worktree (a routed flow must lie in it). */
function repoFlow(L, name = 'scenario') {
  const f = join(L.repo, `${name}.yaml`);
  writeFileSync(f, 'appId: org.example.app\n---\n- assertVisible:\n    id: home\n');
  return f;
}
const flow = (L, extra = [], opts) => runQa(L, ['flow', 'ios', flowFile(L), ...extra], opts);
const maestroRuns = (L) => L.calls('maestro').filter((c) => c.argv?.[0] === 'test');
const qaDir = (L) => join(L.tmp, 'app-qa');
const lockPath = (L) => join(qaDir(L), 'flow.lock');
const sessionPath = (L, worktree) =>
  join(qaDir(L), 'sessions', `${createHash('sha256').update(worktree).digest('hex').slice(0, 16)}.json`);

// ---------- vm lane harness (openspec change app-qa-vm-lane) ----------
// A lane layout adds to a layout: the fake lume (a clone list in a state file) and ssh (runs the joined remote command
// through `sh -c` in a local guest directory) on the host PATH, real tar and cp, a guest directory with its own fake
// tools, driver state and call log, a lane file under the private HOME, and a fake build tool the vm section names.

const FAKE_DIR = join(FIXTURES, 'fakes');
const FAKE_BUILD = join(FIXTURES, 'fake-build.mjs');
const PRELOAD_SLOT = join(HERE, 'qa-test-preload-slotblock.mjs');
const PRELOAD_WRITES = join(HERE, 'qa-test-preload-writes.mjs');
const PRELOAD_LOCKPAUSE = join(HERE, 'qa-test-preload-lockpause.mjs');
const PRELOAD_DHCP = join(HERE, 'qa-test-preload-dhcp.mjs');
const PRELOAD_ORPHAN = join(HERE, 'qa-test-preload-orphanblock.mjs');
const layouts = [];
const procs = [];

after(() => {
  for (const L of layouts) {
    let calls = [];
    try {
      calls = [...L.calls('ssh'), ...L.gcalls('java')];
    } catch {}
    for (const c of calls) {
      if (c.forward || c.tool === 'java') {
        try {
          process.kill(c.pid, 'SIGKILL');
        } catch {}
      }
    }
  }
  for (const pid of procs) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
});

const LAUNCHER_CFG = `[Application]
app.classpath=$APPDIR/onara.jar
app.classpath=$APPDIR/lib/compose.jar
app.mainclass=eu.onara.app.MainKt

[JavaOptions]
java-options=-Dfirst=1
java-options=-Xmx512m
java-options=-Dapp.dir=$APPDIR
`;
const BUILD_ARTIFACTS = {
  ios: { path: 'build/App.app', files: { 'Info.plist': 'ios app v1 port={port}\nbundle=eu.onara.app.test\n', 'bin/app': 'binary-v1' } },
  desktop: { path: 'build/Onara.app', files: { 'Contents/app/Onara.cfg': LAUNCHER_CFG, 'Contents/app/onara.jar': 'jar-v1' } },
};

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const patchJson = (f, patch) => writeFileSync(f, JSON.stringify({ ...readJson(f), ...patch }));

/** A host process the test controls (a fake forward); killed after the suite. */
function background() {
  const child = spawn(NODE, ['-e', 'setInterval(() => {}, 1 << 30)'], { detached: true, stdio: 'ignore' });
  child.unref();
  procs.push(child.pid);
  return child.pid;
}

const LANE_DEFAULTS = { schema: 'app-qa-vm/1', image: 'app-qa-golden', user: 'lume', slots: 2, idleMinutes: 30, ios: { deviceType: 'iPhone 17 Pro' } };

function laneLayout({ backend = true, lane = {}, noLane = false, extraFakes = [] } = {}) {
  const make = (root) => {
    const control = join(root, 'build-control.json');
    const port = backend ? ['{port}'] : [];
    const base = backend ? CONFIGS.onara : (({ backend: _b, ...rest }) => rest)(CONFIGS.onara);
    return v2(base, {
      ios: { artifact: 'build/App.app', build: { argv: [NODE, FAKE_BUILD, control, 'ios', ...port], cwd: '.' } },
      desktop: {
        artifact: 'build/Onara.app',
        build: { argv: [NODE, FAKE_BUILD, control, 'desktop', ...port], cwd: 'app' },
        systemProperties: { 'onara.devCredentialsFile': '{credentials}' },
      },
    });
  };
  const L = layout({ config: make });
  layouts.push(L);
  writeFileSync(join(L.repo, '.gitignore'), '.worktrees/\nbuild/\n.dev-credentials.env\n');
  git(L.repo, 'add', '.gitignore');
  git(L.repo, 'commit', '-qm', 'ignore build output');
  // host
  L.control = join(L.root, 'build-control.json');
  writeFileSync(L.control, JSON.stringify({ print: {}, artifacts: BUILD_ARTIFACTS }));
  L.setControl = (patch) => patchJson(L.control, patch);
  L.builds = () => (existsSync(`${L.control}.runs`) ? readFileSync(`${L.control}.runs`, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
  L.holds = join(L.root, 'holds');
  mkdirSync(L.holds);
  L.lumeFile = join(L.root, 'lume-state.json');
  writeFileSync(L.lumeFile, JSON.stringify({ version: '0.7.2', vms: [{ name: 'app-qa-golden', status: 'stopped', ipAddress: null }], hold: {} }));
  L.lume = () => readJson(L.lumeFile);
  L.setLume = (patch) => patchJson(L.lumeFile, patch);
  L.clones = () => L.lume().vms.map((v) => v.name).filter((n) => n.startsWith('app-qa-slot-'));
  L.addVm = (name, status = 'running') => {
    const s = L.lume();
    s.vms.push({ name, status, ipAddress: status === 'running' ? `192.168.64.${20 + s.vms.length}` : null });
    writeFileSync(L.lumeFile, JSON.stringify(s));
  };
  L.setVmStatus = (name, status) => {
    const s = L.lume();
    const vm = s.vms.find((v) => v.name === name);
    vm.status = status;
    vm.ipAddress = status === 'running' ? '192.168.64.30' : null;
    writeFileSync(L.lumeFile, JSON.stringify(s));
  };
  L.hold = (name, target = true) => patchJson(L.lumeFile, { hold: { ...L.lume().hold, [name]: target } });
  L.held = (name) => join(L.holds, `${name}.held`);
  L.release = (name) => writeFileSync(join(L.holds, `${name}.release`), '');
  // guest
  const g = join(L.root, 'guest');
  L.guest = { dir: g, home: join(g, 'home'), tmp: join(g, 'tmp'), bin: join(g, 'bin'), jdk: join(g, 'jdk21'), stateFile: join(g, 'state.json'), callFile: join(g, 'calls.jsonl') };
  for (const d of [L.guest.home, L.guest.tmp, L.guest.bin, join(L.guest.jdk, 'bin')]) mkdirSync(d, { recursive: true });
  L.guestCopy = join(L.guest.home, 'work', 'onara');
  L.guestDriver = join(L.guest.home, '.omp', 'agent', 'skills', 'app-qa-drivers', 'scripts');
  writeFileSync(L.guest.stateFile, JSON.stringify({ ...structuredClone(DEFAULT_STATE), jvms: [], iosDevices: [] }));
  writeFileSync(L.guest.callFile, '');
  L.gstate = () => readJson(L.guest.stateFile);
  L.gset = (patch) => patchJson(L.guest.stateFile, patch);
  L.gcalls = (tool) => (existsSync(L.guest.callFile) ? readFileSync(L.guest.callFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []).filter((c) => !tool || c.tool === tool);
  L.guestEnv = {
    PATH: `${L.guest.bin}:/usr/bin:/bin`,
    HOME: L.guest.home,
    TMPDIR: L.guest.tmp,
    FAKE_STATE: L.guest.stateFile,
    FAKE_CALLS: L.guest.callFile,
    FAKE_FIXTURES: FIXTURES,
    FAKE_JAVA_HOME: L.guest.jdk,
    QA_TARGET_WARM_MS: '0',
    QA_TARGET_SETTLE_POLL_MS: '0',
  };
  const fakeFile = (name, file, dir) => {
    writeFileSync(join(dir, name), `#!${NODE}\n${readFileSync(join(FAKE_DIR, file), 'utf8')}`);
    chmodSync(join(dir, name), 0o755);
  };
  for (const f of ['spectre', 'lsof', 'maestro', 'xcrun', 'ioreg', 'ps', 'sysctl']) L.fake(f, L.guest.bin);
  for (const [n, f] of [['nc', 'nc.cjs'], ['sudo', 'sudo.cjs'], ['launchctl', 'launchctl.cjs'], ['java_home', 'java_home.cjs'], ['plutil', 'plutil.cjs']]) fakeFile(n, f, L.guest.bin);
  fakeFile('java', 'java.cjs', join(L.guest.jdk, 'bin'));
  symlinkSync(GIT, join(L.guest.bin, 'git'));
  symlinkSync(NODE, join(L.guest.bin, 'node'));
  L.setLume({ guestWipe: [L.guest.home, L.guest.tmp] });
  L.sshFile = join(L.root, 'ssh-state.json');
  writeFileSync(L.sshFile, JSON.stringify({ guestDir: L.guest.home, env: L.guestEnv }));
  L.setSsh = (patch) => patchJson(L.sshFile, patch);
  fakeFile('lume', 'lume.cjs', L.bin);
  fakeFile('ssh', 'ssh.cjs', L.bin);
  fakeFile('tar', 'tar.cjs', L.bin);
  fakeFile('tar', 'tar.cjs', L.guest.bin);
  symlinkSync('/bin/cp', join(L.bin, 'cp'));
  Object.assign(L.env, { FAKE_LUME_STATE: L.lumeFile, FAKE_SSH_STATE: L.sshFile, FAKE_HOLD_DIR: L.holds, FAKE_VM_DIR: join(L.tmp, 'app-qa', 'vm') });
  // lane file
  L.laneFile = join(L.home, '.omp', 'agent', 'app-qa-vm.json');
  L.sshKey = join(L.root, 'id_test');
  writeFileSync(L.sshKey, 'test key\n');
  L.writeLane = (patch = {}, raw) => {
    mkdirSync(dirname(L.laneFile), { recursive: true });
    writeFileSync(L.laneFile, raw ?? JSON.stringify({ ...LANE_DEFAULTS, sshKey: L.sshKey, ...lane, ...patch }, null, 2));
  };
  if (!noLane) L.writeLane();
  // leases
  L.vmDir = join(L.tmp, 'app-qa', 'vm');
  L.slotDir = (n) => join(L.vmDir, `slot-${n}`);
  L.lease = (n) => readJson(join(L.slotDir(n), 'lease.json'));
  L.slots = () => (existsSync(L.vmDir) ? readdirSync(L.vmDir).filter((e) => /^slot-\d+$/.test(e)).sort() : []);
  L.writeLease = (n, lease) => {
    mkdirSync(L.slotDir(n), { recursive: true });
    writeFileSync(join(L.slotDir(n), 'lease.json'), JSON.stringify(lease));
  };
  L.lumeCalls = (verb) => L.calls('lume').filter((c) => !verb || c.argv[0] === verb);
  L.up = (args, opts) => runQa(L, ['vm', 'up', ...args], opts);
  /** A ready lease of `worktree` staged for `targets`, its clone running, a live fake forward, the guest driver faked. */
  L.stage = ({ n = 1, worktree = L.repo, targets = ['ios'], state = 'ready', holder = null, forward = true, lastUsed = Date.now(), port = PORT, fakeDriver = true } = {}) => {
    const clone = `app-qa-slot-${n}`;
    if (!L.lume().vms.some((v) => v.name === clone)) L.addVm(clone);
    const fwd = forward ? { pid: background(), port } : null;
    const lease = { worktree, clone, slot: n, state, holder, targets, inputs: Object.fromEntries(targets.map((t) => [t, { port, argv: [] }])), forward: fwd, lastUsed };
    L.writeLease(n, lease);
    mkdirSync(join(L.guestCopy, '.omp'), { recursive: true });
    copyFileSync(join(L.repo, '.omp', 'app-qa.json'), join(L.guestCopy, '.omp', 'app-qa.json'));
    copyFileSync(join(L.repo, '.dev-credentials.env'), join(L.guestCopy, '.dev-credentials.env'));
    if (!existsSync(join(L.guestCopy, '.git'))) git(L.guestCopy, 'init', '-q');
    if (fakeDriver) L.fakeGuestDriver();
    return lease;
  };
  L.fakeGuestDriver = (cfg) => {
    mkdirSync(L.guestDriver, { recursive: true });
    copyFileSync(QA_SOURCE, join(L.guestDriver, 'qa-real.mjs'));
    cpSync(join(dirname(QA_SOURCE), 'vm'), join(L.guestDriver, 'vm'), { recursive: true });
    copyFileSync(join(FAKE_DIR, 'guest-driver.mjs'), join(L.guestDriver, 'qa.mjs'));
    if (cfg) L.driverCfg(cfg);
  };
  L.driverCfg = (cfg) => writeFileSync(join(L.guest.home, 'fake-driver.json'), JSON.stringify(cfg));
  return L;
}

const writeLaneFile = (L, patch, raw) => L.writeLane(patch, raw);

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
  const L = layout({ config: { ...CONFIGS.minimal, schema: 'app-qa/3' }, fixture: 'minimal' });
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 2);
  assert.deepEqual(r.lines, []);
  const file = join(L.repo, '.omp', 'app-qa.json');
  assert.ok(r.stderr.includes(file), r.stderr);
  assert.match(r.stderr, /app-qa\/3/);
  assert.match(r.stderr, /app-qa\/1/);
  assert.match(r.stderr, /app-qa\/2/);
  assert.match(r.stderr, /redeploy team config/);
  assert.equal(L.calls().length, 0);
});

/** `vm` sections of the app-qa/2 schema (design D8): artifacts and builds per target. */
const VM_SECTION = {
  ios: { artifact: 'build/App.app', build: { argv: ['./gradlew', 'iosApp', '-Pport={port}'], cwd: '.' } },
  desktop: {
    artifact: 'build/Onara.app',
    build: { argv: ['./gradlew', 'createDistributable'], cwd: 'app' },
    systemProperties: { 'onara.devCredentialsFile': '{credentials}' },
  },
};
const v2 = (config, vm) => ({ ...config, schema: 'app-qa/2', vm });

/** Invalid `vm` sections (and their placement), each with the cause the refusal must name. */
const BROKEN_VM = [
  ['vm under app-qa/1', () => ({ ...CONFIGS.onara, vm: VM_SECTION }), /vm: unknown key/],
  ['an empty vm section', () => v2(CONFIGS.onara, {}), /vm: expected at least one of ios, desktop/],
  ['an unknown vm target', () => v2(CONFIGS.onara, { ...VM_SECTION, android: VM_SECTION.ios }), /vm\.android: unknown key/],
  ['an absolute artifact path', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, artifact: '/tmp/App.app' } }), /vm\.ios\.artifact: .*relative/],
  ['a .. in the artifact path', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, artifact: '../App.app' } }), /vm\.ios\.artifact: .*\.\./],
  ['a build without argv', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, build: { cwd: '.' } } }), /vm\.ios\.build\.argv: missing/],
  ['an empty argv element', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, build: { argv: ['make', ''], cwd: '.' } } }), /vm\.ios\.build\.argv: expected a list of non-empty strings/],
  ['an absolute build cwd', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, build: { argv: ['make'], cwd: '/tmp' } } }), /vm\.ios\.build\.cwd: .*relative/],
  ['an empty system property value', () => v2(CONFIGS.onara, { desktop: { ...VM_SECTION.desktop, systemProperties: { a: '' } } }), /vm\.desktop\.systemProperties\.a: expected a non-empty string/],
  ['systemProperties on ios', () => v2(CONFIGS.onara, { ios: { ...VM_SECTION.ios, systemProperties: { a: 'b' } } }), /vm\.ios\.systemProperties: unknown key/],
  ['{port} without a backend section', () => {
    const { backend, ...noBackend } = CONFIGS.onara;
    return v2(noBackend, { ios: VM_SECTION.ios });
  }, /vm\.ios\.build\.argv\.2: \{port\} needs a backend section/],
];

test('config: app-qa/2 refuses an invalid vm section with exit 2 naming the file and the cause', async () => {
  const L = layout();
  const file = join(L.repo, '.omp', 'app-qa.json');
  for (const [label, make, cause] of BROKEN_VM) {
    writeConfig(L.repo, make());
    const r = await runQa(L, ['preflight', 'desktop']);
    assert.equal(r.status, 2, label);
    assert.deepEqual(r.lines, [], label);
    assert.ok(r.stderr.includes(file), `${label}: ${r.stderr}`);
    assert.match(r.stderr, cause, label);
  }
  assert.equal(L.calls().length, 0);
});

test('config: a valid app-qa/2 configuration is accepted with and without a backend', async () => {
  const withBackend = layout({ config: v2(CONFIGS.onara, VM_SECTION) });
  const a = await runQa(withBackend, ['preflight', 'desktop']);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  assert.equal(a.lines.length, 4);
  const { backend, ...noBackend } = CONFIGS.onara;
  const noPort = { ios: { ...VM_SECTION.ios, build: { argv: ['./gradlew', 'iosApp'], cwd: '.' } }, desktop: VM_SECTION.desktop };
  const without = layout({ config: v2(noBackend, noPort) });
  const b = await runQa(without, ['preflight', 'desktop']);
  assert.equal(b.status, 0, b.stdout + b.stderr);
  assert.equal(b.lines.length, 3);
});

// ---------- lane: the machine lane file and the lane's activation ----------

test('lane: with no lane file preflight runs on the host and vm up exits 2 naming the file', async () => {
  const L = laneLayout({ noLane: true });
  const host = await runQa(L, ['preflight', 'desktop']);
  assert.equal(host.status, 0, host.stdout + host.stderr);
  assert.equal(host.lines.length, 4);
  const up = await L.up(['ios']);
  assert.equal(up.status, 2);
  assert.ok(up.stderr.includes(L.laneFile), up.stderr);
  assert.match(up.stderr, /missing/);
  assert.equal(L.calls('lume').length + L.calls('ssh').length, 0);
  assert.equal(L.builds().length, 0);
});

test('lane: without a vm section every command runs on the host', async () => {
  const L = laneLayout();
  writeConfig(L.repo, CONFIGS.onara);
  const r = await runQa(L, ['preflight', 'desktop']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.lines.length, 4);
  assert.equal(L.calls('lume').length + L.calls('ssh').length, 0);
  const up = await L.up(['ios']);
  assert.equal(up.status, 2);
  assert.match(up.stderr, /vm: .*no vm section|no vm section/);
});

/** Invalid lane files, each with the cause its refusal must name. */
const BROKEN_LANES = [
  ['a misspelled key', (L) => ({ ...LANE_DEFAULTS, sshkey: L.sshKey }), /sshkey: unknown key/],
  ['a missing image', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, image: undefined }), /image: missing/],
  ['slots 3', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, slots: 3 }), /slots: expected 1 or 2/],
  ['another schema id', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, schema: 'app-qa-vm/2' }), /schema "?app-qa-vm\/2"?.*app-qa-vm\/1/],
  ['an image named like a slot clone', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, image: 'app-qa-slot-golden' }), /image: .*app-qa-slot-/],
  ['a relative ssh key', () => ({ ...LANE_DEFAULTS, sshKey: 'id_test' }), /sshKey: expected an absolute path/],
  ['idleMinutes 0', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, idleMinutes: 0 }), /idleMinutes: expected a positive integer/],
  ['a missing ios section', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, ios: undefined }), /ios: missing/],
  ['an empty device type', (L) => ({ ...LANE_DEFAULTS, sshKey: L.sshKey, ios: { deviceType: '' } }), /ios\.deviceType: expected a non-empty string/],
];

test('lane: an invalid lane file exits 2 naming the file and the cause before any host check or lume call', async () => {
  const L = laneLayout();
  const invalid = [...BROKEN_LANES.map(([label, make, cause]) => [label, JSON.stringify(make(L)), cause]), ['not JSON', '{ "schema": ', /not valid JSON/]];
  const evidence = join(L.root, 'evidence');
  mkdirSync(evidence);
  for (const [label, text, cause] of invalid) {
    writeFileSync(L.laneFile, text);
    for (const args of [['preflight', 'desktop'], ['preflight', 'ios'], ['desktop', 'attach'], ['flow', 'ios', flowFile(L)], ['vm', 'status'], ['vm', 'up', 'ios'], ['vm', 'down']]) {
      const r = await runQa(L, args);
      assert.equal(r.status, 2, `${label}: ${args.join(' ')}`);
      assert.deepEqual(r.lines, [], label);
      assert.ok(r.stderr.includes(L.laneFile), `${label}: ${r.stderr}`);
      assert.match(r.stderr, cause, label);
    }
    // Android and scan never use the lane, and --host runs the host command as before.
    assert.equal((await runQa(L, ['scan', evidence])).status, 0, label);
    const host = await runQa(L, ['preflight', 'desktop', '--host']);
    assert.equal(host.status, 0, `${label}: ${host.stdout}${host.stderr}`);
  }
  assert.equal(L.calls('lume').length + L.calls('ssh').length, 0);
  assert.equal(L.calls('maestro').length + L.calls('xcrun').length, 0);
});

test('lane: the lane file path is fixed under HOME and the file may not be an environment override', async () => {
  const L = laneLayout({ noLane: true });
  const elsewhere = join(L.root, 'elsewhere.json');
  writeFileSync(elsewhere, JSON.stringify({ ...LANE_DEFAULTS, sshKey: L.sshKey }));
  const r = await L.up(['ios'], { env: { APP_QA_VM_FILE: elsewhere, APP_QA_VM: elsewhere } });
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes(L.laneFile), r.stderr);
});

// ---------- lease: slots, leases, admission, sweep and teardown ----------

const outputOf = (r) => r.stdout + r.stderr;
async function waitUntil(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('timed out waiting for a condition');
    await sleep(25);
  }
}
async function deadPid() {
  const child = spawn(NODE, ['-e', '0']);
  await new Promise((ok) => child.on('close', ok));
  return child.pid;
}
const releaseBuilds = (L) => writeFileSync(`${L.control}.release`, '');
const wtOf = (L, name) => L.worktree(L.repo, join(L.root, `wt-${name}`));
/** Every lume run, stop or delete names a slot clone and never the image (spec "The lane touches only its own clones"). */
function assertOwnClonesOnly(L) {
  for (const c of L.lumeCalls()) {
    if (!['run', 'stop', 'delete'].includes(c.argv[0])) continue;
    const name = c.argv.filter((a) => !a.startsWith('--')).at(-1);
    assert.match(name, /^app-qa-slot-[12]$/, `lume ${c.argv.join(' ')}`);
  }
}
const lockOf = (L) => join(L.vmDir, 'table.lock');
/** A table lock held by `pid` (its token `PID-NONCE`), or with `entries` (name -> content) of no holder token. */
const plantLock = (L, pid, entries = {}) => {
  mkdirSync(lockOf(L), { recursive: true });
  if (pid !== null) writeFileSync(join(lockOf(L), `${pid}-0`), '');
  for (const [name, content] of Object.entries(entries)) writeFileSync(join(lockOf(L), name), content);
};

test('lease: lumels - a log line before the JSON of lume ls leaves vm status, a second vm up and a routed command working', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  L.setLume({ lsLogLine: true });
  const status = await runQa(L, ['vm', 'status']);
  assert.equal(status.status, 0, outputOf(status));
  assert.match(status.stdout, /slot 1: ready/);
  const again = await L.up(['ios']);
  assert.equal(again.status, 0, outputOf(again));
  assert.doesNotMatch(outputOf(again), /cannot be read/);
  const routed = await runQa(L, ['preflight', 'ios']);
  assert.doesNotMatch(outputOf(routed), /cannot be read|not running|infrastructure lost/);
  assert.match(routed.lines[0], /^lane: .*app-qa-slot-1/);
  assert.equal(L.lease(1).state, 'ready');
});

test('lease: lsof-probe - lume ls reporting a running clone stopped keeps it ready while its lume run process is alive, and not otherwise', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  assert.match(L.lease(1).ip, /^192\.168\.64\.\d+$/);
  const runs = () => L.calls('lume').filter((c) => c.argv[0] === 'run').length;
  const before = runs();
  L.setLume({ lsStoppedNoIp: true });
  L.set({ ps: [`4242 /usr/local/bin/lume run --detach --display none --vnc disabled ${L.lease(1).clone}`] });
  // Seen on the driver before 9af7721945: the status line below passes (vm status reads the lease, not lume ls), so it is a control;
  // the second vm up (exit 2, ssh never accepted; a second lume run) and the routed command (clone "not running") fail there.
  const status = await runQa(L, ['vm', 'status']);
  assert.equal(status.status, 0, outputOf(status));
  assert.match(status.stdout, /slot 1: ready/);
  const again = await L.up(['ios']);
  assert.equal(again.status, 0, outputOf(again));
  assert.equal(runs(), before, 'a second lume run was started for a clone whose run process is alive');
  const routed = await runQa(L, ['preflight', 'ios']);
  assert.doesNotMatch(outputOf(routed), /not running|infrastructure lost|cannot be read/);
  assert.match(routed.lines[0], /^lane: .*app-qa-slot-1/);
  // without a live run process the stopped clone is not running
  L.set({ ps: [] });
  const dead = await runQa(L, ['preflight', 'ios']);
  assert.equal(dead.status, 2);
  assert.match(outputOf(dead), /app-qa-slot-1 is not running/);
});

test('lease: dhcp - a fresh clone lume ls reports stopped without an address from its first boot is reached at the address of its DHCP lease', async () => {
  const L = laneLayout();
  L.setLume({ lsStoppedNoIp: true, runPs: true });
  L.set({ ps: [] });
  // bootpd's form: octets without leading zeros; another MAC's lease comes first. The first clone's MAC is 0e:00:00:00:00:01.
  const leases = join(L.root, 'dhcpd_leases');
  const entry = (ip, mac) => `{\n\tname=AppleViMachine1\n\tip_address=${ip}\n\thw_address=1,${mac}\n\tidentifier=1,${mac}\n\tlease=0x6939a1b2\n}\n`;
  writeFileSync(leases, entry('192.168.64.40', 'e:0:0:0:0:9') + entry('192.168.64.41', 'e:0:0:0:0:1'));
  const r = await L.up(['ios'], { env: { QA_TEST_DHCP_LEASES: leases }, argv0: (script, args) => [NODE, ['--import', PRELOAD_DHCP, script, ...args]] });
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.lease(1).ip, '192.168.64.41');
  assert.equal(L.calls('lume').filter((c) => c.argv[0] === 'run').length, 1);
});

test('lease: parallel - two worktrees started together get their own slot and neither clone is deleted', async () => {
  const L = laneLayout();
  const wtB = wtOf(L, 'b');
  L.setControl({ hold: true });
  const a = startQa(L, ['vm', 'up', 'ios']);
  const b = startQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  await waitUntil(() => L.builds().length === 2);
  assert.deepEqual(L.slots(), ['slot-1', 'slot-2']);
  const leases = [L.lease(1), L.lease(2)];
  assert.deepEqual(leases.map((l) => l.worktree).sort(), [L.repo, wtB].sort());
  assert.deepEqual(leases.map((l) => l.state), ['starting', 'starting']);
  assert.deepEqual(leases.map((l) => l.holder).sort(), [a.child.pid, b.child.pid].sort());
  assert.deepEqual(leases.map((l) => l.clone).sort(), ['app-qa-slot-1', 'app-qa-slot-2']);
  assert.equal(L.lumeCalls('delete').length, 0);
  releaseBuilds(L);
  await Promise.all([a.done, b.done]);
  assert.equal(L.lumeCalls('delete').length, 0);
  assert.equal(L.lumeCalls('clone').length, 2);
});

test('lease: same-worktree - two vm up started together give one slot, one build and one exit 2 naming the owner', async () => {
  const L = laneLayout();
  L.setControl({ hold: true });
  const a = startQa(L, ['vm', 'up', 'ios']);
  const b = startQa(L, ['vm', 'up', 'ios']);
  const [loser, winner] = await Promise.race([a.done.then((r) => [r, b]), b.done.then((r) => [r, a])]);
  assert.equal(loser.status, 2, outputOf(loser));
  assert.ok(outputOf(loser).includes(String(winner.child.pid)), outputOf(loser));
  assert.deepEqual(L.slots(), ['slot-1']);
  await waitUntil(() => L.builds().length === 1);
  releaseBuilds(L);
  await winner.done;
  assert.equal(L.builds().length, 1);
});

test('lease: refuse - a third worktree is refused naming each holder, with no build and no lume clone', async () => {
  const L = laneLayout();
  const [wtB, wtC] = [wtOf(L, 'b'), wtOf(L, 'c')];
  L.setControl({ hold: true });
  const a = startQa(L, ['vm', 'up', 'ios']);
  const b = startQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  await waitUntil(() => L.builds().length === 2);
  const c = await runQa(L, ['vm', 'up', 'ios'], { cwd: wtC });
  assert.equal(c.status, 2, outputOf(c));
  for (const wt of [L.repo, wtB]) assert.ok(outputOf(c).includes(wt), outputOf(c));
  assert.match(outputOf(c), /last used/);
  assert.equal(L.builds().length, 2);
  assert.equal(L.lumeCalls('clone').length, 0);
  assert.equal(L.lumeCalls('delete').length, 0);
  assert.deepEqual(L.slots(), ['slot-1', 'slot-2']);
  releaseBuilds(L);
  await Promise.all([a.done, b.done]);
});

test('lease: simultaneous - two worktrees started together for one free slot give one holder, one build and one clone', async () => {
  const L = laneLayout({ lane: { slots: 1 } });
  const wtB = wtOf(L, 'b');
  L.setControl({ hold: true });
  const a = startQa(L, ['vm', 'up', 'ios']);
  const b = startQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  const [loser, winner] = await Promise.race([a.done.then((r) => [r, b]), b.done.then((r) => [r, a])]);
  assert.equal(loser.status, 2, outputOf(loser));
  assert.ok(outputOf(loser).includes(String(winner.child.pid)), outputOf(loser));
  assert.deepEqual(L.slots(), ['slot-1']);
  releaseBuilds(L);
  await winner.done;
  assert.equal(L.builds().length, 1);
  assert.equal(L.lumeCalls('clone').length, 1);
});

test('lease: stale-lock - a table lock left by a dead pid is taken over by the next vm status', async () => {
  const L = laneLayout();
  const pid = await deadPid();
  plantLock(L, pid);
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(r.stdout, new RegExp(`took over.*table lock.*${pid}`));
  assert.equal(existsSync(lockOf(L)), false);
  const again = await runQa(L, ['vm', 'status']);
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stdout, /took over/);
});

test('lease: stale-lock - an empty table lock and one of an earlier layout without a token do not block the next vm status', async () => {
  for (const entries of [{}, { pid: `${await deadPid()}\n` }]) {
    const L = laneLayout();
    plantLock(L, null, entries);
    const r = await runQa(L, ['vm', 'status']);
    assert.equal(r.status, 0, outputOf(r));
    assert.equal(existsSync(lockOf(L)), false, JSON.stringify(entries));
  }
});

test('lease: takeover - a contender that read a dead holder before a successor took the lock never moves or deletes the successor\'s lock', async () => {
  const L = laneLayout();
  const pause = join(L.root, 'pause');
  mkdirSync(pause);
  L.hold('ls');
  // D takes the lock and dies inside it (its sweep holds in lume ls).
  const d = startQa(L, ['vm', 'status']);
  await waitFor(L.held('ls'));
  assert.ok(existsSync(lockOf(L)), 'D holds the table lock while lume ls holds');
  for (const pid of [d.child.pid, Number(readFileSync(L.held('ls'), 'utf8'))]) process.kill(pid, 'SIGKILL');
  await d.done;
  rmSync(L.held('ls'));
  // B reads D's dead lock and stops before its first rename or removal of it.
  const b = startQa(L, ['vm', 'status'], {
    env: { QA_TEST_PAUSE_LOCK: lockOf(L), QA_TEST_PAUSE_DIR: pause },
    argv0: (script, args) => [NODE, ['--import', PRELOAD_LOCKPAUSE, script, ...args]],
  });
  let a;
  try {
    await waitFor(join(pause, 'before'));
    // A takes the lock over and holds it inside its sweep.
    a = startQa(L, ['vm', 'status']);
    await waitFor(L.held('ls'));
    const held = () => (existsSync(lockOf(L)) ? readdirSync(lockOf(L)).sort() : null);
    const successor = held();
    assert.ok(successor?.length, 'A holds the table lock');
    writeFileSync(join(pause, 'go'), '');
    await waitFor(join(pause, 'after'));
    assert.deepEqual(held(), successor, 'B moved or deleted the lock A holds');
  } finally {
    for (const f of ['go', 'go2']) writeFileSync(join(pause, f), '');
    L.release('ls');
  }
  const [ra, rb] = await Promise.all([a.done, b.done]);
  assert.equal(ra.status, 0, outputOf(ra));
  assert.equal(rb.status, 0, outputOf(rb));
  assert.equal(existsSync(lockOf(L)), false);
});

test('lease: busy - a routed command registers busy/PID while it runs and removes it at its end, setting lastUsed at both ends', async () => {
  const L = laneLayout();
  const before = Date.now() - 600000;
  L.stage({ lastUsed: before });
  L.driverCfg({ started: '$HOME/started', pause: '$HOME/release', lines: [{ s: 'out', t: 'GUEST OUT' }] });
  const run = startQa(L, ['preflight', 'ios']);
  await waitFor(join(L.guest.home, 'started'));
  assert.deepEqual(readdirSync(join(L.slotDir(1), 'busy')), [String(run.child.pid)]);
  const during = L.lease(1).lastUsed;
  assert.ok(during > before);
  writeFileSync(join(L.guest.home, 'release'), '');
  const r = await run.done;
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(readdirSync(join(L.slotDir(1), 'busy')), []);
  assert.ok(L.lease(1).lastUsed >= during);
  assert.equal(L.lease(1).state, 'ready');
});

/** Leases a routed command must refuse, each with the lease the test plants. */
const NOT_ROUTABLE = [
  ['a starting lease with a live holder', (L) => L.stage({ state: 'starting', holder: background(), targets: [] })],
  ['a closing lease', (L) => L.stage({ state: 'closing', holder: background() })],
  ['a lease that did not stage the target', (L) => L.stage({ targets: ['desktop'] })],
  ['a truncated lease.json', (L) => {
    L.stage();
    writeFileSync(join(L.slotDir(1), 'lease.json'), '{"worktree": "');
  }],
  ['a slot without lease.json', (L) => {
    L.stage();
    rmSync(join(L.slotDir(1), 'lease.json'));
  }],
  ['no lease at all', () => {}],
];

test('lease: admit - a routed command against a lease that is not ready for its target exits 2 naming vm up and runs no guest command', async () => {
  for (const [label, plant] of NOT_ROUTABLE) {
    const L = laneLayout();
    plant(L);
    L.fakeGuestDriver();
    const r = await runQa(L, ['preflight', 'ios']);
    assert.equal(r.status, 2, `${label}: ${outputOf(r)}`);
    assert.match(outputOf(r), /vm up ios/, label);
    assert.equal(L.gcalls('guest-driver').length, 0, label);
    assert.equal(L.calls('ssh').filter((c) => !c.forward).length, 0, label);
    assert.equal(L.calls('xcrun').length + L.calls('spectre').length, 0, label);
    assert.equal(existsSync(join(L.slotDir(1), 'busy')) ? readdirSync(join(L.slotDir(1), 'busy')).length : 0, 0, label);
  }
});

test('lease: reclaim - the ready lease idle longest beyond the limit is reclaimed for a third worktree', async () => {
  const L = laneLayout();
  const [wtB, wtC] = [wtOf(L, 'b'), wtOf(L, 'c')];
  const old = L.stage({ n: 1, worktree: L.repo, lastUsed: Date.now() - 3 * 3600e3 });
  L.stage({ n: 2, worktree: wtB, lastUsed: Date.now() - 2 * 3600e3 });
  L.setControl({ hold: true });
  const c = startQa(L, ['vm', 'up', 'ios'], { cwd: wtC });
  await waitUntil(() => L.builds().length === 1);
  assert.equal(L.lease(1).worktree, wtC);
  assert.equal(L.lease(1).state, 'starting');
  assert.equal(L.lease(2).worktree, wtB);
  assert.equal(isAlive(old.forward.pid), false);
  const verbs = L.lumeCalls().filter((x) => x.argv.filter((a) => !a.startsWith('--')).at(-1) === 'app-qa-slot-1' && ['stop', 'delete'].includes(x.argv[0])).map((x) => x.argv[0]);
  assert.deepEqual(verbs, ['stop', 'delete']);
  assert.ok(L.lumeCalls('delete').every((x) => x.slots.includes('slot-1')), 'deleted while its slot still existed');
  releaseBuilds(L);
  const r = await c.done;
  assert.match(r.stdout, new RegExp(`reclaimed.*${L.repo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`));
  assertOwnClonesOnly(L);
});

test('lease: reclaim - an idle lease with a live busy pid is not reclaimed', async () => {
  const L = laneLayout();
  const [wtB, wtC] = [wtOf(L, 'b'), wtOf(L, 'c')];
  const old = Date.now() - 3 * 3600e3;
  L.stage({ n: 1, worktree: L.repo, lastUsed: old });
  L.stage({ n: 2, worktree: wtB, lastUsed: Date.now() });
  mkdirSync(join(L.slotDir(1), 'busy'));
  writeFileSync(join(L.slotDir(1), 'busy', String(background())), '');
  const r = await runQa(L, ['vm', 'up', 'ios'], { cwd: wtC });
  assert.equal(r.status, 2, outputOf(r));
  assert.equal(L.lumeCalls('delete').length + L.lumeCalls('stop').length, 0);
  assert.equal(L.lease(1).worktree, L.repo);
  assert.equal(L.builds().length, 0);
  // With the other lease idle too, that one is reclaimed instead.
  L.stage({ n: 2, worktree: wtB, lastUsed: Date.now() - 2 * 3600e3 });
  L.setControl({ hold: true });
  const c = startQa(L, ['vm', 'up', 'ios'], { cwd: wtC });
  await waitUntil(() => L.builds().length === 1);
  assert.equal(L.lease(2).worktree, wtC);
  assert.equal(L.lease(1).worktree, L.repo);
  releaseBuilds(L);
  await c.done;
});

test('lease: admit - during a reclaim whose delete is held a routed command of the reclaimed worktree exits 2 and runs no guest command', async () => {
  const L = laneLayout();
  const [wtB, wtC] = [wtOf(L, 'b'), wtOf(L, 'c')];
  L.stage({ n: 1, worktree: L.repo, lastUsed: Date.now() - 3 * 3600e3 });
  L.stage({ n: 2, worktree: wtB });
  L.hold('delete');
  const c = startQa(L, ['vm', 'up', 'ios'], { cwd: wtC });
  await waitFor(L.held('delete'));
  assert.equal(L.lease(1).state, 'closing');
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /vm up ios/);
  assert.equal(L.gcalls('guest-driver').length, 0);
  L.release('delete');
  await c.done;
});

test('lease: refresh-busy - vm up in the worktree of a running routed flow exits 2 naming the busy pid and changes nothing', async () => {
  const L = laneLayout();
  const lease = L.stage();
  writeFileSync(join(L.guestCopy, 'marker.txt'), 'guest copy');
  L.driverCfg({ started: '$HOME/started', pause: '$HOME/release' });
  const flowRun = startQa(L, ['flow', 'ios', repoFlow(L)]);
  await waitFor(join(L.guest.home, 'started'));
  const before = L.lease(1);
  const up = await L.up(['ios']);
  assert.equal(up.status, 2, outputOf(up));
  assert.ok(outputOf(up).includes(String(flowRun.child.pid)), outputOf(up));
  const after = L.lease(1);
  for (const key of ['state', 'holder', 'targets', 'forward', 'clone', 'worktree']) assert.deepEqual(after[key], before[key], key);
  assert.equal(isAlive(lease.forward.pid), true);
  assert.equal(readFileSync(join(L.guestCopy, 'marker.txt'), 'utf8'), 'guest copy');
  assert.equal(L.builds().length, 0);
  assert.equal(L.lumeCalls('delete').length, 0);
  writeFileSync(join(L.guest.home, 'release'), '');
  assert.equal((await flowRun.done).status, 0);
});

test('lease: down-busy - vm down during a routed command exits 2 naming the busy pid', async () => {
  const L = laneLayout();
  const lease = L.stage();
  L.driverCfg({ started: '$HOME/started', pause: '$HOME/release' });
  const run = startQa(L, ['preflight', 'ios']);
  await waitFor(join(L.guest.home, 'started'));
  const down = await runQa(L, ['vm', 'down']);
  assert.equal(down.status, 2, outputOf(down));
  assert.ok(outputOf(down).includes(String(run.child.pid)), outputOf(down));
  assert.equal(L.lease(1).state, 'ready');
  assert.equal(isAlive(lease.forward.pid), true);
  assert.equal(L.lumeCalls('delete').length, 0);
  writeFileSync(join(L.guest.home, 'release'), '');
  await run.done;
});

test('lease: starting - vm status during another worktree\'s starting vm up deletes nothing and leaves its lease', async () => {
  const L = laneLayout();
  L.setControl({ hold: true });
  const up = startQa(L, ['vm', 'up', 'ios']);
  await waitUntil(() => L.builds().length === 1);
  const r = await runQa(L, ['vm', 'status'], { cwd: wtOf(L, 'b') });
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.lumeCalls('delete').length + L.lumeCalls('stop').length, 0);
  assert.equal(L.lease(1).state, 'starting');
  assert.equal(L.lease(1).holder, up.child.pid);
  assert.match(r.stdout, /slot 1.*starting/);
  releaseBuilds(L);
  await up.done;
});

test('lease: crashed - a killed vm up after its clone appeared is cleaned by vm status, both printed', async () => {
  const L = laneLayout();
  L.hold('run');
  const up = startQa(L, ['vm', 'up', 'ios']);
  await waitFor(L.held('run'));
  assert.deepEqual(L.clones(), ['app-qa-slot-1']);
  up.child.kill('SIGKILL');
  await up.done;
  process.kill(Number(readFileSync(L.held('run'), 'utf8')), 'SIGKILL');
  L.setLume({ hold: {} });
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(r.stdout, /app-qa-slot-1/);
  assert.match(r.stdout, /slot-1/);
  assert.deepEqual(L.clones(), []);
  assert.deepEqual(L.slots(), []);
  assert.ok(L.lumeCalls('delete').every((x) => x.slots.includes('slot-1')));
  assertOwnClonesOnly(L);
});

/** A vm down killed at each of its three points (D4 sweep): before stop, between stop and delete, after delete. */
for (const [point, hold] of [['before stop', 'stop'], ['between stop and delete', 'delete'], ['after delete before the slot removal', 'lsAfterDelete']]) {
  test(`lease: closing - a vm down killed ${point} is completed by the next vm status`, async () => {
    const L = laneLayout();
    const lease = L.stage();
    L.hold(hold);
    const down = startQa(L, ['vm', 'down']);
    await waitFor(L.held(hold));
    down.child.kill('SIGKILL');
    await down.done;
    if (hold !== 'lsAfterDelete') process.kill(Number(readFileSync(L.held(hold), 'utf8')), 'SIGKILL');
    assert.equal(L.lease(1).state, 'closing');
    assert.equal(L.lease(1).holder, down.child.pid);
    L.setLume({ hold: {} });
    const r = await runQa(L, ['vm', 'status']);
    assert.equal(r.status, 0, outputOf(r));
    assert.deepEqual(L.clones(), []);
    assert.deepEqual(L.slots(), []);
    assert.match(r.stdout, /app-qa-slot-1/);
    assert.equal(isAlive(lease.forward.pid), false);
    for (const c of L.lumeCalls('delete')) assert.ok(c.slots.includes('slot-1'), 'the slot outlived the delete call');
    assertOwnClonesOnly(L);
  });
}

test('lease: closing - a slot is never freed while the fake lume ls still lists its clone', async () => {
  const L = laneLayout();
  L.stage({ state: 'closing', holder: await deadPid() });
  L.setLume({ deleteFails: true });
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 2, outputOf(r));
  assert.deepEqual(L.slots(), ['slot-1']);
  assert.deepEqual(L.clones(), ['app-qa-slot-1']);
  assert.match(outputOf(r), /app-qa-slot-1.*still/);
});

test('lease: partial - a slot with a truncated lease.json is torn down with its clone by vm status', async () => {
  const L = laneLayout();
  L.stage();
  writeFileSync(join(L.slotDir(1), 'lease.json'), '{"worktree"');
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(L.clones(), []);
  assert.deepEqual(L.slots(), []);
});

// A driver killed during `lume clone` or `lume delete` leaves that child running; freeing the slot before it ends lets it
// create or delete a clone of that name under the next lease. The process of a held clone is never touched.
for (const [state, verb] of [['starting', ['clone', 'app-qa-golden', 'app-qa-slot-1']], ['closing', ['delete', 'app-qa-slot-1', '--force']]]) {
  test(`lease: mutation - a ${state} slot of a dead driver is freed only after the lume ${verb[0]} it left has ended`, async () => {
    const L = laneLayout();
    L.stage({ state, holder: await deadPid() });
    L.stage({ n: 2, worktree: wtOf(L, 'b') });
    const left = background();
    const held = background();
    L.set({
      ps: [
        ...DEFAULT_STATE.ps,
        `${left} /Users/qa/.local/share/lume/lume.app/Contents/MacOS/lume ${verb.join(' ')}`,
        `${held} /usr/local/bin/lume stop app-qa-slot-2`,
      ],
    });
    const r = await runQa(L, ['vm', 'status']);
    assert.equal(r.status, 0, outputOf(r));
    assert.equal(isAlive(left), false, `the dead driver's lume ${verb[0]} outlived the teardown`);
    assert.equal(isAlive(held), true, 'a lume process naming a held clone was ended');
    assert.deepEqual(L.slots(), ['slot-2']);
    assert.deepEqual(L.clones(), ['app-qa-slot-2']);
  });
}

test('lease: redact - vm status prints a worktree path holding a configured username redacted', async () => {
  const L = laneLayout();
  L.stage({ worktree: wtOf(L, USER1) });
  const status = await runQa(L, ['vm', 'status']);
  assert.equal(status.status, 0, outputOf(status));
  assert.match(status.stdout, /slot 1: ready worktree=/);
  assert.ok(!outputOf(status).includes(USER1), outputOf(status));
});

test('lease: redact - a lane-file error of a routed command prints a home path holding a configured username redacted', async () => {
  const L = laneLayout();
  const home = join(L.root, USER1);
  mkdirSync(join(home, '.omp', 'agent'), { recursive: true });
  writeFileSync(join(home, '.omp', 'agent', 'app-qa-vm.json'), '{');
  const r = await runQa(L, ['preflight', 'ios'], { env: { HOME: home } });
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /app-qa-vm\.json/);
  assert.ok(!outputOf(r).includes(USER1), outputOf(r));
});

test('lease: foreign - vm status leaves every VM that is not a slot clone of this lane alone', async () => {
  const L = laneLayout();
  for (const name of ['app-qa-slot-golden', 'app-qa-slot-3', 'other-vm', 'app-qa-golden-copy']) L.addVm(name, 'running');
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.lumeCalls('delete').length + L.lumeCalls('stop').length, 0);
  assert.deepEqual(L.lume().vms.map((v) => v.name).sort(), ['app-qa-golden', 'app-qa-golden-copy', 'app-qa-slot-3', 'app-qa-slot-golden', 'other-vm']);
});

test('lease: orphan - an orphan app-qa-slot-2 is deleted by the sweep, printed by name', async () => {
  const L = laneLayout();
  L.addVm('app-qa-slot-2', 'running');
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(r.stdout, /app-qa-slot-2/);
  assert.deepEqual(L.clones(), []);
  assert.deepEqual(L.slots(), []);
  assert.ok(L.lumeCalls('delete').every((x) => x.slots.includes('slot-2')), 'reserved before the delete');
});

test('lease: orphan - with the orphan\'s delete held a second sweep leaves it alone and vm up never takes slot 2 until it is free', async () => {
  const L = laneLayout();
  const wtB = wtOf(L, 'b');
  L.addVm('app-qa-slot-2', 'running');
  L.hold('delete');
  const first = startQa(L, ['vm', 'status']);
  await waitFor(L.held('delete'));
  // A second sweep that deletes too waits on the held delete; release it so the test fails on the count instead of hanging.
  const run2 = startQa(L, ['vm', 'status']);
  let settled = false;
  run2.done.then(() => (settled = true));
  await waitUntil(() => settled || L.lumeCalls('delete').length > 1, 120000);
  if (!settled) L.release('delete');
  assert.equal(L.lumeCalls('delete').length, 1, 'the second sweep deleted the orphan the first sweep holds');
  const second = await run2.done;
  assert.equal(second.status, 0, outputOf(second));
  assert.deepEqual(L.slots(), ['slot-2']);
  L.setControl({ hold: true });
  const a = startQa(L, ['vm', 'up', 'ios']);
  await waitUntil(() => L.builds().length === 1);
  assert.equal(L.lease(1).worktree, L.repo);
  const refused = await runQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  assert.equal(refused.status, 2, outputOf(refused));
  assert.equal(L.lumeCalls('clone').length, 0);
  L.setLume({ hold: {} });
  L.release('delete');
  assert.equal((await first.done).status, 0);
  releaseBuilds(L);
  await a.done;
  const b = await runQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  assert.ok(L.lumeCalls('clone').some((c) => c.argv.at(-1) === 'app-qa-slot-2'), outputOf(b));
  assert.equal(L.lease(2).worktree, wtB);
});

test('lease: publish - a vm up killed after creating slot-N before its record is recovered by one vm status', async () => {
  const L = laneLayout();
  const marker = join(L.root, 'slot-blocked');
  const up = startQa(L, ['vm', 'up', 'ios'], {
    env: { QA_TEST_BLOCK_MARKER: marker, QA_TEST_BLOCK_RELEASE: join(L.root, 'never') },
    argv0: (script, args) => [NODE, ['--import', PRELOAD_SLOT, script, ...args]],
  });
  await waitFor(marker);
  up.child.kill('SIGKILL');
  await up.done;
  assert.deepEqual(L.slots(), ['slot-1']);
  assert.equal(existsSync(join(L.slotDir(1), 'lease.json')), false);
  assert.equal(existsSync(lockOf(L)), true);
  assert.equal(L.builds().length + L.lumeCalls('clone').length, 0);
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(r.stdout, /took over/);
  assert.match(r.stdout, /slot-1/);
  assert.deepEqual(L.slots(), []);
  assert.equal(existsSync(lockOf(L)), false);
  assert.equal(L.lumeCalls('delete').length, 0);
  L.setControl({ hold: true });
  const again = startQa(L, ['vm', 'up', 'ios']);
  await waitUntil(() => L.builds().length === 1);
  assert.equal(L.lease(1).worktree, L.repo);
  releaseBuilds(L);
  assert.equal((await again.done).status !== undefined, true);
});

test('lease: publish - slot-1 without a record, a dead-pid table lock and a listed clone are recovered by one vm status', async () => {
  const L = laneLayout();
  plantLock(L, await deadPid());
  mkdirSync(L.slotDir(1));
  L.addVm('app-qa-slot-1', 'running');
  const r = await runQa(L, ['vm', 'status']);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(L.clones(), []);
  assert.deepEqual(L.slots(), []);
  assert.equal(existsSync(lockOf(L)), false);
  const deletes = L.lumeCalls('delete');
  assert.equal(deletes.length, 1);
  assert.ok(deletes[0].slots.includes('slot-1'), 'the clone was deleted before slot-1 was removed');
});

test('lease: image - the golden image is never named in a lume run, stop or delete call', async () => {
  const L = laneLayout();
  L.stage({ n: 1 });
  L.addVm('app-qa-slot-2', 'running');
  assert.equal((await runQa(L, ['vm', 'status'])).status, 0);
  assert.equal((await runQa(L, ['vm', 'down'])).status, 0);
  assert.ok(L.lumeCalls('delete').length >= 2);
  for (const c of L.lumeCalls()) {
    if (['run', 'stop', 'delete'].includes(c.argv[0])) assert.ok(!c.argv.includes('app-qa-golden'), c.argv.join(' '));
  }
  assertOwnClonesOnly(L);
});

test('lease: down removes the clone, the forward and the slot, and vm status shows the slot free', async () => {
  const L = laneLayout();
  const lease = L.stage();
  const r = await runQa(L, ['vm', 'down']);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(L.clones(), []);
  assert.equal(isAlive(lease.forward.pid), false);
  assert.deepEqual(L.slots(), []);
  const status = await runQa(L, ['vm', 'status']);
  assert.equal(status.status, 0);
  assert.match(status.stdout, /slot 1: free/);
  assert.deepEqual(L.lumeCalls().filter((c) => ['stop', 'delete'].includes(c.argv[0])).map((c) => c.argv[0]), ['stop', 'delete']);
});

test('lease: down in another worktree leaves the lease alone and exits 0 without a lease', async () => {
  const L = laneLayout();
  const lease = L.stage();
  const r = await runQa(L, ['vm', 'down'], { cwd: wtOf(L, 'b') });
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.lease(1).state, 'ready');
  assert.equal(L.lease(1).worktree, L.repo);
  assert.equal(isAlive(lease.forward.pid), true);
  assert.deepEqual(L.clones(), ['app-qa-slot-1']);
  assert.equal(L.lumeCalls('delete').length + L.lumeCalls('stop').length, 0);
  const none = laneLayout();
  const empty = await runQa(none, ['vm', 'down']);
  assert.equal(empty.status, 0, outputOf(empty));
});

// ---------- stage: build, snapshot, copy, credentials (task 3.1) ----------

const MARKER = 'BUILD-MARKER-9f2c41';
/** A tracked source file of the worktree `repo`, committed. */
function addSource(repo, rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
  git(repo, 'add', rel);
  git(repo, 'commit', '-qm', `add ${rel}`);
}
/** Regular files below `dirs` whose bytes hold any of `needles`. */
function filesHolding(dirs, needles) {
  const hits = [];
  for (const dir of [].concat(dirs)) {
    for (const f of filesBelow(dir)) {
      const text = readFileSync(f).toString('latin1');
      if (needles.some((n) => text.includes(Buffer.from(n).toString('latin1')))) hits.push(f);
    }
  }
  return hits;
}
/** The files of a guest copy, relative to it, without Git's own folder. */
const guestFiles = (L) => filesBelow(L.guestCopy).map((f) => relative(L.guestCopy, f)).filter((f) => !f.startsWith('.git/'));

test('stage: build - a failing build and a build without its artifact on a worktree without a lease exit 2, hold no slot and start no VM', async () => {
  const L = laneLayout();
  for (const [label, patch] of [['failing', { exit: { ios: 1 }, print: { ios: ['compiling', 'error: broken'] } }], ['no artifact', { exit: {}, noArtifact: { ios: true }, print: { ios: ['compiling', 'done'] } }]]) {
    L.setControl(patch);
    const r = await L.up(['ios']);
    assert.equal(r.status, 2, `${label}: ${outputOf(r)}`);
    assert.match(r.stdout, /compiling/, label);
    assert.deepEqual(L.slots(), [], label);
    for (const verb of ['clone', 'run', 'stop', 'delete']) assert.equal(L.lumeCalls(verb).length, 0, `${label}: lume ${verb}`);
    assert.equal(L.calls('ssh').length, 0, label);
  }
});

test('stage: build - {port} is replaced by the backend port, or by --port', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  assert.equal(L.builds().at(-1).port, String(PORT));
  assert.equal((await L.up(['ios', '--port', '9876'])).status, 0);
  assert.equal(L.builds().at(-1).port, '9876');
});

test('stage: refresh-fail - a failing build and then a missing artifact on refresh leave a ready lease with no staged target', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  assert.deepEqual(L.lease(1).targets, ['ios']);
  const sshBefore = L.calls('ssh').length;
  L.setControl({ exit: { ios: 1 } });
  const failed = await L.up(['ios']);
  assert.equal(failed.status, 2, outputOf(failed));
  rmSync(join(L.repo, 'build'), { recursive: true, force: true });
  L.setControl({ exit: {}, noArtifact: { ios: true } });
  const missing = await L.up(['ios']);
  assert.equal(missing.status, 2, outputOf(missing));
  for (const [label, r] of [['failed', failed], ['missing', missing]]) assert.match(r.stdout, /vm up: /, label);
  assert.equal(L.lease(1).state, 'ready');
  assert.deepEqual(L.lease(1).targets, []);
  const sshMid = L.calls('ssh').length;
  const routed = await runQa(L, ['preflight', 'ios']);
  assert.equal(routed.status, 2, outputOf(routed));
  assert.match(outputOf(routed), /vm up ios/);
  assert.equal(L.calls('ssh').length, sshMid);
  assert.ok(sshMid >= sshBefore);
});

test('stage: redact - a build printing account 1\'s password prints [redacted], and only the two credentials files hold it afterwards', async () => {
  const L = laneLayout();
  L.setControl({ print: { ios: ['compiling', `login with ${PW1} and ${USER1}`] } });
  const ok = await L.up(['ios']);
  assert.equal(ok.status, 0, outputOf(ok));
  L.setControl({ exit: { ios: 1 } });
  const failed = await L.up(['ios']);
  assert.equal(failed.status, 2);
  assert.match(failed.stdout, /login with \[redacted\] and \[redacted\]/);
  for (const r of [ok, failed]) assert.deepEqual(leaks(outputOf(r), [PW1, USER1]), []);
  const hits = filesHolding([L.root], [PW1, USER1]).filter((f) => !f.startsWith(join(L.root, 'driver')) && f !== L.control);
  assert.deepEqual(hits.sort(), [join(L.repo, '.dev-credentials.env'), join(L.guestCopy, '.dev-credentials.env')].sort());
});

test('stage: memory - build output is never written to a file while the build runs or after it ends', async () => {
  const L = laneLayout();
  L.setControl({ print: { ios: [MARKER, PW1] }, hold: true });
  const scanRoots = [L.tmp, L.home, L.repo];
  const up = startQa(L, ['vm', 'up', 'ios']);
  await waitFor(`${L.control}.held`);
  await sleep(200);
  assert.deepEqual(filesHolding(scanRoots, [MARKER, PW1]).filter((f) => f !== join(L.repo, '.dev-credentials.env')), []);
  releaseBuilds(L);
  const done = await up.done;
  assert.equal(done.status, 0, outputOf(done));
  assert.deepEqual(filesHolding(scanRoots, [MARKER, PW1]).filter((f) => f !== join(L.repo, '.dev-credentials.env')), []);
  rmSync(`${L.control}.release`);
  L.setControl({ hold: false, exit: { ios: 1 } });
  const failed = await L.up(['ios']);
  assert.equal(failed.status, 2);
  assert.match(failed.stdout, new RegExp(MARKER));
  assert.deepEqual(filesHolding(scanRoots, [MARKER, PW1]).filter((f) => f !== join(L.repo, '.dev-credentials.env')), []);
});

test('stage: memory - a write recorder over every node:fs write entry point sees no chunk holding the marker or the password', async () => {
  const L = laneLayout();
  const log = join(L.root, 'writes.jsonl');
  const run = (extra = {}) =>
    L.up(['ios'], {
      env: { QA_TEST_WRITE_LOG: log },
      argv0: (script, args) => [NODE, ['--import', PRELOAD_WRITES, script, ...args]],
      ...extra,
    });
  L.setControl({ print: { ios: [MARKER, PW1] } });
  const ok = await run();
  assert.equal(ok.status, 0, outputOf(ok));
  L.setControl({ exit: { ios: 1 } });
  const failed = await run();
  assert.equal(failed.status, 2);
  const chunks = readFileSync(log, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(chunks.length > 5, 'the recorder saw the driver write');
  assert.ok(chunks.some((c) => /lease\.json/.test(c.path)), 'the recorder saw the lease record');
  for (const c of chunks) {
    assert.ok(!c.text.includes(MARKER) && !c.text.includes(PW1), `${c.fn} ${c.path} wrote build output`);
  }
  for (const run of L.builds()) assert.deepEqual(run.pipes, [true, true], 'build stdout and stderr are pipes, not files');
});

test('stage: copy - the guest holds the tracked and untracked unignored files, the credentials file with mode 0600 and the driver', async () => {
  const L = laneLayout();
  addSource(L.repo, 'src/Main.kt', 'fun main() = Unit\n');
  writeFileSync(join(L.repo, 'notes.txt'), 'untracked, not ignored\n');
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  const expected = [
    '.dev-credentials.env', '.gitignore', '.omp/app-qa.json', 'app_kmp/gradle.properties', 'notes.txt', 'src/Main.kt',
    'build/App.app/Info.plist', 'build/App.app/bin/app',
  ].sort();
  assert.deepEqual(guestFiles(L).sort(), expected);
  assert.equal(readFileSync(join(L.guestCopy, 'src/Main.kt'), 'utf8'), 'fun main() = Unit\n');
  assert.equal(statSync(join(L.guestCopy, '.dev-credentials.env')).mode & 0o777, 0o600);
  assert.equal(readFileSync(join(L.guestCopy, '.dev-credentials.env'), 'utf8'), readFileSync(join(L.repo, '.dev-credentials.env'), 'utf8'));
  assert.equal(existsSync(join(L.guestCopy, '.git')), true);
  const head = spawnSync(GIT, ['-C', L.guestCopy, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
  assert.notEqual(head.status, 0, 'git init without a commit');
  assert.deepEqual(readFileSync(join(L.guestDriver, 'qa.mjs')), readFileSync(L.qa));
  assert.equal(existsSync(join(L.guestDriver, 'vm')), true);
  assert.equal(existsSync(join(L.slotDir(1), 'stage')), false, 'the snapshot is deleted after the copy');
  assert.equal(L.lease(1).state, 'ready');
  assert.deepEqual(L.lease(1).targets, ['ios']);
});

test('stage: ignored - the artifact in a git-ignored build folder reaches the guest at its relative path and no other ignored file does', async () => {
  const L = laneLayout();
  writeFileSync(join(L.repo, '.gitignore'), '.worktrees/\nbuild/\n.dev-credentials.env\nnode_modules/\n.gradle/\n');
  git(L.repo, 'commit', '-qam', 'ignore more');
  mkdirSync(join(L.repo, 'build'), { recursive: true });
  writeFileSync(join(L.repo, 'build', 'cache.bin'), 'ignored build cache');
  mkdirSync(join(L.repo, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(L.repo, 'node_modules', 'x', 'index.js'), 'ignored');
  mkdirSync(join(L.repo, '.gradle'));
  writeFileSync(join(L.repo, '.gradle', 'state'), 'ignored');
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  const files = guestFiles(L);
  assert.ok(files.includes('build/App.app/Info.plist'));
  assert.equal(readFileSync(join(L.guestCopy, 'build/App.app/Info.plist'), 'utf8'), `ios app v1 port=${PORT}\nbundle=eu.onara.app.test\n`);
  for (const ignored of ['build/cache.bin', 'node_modules/x/index.js', '.gradle/state']) assert.equal(files.includes(ignored), false, ignored);
});

test('stage: snapshot - an artifact rewritten after the snapshot leaves the guest with the snapshot\'s bytes', async () => {
  const L = laneLayout();
  L.setControl({ watch: { untilTool: 'lume', untilVerb: 'clone', calls: L.callFile, rewrite: { path: 'Info.plist', content: 'MUTATED AFTER THE SNAPSHOT\n' } } });
  L.hold('run');
  const up = startQa(L, ['vm', 'up', 'ios']);
  await waitFor(L.held('run'));
  await waitUntil(() => readFileSync(join(L.repo, 'build/App.app/Info.plist'), 'utf8').startsWith('MUTATED'));
  assert.deepEqual(readFileSync(join(L.slotDir(1), 'stage', 'ios', 'build/App.app/Info.plist'), 'utf8'), `ios app v1 port=${PORT}\nbundle=eu.onara.app.test\n`);
  L.setLume({ hold: {} });
  L.release('run');
  const r = await up.done;
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(readFileSync(join(L.guestCopy, 'build/App.app/Info.plist'), 'utf8'), `ios app v1 port=${PORT}\nbundle=eu.onara.app.test\n`);
  assert.equal(statSync(join(L.slotDir(1))).mode & 0o700, 0o700);
});

test('stage: credentials - no credential value reaches an argument vector of the fake logs, and the file travels over stdin with umask 077', async () => {
  const L = laneLayout();
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  const logs = JSON.stringify([...L.calls(), ...L.gcalls()]);
  assert.deepEqual(leaks(logs, [USER1, PW1, USER2, PW2]), []);
  assert.ok(L.calls('ssh').some((c) => c.argv.join(' ').includes('umask 077')), 'the credentials upload sets umask 077');
  assert.deepEqual(leaks(outputOf(r), [USER1, PW1, USER2, PW2]), []);
});

test('stage: refresh - a rerun after a file change builds again and holds the new content in the same clone', async () => {
  const L = laneLayout();
  addSource(L.repo, 'src/Main.kt', 'v1\n');
  assert.equal((await L.up(['ios'])).status, 0);
  const slot = L.lease(1);
  writeFileSync(join(L.repo, 'src/Main.kt'), 'v2 changed\n');
  L.setControl({ artifacts: { ...BUILD_ARTIFACTS, ios: { ...BUILD_ARTIFACTS.ios, files: { 'Info.plist': 'ios app v2\nbundle=eu.onara.app.v2\n' } } } });
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.builds().length, 2);
  assert.equal(L.lumeCalls('clone').length, 1);
  assert.equal(L.lumeCalls('run').length, 1);
  assert.equal(L.lease(1).clone, slot.clone);
  assert.equal(L.lease(1).state, 'ready');
  assert.equal(readFileSync(join(L.guestCopy, 'src/Main.kt'), 'utf8'), 'v2 changed\n');
  assert.equal(readFileSync(join(L.guestCopy, 'build/App.app/Info.plist'), 'utf8'), 'ios app v2\nbundle=eu.onara.app.v2\n');
});

test('stage: nobackend - a backend-free desktop configuration stages with no ssh -R call, and --port is refused', async () => {
  const L = laneLayout({ backend: false });
  const r = await L.up(['desktop']);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(L.lease(1).targets, ['desktop']);
  assert.equal(L.lease(1).forward, null);
  assert.equal(L.calls('ssh').filter((c) => c.argv.includes('-R') || c.argv.includes('-N')).length, 0);
  const refused = await L.up(['desktop', '--port', '9000']);
  assert.equal(refused.status, 2);
  assert.match(outputOf(refused), /--port/);
  assert.equal(L.calls('ssh').filter((c) => c.argv.includes('-R')).length, 0);
  assert.equal(L.builds().length, 1);
});

test('stage: reset - a refresh deletes a planted guest session record, flow lock and output file, and a routed desktop tap asks for desktop attach', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['desktop'])).status, 0);
  const planted = [
    join(L.guest.tmp, 'app-qa', 'sessions', 'stale.json'),
    join(L.guest.tmp, 'app-qa', 'flow.lock', 'pid'),
    join(L.guest.tmp, 'app-qa-lease', 'out', 'planted.txt'),
  ];
  for (const f of planted) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '1\n');
  }
  assert.equal((await L.up(['desktop'])).status, 0);
  for (const f of planted) assert.equal(existsSync(f), false, f);
  const tap = await runQa(L, ['desktop', 'tap', 'sign-in']);
  assert.notEqual(tap.status, 0, outputOf(tap));
  assert.match(outputOf(tap), /desktop attach/);
});

test('stage: reset - worktree A\'s vm down and worktree B\'s vm up on the same slot clone the image again and B\'s guest holds none of A\'s files', async () => {
  const L = laneLayout({ lane: { slots: 1 } });
  const wtB = wtOf(L, 'b');
  assert.equal((await L.up(['ios'])).status, 0);
  writeFileSync(join(L.guestCopy, 'A-planted.txt'), 'A');
  writeFileSync(join(L.guest.home, 'A-home.txt'), 'A');
  writeFileSync(join(L.guest.tmp, 'A-tmp.txt'), 'A');
  assert.equal((await runQa(L, ['vm', 'down'])).status, 0);
  const r = await runQa(L, ['vm', 'up', 'ios'], { cwd: wtB });
  assert.equal(r.status, 0, outputOf(r));
  const clones = L.lumeCalls('clone');
  assert.equal(clones.length, 2);
  assert.deepEqual(clones[1].argv, ['clone', 'app-qa-golden', 'app-qa-slot-1']);
  assert.deepEqual(filesBelow(L.guest.home).map((f) => relative(L.guest.home, f)).filter((f) => /^A-|A-planted/.test(f) || f.includes('A-')), []);
  assert.equal(L.lease(1).worktree, wtB);
});

test('stage: vnc - lume run starts the clone with --vnc disabled and --display none', async () => {
  const L = laneLayout();
  const up = await L.up(['ios']);
  assert.equal(up.status, 0, outputOf(up));
  const run = L.lumeCalls('run');
  assert.equal(run.length, 1);
  const at = (flag) => run[0].argv[run[0].argv.indexOf(flag) + 1];
  assert.equal(at('--vnc'), 'disabled');
  assert.equal(at('--display'), 'none');
  assert.ok(run[0].argv.includes('--detach'));
  assert.equal(run[0].argv.at(-1), 'app-qa-slot-1');
});

// ---------- stage: forward and clone reconcile (task 3.3) ----------

test('stage: forward - after two vm up runs exactly one forward process is alive, forwarding the backend port into the guest', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  const first = L.lease(1).forward;
  assert.ok(first && isAlive(first.pid));
  assert.equal(first.port, PORT);
  assert.equal((await L.up(['ios'])).status, 0);
  const forwards = L.calls('ssh').filter((c) => c.forward);
  assert.equal(forwards.length, 2);
  await waitUntil(() => !isAlive(first.pid));
  assert.equal(forwards.filter((c) => isAlive(c.pid)).length, 1);
  assert.equal(L.lease(1).forward.pid, forwards[1].pid);
  const argv = forwards[1].argv;
  assert.equal(argv[argv.indexOf('-R') + 1], `${PORT}:127.0.0.1:${PORT}`);
  assert.ok(argv.join(' ').includes('ExitOnForwardFailure=yes'));
  assert.ok(L.gcalls('nc').some((c) => c.argv.join(' ') === `-z 127.0.0.1 ${PORT}`));
  for (const pid of forwards.map((c) => c.pid)) if (isAlive(pid)) process.kill(pid, 'SIGKILL');
});

test('stage: stopped - a stopped clone is run again by vm up, which stages and leaves the lease ready', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  L.setVmStatus('app-qa-slot-1', 'stopped');
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(L.lumeCalls('run').length, 2);
  assert.equal(L.lumeCalls('clone').length, 1);
  assert.equal(L.lease(1).state, 'ready');
  assert.deepEqual(L.lease(1).targets, ['ios']);
});

test('stage: unestablished - a forward process alive with no listener behind it exits 2 naming the forward, stages no target and leaves routed commands refused', async () => {
  const L = laneLayout();
  L.gset({ ncFails: true });
  const r = await L.up(['ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /forward/);
  assert.equal(L.lease(1).state, 'ready');
  assert.deepEqual(L.lease(1).targets, []);
  const fwd = L.calls('ssh').filter((c) => c.forward);
  assert.equal(fwd.length, 1);
  await waitUntil(() => !isAlive(fwd[0].pid));
  assert.equal(L.gcalls('xcrun').filter((c) => c.argv[1] === 'create').length, 0, 'no target started');
  const routed = await runQa(L, ['preflight', 'ios']);
  assert.equal(routed.status, 2, outputOf(routed));
  assert.match(outputOf(routed), /vm up ios/);
});

// ---------- route: routing, lease health and dependency loss (task 4.1) ----------

/** The staged lease of `L`'s worktree with a guest driver that prints `lines` (after pausing until $HOME/release when `pause`). */
function routedLease(L, { target = 'ios', lines = [{ s: 'out', t: 'PASS guest check' }], pause = false, exit = 0, ...stage } = {}) {
  L.stage({ targets: [target], ...stage });
  L.driverCfg({ started: '$HOME/started', ...(pause ? { pause: '$HOME/release' } : {}), lines, exit });
}
const hostTools = (L) => L.calls('xcrun').length + L.calls('spectre').length + L.calls('maestro').length;
const busyLeft = (L) => (existsSync(join(L.slotDir(1), 'busy')) ? readdirSync(join(L.slotDir(1), 'busy')) : []);

for (const sweep of ['none', 'a vm status killed while recording the orphan']) {
  test(`lease: orphaned-run - vm up after a routed command whose host driver was killed mid-run deletes and recreates the clone instead of resetting it in place (earlier sweep: ${sweep})`, async () => {
    const L = laneLayout();
    routedLease(L, { pause: true });
    const run = startQa(L, ['preflight', 'ios']);
    await waitFor(join(L.guest.home, 'started'));
    run.child.kill('SIGKILL');
    await run.done;
    writeFileSync(join(L.guest.home, 'release'), '');
    if (sweep !== 'none') {
      const marker = join(L.root, 'orphan-blocked');
      const status = startQa(L, ['vm', 'status'], {
        env: { QA_TEST_BLOCK_MARKER: marker, QA_TEST_BLOCK_RELEASE: join(L.root, 'never') },
        argv0: (script, args) => [NODE, ['--import', PRELOAD_ORPHAN, script, ...args]],
      });
      await waitFor(marker);
      status.child.kill('SIGKILL');
      await status.done;
      assert.deepEqual(busyLeft(L), [String(run.child.pid)], 'the dead marker outlives a sweeper killed before the orphan is recorded');
    }
    const before = L.calls('lume').length;
    const up = await L.up(['ios']);
    assert.equal(up.status, 0, outputOf(up));
    assert.match(outputOf(up), new RegExp(`pid ${run.child.pid}\\b.*deleted app-qa-slot-1 to recreate it`));
    const verbs = L.calls('lume').slice(before).map((c) => c.argv.join(' '));
    const deleted = verbs.findIndex((v) => v.startsWith('delete ') && v.split(' ').includes('app-qa-slot-1'));
    assert.ok(deleted >= 0, verbs.join('\n'));
    assert.ok(verbs.slice(deleted).some((v) => v.startsWith('clone ') && v.split(' ').includes('app-qa-slot-1')), verbs.join('\n'));
    assert.equal(L.lease(1).state, 'ready');
    assert.equal(L.lease(1).orphaned, undefined);
    assert.deepEqual(busyLeft(L), []);
  });
}

test('route: lane - a routed preflight runs the guest driver, names the lane and the clone first, and leaves the host tools and flow lock untouched', async () => {
  const L = laneLayout();
  routedLease(L);
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(r.lines[0], /^lane: .*app-qa-slot-1/);
  assert.ok(r.lines.includes('PASS guest check'));
  assert.deepEqual(L.gcalls('guest-driver').map((c) => c.argv), [['preflight', 'ios', '--port', String(PORT)]]);
  assert.equal(hostTools(L), 0);
  assert.equal(existsSync(lockPath(L)), false);
  assert.deepEqual(busyLeft(L), []);
});

test('route: port - a routed preflight checks the port the lease forwards, and another --port is refused naming vm up', async () => {
  const L = laneLayout();
  routedLease(L, { port: 9876 });
  const plain = await runQa(L, ['preflight', 'ios']);
  assert.equal(plain.status, 0, outputOf(plain));
  const same = await runQa(L, ['preflight', 'ios', '--port', '9876']);
  assert.equal(same.status, 0, outputOf(same));
  assert.deepEqual(L.gcalls('guest-driver').map((c) => c.argv), [['preflight', 'ios', '--port', '9876'], ['preflight', 'ios', '--port', '9876']]);
  const other = await runQa(L, ['preflight', 'ios', '--port', '1234']);
  assert.equal(other.status, 2, outputOf(other));
  assert.match(outputOf(other), /forwards the backend port 9876, not 1234; run .* vm up ios --port 1234/);
  assert.equal(L.gcalls('guest-driver').length, 2);
  assert.deepEqual(busyLeft(L), []);
});

test('route: nolease - with no lease, and with a lease only another worktree holds, desktop attach exits 2 naming vm up desktop and runs nothing on the host', async () => {
  const L = laneLayout();
  const none = await runQa(L, ['desktop', 'attach']);
  assert.equal(none.status, 2, outputOf(none));
  assert.match(outputOf(none), /vm up desktop/);
  routedLease(L, { target: 'desktop' });
  const wtB = wtOf(L, 'b');
  const other = await runQa(L, ['desktop', 'attach'], { cwd: wtB });
  assert.equal(other.status, 2, outputOf(other));
  assert.match(outputOf(other), /vm up desktop/);
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.equal(hostTools(L), 0);
});

test('route: other - a worktree never runs in another worktree\'s clone', async () => {
  const L = laneLayout();
  routedLease(L);
  const wtB = wtOf(L, 'b');
  const r = await runQa(L, ['preflight', 'ios'], { cwd: wtB });
  assert.equal(r.status, 2, outputOf(r));
  assert.equal(L.calls('ssh').filter((c) => !c.forward).length, 0);
  assert.deepEqual(L.lease(1).worktree, L.repo);
});

test('route: target - a lease that staged only ios refuses a desktop command naming vm up desktop', async () => {
  const L = laneLayout();
  routedLease(L, { target: 'ios' });
  const r = await runQa(L, ['desktop', 'attach']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /vm up desktop/);
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.deepEqual(busyLeft(L), []);
});

test('route: stopped - a clone that is not running exits 2 naming vm up and leaves no busy marker', async () => {
  const L = laneLayout();
  routedLease(L);
  L.setVmStatus('app-qa-slot-1', 'stopped');
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /vm up ios/);
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.equal(hostTools(L), 0);
  assert.deepEqual(busyLeft(L), []);
});

test('route: forward - a dead forward pid and a forward with no listener behind it each exit 2 naming vm up and run no guest driver', async () => {
  const dead = laneLayout();
  routedLease(dead, { forward: false });
  const lease = dead.lease(1);
  dead.writeLease(1, { ...lease, forward: { pid: await deadPid(), port: PORT } });
  const a = await runQa(dead, ['preflight', 'ios']);
  assert.equal(a.status, 2, outputOf(a));
  assert.match(outputOf(a), /vm up ios/);
  assert.equal(dead.gcalls('guest-driver').length, 0);
  assert.deepEqual(busyLeft(dead), []);
  const silent = laneLayout();
  routedLease(silent);
  silent.gset({ ncFails: true });
  const b = await runQa(silent, ['preflight', 'ios']);
  assert.equal(b.status, 2, outputOf(b));
  assert.match(outputOf(b), /vm up ios/);
  assert.equal(silent.gcalls('guest-driver').length, 0);
  assert.deepEqual(busyLeft(silent), []);
});

test('route: unreachable - ssh exiting 255 before the guest command exits 2 naming vm up and leaves no busy marker', async () => {
  const L = laneLayout();
  routedLease(L);
  L.setSsh({ connectFails: true });
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /vm up ios/);
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.equal(hostTools(L), 0);
  assert.deepEqual(busyLeft(L), []);
});

test('route: host - --host runs the host checks and no guest driver', async () => {
  const L = laneLayout();
  routedLease(L, { target: 'desktop' });
  const r = await runQa(L, ['preflight', 'desktop', '--host']);
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(r.lines.length, 4);
  assert.ok(L.calls('spectre').length > 0);
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.equal(L.calls('ssh').length, 0);
});

test('route: android - preflight android and scan run on the host with the lane active and no lease', async () => {
  const L = laneLayout();
  const r = await runQa(L, ['preflight', 'android']);
  assert.equal(r.status, 0, outputOf(r));
  assert.ok(L.calls('adb').length > 0);
  const evidence = join(L.root, 'evidence');
  mkdirSync(evidence);
  assert.equal((await runQa(L, ['scan', evidence])).status, 0);
  assert.equal(L.calls('ssh').length, 0);
});

/** The loss cases of design D7: each happens while the guest driver pauses, or after the guest command. */
const LOSSES = [
  ['forward killed', 'forward', async (L) => process.kill(L.lease(1).forward.pid, 'SIGKILL')],
  ['clone stopped', 'clone', async (L) => L.setVmStatus('app-qa-slot-1', 'stopped')],
  ['forward probe failing with its pid alive', 'forward', async (L) => L.gset({ ncFails: true })],
];

test('route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix', async () => {
  for (const [label, dep, lose] of LOSSES) {
    const L = laneLayout();
    routedLease(L, { pause: true });
    const run = startQa(L, ['preflight', 'ios']);
    await waitFor(join(L.guest.home, 'started'));
    await lose(L);
    writeFileSync(join(L.guest.home, 'release'), '');
    const r = await run.done;
    assert.equal(r.status, 2, `${label}: ${outputOf(r)}`);
    assert.match(r.lines[0], /^lane: /, label);
    assert.match(r.lines[1], new RegExp(`^lane: infrastructure lost during the run \\(${dep}\\); this is not an app result, run .*vm up ios`), `${label}: ${r.lines[1]}`);
    assert.ok(r.lines.includes('guest (not an app result): PASS guest check'), label);
    assert.equal(r.lines.filter((l) => l.startsWith('PASS')).length, 0, label);
    assert.deepEqual(busyLeft(L), [], label);
  }
  const L = laneLayout();
  routedLease(L);
  L.setSsh({ exit255: 'after' });
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(r.lines[1], /^lane: infrastructure lost during the run \(connection\)/);
  assert.ok(r.lines.includes('guest (not an app result): PASS guest check'));
  assert.equal(r.lines.filter((l) => l.startsWith('PASS')).length, 0);
});

test('route: peer-gone - a clone that vanishes without closing the routed command\'s connection ends the command within the keepalive bound: exit 2, the infrastructure line, the busy marker released', async () => {
  const L = laneLayout();
  routedLease(L, { pause: true });
  L.setSsh({ watchPeer: true, aliveSecondMs: 20 });
  const run = startQa(L, ['preflight', 'ios']);
  await waitFor(join(L.guest.home, 'started'));
  L.setVmStatus('app-qa-slot-1', 'stopped');
  L.setSsh({ peerGone: true });
  const r = await Promise.race([run.done, sleep(10000).then(() => null)]);
  if (r === null) {
    for (const c of L.calls('ssh').filter((c) => !c.forward)) {
      try {
        process.kill(c.pid, 'SIGKILL');
      } catch {}
    }
    run.child.kill('SIGKILL');
    await run.done;
  }
  assert.ok(r, 'the routed command still waited on its ssh 10 s after the guest vanished');
  assert.equal(r.status, 2, outputOf(r));
  assert.match(r.lines[1], /^lane: infrastructure lost during the run \(clone\)/, outputOf(r));
  assert.deepEqual(busyLeft(L), []);
});

test('route: lost - no guest line is printed before the guest command has ended, and the lines then appear in order', async () => {
  const L = laneLayout();
  routedLease(L, { pause: true, lines: [{ s: 'out', t: 'PASS first' }, { s: 'err', t: 'second' }] });
  const run = startQa(L, ['preflight', 'ios']);
  const stamps = [];
  run.child.stdout.on('data', (c) => stamps.push([Date.now(), String(c)]));
  await waitFor(join(L.guest.home, 'started'));
  await sleep(400);
  const released = Date.now();
  writeFileSync(join(L.guest.home, 'release'), '');
  const r = await run.done;
  assert.equal(r.status, 0, outputOf(r));
  const guestLines = stamps.filter(([, text]) => text.includes('PASS first'));
  assert.equal(guestLines.length, 1);
  assert.ok(guestLines[0][0] >= released, 'the guest line was printed before the guest command ended');
  assert.ok(stamps[0][1].startsWith('lane: '));
  assert.ok(r.lines.indexOf('PASS first') >= 0);
});

// ---------- route: argument and location translation (task 4.2) ----------

/** A staged lease whose host worktree and guest copy both hold `files` (relative path -> content). */
function routedFiles(L, files, opts = {}) {
  routedLease(L, opts);
  for (const [rel, content] of Object.entries(files)) {
    for (const base of [L.repo, L.guestCopy]) {
      mkdirSync(dirname(join(base, rel)), { recursive: true });
      writeFileSync(join(base, rel), content);
    }
  }
}
const guestCall = (L) => L.gcalls('guest-driver').at(-1);

test('route: quote - a text with spaces, quotes, $HOME, $(id) and ; reaches the guest driver as one byte-identical argument and runs no command', async () => {
  const L = laneLayout();
  routedFiles(L, { 'app_kmp/keep': 'x' }, { target: 'desktop' });
  const text = `a b "q" 'single' $HOME $(id) \`id\` ; touch ${join(L.root, 'pwned')} \\ & | > x`;
  const r = await runQa(L, ['desktop', 'type', 'login-field', text], { cwd: join(L.repo, 'app_kmp') });
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(guestCall(L).argv, ['desktop', 'type', 'login-field', text]);
  assert.equal(existsSync(join(L.root, 'pwned')), false);
  assert.equal(existsSync(join(L.guest.home, 'pwned')), false);
  const ssh = L.calls('ssh').filter((c) => !c.forward);
  assert.ok(ssh.every((c) => !c.argv.join(' ').includes('uid=')));
});

test('route: cwd - a run from app_kmp/ runs the guest driver in the guest copy\'s app_kmp/', async () => {
  const L = laneLayout();
  routedFiles(L, { 'app_kmp/keep': 'x' });
  const r = await runQa(L, ['preflight', 'ios'], { cwd: join(L.repo, 'app_kmp') });
  assert.equal(r.status, 0, outputOf(r));
  assert.equal(realpathSync(guestCall(L).cwd), realpathSync(join(L.guestCopy, 'app_kmp')));
  const root = await runQa(L, ['preflight', 'ios']);
  assert.equal(root.status, 0, outputOf(root));
  assert.equal(realpathSync(guestCall(L).cwd), realpathSync(L.guestCopy));
});

test('route: flowpath - a flow named by its path relative to app_kmp/ opens that same file of the guest copy, never a decoy, and an outside flow exits 2 with no ssh', async () => {
  const L = laneLayout();
  routedFiles(L, { 'app_kmp/maestro/signin.yaml': 'host\n' });
  writeFileSync(join(L.guestCopy, 'app_kmp/maestro/signin.yaml'), 'guest\n');
  mkdirSync(join(L.guestCopy, 'app_kmp/app_kmp/maestro'), { recursive: true });
  writeFileSync(join(L.guestCopy, 'app_kmp/app_kmp/maestro/signin.yaml'), 'decoy\n');
  const r = await runQa(L, ['flow', 'ios', 'maestro/signin.yaml'], { cwd: join(L.repo, 'app_kmp') });
  assert.equal(r.status, 0, outputOf(r));
  const call = guestCall(L);
  assert.deepEqual(call.argv, ['flow', 'ios', 'maestro/signin.yaml', '--out', call.argv[4]]);
  assert.equal(realpathSync(call.flowFile.path), realpathSync(join(L.guestCopy, 'app_kmp/maestro/signin.yaml')));
  assert.equal(call.flowFile.exists, true);
  const before = L.calls('ssh').length;
  const outside = join(L.root, 'outside.yaml');
  writeFileSync(outside, 'appId: x\n');
  const out = await runQa(L, ['flow', 'ios', outside], { cwd: join(L.repo, 'app_kmp') });
  assert.equal(out.status, 2, outputOf(out));
  assert.match(outputOf(out), /outside the worktree/);
  assert.equal(L.calls('ssh').length, before);
  assert.deepEqual(busyLeft(L), []);
});

test('route: flowsub - a flow named from a sibling folder through .. reaches the guest relative to the working directory and the same file opens', async () => {
  const L = laneLayout();
  routedFiles(L, { 'app_kmp/maestro/signin.yaml': 'host\n', 'app_kmp/other/keep': 'x' });
  const r = await runQa(L, ['flow', 'ios', '../maestro/signin.yaml'], { cwd: join(L.repo, 'app_kmp/other') });
  assert.equal(r.status, 0, outputOf(r));
  const call = guestCall(L);
  assert.equal(call.argv[2], '../maestro/signin.yaml');
  assert.equal(realpathSync(call.flowFile.path), realpathSync(join(L.guestCopy, 'app_kmp/maestro/signin.yaml')));
  const fromRoot = await runQa(L, ['flow', 'ios', 'app_kmp/maestro/signin.yaml']);
  assert.equal(fromRoot.status, 0, outputOf(fromRoot));
  assert.equal(guestCall(L).argv[2], 'app_kmp/maestro/signin.yaml');
});

test('route: config - --config exits 2 naming --host with no ssh call', async () => {
  const L = laneLayout();
  routedLease(L);
  const r = await runQa(L, ['preflight', 'ios', '--config', join(L.repo, '.omp', 'app-qa.json')]);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /--config.*--host/);
  assert.equal(L.calls('ssh').filter((c) => !c.forward).length, 0);
  assert.deepEqual(busyLeft(L), []);
});

test('route: credentials - --credentials exits 2 naming --host with no ssh call', async () => {
  const L = laneLayout();
  routedLease(L);
  const r = await runQa(L, ['flow', 'ios', repoFlow(L), '--credentials', join(L.repo, '.dev-credentials.env')]);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /--credentials.*--host/);
  assert.equal(L.calls('ssh').filter((c) => !c.forward).length, 0);
});

// ---------- route: output return (task 4.3) ----------

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');
const VALUES = [USER1, PW1];
/** Host files below `dirs` that hold a credential value of account 1 (the worktree's own credentials file excluded). */
const hostLeaks = (L, extra = []) => filesHolding([L.tmp, L.home, ...extra], VALUES);
/** The names of every entry below `dirs`, folders included. */
const entryNames = (dirs) => dirs.flatMap((d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map(String) : []));

test('route: redact - a guest line holding account 1\'s password is printed [redacted] and no output holds a value', async () => {
  const L = laneLayout();
  routedLease(L, { lines: [{ s: 'out', t: `typed ${PW1} for ${USER1}` }, { s: 'err', t: `err ${PW1}` }] });
  const r = await runQa(L, ['preflight', 'ios']);
  assert.equal(r.status, 0, outputOf(r));
  assert.ok(r.lines.includes('typed [redacted] for [redacted]'), r.stdout);
  assert.deepEqual(leaks(outputOf(r), VALUES), []);
});

test('route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line', async () => {
  const L = laneLayout();
  routedFiles(L, { 'flows/x.yaml': 'appId: x\n' }, {
    lines: [{ s: 'out', t: 'out: $OUT' }, { s: 'out', t: 'root kept: $TMP/app-qa-flow-abc' }, { s: 'out', t: 'guest copy $CWD' }],
    exit: 1,
  });
  L.driverCfg({
    started: '$HOME/started',
    lines: [{ s: 'out', t: 'out: $OUT' }, { s: 'out', t: 'root kept: $TMP/app-qa-flow-abc' }],
    files: [
      { dir: '$TMP', path: 'app-qa-flow-abc/note.log', content: `typed ${PW1}\n` },
      { dir: '$OUT', path: 'shot.json', content: JSON.stringify({ field: USER1 }) },
    ],
    exit: 1,
  });
  const r = await runQa(L, ['flow', 'ios', 'flows/x.yaml']);
  assert.equal(r.status, 1, outputOf(r));
  const root = valueAfter(r, 'root kept: ');
  const out = valueAfter(r, 'out: ');
  assert.equal(dirname(root), L.tmp);
  assert.equal(statSync(root).mode & 0o777, 0o700);
  assert.equal(readFileSync(join(root, 'note.log'), 'utf8'), 'typed [redacted]\n');
  assert.equal(readFileSync(join(out, 'shot.json'), 'utf8'), '{"field":"[redacted]"}');
  assert.ok(r.lines.some((l) => /^lane: .*vm up ios/.test(l)), r.stdout);
  assert.ok(!outputOf(r).includes(L.guest.dir), outputOf(r));
  assert.deepEqual(hostLeaks(L, [out, root]), []);
});

test('route: capture - a routed desktop capture lands its PNG and JSON in the host folder with host paths printed and the guest\'s exit code', async () => {
  const L = laneLayout();
  routedLease(L, { target: 'desktop' });
  L.driverCfg({
    started: '$HOME/started',
    lines: [{ s: 'out', t: 'capture: $OUT/commands.png' }, { s: 'out', t: 'capture: $OUT/commands.json' }],
    files: [
      { dir: '$OUT', path: 'commands.png', content: PNG_BYTES, base64: true },
      { dir: '$OUT', path: 'commands.json', content: '{"tree":"credential-free"}' },
    ],
  });
  const out = join(L.root, 'evidence');
  mkdirSync(out);
  const r = await runQa(L, ['desktop', 'capture', 'commands', '--out', out]);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(readFileSync(join(out, 'commands.png')), Buffer.from(PNG_BYTES, 'base64'));
  assert.equal(readFileSync(join(out, 'commands.json'), 'utf8'), '{"tree":"credential-free"}');
  assert.deepEqual(r.lines.filter((l) => l.startsWith('capture: ')), [`capture: ${join(out, 'commands.png')}`, `capture: ${join(out, 'commands.json')}`]);
  assert.ok(!outputOf(r).includes(L.guest.dir));
});

test('route: sweep - a capture named after account 1\'s username returns neither file, prints a sweep line with the name redacted and leaves no host path holding it', async () => {
  const L = laneLayout();
  routedLease(L, { target: 'desktop' });
  L.driverCfg({
    started: '$HOME/started',
    files: [
      { dir: '$OUT', path: `${USER1}.png`, content: PNG_BYTES, base64: true },
      { dir: '$OUT', path: `${USER1}.json`, content: '{}' },
      { dir: '$OUT', path: 'keep.json', content: '{"ok":1}' },
    ],
  });
  const out = join(L.root, 'evidence');
  mkdirSync(out);
  const r = await runQa(L, ['desktop', 'capture', USER1, '--out', out]);
  assert.equal(r.status, 0, outputOf(r));
  assert.deepEqual(readdirSync(out), ['keep.json']);
  assert.ok(r.lines.some((l) => /^sweep: deleted .*\[redacted\]/.test(l)), r.stdout);
  assert.deepEqual(leaks(outputOf(r), VALUES), []);
  assert.deepEqual(entryNames([L.tmp, L.home, out]).filter((n) => n.includes(USER1)), []);
});

test('route: noout - a passing flow without --out returns its screenshot to a printed new host folder and prints no guest path', async () => {
  const L = laneLayout();
  routedFiles(L, { 'flows/x.yaml': 'appId: x\n' });
  L.driverCfg({
    started: '$HOME/started',
    lines: [{ s: 'out', t: 'out: $OUT' }, { s: 'out', t: 'screenshot: $OUT/home.png' }, { s: 'out', t: 'PASS scenario 1s' }],
    files: [{ dir: '$OUT', path: 'home.png', content: PNG_BYTES, base64: true }],
  });
  const r = await runQa(L, ['flow', 'ios', 'flows/x.yaml']);
  assert.equal(r.status, 0, outputOf(r));
  const out = valueAfter(r, 'out: ');
  assert.equal(dirname(out), L.tmp);
  assert.match(out, /app-qa-out-/);
  assert.deepEqual(readFileSync(join(out, 'home.png')), Buffer.from(PNG_BYTES, 'base64'));
  assert.ok(r.lines.includes(`screenshot: ${join(out, 'home.png')}`));
  assert.ok(!outputOf(r).includes(L.guest.dir));
});

test('route: out - an existing flow --out and an existing capture file each exit 2 with no guest command, and a new --out receives the files', async () => {
  const L = laneLayout();
  routedFiles(L, { 'flows/x.yaml': 'appId: x\n' });
  const existing = join(L.root, 'existing');
  mkdirSync(existing);
  const f = await runQa(L, ['flow', 'ios', 'flows/x.yaml', '--out', existing]);
  assert.equal(f.status, 2, outputOf(f));
  assert.match(outputOf(f), /exists/);
  routedLease(L, { target: 'desktop' });
  writeFileSync(join(existing, 'commands.png'), 'old');
  const c = await runQa(L, ['desktop', 'capture', 'commands', '--out', existing]);
  assert.equal(c.status, 2, outputOf(c));
  assert.match(outputOf(c), /already exists/);
  assert.equal(readFileSync(join(existing, 'commands.png'), 'utf8'), 'old');
  assert.equal(L.gcalls('guest-driver').length, 0);
  assert.deepEqual(busyLeft(L), []);
  routedFiles(L, { 'flows/x.yaml': 'appId: x\n' }, { files: undefined });
  L.driverCfg({ started: '$HOME/started', files: [{ dir: '$OUT', path: 'home.png', content: PNG_BYTES, base64: true }] });
  const fresh = join(L.root, 'fresh');
  const ok = await runQa(L, ['flow', 'ios', 'flows/x.yaml', '--out', fresh]);
  assert.equal(ok.status, 0, outputOf(ok));
  assert.deepEqual(readdirSync(fresh), ['home.png']);
});

test('route: pack - vm pack sanitizes the whole folder before it writes the tar, so no member name holds a value', async () => {
  const L = laneLayout();
  routedLease(L);
  const dir = join(L.guest.tmp, 'pack-me');
  mkdirSync(dir);
  writeFileSync(join(dir, `${USER1}.png`), 'x');
  writeFileSync(join(dir, 'note.log'), `p ${PW1}\n`);
  writeFileSync(join(dir, 'fine.txt'), 'fine');
  const r = spawnSync(NODE, [join(L.guestDriver, 'qa-real.mjs'), 'vm', 'pack', dir], { cwd: L.guestCopy, env: L.guestEnv, encoding: 'buffer' });
  assert.equal(r.status, 0, String(r.stderr));
  const names = spawnSync('/usr/bin/tar', ['-tf', '-'], { input: r.stdout, encoding: 'utf8' }).stdout;
  assert.ok(names.includes('fine.txt') && names.includes('note.log'));
  assert.ok(!names.includes(USER1));
  assert.match(String(r.stderr), /sweep: deleted \[redacted\]/);
  assert.deepEqual(leaks(r.stdout.toString('latin1'), VALUES), []);
});

/** A routed capture whose guest files hold values and whose host return is held at an extraction point. */
async function heldReturn(L, when) {
  routedLease(L, { target: 'desktop' });
  L.driverCfg({
    started: '$HOME/started',
    files: [
      { dir: '$OUT', path: `${USER1}.png`, content: PNG_BYTES, base64: true },
      { dir: '$OUT', path: 'note.txt', content: `typed ${PW1}\n` },
    ],
  });
  const out = join(L.root, 'evidence');
  mkdirSync(out);
  const run = startQa(L, ['desktop', 'capture', 'c', '--out', out], { env: { FAKE_TAR_HOLD: when } });
  await waitFor(join(L.holds, `tar-x-${when}.held`));
  return { run, out };
}

for (const when of ['before', 'after']) {
  test(`route: interrupt - a host killed ${when} the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID`, async () => {
    const L = laneLayout();
    const { run, out } = await heldReturn(L, when);
    const returnDir = join(L.slotDir(1), `return-${run.child.pid}`);
    assert.equal(existsSync(join(returnDir, 'archive.tar')), true);
    assert.equal(statSync(join(returnDir, 'archive.tar')).mode & 0o777, 0o600);
    const members = spawnSync('/usr/bin/tar', ['-tf', join(returnDir, 'archive.tar')], { encoding: 'utf8' }).stdout;
    assert.ok(!members.includes(USER1), members);
    assert.deepEqual(hostLeaks(L, [out]), []);
    run.child.kill('SIGKILL');
    await run.done;
    assert.deepEqual(hostLeaks(L, [out]), []);
    assert.deepEqual(entryNames([L.tmp, L.home, out]).filter((n) => n.includes(USER1)), []);
    const status = await runQa(L, ['vm', 'status']);
    assert.equal(status.status, 0, outputOf(status));
    assert.equal(existsSync(returnDir), false);
  });
}

/** Guest archives the host must refuse whole, each with the guest-side control that builds it. */
const EVIL = [
  ['a .. component', (L) => ({ env: { FAKE_PACK_EVIL: 'dotdot' }, escaped: () => join(L.slotDir(1), 'escape') })],
  ['an absolute path', (L) => ({ env: { FAKE_PACK_EVIL: 'absolute', EVIL_ABS_DIR: join(L.root, 'evil-abs') }, escaped: () => join(L.root, 'evil-abs') })],
  ['a symlink', () => ({ cfg: { links: [{ dir: '$OUT', path: 'link', target: '/etc/hosts' }] } })],
  ['a FIFO', () => ({ cfg: { fifos: [{ dir: '$OUT', path: 'pipe' }] } })],
];

test('route: tar - a guest archive with .., an absolute path, a symlink or a FIFO is refused whole with nothing extracted', async () => {
  for (const [label, make] of EVIL) {
    const L = laneLayout();
    routedLease(L, { target: 'desktop' });
    const evil = make(L);
    L.driverCfg({ started: '$HOME/started', files: [{ dir: '$OUT', path: 'ok.txt', content: 'fine' }], ...(evil.cfg ?? {}) });
    if (evil.env) L.setSsh({ env: { ...L.guestEnv, ...evil.env } });
    const out = join(L.root, 'evidence');
    mkdirSync(out);
    const r = await runQa(L, ['desktop', 'capture', 'c', '--out', out]);
    assert.equal(r.status, 2, `${label}: ${outputOf(r)}`);
    assert.match(outputOf(r), /not returned/, label);
    assert.deepEqual(readdirSync(out), [], label);
    if (evil.escaped) assert.equal(existsSync(evil.escaped()), false, label);
    assert.equal(existsSync(join(L.slotDir(1), `return-${r.pid}`)), false, label);
    assert.deepEqual(busyLeft(L), [], label);
  }
});

test('route: root - a failing flow\'s kept root returns to a new 0700 host folder whose path replaces the guest path', async () => {
  const L = laneLayout();
  routedFiles(L, { 'flows/x.yaml': 'appId: x\n' });
  L.driverCfg({
    started: '$HOME/started',
    lines: [{ s: 'out', t: 'root kept: $TMP/app-qa-flow-zzz' }, { s: 'out', t: 'FAIL scenario' }],
    files: [{ dir: '$TMP', path: 'app-qa-flow-zzz/console.log', content: 'log\n' }],
    exit: 1,
  });
  const r = await runQa(L, ['flow', 'ios', 'flows/x.yaml']);
  assert.equal(r.status, 1, outputOf(r));
  const root = valueAfter(r, 'root kept: ');
  assert.equal(statSync(root).mode & 0o777, 0o700);
  assert.equal(readFileSync(join(root, 'console.log'), 'utf8'), 'log\n');
  assert.ok(!outputOf(r).includes('app-qa-flow-zzz'));
  assert.ok(r.lines.some((l) => /^lane: .*app-qa-slot-1.*vm up ios/.test(l)));
});

test('route: flowlock - two routed flows started together in one lease take the guest\'s one flow lock: one Maestro run, the other exits 2 naming the holder', async () => {
  const L = laneLayout();
  L.stage({ fakeDriver: false });
  mkdirSync(L.guestDriver, { recursive: true });
  copyFileSync(QA_SOURCE, join(L.guestDriver, 'qa.mjs'));
  cpSync(join(dirname(QA_SOURCE), 'vm'), join(L.guestDriver, 'vm'), { recursive: true });
  L.gset({ iosDevices: DEFAULT_STATE.iosDevices, maestro: { ...DEFAULT_STATE.maestro, sleepMs: 1500 } });
  for (const base of [L.repo, L.guestCopy]) {
    mkdirSync(join(base, 'flows'), { recursive: true });
    writeFileSync(join(base, 'flows', 'x.yaml'), 'appId: org.example.app\n---\n- assertVisible:\n    id: home\n');
  }
  const results = await Promise.all([0, 1].map(() => runQa(L, ['flow', 'ios', 'flows/x.yaml'])));
  assert.deepEqual(results.map((r) => r.status).sort(), [0, 2], results.map(outputOf).join('\n----\n'));
  assert.match(outputOf(results.find((r) => r.status === 2)), /another flow run holds the lock/);
  assert.equal(L.gcalls('maestro').filter((c) => c.argv?.[0] === 'test').length, 1);
});

// ---------- target: guest-side target start (task 3.2) ----------

test('target: ios - two vm up runs leave one simulator, created fresh the second time, with the app installed and WebKit warmed', async () => {
  const L = laneLayout();
  assert.equal((await L.up(['ios'])).status, 0);
  const first = L.gstate().sims;
  assert.equal(first.length, 1);
  assert.equal(first[0].name, 'app-qa-lane');
  assert.equal(first[0].deviceType, 'iPhone 17 Pro');
  assert.equal(first[0].state, 'Booted');
  assert.equal(first[0].installed.length, 1);
  assert.equal(realpathSync(first[0].installed[0]), realpathSync(join(L.guestCopy, 'build/App.app')));
  const second = await L.up(['ios']);
  assert.equal(second.status, 0, outputOf(second));
  const sims = L.gstate().sims;
  assert.equal(sims.length, 1);
  assert.notEqual(sims[0].udid, first[0].udid);
  assert.equal(sims[0].udid, 'LANE-SIM-2');
  const verbs = L.gcalls('xcrun').map((c) => c.argv.slice(1, 3));
  assert.ok(verbs.some(([v]) => v === 'delete'), 'the earlier simulator is deleted');
  const open = L.gcalls('xcrun').filter((c) => c.argv[1] === 'openurl');
  assert.equal(open.length, 2);
  assert.match(open[0].argv[3], new RegExp(`^http://127\\.0\\.0\\.1:${PORT}/`));
  assert.ok(L.gcalls('xcrun').some((c) => c.argv[1] === 'terminate' && c.argv[3] === 'com.apple.mobilesafari'));
});

test('target: ios - the app is launched last with the artifact\'s bundle id, after the WebKit warm, and without a backend right after the install', async () => {
  const L = laneLayout();
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  const calls = L.gcalls('xcrun').map((c) => c.argv.slice(1));
  const verbs = calls.map((c) => c[0]);
  const sim = L.gstate().sims[0].udid;
  assert.deepEqual(calls.at(-1), ['launch', '--terminate-running-process', sim, 'eu.onara.app.test']);
  assert.ok(verbs.lastIndexOf('terminate') < verbs.lastIndexOf('launch'));
  const plutil = L.gcalls('plutil');
  assert.equal(plutil.length, 1);
  assert.ok(plutil[0].argv.at(-1).endsWith('build/App.app/Info.plist'), plutil[0].argv.join(' '));
  const bare = laneLayout({ backend: false });
  assert.equal((await bare.up(['ios'])).status, 0);
  const seq = bare.gcalls('xcrun').map((c) => c.argv[1]);
  assert.equal(seq.includes('openurl'), false);
  assert.deepEqual(seq.slice(-2), ['install', 'launch']);
});

test('target: ios - a failing launch exits 2 naming the launch and stages no target', async () => {
  const L = laneLayout();
  L.gset({ launchFails: true });
  const r = await L.up(['ios']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(outputOf(r), /launch/);
  assert.deepEqual(L.lease(1).targets, []);
});

test('target: settle - the WebKit warm and the desktop start wait until the guest load falls below its CPU count', async () => {
  const L = laneLayout();
  L.gset({ ncpu: 8, loads: [76.4, 12, 7.5] });
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  const seq = L.gcalls().map((c) => (c.tool === 'xcrun' ? c.argv[1] : c.tool)).filter((t) => ['sysctl', 'install', 'openurl'].includes(t));
  assert.deepEqual(seq, ['install', 'sysctl', 'sysctl', 'sysctl', 'openurl']);
  assert.match(outputOf(r), /settle: load 7\.50 below 8 CPUs/);
  L.gset({ loads: [9, 3] });
  const d = await L.up(['desktop']);
  assert.equal(d.status, 0, outputOf(d));
  await waitUntil(() => L.gcalls('java').length === 1);
  const after = L.gcalls().map((c) => c.tool).filter((t) => t === 'sysctl' || t === 'java');
  assert.deepEqual(after.slice(-3), ['sysctl', 'sysctl', 'java']);
});

test('target: settle - a guest that never settles starts the target after the cap and says so', async () => {
  const L = laneLayout();
  L.setSsh({ env: { ...L.guestEnv, QA_TARGET_SETTLE_MS: '0' } });
  L.gset({ ncpu: 8, loads: [40] });
  const r = await L.up(['ios']);
  assert.equal(r.status, 0, outputOf(r));
  assert.match(outputOf(r), /settle: load 40\.00 still at or above 8 CPUs .*starting anyway/);
  assert.equal(L.gcalls('xcrun').at(-1).argv[1], 'launch');
});

test('target: desktop - two vm up runs leave one app process and the first is killed', async () => {
  const L = laneLayout();
  const up1 = await L.up(['desktop']);
  assert.equal(up1.status, 0, outputOf(up1));
  await waitUntil(() => L.gcalls('java').length === 1);
  const [first] = L.gcalls('java');
  assert.ok(isAlive(first.pid));
  const second = await L.up(['desktop']);
  assert.equal(second.status, 0, outputOf(second));
  await waitUntil(() => L.gcalls('java').length === 2);
  const javas = L.gcalls('java');
  assert.equal(javas.length, 2);
  await waitUntil(() => !isAlive(javas[0].pid));
  assert.ok(isAlive(javas[1].pid));
});

test('target: desktop-stop - a refresh starts the new app only after the old one has exited, and kills one that ignores SIGTERM', async () => {
  const L = laneLayout();
  L.gset({ javaTermMs: 3000 });
  assert.equal((await L.up(['desktop'])).status, 0);
  await waitUntil(() => L.gcalls('java').length === 1);
  const [first] = L.gcalls('java');
  const slow = await L.up(['desktop']);
  assert.equal(slow.status, 0, outputOf(slow));
  assert.equal(isAlive(first.pid), false, 'the slow predecessor is gone when vm up returns');
  await waitUntil(() => L.gcalls('java').length === 2);
  const order = L.gcalls().filter((c) => c.tool === 'java' || c.tool === 'java-exit').map((c) => `${c.tool}:${c.pid}`);
  const second = L.gcalls('java')[1];
  assert.ok(order.indexOf(`java-exit:${first.pid}`) !== -1 && order.indexOf(`java-exit:${first.pid}`) < order.indexOf(`java:${second.pid}`), order.join(' '));
  L.gset({ javaTermMs: 'ignore' });
  L.setSsh({ env: { ...L.guestEnv, QA_TARGET_STOP_MS: '300' } });
  const stubborn = await L.up(['desktop']);
  assert.equal(stubborn.status, 0, outputOf(stubborn));
  assert.equal(isAlive(second.pid), false, 'a predecessor ignoring SIGTERM is killed before vm up returns');
  await waitUntil(() => L.gcalls('java').length === 3);
  assert.ok(isAlive(L.gcalls('java')[2].pid));
});

test('target: desktop - the command line holds the classpath, both options in order, the headless flag, the property and the launchctl prefix', async () => {
  const L = laneLayout();
  const r = await L.up(['desktop']);
  assert.equal(r.status, 0, outputOf(r));
  const appDir = join(realpathSync(L.guestCopy), 'build/Onara.app/Contents/app');
  await waitUntil(() => L.gcalls('java').length === 1);
  const [java] = L.gcalls('java');
  assert.equal(java.argv.at(-1), 'eu.onara.app.MainKt');
  assert.deepEqual(java.argv.slice(java.argv.indexOf('-cp')), ['-cp', `${appDir}/onara.jar:${appDir}/lib/compose.jar`, 'eu.onara.app.MainKt']);
  const opts = java.argv.slice(0, java.argv.indexOf('-cp'));
  assert.equal(opts[0], '-Djava.awt.headless=false');
  assert.deepEqual(opts.filter((o) => ['-Dfirst=1', '-Xmx512m', `-Dapp.dir=${appDir}`].includes(o)), ['-Dfirst=1', '-Xmx512m', `-Dapp.dir=${appDir}`]);
  assert.ok(opts.includes(`-Donara.devCredentialsFile=${realpathSync(L.guestCopy)}/.dev-credentials.env`), opts.join(' '));
  assert.equal(realpathSync(java.cwd), realpathSync(L.guestCopy));
  assert.match(java.argv[0], /^-D|^-X/);
  const [launch] = L.gcalls('launchctl');
  assert.deepEqual(launch.argv.slice(0, 5), ['asuser', String(process.getuid()), 'sudo', '-u', launch.argv[4]]);
  assert.ok(L.gcalls('java_home').some((c) => c.argv.join(' ') === '-v 21'));
});

test('target: desktop - a launcher cfg without app.mainclass is refused by the host with exit 2 before any clone', async () => {
  const L = laneLayout();
  L.setControl({ artifacts: { ...BUILD_ARTIFACTS, desktop: { ...BUILD_ARTIFACTS.desktop, files: { 'Contents/app/Onara.cfg': '[Application]\napp.classpath=$APPDIR/onara.jar\n' } } } });
  const r = await L.up(['desktop']);
  assert.equal(r.status, 2, outputOf(r));
  assert.match(r.stdout, /app\.mainclass/);
  for (const verb of ['clone', 'run', 'stop', 'delete']) assert.equal(L.lumeCalls(verb).length, 0, verb);
  assert.deepEqual(L.slots(), []);
});

test('target: cfg - the reader ignores other sections and keys, expands $APPDIR and keeps repeated lines in order', async () => {
  const { parseLauncherCfg } = await import(pathToFileURL(join(dirname(QA_SOURCE), 'vm', 'start-target.mjs')).href);
  const cfg = parseLauncherCfg('[Other]\napp.mainclass=wrong\n\n[Application]\napp.version=1\napp.classpath=$APPDIR/a.jar\napp.classpath=$APPDIR/b.jar\napp.mainclass=x.Main\n\n[JavaOptions]\njava-options=-Da=1\njava-options=-Db=$APPDIR\n', '/d');
  assert.deepEqual(cfg, { classpath: ['/d/a.jar', '/d/b.jar'], mainClass: 'x.Main', javaOptions: ['-Da=1', '-Db=/d'] });
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

test('preflight: a given device that is not booted fails, naming the booted devices', async () => {
  const L = layout({ state: { iosDevices: [{ udid: 'SIM-1', name: 'A' }], androidDevices: ['emulator-5554'] } });
  const ios = await runQa(L, ['preflight', 'ios', '--device', 'SIM-9']);
  assert.equal(ios.status, 1);
  assert.equal(ios.lines[2], 'FAIL device: SIM-9 is not booted (booted: SIM-1 (A)) -- fix: pass --device ID');
  const android = await runQa(L, ['preflight', 'android', '--device', 'emulator-5556']);
  assert.equal(android.status, 1);
  assert.equal(android.lines[2], 'FAIL device: emulator-5556 is not booted (booted: emulator-5554) -- fix: pass --device ID');
  const listed = await runQa(L, ['preflight', 'ios', '--device', 'SIM-1']);
  assert.equal(listed.status, 0, listed.stdout);
  assert.equal(listed.lines[2], 'PASS device: SIM-1 (given)');
  L.set({ iosDevices: [], androidDevices: [] });
  const noneIos = await runQa(L, ['preflight', 'ios', '--device', 'SIM-1']);
  assert.equal(noneIos.status, 1);
  assert.equal(noneIos.lines[2], 'FAIL device: SIM-1 is not booted (booted: none) -- fix: boot a simulator (xcrun simctl boot NAME)');
  const noneAndroid = await runQa(L, ['preflight', 'android', '--device', 'emulator-5554']);
  assert.equal(noneAndroid.status, 1);
  assert.equal(noneAndroid.lines[2], 'FAIL device: emulator-5554 is not booted (booted: none) -- fix: start an emulator');
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

test('desktop: capture refuses a name whose PNG alone or JSON alone already exists', async () => {
  const L = await attached();
  for (const [kept, bytes] of [['home.json', '{"kept":true}\n'], ['home.png', 'kept png bytes']]) {
    const out = join(L.root, `evidence-${kept}`);
    mkdirSync(out);
    writeFileSync(join(out, kept), bytes);
    const r = await runQa(L, ['desktop', 'capture', 'home', '--out', out]);
    assert.equal(r.status, 2, kept);
    assert.deepEqual(readdirSync(out), [kept]);
    assert.equal(readFileSync(join(out, kept), 'utf8'), bytes);
  }
  assert.equal(spectreCalls(L, 'capture').length, 0);
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

/** Paths of every file and folder below `dir`, relative to it. */
function pathsBelow(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true, recursive: true }).map((e) => relative(dir, join(e.parentPath, e.name))).sort();
}

/** Asserts that no configured value of either foreign account, in any form, reached a sink of design D3, path names included. */
function assertNoForeignLeak(L, r, out) {
  const values = [ALPHA_USER, ALPHA_PW, BETA_USER, BETA_PW];
  assert.deepEqual(leaks(r.stdout + r.stderr, values), [], 'driver output');
  const root = valueAfter(r, 'root: ');
  for (const f of [...filesBelow(root), ...filesBelow(out)]) {
    const bytes = readFileSync(f, 'latin1');
    assert.deepEqual(leaks(bytes, values.map((v) => Buffer.from(v, 'utf8').toString('latin1'))), [], f);
  }
  for (const p of [...pathsBelow(root), ...pathsBelow(out)]) assert.deepEqual(leaks(p, values), [], `path ${p}`);
}

test('flow: sweep removes files and folders whose names hold a credential, failing and passing', async () => {
  for (const fail of [true, false]) {
    const L = layout({ fixture: 'foreign' });
    // Clean bytes throughout: only the names carry the values (beta is the selected account, alpha is not).
    L.maestro({ fail, failMessage: 'not there', shots: [{ file: `sign-in-${BETA_USER}.png` }, { file: 'menu.png' }], dirs: [ALPHA_PW] });
    const out = join(L.root, 'evidence');
    const r = await flow(L, ['--out', out]);
    assert.equal(r.status, 1, r.stdout);
    assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
    assert.ok(r.lines.includes(`sweep: deleted ${join('out', '2026-11-07_120000', 'scenario', '[redacted]')}`), r.stdout);
    if (!fail) {
      assert.ok(r.lines.includes('flow: screenshot sign-in-[redacted].png removed by the sweep'), r.stdout);
      assert.deepEqual(readdirSync(out), ['menu.png']);
    } else assert.equal(existsSync(valueAfter(r, 'root: ')), true);
    assertNoForeignLeak(L, r, out);
  }
});

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

test('flow: device a given device that is not booted is refused before the lock', async () => {
  const L = layout({ state: { iosDevices: [{ udid: 'SIM-1', name: 'A' }], androidDevices: ['emulator-5554'] } });
  const ios = await flow(L, ['--device', 'SIM-9']);
  assert.equal(ios.status, 2);
  assert.equal(ios.lines.at(-1), 'flow: SIM-9 is not booted (booted: SIM-1 (A))');
  const android = await runQa(L, ['flow', 'android', flowFile(L), '--device', 'emulator-5556']);
  assert.equal(android.status, 2);
  assert.equal(android.lines.at(-1), 'flow: emulator-5556 is not booted (booted: emulator-5554)');
  L.set({ iosDevices: [] });
  const none = await flow(L, ['--device', 'SIM-1']);
  assert.equal(none.status, 2);
  assert.equal(none.lines.at(-1), 'flow: SIM-1 is not booted (booted: none)');
  assert.equal(existsSync(lockPath(L)), false);
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

const caseShot = (file) => join('out', '2026-11-07_120000', 'scenario', 'takeScreenshot', file);
const caseRecord = join('out', '2026-11-07_120000', 'scenario', 'commands-(scenario).json');

test('flow: screenshot the flow and its subflow both naming home copy neither and fail the run', async () => {
  // The fake, like Maestro 2.12.1, leaves one home.png on disk: the subflow's overwrote the flow's.
  const L = layout({
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { sub: 'signin', file: 'home.png', data: 'b' }, { file: 'menu.png' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  assert.ok(r.lines.includes(`flow: screenshot home.png taken 2 times (${caseShot('home.png')} step 0, ${caseShot('home.png')} step 2 in signin.yaml)`), r.stdout);
  assert.ok(r.lines.includes(`screenshot: ${join(out, 'menu.png')}`));
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
});

test('flow: screenshot a clash stays a clash when the sweep removed its one file', async () => {
  const L = layout({
    fixture: 'foreign',
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { sub: 'signin', file: 'home.png', data: 'pw' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), []);
  assert.ok(r.lines.some((l) => l.startsWith('flow: screenshot home.png taken 2 times (')), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assertNoForeignLeak(L, r, out);
});

test('flow: screenshot two files named home in different folders copy neither and fail the run', async () => {
  const L = layout({
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { dir: 'other', file: 'home.png', data: 'b' }, { file: 'menu.png' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  const other = join('out', '2026-11-07_120000', 'scenario', 'other', 'takeScreenshot', 'home.png');
  assert.ok(r.lines.includes(`flow: screenshot home.png taken 2 times (${caseShot('home.png')} step 0, ${other} step 1)`), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
});

test('flow: screenshot two files named home in different folders, one swept, export neither', async () => {
  const L = layout({
    fixture: 'foreign',
    state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png' }, { dir: 'other', file: 'home.png', data: 'pw' }] } },
  });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), []);
  assert.ok(r.lines.some((l) => l.startsWith('flow: screenshot home.png taken 2 times (')), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assertNoForeignLeak(L, r, out);
});

test('flow: screenshot an unreadable command record fails a passing run', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, named: true, badRecord: true } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.lines.includes(`flow: screenshot record unreadable: ${caseRecord}`), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
});

test('flow: screenshot a recorded screenshot with no file fails the run', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'gone.png', noFile: true }, { file: 'menu.png' }] } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  assert.ok(r.lines.includes(`flow: screenshot gone.png missing (${caseShot('gone.png')} step 0)`), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
});

test('flow: screenshot a named screenshot the sweep removes fails the run', async () => {
  const L = layout({ fixture: 'foreign', state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png', data: 'pw' }, { file: 'menu.png' }] } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(readdirSync(out), ['menu.png']);
  assert.ok(r.lines.includes('flow: screenshot home.png removed by the sweep'), r.stdout);
  assert.ok(r.lines.includes(`sweep: deleted ${caseShot('home.png')}`), r.stdout);
  assert.equal(r.lines.some((l) => l.startsWith('PASS')), false);
  assert.equal(existsSync(valueAfter(r, 'root: ')), false);
  assertNoForeignLeak(L, r, out);
});

test('flow: screenshot a short username alone in a named screenshot is exported', async () => {
  const L = layout({ state: { maestro: { ...DEFAULT_STATE.maestro, shots: [{ file: 'home.png', data: 'user' }] } } });
  const out = join(L.root, 'evidence');
  const r = await flow(L, ['--out', out, '--credentials', shortUserCredentials(L.root)]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(readdirSync(out), ['home.png']);
  assert.ok(readFileSync(join(out, 'home.png')).includes(Buffer.from([0, ...Buffer.from(SHORT_USER), 0])));
  assert.ok(r.lines.some((l) => l.startsWith('PASS')), r.stdout);
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

test('scan: a short value alone in a binary file is not a hit, a password in one is', async () => {
  const L = layout({ fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'short.png'), Buffer.concat([PNG, Buffer.from([0]), Buffer.from(SHORT_USER), Buffer.from([0])]));
  writeFileSync(join(folder, 'password.png'), Buffer.concat([PNG, Buffer.from([0]), Buffer.from(PW1)]));
  const r = await runQa(L, ['scan', folder, '--credentials', shortUserCredentials(L.root)]);
  assert.equal(r.status, 1, r.stdout);
  assert.deepEqual(r.lines, [join(folder, 'password.png')]);
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

test('scan: a clean file whose name holds a password is a hit, printed with the value redacted', async () => {
  const L = layout({ fixture: 'foreign', fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(join(folder, `by-${BETA_USER}`), { recursive: true });
  writeFileSync(join(folder, 'clean.log'), 'nothing to see\n');
  writeFileSync(join(folder, `${ALPHA_PW}.log`), 'nothing to see\n');
  writeFileSync(join(folder, `by-${BETA_USER}`, 'clean.log'), 'nothing to see\n');
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 1);
  assert.deepEqual(r.lines, [join(folder, '[redacted].log'), join(folder, 'by-[redacted]', 'clean.log')]);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  const file = await runQa(L, ['scan', join(folder, `${ALPHA_PW}.log`)]);
  assert.equal(file.status, 1);
  assert.deepEqual(file.lines, [join(folder, '[redacted].log')]);
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

for (const [fixture, config] of [
  ['foreign', undefined],
  ['minimal', { ...CONFIGS.minimal, scan: { sentinels: ['CANARY'] } }],
]) {
  test(`scan: a sentinel in a matching file's name or folder is redacted (${fixture})`, async () => {
    const L = layout({ fixture, config, fakes: [] });
    const folder = join(L.root, 'evidence');
    mkdirSync(join(folder, 'CANARY-run'), { recursive: true });
    writeFileSync(join(folder, 'CANARY.log'), `access ${TOKEN}\n`);
    writeFileSync(join(folder, 'CANARY-run', 'run.log'), `access ${TOKEN}\n`);
    const r = await runQa(L, ['scan', folder]);
    assert.equal(r.status, 1, r.stderr);
    assert.deepEqual(r.lines, [join(folder, '[redacted]-run', 'run.log'), join(folder, '[redacted].log')]);
    assert.doesNotMatch(r.stdout + r.stderr, /CANARY/);
    assert.deepEqual(leaks(r.stdout + r.stderr), []);
  });
}

test('scan: a symbolic link is not followed but reported as not scanned', async () => {
  const L = layout({ fixture: 'minimal', fakes: [] });
  const outside = join(L.root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.log'), `access ${TOKEN}\n`);
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'nothing to see\n');
  writeFileSync(join(folder, 'token.log'), `access ${TOKEN}\n`);
  symlinkSync(join(outside, 'secret.log'), join(folder, 'latest.log'));
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 2, r.stdout);
  assert.deepEqual(r.lines, [join(folder, 'token.log'), `scan: not scanned: ${join(folder, 'latest.log')}`]);
  assert.deepEqual(leaks(r.stdout + r.stderr), []);
  const link = await runQa(L, ['scan', join(folder, 'latest.log')]);
  assert.equal(link.status, 2, link.stdout);
  assert.deepEqual(link.lines, [`scan: not scanned: ${join(folder, 'latest.log')}`]);
  assert.deepEqual(leaks(link.stdout + link.stderr), []);
});

test('scan: a FIFO is reported as not scanned without being opened', { timeout: 15000 }, async () => {
  const L = layout({ fixture: 'minimal', fakes: [] });
  const folder = join(L.root, 'evidence');
  mkdirSync(folder);
  writeFileSync(join(folder, 'clean.log'), 'nothing to see\n');
  assert.equal(spawnSync('mkfifo', [join(folder, 'pipe')]).status, 0);
  const r = await runQa(L, ['scan', folder]);
  assert.equal(r.status, 2, r.stdout);
  assert.deepEqual(r.lines, [`scan: not scanned: ${join(folder, 'pipe')}`]);
});

// ---------- CLI ----------

test('config: usage lines name the deployed driver', async () => {
  const L = layout({ fakes: [] });
  const r = await runQa(L, ['nonsense']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage: node ~\/\.omp\/agent\/skills\/app-qa-drivers\/scripts\/qa\.mjs /);
});
