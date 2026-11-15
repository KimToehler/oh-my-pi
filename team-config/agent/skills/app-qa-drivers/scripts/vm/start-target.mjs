#!/usr/bin/env node
// Guest-side target start of the VM lane (openspec change app-qa-vm-lane, design D6). Runs inside the leased clone, in
// the guest copy of the worktree, through one SSH command per target. Node builtins only.
//   node start-target.mjs ios --artifact REL --device-type TYPE [--port N]
//   node start-target.mjs desktop --artifact REL
// ios: deletes the lane's earlier simulator, creates one of TYPE on the guest's iOS runtime, boots it, installs the
// artifact and, with a backend and --port, opens its health URL once to warm WebKit and terminates Safari, then launches the
// app (`simctl launch --terminate-running-process`, bundle id from the artifact's Info.plist).
// desktop: kills the recorded app pid, reads the distributable's launcher cfg and starts it on JDK 21 in the console
// session. The pid is recorded under ~/.app-qa-lane/ (outside the TMPDIR state a refresh resets).
// QA_TARGET_WARM_MS (default 8000) is how long Safari keeps the health page open before it is terminated.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SIM_NAME = 'app-qa-lane';

/**
 * The launcher cfg reader (design "Build vs. adopt: launcher cfg reader"): `[Application]` `app.classpath` and
 * `app.mainclass`, `[JavaOptions]` `java-options`, `$APPDIR` expanded to `appDir`; other sections and keys are ignored,
 * repeated lines keep their order. Returns `{ classpath, mainClass, javaOptions }` or throws on a missing main class.
 */
export function parseLauncherCfg(text, appDir) {
  const expand = (v) => v.replaceAll('$APPDIR', appDir);
  const out = { classpath: [], mainClass: null, javaOptions: [] };
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const head = /^\[(.+)\]$/.exec(line);
    if (head) {
      section = head[1];
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = expand(line.slice(eq + 1).trim());
    if (section === 'Application' && key === 'app.classpath') out.classpath.push(...value.split(delimiter).filter(Boolean));
    else if (section === 'Application' && key === 'app.mainclass') out.mainClass = value;
    else if (section === 'JavaOptions' && key === 'java-options') out.javaOptions.push(value);
  }
  if (!out.mainClass) throw new Error('the launcher cfg names no app.mainclass');
  return out;
}

/** Reads the `Contents/app/*.cfg` of a distributable folder `artifact`; throws when there is none or it names no main class. */
export function readLauncherCfg(artifact) {
  const appDir = join(artifact, 'Contents', 'app');
  let cfg;
  try {
    cfg = readdirSync(appDir).filter((f) => f.endsWith('.cfg')).sort()[0];
  } catch {}
  if (!cfg) throw new Error(`${appDir} holds no launcher cfg`);
  return parseLauncherCfg(readFileSync(join(appDir, cfg), 'utf8'), appDir);
}

const recordDir = () => join(homedir(), '.app-qa-lane');
const recordFile = (target) => join(recordDir(), `${target}.json`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const fail = (line) => {
  process.stderr.write(`start-target: ${line}\n`);
  process.exit(1);
};

function which(cmd) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return join(dir, cmd);
  }
  return null;
}

const simctl = (...args) => spawnSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });

function startIos(flags) {
  const list = simctl('list', 'devices', '--json');
  if (list.status !== 0) fail('xcrun simctl list devices failed');
  for (const devices of Object.values(JSON.parse(list.stdout).devices ?? {})) {
    for (const d of devices) if (d.name === SIM_NAME) simctl('delete', d.udid);
  }
  const rt = simctl('list', 'runtimes', '--json');
  const runtime = JSON.parse(rt.stdout || '{}').runtimes?.find((r) => r.platform === 'iOS' && r.isAvailable);
  if (!runtime) fail('no iOS runtime is installed in the guest');
  const created = simctl('create', SIM_NAME, flags['device-type'], runtime.identifier);
  const udid = created.stdout.trim();
  if (created.status !== 0 || !udid) fail(`xcrun simctl create ${flags['device-type']} failed: ${created.stderr.trim()}`);
  for (const step of [['boot', udid], ['bootstatus', udid, '-b']]) {
    if (simctl(...step).status !== 0) fail(`xcrun simctl ${step[0]} failed`);
  }
  if (simctl('install', udid, resolve(flags.artifact)).status !== 0) fail(`xcrun simctl install ${flags.artifact} failed`);
  return udid;
}

/** Launches the installed app, terminating a running instance; the bundle id is read from the artifact's Info.plist. */
function launchApp(udid, artifact) {
  const plist = join(resolve(artifact), 'Info.plist');
  const id = spawnSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], { encoding: 'utf8' });
  const bundle = id.stdout.trim();
  if (id.status !== 0 || !bundle) fail(`cannot read CFBundleIdentifier from ${plist}`);
  const r = simctl('launch', '--terminate-running-process', udid, bundle);
  if (r.status !== 0) fail(`xcrun simctl launch ${bundle} failed: ${r.stderr.trim()}`);
}

async function warmWebKit(udid, url) {
  simctl('openurl', udid, url);
  await pause(Number(process.env.QA_TARGET_WARM_MS ?? 8000));
  simctl('terminate', udid, 'com.apple.mobilesafari');
}

function stopRecorded(target) {
  try {
    const { pid } = JSON.parse(readFileSync(recordFile(target), 'utf8'));
    if (pid) process.kill(pid, 'SIGTERM');
  } catch {}
  rmSync(recordFile(target), { force: true });
}

async function startDesktop(flags, config) {
  stopRecorded('desktop');
  let cfg;
  try {
    cfg = readLauncherCfg(resolve(flags.artifact));
  } catch (e) {
    fail(e.message);
  }
  const javaHome = spawnSync(which('java_home') ?? '/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' }).stdout.trim();
  if (!javaHome) fail('no JDK 21 in the guest');
  const credentials = config.credentials ? resolve(config.credentials.file) : '';
  const props = Object.entries(config.vm.desktop.systemProperties ?? {}).map(([k, v]) => `-D${k}=${v.replaceAll('{credentials}', credentials)}`);
  const user = userInfo().username;
  const pidFile = join(recordDir(), 'desktop.pid');
  rmSync(pidFile, { force: true });
  // `sh -c` records its own pid, then becomes the JVM: the recorded pid is the app, owned by the console user.
  const launch = ['sh', '-c', 'echo $$ > "$0" && exec "$@"', pidFile, join(javaHome, 'bin', 'java'), '-Djava.awt.headless=false', ...cfg.javaOptions, ...props, '-cp', cfg.classpath.join(delimiter), cfg.mainClass];
  const child = spawn('sudo', ['launchctl', 'asuser', String(process.getuid()), 'sudo', '-u', user, ...launch], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 100; i++) {
    if (existsSync(pidFile) && readFileSync(pidFile, 'utf8').trim()) break;
    await pause(100);
  }
  const pid = Number(existsSync(pidFile) ? readFileSync(pidFile, 'utf8').trim() : 0);
  if (!pid || !alive(pid)) fail('the desktop app did not start');
  writeFileSync(recordFile('desktop'), `${JSON.stringify({ pid })}\n`);
  return pid;
}

async function main(argv) {
  const [target, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) flags[rest[i].replace(/^--/, '')] = rest[i + 1];
  if (!['ios', 'desktop'].includes(target) || !flags.artifact) fail('usage: start-target.mjs ios|desktop --artifact REL [--device-type TYPE] [--port N]');
  mkdirSync(recordDir(), { recursive: true });
  const config = JSON.parse(readFileSync(join(process.cwd(), '.omp', 'app-qa.json'), 'utf8'));
  if (target === 'ios') {
    if (!flags['device-type']) fail('ios needs --device-type');
    const udid = startIos(flags);
    if (config.backend && flags.port) await warmWebKit(udid, config.backend.healthUrl.replaceAll('{port}', flags.port));
    launchApp(udid, flags.artifact);
    process.stdout.write(`ios: ${udid}\n`);
  } else {
    process.stdout.write(`desktop: pid ${await startDesktop(flags, config)}\n`);
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
