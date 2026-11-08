#!/usr/bin/env node
// Shared QA driver for Compose Multiplatform apps: the desktop app through Spectre, the iOS simulator and the Android
// emulator through Maestro (openspec change app-qa-shared-driver). Run it from inside an app repository or worktree:
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop|ios|android [--port N] [--device ID]
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach [--pid N]
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap TAG | type TAG TEXT | wait TAG [--timeout S]
//                                                                  | find TAG [--equals TEXT]
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture NAME --out DIR | detach
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios|android FLOW [--account ID] [--expect SCREEN]
//                                                          [--device ID] [--out DIR] [--credentials FILE]
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan PATH [--credentials FILE]
// Every command also takes --config FILE. Without it the configuration is .omp/app-qa.json at the root of the
// repository holding the working directory; it is validated strictly (schema app-qa/1) before anything else runs.
// Exit: 0 pass, 1 a check, action or flow failed or the scan found a file, 2 usage, configuration or refused start.
// No npm dependencies. Drivers: Spectre 0.9.0 (desktop) and Maestro 2.12.1 (ios, android), both external.
// Dev credentials come from the configured file at the main checkout's root (or --credentials), reach only Maestro's
// environment, and every line this script prints passes one redaction of the configured accounts' values and tokens.
// Redaction, scan and sweep match a password anywhere and a username only as a whole word, never inside a longer word.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'app-qa/1';
export const SPECTRE_VERSION = '0.9.0';
export const SPECTRE_SHA256 = '7bee663dbf4e7b8b089bd989cf93c327a2dbc4afa894c997f4407e18ad73371b';
export const MAESTRO_VERSION = '2.12.1';
const INVOKE = 'node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs';
const SPECTRE_HINT =
  `download spectre-macosArm64.zip from https://github.com/rock3r/spectre/releases/tag/v${SPECTRE_VERSION}, ` +
  `check its sha256 is ${SPECTRE_SHA256}, unzip it and put spectre on PATH (not brew: the tap tracks the newest release)`;
const MAESTRO_HINT = `curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=${MAESTRO_VERSION} bash`;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.mp4', '.mov']);
const RESTRICTED_WARNING =
  /^WARNING: (A restricted method in |java\.lang\.System::load has been called|Use --enable-native-access|Restricted methods will be blocked)/;
const DEV_VARS = ['MAESTRO_DEV_USER', 'MAESTRO_DEV_PW'];
const EXPECT_VAR = 'MAESTRO_EXPECT_TAG';

// ---------- processes ----------

function which(cmd) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, cmd);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

/** The real path of the worktree holding `dir`, or null outside a Git worktree or when Git cannot read it. */
function worktreeOf(dir) {
  const r = run('git', ['-C', dir, 'rev-parse', '--show-toplevel']);
  if (r.error || r.status !== 0 || !r.stdout.trim()) return null;
  try {
    return realpathSync(r.stdout.trim());
  } catch {
    return null;
  }
}

/** The main checkout's root for `dir` (a linked worktree resolves to the main checkout), or null outside Git. */
function mainCheckoutOf(dir) {
  const r = run('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (r.error || r.status !== 0 || !r.stdout.trim()) return null;
  return dirname(r.stdout.trim());
}

// ---------- configuration ----------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sub = (path, key) => (path ? `${path}.${key}` : key);

const nonEmpty = (v, p, e) => {
  if (typeof v !== 'string' || v === '') e.push(`${p}: expected a non-empty string`);
};
const matching = (re, what) => (v, p, e) => {
  if (typeof v !== 'string' || !re.test(v)) e.push(`${p}: expected ${what}`);
};
const envKey = matching(/^[A-Za-z_][A-Za-z0-9_]*$/, 'an environment-style key name');
const relPath = (v, p, e) => {
  if (typeof v !== 'string' || v === '' || isAbsolute(v) || v.split(/[\\/]+/).includes('..')) {
    e.push(`${p}: expected a path relative to the repository without ..`);
  }
};
const port = (v, p, e) => {
  if (!Number.isInteger(v) || v < 1 || v > 65535) e.push(`${p}: expected a port number from 1 to 65535`);
};
const healthUrl = (v, p, e) => {
  if (typeof v !== 'string' || !/^https?:\/\//.test(v) || !v.includes('{port}')) e.push(`${p}: expected an http URL containing {port}`);
};
const stringList = (v, p, e) => {
  if (!Array.isArray(v) || v.length === 0 || v.some((s) => typeof s !== 'string' || s === '')) {
    e.push(`${p}: expected a list of non-empty strings`);
  }
};

/** An object holding exactly the given fields: `fields` maps a key to [required, check]. */
const section = (fields) => (v, p, e) => {
  if (!isObject(v)) {
    e.push(`${p || 'the configuration'}: expected an object`);
    return;
  }
  for (const key of Object.keys(v)) if (!Object.hasOwn(fields, key)) e.push(`${sub(p, key)}: unknown key`);
  for (const [key, [required, check]] of Object.entries(fields)) {
    if (Object.hasOwn(v, key)) check(v[key], sub(p, key), e);
    else if (required) e.push(`${sub(p, key)}: missing`);
  }
};

/** A non-empty object whose keys are names and whose values pass `check`. */
const named = (check) => (v, p, e) => {
  if (!isObject(v) || Object.keys(v).length === 0) {
    e.push(`${p}: expected an object with at least one entry`);
    return;
  }
  for (const [key, value] of Object.entries(v)) {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) e.push(`${sub(p, key)}: expected a name of letters, digits, - and _`);
    check(value, sub(p, key), e);
  }
};

const CONFIG_SHAPE = section({
  schema: [true, () => {}],
  name: [true, matching(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens')],
  desktop: [false, section({ mainClass: [true, nonEmpty], launchHint: [true, nonEmpty] })],
  backend: [
    false,
    section({
      healthUrl: [true, healthUrl],
      defaultPort: [true, port],
      portProperty: [false, section({ file: [true, relPath], key: [true, nonEmpty] })],
      startHint: [true, nonEmpty],
    }),
  ],
  credentials: [
    false,
    section({
      file: [true, relPath],
      accounts: [true, named(section({ user: [true, envKey], password: [true, envKey] }))],
      defaultAccount: [true, nonEmpty],
    }),
  ],
  expect: [false, section({ default: [true, nonEmpty], tags: [true, named(nonEmpty)] })],
  android: [false, section({ sdkProperties: [true, relPath] })],
  scan: [false, section({ sentinels: [true, stringList] })],
});

/** The causes that make `config` not a valid app-qa/1 configuration; empty when it is valid. */
export function configErrors(config) {
  if (!isObject(config)) return ['the configuration: expected an object'];
  if (config.schema !== SCHEMA) {
    const id = typeof config.schema === 'string' ? config.schema : JSON.stringify(config.schema ?? null);
    return [`schema ${id} is not ${SCHEMA}, the schema this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it`];
  }
  const errors = [];
  CONFIG_SHAPE(config, '', errors);
  if (errors.length) return errors;
  const { credentials, expect } = config;
  if (credentials && !Object.hasOwn(credentials.accounts, credentials.defaultAccount)) {
    errors.push(`credentials.defaultAccount: ${JSON.stringify(credentials.defaultAccount)} is not in credentials.accounts`);
  }
  if (expect && !Object.hasOwn(expect.tags, expect.default)) {
    errors.push(`expect.default: ${JSON.stringify(expect.default)} is not in expect.tags`);
  }
  return errors;
}

/**
 * The configuration in force: `--config`, else `.omp/app-qa.json` at the root of the worktree holding the working
 * directory. `worktree` is that worktree's real path (null outside Git); `root` resolves configured repository paths.
 */
function loadConfig(flags) {
  const cwd = process.cwd();
  const worktree = worktreeOf(cwd);
  let path;
  if (flags.config !== undefined) path = resolve(flags.config);
  else if (worktree) path = join(worktree, '.omp', 'app-qa.json');
  else return { error: `config: no configuration: ${cwd} is not in a git checkout; pass --config FILE` };
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    return { error: `config: ${path}: ${e.code === 'ENOENT' ? 'missing' : `unreadable (${e.code ?? 'error'})`}` };
  }
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return { error: `config: ${path}: not valid JSON` };
  }
  const errors = configErrors(config);
  if (errors.length) return { error: errors.map((cause) => `config: ${path}: ${cause}`).join('\n') };
  const real = realpathSync(path);
  return { path, real, config, worktree, root: worktree ?? dirname(dirname(real)) };
}

// ---------- credentials and redaction ----------

/** `KEY=VALUE` lines as the apps' dev sign-in reads them: trimmed, one pair of matching quotes stripped, last non-empty wins. */
export function parseCredentials(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const key = line.slice(0, line.indexOf('=')).trim();
    let value = line.slice(line.indexOf('=') + 1).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) value = value.slice(1, -1);
    if (value) values[key] = value;
  }
  return values;
}

/** The values of every key of every configured account, selected or not: the one input of redaction, sweep and scan. */
export function credentialValues(config, parsed) {
  const users = [];
  const passwords = [];
  for (const account of Object.values(config.credentials?.accounts ?? {})) {
    if (Object.hasOwn(parsed, account.user)) users.push(parsed[account.user]);
    if (Object.hasOwn(parsed, account.password)) passwords.push(parsed[account.password]);
  }
  return { users, passwords };
}

const NO_VALUES = { users: [], passwords: [] };
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** XML's spellings of the five characters it escapes: raw, the named entity, the decimal and the hex reference. */
const XML_FORMS = {
  '&': ['&amp;', '&#38;', '&#x26;'],
  '<': ['&lt;', '&#60;', '&#x3c;', '&#x3C;'],
  '>': ['&gt;', '&#62;', '&#x3e;', '&#x3E;'],
  '"': ['&quot;', '&#34;', '&#x22;'],
  "'": ['&apos;', '&#39;', '&#x27;'],
};

/** A form as a pattern that also matches it XML-escaped, as Maestro's JUnit report holds a failure text. */
const xmlFlexible = (form) =>
  [...form].map((c) => (XML_FORMS[c] ? `(?:${[c, ...XML_FORMS[c]].map(escapeRegExp).join('|')})` : escapeRegExp(c))).join('');

/**
 * One pattern for every value raw and JSON-escaped, each also XML-escaped, longest first so a value containing another
 * is replaced whole. A password matches anywhere; a username only where neither neighbour is an ASCII letter or digit,
 * because a short one occurs inside ordinary words. `encode` maps a form to the alphabet the pattern runs on (latin1
 * bytes for files).
 */
export function credentialPattern({ users, passwords }, encode = (s) => s) {
  const forms = [];
  for (const [values, word] of [[passwords, false], [users, true]]) {
    for (const v of values) {
      for (const form of new Set([v, JSON.stringify(v).slice(1, -1)])) if (form) forms.push({ form: encode(form), word });
    }
  }
  if (forms.length === 0) return null;
  forms.sort((a, b) => b.form.length - a.form.length);
  const alternatives = forms.map(({ form, word }) =>
    word ? `(?<![A-Za-z0-9])${xmlFlexible(form)}(?![A-Za-z0-9])` : xmlFlexible(form),
  );
  return new RegExp(alternatives.join('|'), 'g');
}

/**
 * A JWT starts with `eyJ` (base64 of `{"`). Redaction and the scan of a text file take the prefix itself, with the run
 * of base64url and `.` characters after it, so a flagged text file is clean once redacted.
 */
const TOKEN = /eyJ[A-Za-z0-9_.-]*/g;

/** In a binary file the three bytes occur by chance in image data, so there the prefix needs ten token characters. */
const BINARY_TOKEN = /eyJ[A-Za-z0-9_-]{10,}/g;

/** Compiled once per values object: `say` and the console sink redact every driver line. */
const patterns = new WeakMap();

export function redact(text, values) {
  if (!patterns.has(values)) patterns.set(values, credentialPattern(values));
  const pattern = patterns.get(values);
  const out = pattern ? text.replace(pattern, '[redacted]') : text;
  return out.replace(TOKEN, '[redacted]');
}

/** The credentials file: `--credentials`, else the configured file at the working directory's main checkout. */
function credentialsPath(ctx, flag) {
  if (flag !== undefined) return resolve(flag);
  const main = mainCheckoutOf(process.cwd());
  return main ? join(main, ctx.config.credentials.file) : null;
}

function loadCredentials(path) {
  if (!path) return { error: 'no credentials file: not in a git checkout; pass --credentials FILE' };
  try {
    return { path, parsed: parseCredentials(readFileSync(path, 'utf8')) };
  } catch {
    return { path, error: `cannot read credentials file ${path}` };
  }
}

let redactValues = NO_VALUES;
const say = (line) => process.stdout.write(redact(line, redactValues) + '\n');
const complain = (line) => process.stderr.write(redact(line, redactValues) + '\n');

/** Redacts every printed line with the configured accounts' values, when the credentials file can be read. */
function loadRedaction(ctx) {
  if (!ctx.config.credentials) return;
  const loaded = loadCredentials(credentialsPath(ctx));
  if (loaded.parsed) redactValues = credentialValues(ctx.config, loaded.parsed);
}

// ---------- scan ----------

const isText = (buf) => !buf.subarray(0, 8000).includes(0);

/** A form's UTF-8 bytes as a latin1 string, so a pattern over `buf.toString('latin1')` matches byte for byte. */
const asBytes = (s) => Buffer.from(s, 'utf8').toString('latin1');

/** Whether a file's bytes hold a token, a credential (`pattern`) or one of the `extra` literal terms. */
export function fileHit(buf, pattern, extra = []) {
  for (const term of extra) if (buf.includes(Buffer.from(term, 'utf8'))) return true;
  const bytes = buf.toString('latin1');
  if (pattern) {
    pattern.lastIndex = 0;
    if (pattern.test(bytes)) return true;
  }
  const token = isText(buf) ? TOKEN : BINARY_TOKEN;
  token.lastIndex = 0;
  return token.test(bytes);
}

function* walkFiles(path) {
  const st = lstatSync(path);
  if (st.isSymbolicLink()) return;
  if (st.isFile()) {
    yield path;
    return;
  }
  if (!st.isDirectory()) return;
  for (const entry of readdirSync(path).sort()) yield* walkFiles(join(path, entry));
}

/** Whether a path, relative to the folder it was found in, holds a credential (`pattern`, the redaction pattern). */
export function pathHit(rel, pattern) {
  if (!pattern) return false;
  pattern.lastIndex = 0;
  return pattern.test(rel);
}

/**
 * Paths of the files below `path` whose contents hold a token, a credential value or one of the `extra` literal terms,
 * or whose path relative to `path` (a file by its own name) holds a credential value.
 */
export function scanPaths(path, values, extra = []) {
  const pattern = credentialPattern(values, asBytes);
  const names = credentialPattern(values);
  const base = lstatSync(path).isDirectory() ? path : dirname(path);
  return [...walkFiles(path)].filter((f) => pathHit(relative(base, f), names) || fileHit(readFileSync(f), pattern, extra));
}

/** Redacts a flagged text file in place or deletes a flagged binary file; returns what it did. */
function neutralize(file, values) {
  const buf = readFileSync(file);
  if (isText(buf)) {
    writeFileSync(file, redact(buf.toString('utf8'), values));
    return 'redacted';
  }
  unlinkSync(file);
  return 'deleted';
}

function cmdScan(ctx, args) {
  const [target] = args.positional;
  if (!target || args.positional.length !== 1) return usage('scan PATH [--credentials FILE]');
  let values = NO_VALUES;
  if (ctx.config.credentials) {
    const creds = loadCredentials(credentialsPath(ctx, args.flags.credentials));
    if (creds.error) {
      complain(`scan: ${creds.error}`);
      return 2;
    }
    values = credentialValues(ctx.config, creds.parsed);
    redactValues = values;
    if (values.users.length + values.passwords.length === 0) {
      complain(`scan: no configured credential value in ${creds.path}`);
      return 2;
    }
    complain(`credentials: ${creds.path}`);
  } else if (args.flags.credentials !== undefined) {
    complain(`scan: --credentials needs a credentials section in ${ctx.path}`);
    return 2;
  }
  let hits;
  try {
    hits = scanPaths(target, values, ctx.config.scan?.sentinels ?? []);
  } catch {
    complain(`scan: cannot read ${target}`);
    return 2;
  }
  for (const hit of hits) say(hit);
  return hits.length ? 1 : 0;
}

// ---------- devices ----------

function resolveMaestro() {
  return which('maestro') ?? (existsSync(join(homedir(), '.maestro/bin/maestro')) ? join(homedir(), '.maestro/bin/maestro') : null);
}

/** adb from ADB, then PATH, then sdk.dir in the configured Android SDK properties file. */
function resolveAdb(ctx) {
  if (process.env.ADB) return existsSync(process.env.ADB) ? process.env.ADB : null;
  const onPath = which('adb');
  if (onPath) return onPath;
  const props = ctx.config.android?.sdkProperties;
  if (!props) return null;
  try {
    const sdk = /^\s*sdk\.dir\s*=(.*)$/m.exec(readFileSync(join(ctx.root, props), 'utf8'))?.[1]?.trim();
    const adb = sdk && join(sdk, 'platform-tools/adb');
    return adb && existsSync(adb) ? adb : null;
  } catch {
    return null;
  }
}

/** Booted iOS simulators as `udid (name)`; null when xcrun cannot list them. */
function iosDevices() {
  const r = run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
  if (r.error || r.status !== 0) return null;
  try {
    return Object.values(JSON.parse(r.stdout).devices ?? {})
      .flat()
      .filter((d) => d.state === 'Booted')
      .map((d) => ({ id: d.udid, label: `${d.udid} (${d.name})` }));
  } catch {
    return null;
  }
}

function androidDevices(adb) {
  if (!adb) return null;
  const r = run(adb, ['devices']);
  if (r.error || r.status !== 0) return null;
  return r.stdout
    .split(/\r?\n/)
    .map((l) => /^(\S+)\tdevice$/.exec(l.trim())?.[1])
    .filter(Boolean)
    .map((id) => ({ id, label: id }));
}

/** The one device to use: the given one, else the only booted one. */
export function chooseDevice(given, devices) {
  if (given) return { id: given };
  if (devices.length === 1) return { id: devices[0].id };
  if (devices.length === 0) return { error: 'no booted device' };
  return { error: `${devices.length} booted devices (${devices.map((d) => d.label).join(', ')}); pass --device ID` };
}

/** Pids of Maestro `test` runs in `ps -Ao pid=,args=` output. */
export function maestroTestPids(psOutput) {
  return psOutput
    .split(/\r?\n/)
    .map((l) => /^\s*(\d+)\s+(.*)$/.exec(l))
    .filter((m) => m && /(?:^|[\s/])maestro(?:\.cli\.AppKt)?\s(?:.*\s)?test(?:\s|$)/.test(m[2]))
    .map((m) => Number(m[1]));
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// ---------- preflight ----------

function backendPort(ctx, flag) {
  if (flag !== undefined) return Number(flag);
  const { portProperty, defaultPort } = ctx.config.backend;
  if (portProperty) {
    try {
      const text = readFileSync(join(ctx.root, portProperty.file), 'utf8');
      const m = new RegExp(`^\\s*${escapeRegExp(portProperty.key)}\\s*=\\s*(\\d+)\\s*$`, 'm').exec(text);
      if (m) return Number(m[1]);
    } catch {}
  }
  return defaultPort;
}

/**
 * Healthy is HTTP 2xx and, when the body is a JSON object with a `status` key, that key holding exactly the string `UP`.
 * A 2xx body that is not JSON, not an object or has no `status` passes on the status code alone.
 */
async function backendCheck(ctx, port) {
  const url = ctx.config.backend.healthUrl.replaceAll('{port}', String(port));
  const hint = `start the backend (${ctx.config.backend.startHint}) or pass --port`;
  let res;
  let body;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    body = await res.text();
  } catch {
    return [false, `backend: ${url} unreachable`, hint];
  }
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {}
  const hasStatus = isObject(json) && Object.hasOwn(json, 'status');
  const status = hasStatus ? json.status : undefined;
  const shown = typeof status === 'string' ? status : `status ${JSON.stringify(status ?? null)}`;
  if (hasStatus && status !== 'UP') return [false, `backend: ${url} ${shown}`, hint];
  if (!res.ok) return [false, `backend: ${url} HTTP ${res.status}`, hint];
  return [true, `backend: ${url} ${hasStatus ? 'UP' : `HTTP ${res.status}`}`];
}

function maestroCheck() {
  const bin = resolveMaestro();
  if (!bin) return [false, 'driver: maestro not found', MAESTRO_HINT];
  const r = run(bin, ['--version']);
  const last = (r.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).at(-1) ?? '';
  if (r.error || !/^\d+\.\d+\.\d+$/.test(last)) return [false, 'driver: maestro version line unreadable', MAESTRO_HINT];
  if (last !== MAESTRO_VERSION) return [false, `driver: maestro ${last} (tested ${MAESTRO_VERSION})`, MAESTRO_HINT];
  return [true, `driver: maestro ${last}`];
}

function deviceCheck(given, devices, tool, bootHint) {
  if (devices === null) return [false, `device: not checked, ${tool} unavailable`, `fix ${tool} first`];
  const choice = chooseDevice(given, devices);
  if (choice.error) {
    const hint = devices.length === 0 ? bootHint : 'pass --device ID';
    return [false, `device: ${choice.error}`, hint];
  }
  return [true, `device: ${choice.id}${given ? ' (given)' : ''}`];
}

async function cmdPreflight(ctx, args) {
  const [target] = args.positional;
  const synopsis = 'preflight desktop|ios|android [--port N] [--device ID]';
  if (!['desktop', 'ios', 'android'].includes(target) || args.positional.length !== 1) return usage(synopsis);
  const port = args.flags.port;
  if (port !== undefined && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) return usage(synopsis);
  loadRedaction(ctx);
  const checks = [];
  if (target === 'desktop') {
    const spectreBin = which('spectre');
    if (!spectreBin) {
      checks.push([false, 'driver: spectre not found', SPECTRE_HINT]);
      checks.push([false, 'screen capture: not checked, spectre not found', 'install spectre (see the driver line)']);
    } else {
      const v = run(spectreBin, ['--version']);
      const version = /\b(\d+\.\d+\.\d+)\b/.exec(v.stdout ?? '')?.[1];
      if (v.status !== 0 || !version) checks.push([false, 'driver: spectre version unreadable', SPECTRE_HINT]);
      else if (version !== SPECTRE_VERSION) checks.push([false, `driver: spectre ${version} (tested ${SPECTRE_VERSION})`, SPECTRE_HINT]);
      else checks.push([true, `driver: spectre ${version}`]);
      const p = run(spectreBin, ['permissions', 'check', '--json']);
      let perm = null;
      try {
        perm = JSON.parse(p.stdout);
      } catch {}
      if (perm?.granted === true) checks.push([true, 'screen capture: granted']);
      else {
        const who = perm?.binary ? `for ${perm.binary}` : 'for the terminal';
        checks.push([false, 'screen capture: denied', `System Settings > Privacy & Security > Screen Recording: allow it ${who}`]);
      }
    }
    const io = run('ioreg', ['-n', 'Root', '-d1']);
    if (io.error || io.status !== 0) checks.push([false, 'screen: lock state unreadable (ioreg)', 'run on the macOS desktop session']);
    else if (/"CGSSessionScreenIsLocked"\s*=\s*Yes/.test(io.stdout)) checks.push([false, 'screen: locked', 'unlock the screen']);
    else checks.push([true, 'screen: unlocked']);
  } else if (target === 'ios') {
    checks.push(maestroCheck());
    const devices = which('xcrun') ? iosDevices() : null;
    checks.push(
      devices === null ? [false, 'tools: xcrun simctl unavailable', 'xcode-select --install'] : [true, 'tools: xcrun simctl'],
    );
    checks.push(deviceCheck(args.flags.device, devices, 'xcrun', 'boot a simulator (xcrun simctl boot NAME)'));
  } else {
    checks.push(maestroCheck());
    const adb = resolveAdb(ctx);
    const devices = androidDevices(adb);
    const props = ctx.config.android?.sdkProperties;
    const adbHint = props ? `put adb on PATH, set ADB, or set sdk.dir in ${props}` : 'put adb on PATH or set ADB';
    checks.push(devices === null ? [false, 'tools: adb unavailable', adbHint] : [true, `tools: adb ${adb}`]);
    checks.push(deviceCheck(args.flags.device, devices, 'adb', 'start an emulator'));
  }
  if (ctx.config.backend) checks.push(await backendCheck(ctx, backendPort(ctx, port)));
  for (const [ok, text, hint] of checks) say(ok ? `PASS ${text}` : `FAIL ${text} -- fix: ${hint}`);
  return checks.every(([ok]) => ok) ? 0 : 1;
}

// ---------- host-wide state ----------

const qaDir = () => join(tmpdir(), 'app-qa');
const sessionsDir = () => join(qaDir(), 'sessions');
export const lockDir = () => join(qaDir(), 'flow.lock');

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

// ---------- desktop ----------

/** Runs spectre; drops the JVM's restricted-method warnings, passes other stderr through, parses `--json` stdout. */
function spectre(args) {
  const r = run('spectre', args);
  if (r.error) {
    complain(`desktop: spectre not found; run ${INVOKE} preflight desktop`);
    return { status: 2, json: null };
  }
  const rest = (r.stderr ?? '').split(/\r?\n/).filter((l) => l && !RESTRICTED_WARNING.test(l));
  for (const line of rest) complain(line);
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { status: r.status, json };
}

/** One worktree's session record: keyed by the real path of its root, so worktrees and repositories never share one. */
const sessionFile = (worktree) => join(sessionsDir(), `${createHash('sha256').update(worktree).digest('hex').slice(0, 16)}.json`);

function readSession(worktree) {
  try {
    const record = JSON.parse(readFileSync(sessionFile(worktree), 'utf8'));
    return isObject(record) ? record : null;
  } catch {
    return null;
  }
}

/** The worktree a process's working directory belongs to (macOS lsof), or null when it cannot be read. */
function processWorktree(pid) {
  const lsof = which('lsof') ?? '/usr/sbin/lsof';
  const r = run(lsof, ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  if (r.error || r.status !== 0) return null;
  const dir = (r.stdout ?? '').split(/\r?\n/).find((l) => l.startsWith('n'))?.slice(1);
  return dir ? worktreeOf(dir) : null;
}

const nodeText = (node) => node.editableText ?? (node.texts ?? []).join(' ');

function findNodes(session, tag) {
  const r = spectre(['find', session, tag, '--json']);
  if (r.status !== 0 || !Array.isArray(r.json?.nodes)) return null;
  return r.json.nodes;
}

/** The one node carrying `tag`, or null after printing the tag and the match count. */
function oneNode(session, tag, verb) {
  const nodes = findNodes(session, tag);
  if (nodes === null) return null;
  if (nodes.length !== 1) {
    say(`${verb}: tag=${tag} count=${nodes.length}`);
    return null;
  }
  return nodes[0];
}

/**
 * Attaches to the one JVM of the configured main class whose working directory belongs to this worktree, by an exact
 * match of worktree roots: a linked worktree below the main checkout is another worktree.
 */
function desktopAttach(ctx, flags) {
  const { mainClass, launchHint } = ctx.config.desktop;
  if (flags.pid !== undefined && !/^\d+$/.test(flags.pid)) return usage('desktop attach [--pid N]');
  const ps = spectre(['ps', '--json']);
  if (ps.status !== 0 || !Array.isArray(ps.json?.processes)) return 1;
  const own = [];
  const other = [];
  for (const p of ps.json.processes) {
    if (p.displayName !== mainClass && !p.displayName?.startsWith(`${mainClass} `)) continue;
    const worktree = processWorktree(p.pid);
    if (worktree === ctx.worktree) own.push(p.pid);
    else other.push(`${p.pid} (${worktree === null ? 'working directory unreadable' : `in ${worktree}`})`);
  }
  const others = other.length ? `; other ${mainClass} JVMs: ${other.join(', ')}` : '';
  let pid;
  if (flags.pid !== undefined) {
    pid = Number(flags.pid);
    if (!own.includes(pid)) {
      say(`attach: pid ${pid} is not a ${mainClass} JVM of this worktree (${ctx.worktree})${others}`);
      return 2;
    }
  } else if (own.length === 0) {
    say(`attach: no ${mainClass} JVM in this worktree (${ctx.worktree}); start it with ${launchHint}${others}`);
    return 2;
  } else if (own.length > 1) {
    say(`attach: ${own.length} ${mainClass} JVMs in this worktree (pids ${own.join(', ')}); pass --pid N or stop all but one`);
    return 2;
  } else pid = own[0];
  const a = spectre(['attach', String(pid), '--json']);
  const session = a.json?.sessionId;
  if (a.status !== 0 || !session) return 1;
  ensureDir(sessionsDir());
  const record = { root: ctx.worktree, config: ctx.real, mainClass, pid, session };
  writeFileSync(sessionFile(ctx.worktree), `${JSON.stringify(record)}\n`, { mode: 0o600 });
  say(`attach: pid=${pid} session=${session}`);
  return 0;
}

function desktopCapture(session, args) {
  const [name] = args.positional;
  const out = args.flags.out;
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name) || !out) return usage('desktop capture NAME --out DIR');
  const png = join(resolve(out), `${name}.png`);
  const json = join(resolve(out), `${name}.json`);
  if (existsSync(png) || existsSync(json)) {
    say(`capture: ${name}.png or ${name}.json already exists in ${out}`);
    return 2;
  }
  const tmp = mkdtempSync(join(tmpdir(), 'app-qa-capture-'));
  try {
    const r = spectre(['capture', session, '--out-dir', tmp, '--json']);
    const { screenshotPng: shot, captureJson: tree } = r.json ?? {};
    if (r.status !== 0 || !shot || !tree) return 1;
    mkdirSync(resolve(out), { recursive: true });
    copyFileSync(shot, png, constants.COPYFILE_EXCL);
    copyFileSync(tree, json, constants.COPYFILE_EXCL);
    say(`capture: ${png}`);
    say(`capture: ${json}`);
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function cmdDesktop(ctx, args) {
  const [verb, ...rest] = args.positional;
  const sub = { ...args, positional: rest };
  if (!['attach', 'tap', 'type', 'wait', 'find', 'capture', 'detach'].includes(verb)) {
    return usage('desktop attach|tap|type|wait|find|capture|detach');
  }
  if (!ctx.config.desktop) {
    say(`desktop: ${ctx.path} has no desktop section`);
    return 2;
  }
  if (!ctx.worktree) {
    say(`desktop: ${process.cwd()} is not in a git worktree; run desktop commands inside the app's worktree`);
    return 2;
  }
  loadRedaction(ctx);
  if (verb === 'attach') return rest.length ? usage('desktop attach [--pid N]') : desktopAttach(ctx, args.flags);
  const record = readSession(ctx.worktree);
  if (!record) {
    say(`${verb}: no attached session for this worktree; run ${INVOKE} desktop attach`);
    return 2;
  }
  if (record.root !== ctx.worktree || record.config !== ctx.real || record.mainClass !== ctx.config.desktop.mainClass) {
    say(`${verb}: attached with ${record.config} for ${record.mainClass}; attach again`);
    return 2;
  }
  const { session } = record;
  if (verb === 'capture') return desktopCapture(session, sub);
  if (verb === 'detach') {
    const r = spectre(['detach', session, '--json']);
    rmSync(sessionFile(ctx.worktree), { force: true });
    if (r.status !== 0) return 1;
    say(`detach: session=${session}`);
    return 0;
  }
  const [tag, text] = rest;
  if (!tag) return usage(`desktop ${verb} TAG`);
  if (verb === 'tap') {
    if (rest.length !== 1) return usage('desktop tap TAG');
    const node = oneNode(session, tag, 'tap');
    if (!node) return 1;
    if (spectre(['click', session, node.key, '--json']).status !== 0) return 1;
    say(`tap: tag=${tag}`);
    return 0;
  }
  if (verb === 'find') {
    if (rest.length !== 1) return usage('desktop find TAG [--equals TEXT]');
    const nodes = findNodes(session, tag);
    if (nodes === null) return 1;
    if (nodes.length !== 1) {
      say(`find: tag=${tag} count=${nodes.length}`);
      return 1;
    }
    const node = nodes[0];
    const value = nodeText(node);
    let line = `tag=${tag} count=1 enabled=${!node.isDisabled} focused=${Boolean(node.isFocused)} textLength=${value.length}`;
    const expected = args.flags.equals;
    if (expected !== undefined) line += ` equals=${value === expected}`;
    say(line);
    return expected === undefined || value === expected ? 0 : 1;
  }
  if (verb === 'wait') {
    if (rest.length !== 1) return usage('desktop wait TAG [--timeout S]');
    const seconds = Number(args.flags.timeout ?? 10);
    if (!(seconds > 0)) return usage('desktop wait TAG [--timeout S]');
    const w = spectre(['wait-for-node', session, '--tag', tag, '--timeout-ms', String(Math.round(seconds * 1000)), '--json']);
    const nodes = findNodes(session, tag);
    if (nodes === null) return 1;
    if (w.status !== 0) {
      say(`wait: tag=${tag} timed out after ${seconds}s, last count=${nodes.length}`);
      return 1;
    }
    say(`wait: tag=${tag} count=${nodes.length}`);
    return nodes.length === 1 ? 0 : 1;
  }
  // type
  if (rest.length !== 2) return usage('desktop type TAG TEXT');
  const node = oneNode(session, tag, 'type');
  if (!node) return 1;
  for (const step of [
    ['click', session, node.key],
    ['press-key', session, 'Cmd+A'],
    ['press-key', session, 'BackSpace'],
    ['type', session, text],
  ]) {
    if (spectre([...step, '--json']).status !== 0) return 1;
  }
  const after = oneNode(session, tag, 'type');
  if (!after) return 1;
  const actual = after.editableText ?? '';
  if (actual !== text) {
    say(`type: tag=${tag} text differs: expected length ${text.length}, actual length ${actual.length}`);
    return 1;
  }
  say(`type: tag=${tag} textLength=${actual.length}`);
  return 0;
}

// ---------- flow ----------

/**
 * `testcase@time` and the failure text of a single-testcase JUnit report: `failure@message`, else the element's body
 * (Maestro 2.12.1 writes the body); null unless it holds exactly one testcase.
 */
export function readJunit(xml) {
  const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)];
  if (cases.length !== 1) return null;
  const decode = (s) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const time = Number(/\btime="([^"]*)"/.exec(cases[0][1])?.[1]);
  const failure = /<(failure|error)\b([^>]*?)(?:\/>|>(?:([\s\S]*?)<\/\1>)?)/.exec(cases[0][2] ?? '');
  const text = failure && (/\bmessage="([^"]*)"/.exec(failure[2])?.[1] ?? failure[3]?.trim());
  const message = failure ? (text ? decode(text) : 'failed') : null;
  return { time: Number.isFinite(time) ? time : null, failed: Boolean(failure), message };
}

/**
 * Takes the host-wide flow lock with one atomic mkdir, then writes the configuration's name and the holder's pid. Every
 * reader parses `pid` alone, so an app script that writes only `pid` and this driver read each other's locks alike.
 */
function acquireLock(name) {
  ensureDir(qaDir());
  try {
    mkdirSync(lockDir());
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    return describeLock();
  }
  writeFileSync(join(lockDir(), 'name'), `${name}\n`);
  writeFileSync(join(lockDir(), 'pid'), `${process.pid}\n`);
  return null;
}

const lockPid = () => Number(readFileSync(join(lockDir(), 'pid'), 'utf8').trim()) || null;

/** Why the existing lock refuses this run: a live holder, or a stale lock left for removal by hand. */
function describeLock() {
  let pid = null;
  // A starting holder creates the directory before it writes its pid.
  for (let i = 0; i < 10 && pid === null; i++) {
    try {
      pid = lockPid();
    } catch {}
    if (pid === null) sleepSync(100);
  }
  if (pid !== null && alive(pid)) {
    let name = '';
    try {
      name = readFileSync(join(lockDir(), 'name'), 'utf8').trim();
    } catch {}
    return `flow: another flow run holds the lock (pid ${pid}${name ? `, ${name}` : ''}); wait for it to finish`;
  }
  const why = pid === null ? 'it names no pid' : `pid ${pid} is not running`;
  return `flow: stale lock ${lockDir()} (${why}); remove it by hand: rm -r '${lockDir()}'`;
}

function releaseLock() {
  try {
    if (lockPid() === process.pid) rmSync(lockDir(), { recursive: true, force: true });
  } catch {}
}

function* walkAll(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) {
      yield* walkAll(p);
      yield { path: p, dir: true, name: entry.name };
    } else if (entry.isFile()) yield { path: p, dir: false, name: entry.name };
  }
}

/** Maestro's command records, which hold every typed value and are deleted by the sweep. */
const RECORD = /^commands.*\.json$/;

/**
 * Removes Maestro's step screenshots and hierarchies (every image too after a failure) and its command records, then
 * every file and folder whose path below the root holds a credential, then redacts or deletes each file that still
 * holds a credential or token. Returns the printed sweep lines; `say` redacts a value in a printed path.
 */
export function sweepRoot(root, values, failed) {
  const lines = [];
  const rel = (p) => relative(root, p);
  for (const e of [...walkAll(root)]) {
    if (e.dir && (e.name === 'screenshots' || e.name === 'screen-hierarchy')) rmSync(e.path, { recursive: true, force: true });
  }
  for (const e of [...walkAll(root)]) {
    if (e.dir) continue;
    if (RECORD.test(e.name)) {
      unlinkSync(e.path);
      lines.push(`sweep: deleted ${rel(e.path)}`);
    } else if (failed && IMAGE_EXT.has(extname(e.name).toLowerCase())) unlinkSync(e.path);
  }
  // A flagged folder's contents are flagged too; only the topmost flagged path of each branch is removed and printed.
  const names = credentialPattern(values);
  for (const e of [...walkAll(root)]) {
    if (!pathHit(rel(e.path), names) || pathHit(rel(dirname(e.path)), names)) continue;
    rmSync(e.path, { recursive: true, force: true });
    lines.push(`sweep: deleted ${rel(e.path)}`);
  }
  for (const file of scanPaths(root, values)) lines.push(`sweep: ${neutralize(file, values)} ${rel(file)}`);
  return lines;
}

/**
 * The named screenshots of the run by file name, read before the sweep from Maestro's command records below `outRoot`:
 * Maestro 2.12.1 writes a flow's and its subflows' screenshots of one name to one file, so only the records count
 * them. Each source is the screenshot's path relative to `root` with the step (and subflow) that took it, and whether
 * its file existed; a `takeScreenshot/` file no record names adds a source of its own. Returns the manifest and the
 * records that could not be read.
 */
function namedScreenshots(outRoot, root) {
  const byName = new Map();
  const unreadable = [];
  if (!existsSync(outRoot)) return { byName, unreadable };
  const add = (path, src) => {
    const name = basename(path);
    byName.set(name, [...(byName.get(name) ?? []), { path, src, present: existsSync(path) }]);
  };
  const all = [...walkAll(outRoot)].filter((e) => !e.dir).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const recorded = new Set();
  for (const e of all.filter((f) => RECORD.test(f.name))) {
    let entries;
    try {
      entries = JSON.parse(readFileSync(e.path, 'utf8'));
    } catch {
      entries = null;
    }
    if (!Array.isArray(entries)) {
      unreadable.push(e.path);
      continue;
    }
    const subflows = [];
    for (const entry of entries) {
      const meta = entry?.metadata ?? {};
      const depth = Number.isInteger(meta.depth) ? meta.depth : 0;
      const run = entry?.command?.runFlowCommand;
      if (run) subflows[depth + 1] = run.sourceDescription ?? null;
      for (const a of meta.artifacts ?? []) {
        if (a?.type !== 'TAKE_SCREENSHOT' || typeof a.path !== 'string') continue;
        const path = join(dirname(e.path), a.path);
        recorded.add(path);
        const sub = depth > 0 && subflows[depth] ? ` in ${subflows[depth]}` : '';
        add(path, `${relative(root, path)} step ${meta.sequenceNumber}${sub}`);
      }
    }
  }
  for (const e of all) {
    if (basename(dirname(e.path)) === 'takeScreenshot' && !recorded.has(e.path)) add(e.path, relative(root, e.path));
  }
  return { byName, unreadable };
}

/**
 * Copies each named screenshot to `out` under its file name and reports every one it could not: an unreadable record
 * (a clash cannot be ruled out), a name taken more than once (none of them copied), one whose file Maestro never
 * wrote, one the sweep removed, a copy error, and a copy that holds a credential or token.
 * Returns whether every named screenshot was copied.
 */
function exportScreenshots({ byName, unreadable }, root, out, values) {
  const pattern = credentialPattern(values, asBytes);
  let complete = unreadable.length === 0;
  for (const record of unreadable) say(`flow: screenshot record unreadable: ${relative(root, record)}`);
  for (const [file, sources] of byName) {
    if (sources.length > 1) {
      say(`flow: screenshot ${file} taken ${sources.length} times (${sources.map((s) => s.src).join(', ')})`);
      complete = false;
      continue;
    }
    const [source] = sources;
    if (!source.present) {
      say(`flow: screenshot ${file} missing (${source.src})`);
      complete = false;
      continue;
    }
    if (!existsSync(source.path)) {
      say(`flow: screenshot ${file} removed by the sweep`);
      complete = false;
      continue;
    }
    const target = join(out, file);
    try {
      copyFileSync(source.path, target, constants.COPYFILE_EXCL);
    } catch (e) {
      say(`flow: screenshot ${file} not copied: ${e.code ?? 'error'}`);
      complete = false;
      continue;
    }
    if (fileHit(readFileSync(target), pattern)) {
      unlinkSync(target);
      say(`sweep: deleted ${file}`);
      complete = false;
      continue;
    }
    say(`screenshot: ${target}`);
  }
  return complete;
}

/** Splits a stream into lines (the last at end) so a value written in two pieces is redacted whole. */
function lineSink(onLine) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    },
    end() {
      if (buf) onLine(buf);
      buf = '';
    },
  };
}

async function cmdFlow(ctx, args) {
  const [platform, flowArg] = args.positional;
  const synopsis = 'flow ios|android FLOW [--account ID] [--expect SCREEN] [--device ID] [--out DIR] [--credentials FILE]';
  if (!['ios', 'android'].includes(platform) || !flowArg || args.positional.length !== 2) return usage(synopsis);
  const { credentials, expect } = ctx.config;
  if (!credentials) {
    for (const flag of ['account', 'credentials']) {
      if (args.flags[flag] !== undefined) {
        say(`flow: --${flag} needs a credentials section in ${ctx.path}`);
        return 2;
      }
    }
  }
  if (!expect && args.flags.expect !== undefined) {
    say(`flow: --expect needs an expect section in ${ctx.path}`);
    return 2;
  }
  const account = credentials ? (args.flags.account ?? credentials.defaultAccount) : null;
  if (credentials && !Object.hasOwn(credentials.accounts, account)) {
    say(`flow: account ${account} is not in credentials.accounts of ${ctx.path} (accounts: ${Object.keys(credentials.accounts).join(', ')})`);
    return 2;
  }
  const screen = expect ? (args.flags.expect ?? expect.default) : null;
  if (expect && !Object.hasOwn(expect.tags, screen)) {
    say(`flow: screen ${screen} is not in expect.tags of ${ctx.path} (screens: ${Object.keys(expect.tags).join(', ')})`);
    return 2;
  }
  const flow = resolve(flowArg);
  if (!existsSync(flow)) {
    say(`flow: ${flowArg} not found`);
    return 2;
  }

  const env = { ...process.env };
  for (const name of [...DEV_VARS, EXPECT_VAR]) delete env[name];
  if (credentials) {
    const creds = loadCredentials(credentialsPath(ctx, args.flags.credentials));
    if (creds.error) {
      say(`flow: ${creds.error}`);
      return 2;
    }
    redactValues = credentialValues(ctx.config, creds.parsed);
    say(`credentials: ${creds.path}`);
    const keys = credentials.accounts[account];
    for (const key of [keys.user, keys.password]) {
      if (!creds.parsed[key]) {
        say(`flow: ${key} is missing in ${creds.path}`);
        return 2;
      }
    }
    env.MAESTRO_DEV_USER = creds.parsed[keys.user];
    env.MAESTRO_DEV_PW = creds.parsed[keys.password];
  }
  if (expect) env[EXPECT_VAR] = expect.tags[screen];

  const maestro = resolveMaestro();
  if (!maestro) {
    say(`flow: maestro not found; run ${INVOKE} preflight ${platform}`);
    return 2;
  }
  const devices = platform === 'ios' ? iosDevices() : androidDevices(resolveAdb(ctx));
  if (devices === null && !args.flags.device) {
    say(`flow: cannot list ${platform} devices; run ${INVOKE} preflight ${platform}`);
    return 2;
  }
  const device = chooseDevice(args.flags.device, devices ?? []);
  if (device.error) {
    say(`flow: ${device.error}`);
    return 2;
  }
  const outFlag = args.flags.out ? resolve(args.flags.out) : null;
  if (outFlag && existsOrLink(outFlag)) {
    say(`flow: --out ${outFlag} exists; name a directory that does not exist yet`);
    return 2;
  }

  const refused = acquireLock(ctx.config.name);
  if (refused) {
    say(refused);
    return 2;
  }
  let root = null;
  let child = null;
  let interrupted = null;
  const onSignal = (signal) => {
    interrupted = signal;
    if (child) child.kill('SIGTERM');
    else {
      releaseLock();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    const ps = run('ps', ['-Ao', 'pid=,args=']);
    if (ps.error || ps.status !== 0) {
      say('flow: cannot list processes (ps)');
      return 2;
    }
    const unlocked = maestroTestPids(ps.stdout);
    if (unlocked.length) {
      say(`flow: a Maestro test run without the lock is running (pid ${unlocked.join(', ')}); wait for it or stop it`);
      return 2;
    }
    let out = outFlag;
    if (out) {
      try {
        mkdirSync(out);
      } catch (e) {
        say(e.code === 'EEXIST' ? `flow: --out ${out} exists; name a directory that does not exist yet` : `flow: cannot create --out ${out}`);
        return 2;
      }
    } else out = mkdtempSync(join(tmpdir(), 'app-qa-out-'));
    root = mkdtempSync(join(tmpdir(), 'app-qa-flow-'));
    chmodSync(root, 0o700);
    say(`device: ${device.id}`);
    say(`root: ${root}`);
    say(`out: ${out}`);

    const consoleLog = join(root, 'console.log');
    writeFileSync(consoleLog, '');
    const keep = (line) => appendFileSync(consoleLog, redact(line, redactValues) + '\n');
    // The JVM's own temporary files (the iOS driver's .xctestrun, xcodebuild's derived data) go into the root too.
    const jvmTmp = join(root, 'tmp');
    mkdirSync(jvmTmp);
    env.MAESTRO_OPTS = [process.env.MAESTRO_OPTS, `"-Djava.io.tmpdir=${jvmTmp}"`].filter(Boolean).join(' ');
    const report = join(root, 'report.xml');
    const argv = ['test', '--no-ansi', '--udid', device.id, '--debug-output', join(root, 'debug'),
      '--test-output-dir', join(root, 'out'), '--format', 'junit', '--output', report, flow];
    const status = await new Promise((done) => {
      child = spawn(maestro, argv, { env, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdin.end();
      for (const stream of [child.stdout, child.stderr]) {
        const sink = lineSink(keep);
        stream.setEncoding('utf8');
        stream.on('data', (c) => sink.push(c));
        stream.on('end', () => sink.end());
      }
      child.on('error', () => done(-1));
      child.on('close', (code) => done(code ?? -1));
    });
    child = null;

    const name = basename(flow, extname(flow));
    if (interrupted) {
      for (const line of sweepRoot(root, redactValues, true)) say(line);
      rmSync(root, { recursive: true, force: true });
      say(`flow: interrupted (${interrupted}); root removed`);
      return interrupted === 'SIGINT' ? 130 : 143;
    }
    let result = null;
    try {
      result = readJunit(readFileSync(report, 'utf8'));
    } catch {}
    const passed = status === 0 && result !== null && !result.failed;
    // Read from Maestro's command records before the sweep deletes them, so every named screenshot taken, one the
    // sweep removes included, is accounted for.
    const manifest = namedScreenshots(join(root, 'out'), root);
    for (const line of sweepRoot(root, redactValues, !passed)) say(line);
    const secs = result?.time != null ? ` ${Math.round(result.time * 10) / 10}s` : '';
    if (!passed) {
      if (result === null) say(`FAIL ${name}: unreadable report`);
      else say(`FAIL ${name}${secs}: ${result.message ?? `maestro exited ${status}`}`);
      say(`root kept: ${root}`);
      return 1;
    }
    const exported = exportScreenshots(manifest, root, out, redactValues);
    rmSync(root, { recursive: true, force: true });
    if (!exported) {
      say(`FAIL ${name}${secs}: named screenshots not exported`);
      return 1;
    }
    say(`PASS ${name}${secs}`);
    return 0;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    releaseLock();
  }
}

function existsOrLink(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

// ---------- CLI ----------

const VALUE_FLAGS = new Set(['port', 'device', 'timeout', 'equals', 'out', 'account', 'expect', 'credentials', 'config', 'pid']);
const COMMANDS = { preflight: cmdPreflight, desktop: cmdDesktop, flow: cmdFlow, scan: cmdScan };

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (!VALUE_FLAGS.has(name) || i + 1 >= argv.length) return null;
      flags[name] = argv[++i];
    } else positional.push(a);
  }
  return { positional, flags };
}

function usage(synopsis) {
  complain(`usage: ${INVOKE} ${synopsis}`);
  return 2;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!args || !Object.hasOwn(COMMANDS, command)) {
    return usage(`preflight|desktop|flow|scan ... [--config FILE] (see the header of ${INVOKE.slice(5)})`);
  }
  const ctx = loadConfig(args.flags);
  if (ctx.error) {
    complain(ctx.error);
    return 2;
  }
  return COMMANDS[command](ctx, args);
}

const invoked = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : null;
if (invoked === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = await main();
