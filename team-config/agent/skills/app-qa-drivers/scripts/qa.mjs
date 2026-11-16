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
//   node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios|desktop... [--port N] | vm down | vm status
// VM lane (openspec change app-qa-vm-lane): where ~/.omp/agent/app-qa-vm.json exists and the configuration (schema
// app-qa/2) has a `vm` section, preflight, desktop and flow for ios and desktop run in the leased lume VM of the worktree
// after `vm up`; --host runs one command on the host, android and scan always do. `vm pack DIR` is internal (guest).
// Every command also takes --config FILE. Without it the configuration is .omp/app-qa.json at the root of the
// repository holding the working directory; it is validated strictly (schema app-qa/1) before anything else runs.
// Exit: 0 pass, 1 a check, action or flow failed or the scan found a file, 2 usage, configuration or refused start.
// No npm dependencies. Drivers: Spectre 0.9.0 (desktop) and Maestro 2.12.1 (ios, android), both external.
// Dev credentials come from the configured file at the main checkout's root (or --credentials), reach only Maestro's
// environment, and every line this script prints passes one redaction of the configured accounts' values and tokens.
// Redaction, scan and sweep match a password anywhere and a username only as a whole word, never inside a longer word.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  constants,
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMAS = ['app-qa/1', 'app-qa/2'];
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

const CONFIG_FIELDS = {
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
};

/** A map of non-empty names to non-empty strings (the desktop app's system properties). */
const stringMap = (v, p, e) => {
  if (!isObject(v)) {
    e.push(`${p}: expected an object`);
    return;
  }
  for (const [key, value] of Object.entries(v)) {
    if (key === '') e.push(`${p}: expected non-empty names`);
    nonEmpty(value, sub(p, key), e);
  }
};

/** One VM target: the artifact to stage and the build that makes it (design D8). */
const vmTarget = (extra = {}) =>
  section({
    artifact: [true, relPath],
    build: [true, section({ argv: [true, stringList], cwd: [true, relPath] })],
    ...extra,
  });

/** The `vm` section of app-qa/2: at least one of ios and desktop. */
const vmShape = (v, p, e) => {
  section({ ios: [false, vmTarget()], desktop: [false, vmTarget({ systemProperties: [false, stringMap] })] })(v, p, e);
  if (isObject(v) && !Object.hasOwn(v, 'ios') && !Object.hasOwn(v, 'desktop')) e.push(`${p}: expected at least one of ios, desktop`);
};

const CONFIG_SHAPES = {
  'app-qa/1': section(CONFIG_FIELDS),
  'app-qa/2': section({ ...CONFIG_FIELDS, vm: [false, vmShape] }),
};

/** The causes that make `config` not a valid app-qa/1 or app-qa/2 configuration; empty when it is valid. */
export function configErrors(config) {
  if (!isObject(config)) return ['the configuration: expected an object'];
  if (!SCHEMAS.includes(config.schema)) {
    const id = typeof config.schema === 'string' ? config.schema : JSON.stringify(config.schema ?? null);
    return [`schema ${id} is not one of ${SCHEMAS.join(', ')}, the schemas this driver supports; redeploy team config (scripts/deploy-local.sh) to get a driver for it`];
  }
  const errors = [];
  CONFIG_SHAPES[config.schema](config, '', errors);
  if (errors.length) return errors;
  const { credentials, expect } = config;
  if (credentials && !Object.hasOwn(credentials.accounts, credentials.defaultAccount)) {
    errors.push(`credentials.defaultAccount: ${JSON.stringify(credentials.defaultAccount)} is not in credentials.accounts`);
  }
  if (expect && !Object.hasOwn(expect.tags, expect.default)) {
    errors.push(`expect.default: ${JSON.stringify(expect.default)} is not in expect.tags`);
  }
  for (const [target, { build }] of Object.entries(config.vm ?? {})) {
    build.argv.forEach((arg, i) => {
      if (arg.includes('{port}') && !config.backend) errors.push(`vm.${target}.build.argv.${i}: {port} needs a backend section`);
    });
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

// ---------- the machine lane file ----------

export const LANE_SCHEMA = 'app-qa-vm/1';
/** The lane's clones are named `app-qa-slot-N`; no other VM is ever stopped, run or deleted. */
const CLONE_PREFIX = 'app-qa-slot-';
const laneFilePath = () => join(homedir(), '.omp', 'agent', 'app-qa-vm.json');

const LANE_SHAPE = section({
  schema: [true, () => {}],
  image: [
    true,
    (v, p, e) => {
      nonEmpty(v, p, e);
      if (typeof v === 'string' && v.startsWith(CLONE_PREFIX)) e.push(`${p}: ${JSON.stringify(v)} lies in ${CLONE_PREFIX}, the namespace of the lane's clones`);
    },
  ],
  user: [true, nonEmpty],
  sshKey: [
    true,
    (v, p, e) => {
      if (typeof v !== 'string' || !isAbsolute(v)) e.push(`${p}: expected an absolute path`);
    },
  ],
  slots: [
    true,
    (v, p, e) => {
      if (v !== 1 && v !== 2) e.push(`${p}: expected 1 or 2`);
    },
  ],
  idleMinutes: [
    true,
    (v, p, e) => {
      if (!Number.isInteger(v) || v <= 0) e.push(`${p}: expected a positive integer`);
    },
  ],
  ios: [true, section({ deviceType: [true, nonEmpty] })],
});

/**
 * The machine lane file: `{ absent, path }` without the file, `{ error }` naming the file and the cause when it cannot
 * be used, else `{ path, lane }`. The path is fixed under HOME; no environment variable overrides it.
 */
function loadLane() {
  const path = laneFilePath();
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { absent: true, path };
    return { error: `lane: ${path}: unreadable (${e.code ?? 'error'})` };
  }
  let lane;
  try {
    lane = JSON.parse(text);
  } catch {
    return { error: `lane: ${path}: not valid JSON` };
  }
  const errors = [];
  if (!isObject(lane)) errors.push('the lane file: expected an object');
  else if (lane.schema !== LANE_SCHEMA) {
    const id = typeof lane.schema === 'string' ? lane.schema : JSON.stringify(lane.schema ?? null);
    errors.push(`schema ${id} is not ${LANE_SCHEMA}, the schema this driver supports`);
  } else LANE_SHAPE(lane, '', errors);
  if (errors.length) return { error: errors.map((cause) => `lane: ${path}: ${cause}`).join('\n') };
  return { path, lane };
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

/**
 * Image and archive bytes hold any three given letters by chance (a real three-letter username occurs in about one
 * 345 KB screenshot in a hundred), so a binary file is searched only for values of at least this many UTF-8 bytes.
 */
const BINARY_MIN_BYTES = 6;

/** The byte patterns `fileHit` takes: every value for a text file, the long values for a binary file. */
function contentPatterns({ users, passwords }) {
  const long = (vs) => vs.filter((v) => Buffer.byteLength(v, 'utf8') >= BINARY_MIN_BYTES);
  return {
    text: credentialPattern({ users, passwords }, asBytes),
    binary: credentialPattern({ users: long(users), passwords: long(passwords) }, asBytes),
  };
}

/** Whether a file's bytes hold a token, a credential (`patterns`, from `contentPatterns`) or one of the `extra` literal terms. */
export function fileHit(buf, patterns, extra = []) {
  for (const term of extra) if (buf.includes(Buffer.from(term, 'utf8'))) return true;
  const bytes = buf.toString('latin1');
  const text = isText(buf);
  const pattern = text ? patterns.text : patterns.binary;
  if (pattern) {
    pattern.lastIndex = 0;
    if (pattern.test(bytes)) return true;
  }
  const token = text ? TOKEN : BINARY_TOKEN;
  token.lastIndex = 0;
  return token.test(bytes);
}

/** Regular files below `path`, never following a link; every other entry that is no folder goes to `skipped`. */
function* walkFiles(path, skipped) {
  const st = lstatSync(path);
  if (st.isFile()) {
    yield path;
    return;
  }
  if (!st.isDirectory()) {
    skipped?.push(path);
    return;
  }
  for (const entry of readdirSync(path).sort()) yield* walkFiles(join(path, entry), skipped);
}

/** Whether a path, relative to the folder it was found in, holds a credential (`pattern`, the redaction pattern). */
export function pathHit(rel, pattern) {
  if (!pattern) return false;
  pattern.lastIndex = 0;
  return pattern.test(rel);
}

/**
 * Paths of the files below `path` whose contents hold a token, a credential value or one of the `extra` literal terms,
 * or whose path relative to `path` (a file by its own name) holds a credential value. Symbolic links and other entries
 * that are neither a regular file nor a folder are never opened; their paths go to `skipped` when it is given.
 */
export function scanPaths(path, values, extra = [], skipped) {
  const patterns = contentPatterns(values);
  const names = credentialPattern(values);
  const base = lstatSync(path).isDirectory() ? path : dirname(path);
  return [...walkFiles(path, skipped)].filter((f) => pathHit(relative(base, f), names) || fileHit(readFileSync(f), patterns, extra));
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
  const sentinels = ctx.config.scan?.sentinels ?? [];
  // Printed paths hide the sentinels as well; the flow's sweep and redaction keep the credential values alone.
  redactValues = { users: values.users, passwords: [...values.passwords, ...sentinels] };
  const notScanned = [];
  let hits;
  try {
    hits = scanPaths(target, values, sentinels, notScanned);
  } catch {
    complain(`scan: cannot read ${target}`);
    return 2;
  }
  for (const hit of hits) say(hit);
  for (const path of notScanned) say(`scan: not scanned: ${path}`);
  if (notScanned.length) return 2;
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

/** The one device to use: the given one when it is booted, else the only booted one. */
export function chooseDevice(given, devices) {
  if (given) {
    if (devices.some((d) => d.id === given)) return { id: given };
    return { error: `${given} is not booted (booted: ${devices.map((d) => d.label).join(', ') || 'none'})` };
  }
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
/**
 * The credential half of `sweepRoot`: deletes every file and folder whose path below `root` holds a credential value,
 * then redacts or deletes every file that still holds one. Returns the `sweep:` lines. A returned tree gets only this half.
 */
export function sweepCredentials(root, values) {
  const lines = [];
  const rel = (p) => relative(root, p);
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
  lines.push(...sweepCredentials(root, values));
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
  const patterns = contentPatterns(values);
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
    if (fileHit(readFileSync(target), patterns)) {
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
  if (devices === null) {
    say(`flow: cannot list ${platform} devices; run ${INVOKE} preflight ${platform}`);
    return 2;
  }
  const device = chooseDevice(args.flags.device, devices);
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
    // A routed flow names its lease-private run folder here (QA_FLOW_ROOT_DIR), so a kept root returns with the run;
    // TMPDIR, and so the host-wide flow lock, stays the machine's own.
    root = mkdtempSync(join(process.env.QA_FLOW_ROOT_DIR || tmpdir(), 'app-qa-flow-'));
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

// ---------- vm lane ----------

/**
 * Whether the command is one the lane serves: preflight, desktop and flow for ios and desktop, in a repository whose
 * configuration has a `vm` section and without `--host`. Android and scan always run on the host.
 */
function laneRoutes(command, args, ctx) {
  if (!ctx.config.vm || args.flags.host) return false;
  const [first] = args.positional;
  if (command === 'desktop') return true;
  if (command === 'preflight') return first === 'ios' || first === 'desktop';
  return command === 'flow' && first === 'ios';
}

// ---------- vm lane: quoting, processes ----------

/** POSIX single quoting of one argv element: the remote shell receives exactly these bytes. */
const shq = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;

/** Runs a command without a shell; each stdout and stderr line goes to `onLine(line, 'out' | 'err')`. */
function runStreaming(cmd, args, { cwd, env, input, onLine } = {}) {
  return new Promise((done) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      done({ status: -1, error });
      return;
    }
    child.on('error', (error) => done({ status: -1, error }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    for (const [name, stream] of [['out', child.stdout], ['err', child.stderr]]) {
      const sink = lineSink((line) => onLine?.(line, name));
      stream.setEncoding('utf8');
      stream.on('data', (c) => sink.push(c));
      stream.on('end', () => sink.end());
    }
    child.on('close', (code) => done({ status: code ?? -1 }));
  });
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** SIGTERM, then SIGKILL after two seconds; the event loop keeps running so a child of this process is reaped. */
async function killPid(pid) {
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    try {
      process.kill(pid, signal);
    } catch {
      return;
    }
    for (let i = 0; i < 40; i++) {
      await pause(50);
      if (!alive(pid)) return;
    }
  }
}

// ---------- vm lane: lume and ssh ----------

const LUME_VERSION = '0.7.2';
const MAX_SLOTS = 2;
const lumeBin = () => which('lume') ?? join(homedir(), '.local', 'bin', 'lume');
const sshBin = () => which('ssh') ?? '/usr/bin/ssh';
const cloneName = (n) => `${CLONE_PREFIX}${n}`;

function lume(args) {
  const r = run(lumeBin(), args);
  if (r.error || r.status !== 0) for (const line of (r.stderr ?? '').split(/\r?\n/)) if (line) complain(`lume: ${line}`);
  return r;
}

/** The VMs `lume ls` lists, or null when it cannot be read. */
function lumeList() {
  const r = run(lumeBin(), ['ls', '--format', 'json']);
  if (r.error || r.status !== 0) return null;
  try {
    // lume 0.7.2 may print timestamped log lines (`[2026-11-15T11:35:40Z] INFO: ...`) to stdout before the JSON array,
    // whose `[` starts a line and is followed by `{` or `]`.
    const start = /^\[\s*[{\]]/m.exec(r.stdout);
    if (!start) return null;
    const list = JSON.parse(r.stdout.slice(start.index));
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/** Stops and deletes one slot clone and checks that `lume ls` no longer lists it; an absent clone counts as deleted. */
function destroyClone(clone) {
  let list = lumeList();
  if (list === null) return { ok: false, why: 'lume ls cannot be read' };
  const vm = list.find((v) => v.name === clone);
  if (!vm) return { ok: true, existed: false };
  if (vm.status !== 'stopped' || cloneRunAlive(clone)) lume(['stop', clone]);
  lume(['delete', clone, '--force']);
  list = lumeList();
  if (list === null || list.some((v) => v.name === clone)) return { ok: false, why: `${clone} is still listed after lume delete` };
  return { ok: true, existed: true };
}

// ---------- vm lane: table lock, slots and leases (design D4) ----------

const LEASE_STATES = ['starting', 'ready', 'closing'];
const vmDir = () => join(qaDir(), 'vm');
const tableLockDir = () => join(vmDir(), 'table.lock');
const slotPath = (n) => join(vmDir(), `slot-${n}`);
const leasePath = (n) => join(slotPath(n), 'lease.json');
const busyDir = (n) => join(slotPath(n), 'busy');

const LOCK_TOKEN = /^(\d+)-[0-9a-f]+$/;
const GONE = new Set(['ENOENT', 'ENOTEMPTY', 'EEXIST']);

/**
 * The table lock as read: `{ names, pid }`, its entries and the holder's pid when its one entry is a token `PID-NONCE`
 * (else null); null when there is no lock.
 */
function readTableLock(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  const m = names.length === 1 ? LOCK_TOKEN.exec(names[0]) : null;
  return { names, pid: m ? Number(m[1]) : null };
}

/** Removes the lock directory only while it is empty; a lock a contender meanwhile renamed into place stays. */
function removeEmptyLock(dir) {
  try {
    rmdirSync(dir);
  } catch (e) {
    if (!GONE.has(e.code)) throw e;
  }
}

/**
 * Takes over a lock whose holder is dead, or that holds anything but one token: deletes exactly the entries read, then
 * the directory only while empty. A live successor's lock holds another token, so a contender acting on an outdated read
 * deletes nothing of it.
 */
function takeOverLock(dir, { names, pid }) {
  let took = false;
  for (const name of names) {
    try {
      rmSync(join(dir, name), { recursive: true });
      took = true;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  removeEmptyLock(dir);
  if (took) say(`lane: took over the table lock of ${pid === null ? 'a holder without a token' : `dead pid ${pid}`}`);
}

/**
 * The host-wide table lock (design D4): a directory prepared with this holder's token beside the lock and renamed into
 * place, which succeeds only while no lock is held (absent or empty), so a lock never exists without its holder.
 * Returns its release.
 */
function lockTable() {
  ensureDir(vmDir());
  const dir = tableLockDir();
  const token = `${process.pid}-${randomBytes(6).toString('hex')}`;
  const prepared = `${dir}.new-${process.pid}`;
  rmSync(prepared, { recursive: true, force: true });
  mkdirSync(prepared, { mode: 0o700 });
  writeFileSync(join(prepared, token), '');
  const deadline = Date.now() + 60000;
  try {
    for (;;) {
      try {
        renameSync(prepared, dir);
        return () => {
          try {
            unlinkSync(join(dir, token));
          } catch (e) {
            if (e.code === 'ENOENT') return;
            throw e;
          }
          removeEmptyLock(dir);
        };
      } catch (e) {
        if (!['ENOTEMPTY', 'EEXIST', 'ENOTDIR'].includes(e.code)) throw e;
      }
      const held = readTableLock(dir);
      if (held === null || held.names.length === 0) continue;
      if (held.pid === null || !alive(held.pid)) {
        takeOverLock(dir, held);
        continue;
      }
      if (Date.now() > deadline) throw new Error(`the table lock ${dir} stays held by pid ${held.pid}`);
      sleepSync(10);
    }
  } catch (e) {
    rmSync(prepared, { recursive: true, force: true });
    throw e;
  }
}

/** Runs `fn` under the table lock. Nothing slow runs inside: no build, clone, copy, stop or delete. */
function withTable(fn) {
  const release = lockTable();
  try {
    return fn();
  } finally {
    release();
  }
}

function validLease(l) {
  return (
    isObject(l) &&
    LEASE_STATES.includes(l.state) &&
    typeof l.clone === 'string' &&
    Array.isArray(l.targets) &&
    l.targets.every((t) => typeof t === 'string') &&
    Number.isFinite(l.lastUsed) &&
    (l.worktree === null || typeof l.worktree === 'string') &&
    (l.holder === null || Number.isInteger(l.holder)) &&
    isObject(l.inputs) &&
    (l.forward === null || (isObject(l.forward) && Number.isInteger(l.forward.pid) && Number.isInteger(l.forward.port)))
  );
}

/** One slot: `{ free }` without its directory, `{ lease }` with a complete record, else `{ partial }` (missing or unreadable). */
function readSlot(n) {
  if (!existsSync(slotPath(n))) return { free: true };
  try {
    const lease = JSON.parse(readFileSync(leasePath(n), 'utf8'));
    if (validLease(lease)) return { lease };
  } catch {}
  return { partial: true };
}

/** The record is written to a temporary file in the slot and renamed, so a reader never sees half of it. */
function writeLease(n, lease) {
  const tmp = join(slotPath(n), `lease.json.tmp-${process.pid}`);
  writeFileSync(tmp, `${JSON.stringify(lease)}\n`, { mode: 0o600 });
  renameSync(tmp, leasePath(n));
}

const newLease = (n, worktree, state, forward = null) => ({
  worktree,
  clone: cloneName(n),
  slot: n,
  state,
  holder: process.pid,
  targets: [],
  inputs: {},
  forward,
  ip: null,
  lastUsed: Date.now(),
});

const busyPids = (n) => {
  try {
    return readdirSync(busyDir(n)).map(Number).filter((p) => Number.isInteger(p) && p > 0);
  } catch {
    return [];
  }
};

/** The live pids of the slot's routed commands; markers of dead pids are removed. Under the table lock only. */
function liveBusy(n) {
  const live = [];
  for (const pid of busyPids(n)) {
    if (alive(pid)) live.push(pid);
    else rmSync(join(busyDir(n), String(pid)), { force: true });
  }
  return live;
}

const ago = (ms) => {
  const min = Math.floor((Date.now() - ms) / 60000);
  return min < 1 ? 'less than a minute ago' : `${min} min ago`;
};

const holderOf = (n, l) => `slot ${n}: ${l.worktree ?? 'no worktree'} (${l.state}${l.holder ? `, pid ${l.holder}` : ''}, last used ${ago(l.lastUsed)})`;

/** Ends one slot's teardown: only the closer, with its clone gone from `lume ls`, removes the slot. */
async function finishTeardown(n, { clone, forward }) {
  if (forward) await killPid(forward.pid);
  const r = destroyClone(clone);
  if (!r.ok) {
    say(`lane: slot-${n}: ${r.why}; the slot stays until ${clone} is gone`);
    return false;
  }
  withTable(() => {
    const s = readSlot(n);
    if (s.lease?.state === 'closing' && s.lease.holder === process.pid) rmSync(slotPath(n), { recursive: true, force: true });
  });
  return true;
}

/**
 * The sweep of vm up, vm down and vm status (D4). Decisions run under the table lock, the teardown outside it. A lease
 * with a live holder, or ready with a live busy pid, is never touched. Returns whether every teardown finished.
 */
/** Deletes the `return-PID/` folders of dead pids in slot N (a return interrupted by SIGKILL leaves only sanitized files). */
function removeDeadReturns(n) {
  let entries;
  try {
    entries = readdirSync(slotPath(n));
  } catch {
    return;
  }
  for (const e of entries) {
    const m = /^return-(\d+)$/.exec(e);
    if (m && !alive(Number(m[1]))) rmSync(join(slotPath(n), e), { recursive: true, force: true });
  }
}

async function sweep() {
  const torn = [];
  withTable(() => {
    const listed = lumeList();
    if (listed === null) throw new Error('lume ls cannot be read');
    const names = new Set(listed.map((v) => v.name));
    for (let n = 1; n <= MAX_SLOTS; n++) {
      removeDeadReturns(n);
      const slot = readSlot(n);
      if (slot.free) {
        if (!names.has(cloneName(n))) continue;
        mkdirSync(slotPath(n), { mode: 0o700 });
        writeLease(n, { ...newLease(n, null, 'closing'), lastUsed: Date.now() });
        torn.push({ n, clone: cloneName(n), forward: null, why: 'a clone no slot holds' });
        continue;
      }
      if (slot.partial) {
        writeLease(n, newLease(n, null, 'closing'));
        torn.push({ n, clone: cloneName(n), forward: null, why: 'a partial slot' });
        continue;
      }
      const l = slot.lease;
      if (l.state === 'ready') {
        if (liveBusy(n).length > 0) continue;
        if (!names.has(l.clone)) {
          if (l.forward) torn.push({ n, clone: null, forward: l.forward, why: `ready, but ${l.clone} is gone`, remove: true });
          else torn.push({ n, clone: null, forward: null, why: `ready, but ${l.clone} is gone`, remove: true });
          writeLease(n, { ...l, state: 'closing', holder: process.pid });
        }
        continue;
      }
      if (l.holder !== null && alive(l.holder)) continue;
      const why = `${l.state} lease of dead pid ${l.holder ?? 'unknown'}`;
      writeLease(n, { ...l, state: 'closing', holder: process.pid });
      torn.push({ n, clone: l.clone, forward: l.forward, why });
    }
  });
  let ok = true;
  for (const item of torn) {
    if (item.clone === null) {
      if (item.forward) await killPid(item.forward.pid);
      withTable(() => rmSync(slotPath(item.n), { recursive: true, force: true }));
      say(`lane: sweep: freed slot-${item.n} (${item.why})`);
      continue;
    }
    if (!(await finishTeardown(item.n, item))) {
      ok = false;
      continue;
    }
    say(`lane: sweep: deleted ${item.clone} (${item.why})`);
    say(`lane: sweep: freed slot-${item.n}`);
  }
  return ok;
}

// ---------- vm lane: vm up, vm down, vm status ----------

/** The lease of this worktree among the complete records, as `{ n, lease }`, else null. Under the table lock. */
function ownLease(worktree) {
  for (let n = 1; n <= MAX_SLOTS; n++) {
    const slot = readSlot(n);
    if (slot.lease?.worktree === worktree) return { n, lease: slot.lease };
  }
  return null;
}

/**
 * Admission of vm up in one critical section (D4 table): the own lease is refreshed, else a free slot is taken, else the
 * ready lease idle longest beyond the limit is marked closing for reclaim. Returns `{ refuse }` or the mode.
 */
function admitUp(worktree, lane) {
  return withTable(() => {
    const own = ownLease(worktree);
    if (own) {
      const { n, lease } = own;
      if (lease.state === 'ready') {
        const busy = liveBusy(n);
        if (busy.length) return { refuse: `vm up: a routed command of this worktree's lease runs (pid ${busy.join(', ')}); wait for it to finish` };
        writeLease(n, { ...lease, state: 'starting', holder: process.pid, targets: [], inputs: {}, lastUsed: Date.now() });
        return { mode: 'refresh', n, forward: lease.forward, ip: lease.ip ?? null };
      }
      if (lease.holder !== null && alive(lease.holder)) {
        return { refuse: `vm up: this worktree's lease is ${lease.state} (pid ${lease.holder}); wait for it to finish` };
      }
      return { retry: true };
    }
    for (let n = 1; n <= lane.slots; n++) {
      if (existsSync(slotPath(n))) continue;
      const listed = lumeList();
      if (listed === null) return { refuse: 'vm up: lume ls cannot be read' };
      mkdirSync(slotPath(n), { mode: 0o700 });
      if (listed.some((v) => v.name === cloneName(n))) {
        writeLease(n, newLease(n, worktree, 'closing'));
        return { mode: 'orphan', n };
      }
      writeLease(n, newLease(n, worktree, 'starting'));
      return { mode: 'fresh', n };
    }
    let oldest = null;
    const held = [];
    for (let n = 1; n <= lane.slots; n++) {
      const slot = readSlot(n);
      if (!slot.lease) {
        held.push(`slot ${n}: ${slot.partial ? 'partial' : 'free'}`);
        continue;
      }
      const l = slot.lease;
      held.push(holderOf(n, l));
      const idle = Date.now() - l.lastUsed > lane.idleMinutes * 60000;
      if (l.state === 'ready' && idle && liveBusy(n).length === 0 && (oldest === null || l.lastUsed < oldest.lease.lastUsed)) oldest = { n, lease: l };
    }
    if (!oldest) return { refuse: `vm up: no free slot; every slot is held or used within ${lane.idleMinutes} min:\n  ${held.join('\n  ')}` };
    writeLease(oldest.n, { ...oldest.lease, state: 'closing', holder: process.pid });
    return { mode: 'reclaim', n: oldest.n, old: oldest.lease };
  });
}

/** vm up's failure transition (D4): a clone that exists keeps a ready lease with no staged target, else the slot goes. */
function failStart(n, cloneExists) {
  rmSync(join(slotPath(n), 'stage'), { recursive: true, force: true });
  withTable(() => {
    const slot = readSlot(n);
    if (!slot.lease || slot.lease.state !== 'starting' || slot.lease.holder !== process.pid) return;
    if (cloneExists) writeLease(n, { ...slot.lease, state: 'ready', holder: null, targets: [], inputs: {}, lastUsed: Date.now() });
    else rmSync(slotPath(n), { recursive: true, force: true });
  });
}

const sshBase = (lane, ip) => [
  '-i', lane.sshKey,
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'LogLevel=ERROR',
  '-o', 'ConnectTimeout=10',
  `${lane.user}@${ip}`,
];

/**
 * True while the detached `lume run ... --vnc disabled CLONE` process of a slot clone is alive. For a VNC-off run, lume 0.7.2
 * decides liveness in `lume ls` by an `lsof` probe of the clone's config.json with a hard 2 s timeout and reports an
 * inconclusive probe as `stopped` with no address (LumeController.swift:355-398, Utils/RunLockProbe.swift:52-115), so on a
 * loaded host the `lume ls` status is not proof that a clone is down (design D5).
 */
function cloneRunAlive(clone) {
  const r = run('ps', ['-Ao', 'pid=,args=']);
  if (r.error || r.status !== 0) return false;
  return r.stdout.split('\n').some((line) => {
    const t = line.trim().split(/\s+/).slice(1);
    const at = t.findIndex((a) => basename(a) === 'lume');
    const vnc = t.indexOf('--vnc');
    return at >= 0 && t[at + 1] === 'run' && vnc > at && t[vnc + 1] === 'disabled' && t.at(-1) === clone;
  });
}

/** Whether a listed slot clone is running: `lume ls` says so, or its own run process is alive. A clone not listed is not running. */
function cloneRunning(clone, listed) {
  const vm = listed?.find((v) => v.name === clone);
  return vm !== undefined && (vm.status === 'running' || cloneRunAlive(clone));
}

/**
 * The address of a running clone: the one `lume ls` reports, else `known` (the address the lease recorded when `vm up` first
 * reached the guest); null when the clone is not running.
 */
function cloneIp(clone, known = null) {
  const listed = lumeList();
  if (!cloneRunning(clone, listed)) return null;
  const vm = listed.find((v) => v.name === clone);
  return (vm.status === 'running' && vm.ipAddress) || known;
}

/** Waits until the clone has an address and accepts an ssh connection; returns the address or null after `seconds`. */
async function waitForSsh(lane, clone, known = null, seconds = 180) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const ip = cloneIp(clone, known);
    if (ip) {
      const r = run(sshBin(), [...sshBase(lane, ip), 'true']);
      if (r.status === 0) return ip;
    }
    await pause(1000);
  }
  return null;
}

/** Runs each target's build on the host without a shell; the output is kept in memory as redacted last lines only. */
async function runBuilds(ctx, targets, port) {
  const tail = [];
  const keep = (line) => {
    tail.push(redact(line, redactValues));
    if (tail.length > 40) tail.shift();
  };
  for (const target of targets) {
    const { build, artifact } = ctx.config.vm[target];
    const argv = build.argv.map((a) => a.replaceAll('{port}', String(port)));
    const r = await runStreaming(argv[0], argv.slice(1), { cwd: join(ctx.root, build.cwd), onLine: keep });
    const failure = r.error ? `cannot start ${argv[0]}` : r.status !== 0 ? `${target} build exited ${r.status}` : !existsSync(join(ctx.root, artifact)) ? `${target} build left no ${artifact}` : null;
    if (failure) return { failure, tail };
  }
  return { tail };
}

/** The remote path of the guest copy: `"$HOME"/work/NAME`, ready for a remote shell. */
const guestCopy = (ctx) => `"$HOME"/work/${shq(ctx.config.name)}`;
const GUEST_DRIVER = '"$HOME"/.omp/agent/skills/app-qa-drivers/scripts';
/** Copies the guest holds only for one lease: the driver state and the lease-private output folders below the guest's TMPDIR. */
const GUEST_RESET = 'T="${TMPDIR:-/tmp}"; rm -rf "${T%/}"/app-qa "${T%/}"/app-qa-lease';

/** One ssh call; every output line goes through the host redaction. */
function sshRun(lane, ip, remote, input) {
  return runStreaming(sshBin(), [...sshBase(lane, ip), remote], {
    input,
    onLine: (line, stream) => (stream === 'err' ? complain(`ssh: ${line}`) : say(`ssh: ${line}`)),
  });
}

/** Streams `tar -c` of a local directory (names from `names` when given) into a remote command's stdin. */
function tarOver(lane, ip, { cwd, names, paths, excludes = [] }, remote) {
  return new Promise((done) => {
    const out = names
      ? ['-c', '-f', '-', '--null', '-T', '-', ...excludes.flatMap((e) => ['--exclude', e])]
      : ['-c', '-f', '-', ...excludes.flatMap((e) => ['--exclude', e]), ...paths];
    const local = spawn('tar', out, { cwd, env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: [names ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    const remoteChild = spawn(sshBin(), [...sshBase(lane, ip), remote], { stdio: [local.stdout ?? 'ignore', 'pipe', 'pipe'] });
    if (names) {
      local.stdin.on('error', () => {});
      local.stdin.end(names.join('\0'));
    }
    let codes = 0;
    const result = { status: 0 };
    const finish = (code, who, error) => {
      if (code !== 0 && result.status === 0) result.status = code ?? -1;
      if (error) result.error = error;
      if (++codes === 2) done(result);
    };
    for (const [child, name] of [[local, 'tar'], [remoteChild, 'ssh']]) {
      for (const stream of child === local ? [child.stderr] : [child.stderr, child.stdout]) {
        const sink = lineSink((line) => complain(`${name}: ${line}`));
        stream.setEncoding('utf8');
        stream.on('data', (c) => sink.push(c));
        stream.on('end', () => sink.end());
      }
      child.on('error', (error) => finish(-1, name, error));
      // A stdout handed to the next process never closes in this one, so the local tar is awaited by its exit.
      child.on(child === local ? 'exit' : 'close', (code) => finish(code, name));
    }
  });
}

/** The worktree's tracked and untracked unignored files (existing, not folders), relative to the root. */
function worktreeFiles(root) {
  const r = run('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (r.error || r.status !== 0) return null;
  return r.stdout.split('\0').filter((f) => {
    if (!f) return false;
    try {
      return !lstatSync(join(root, f)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** Copies each target's artifact by `cp -c -R` into the slot's private `stage/TARGET/ARTIFACT`; returns an error line or null. */
async function snapshotArtifacts(ctx, n, targets) {
  const stage = join(slotPath(n), 'stage');
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true, mode: 0o700 });
  for (const target of targets) {
    const { artifact } = ctx.config.vm[target];
    const dest = join(stage, target, artifact);
    mkdirSync(dirname(dest), { recursive: true });
    const r = run('cp', ['-c', '-R', join(ctx.root, artifact), dest]);
    if (r.error || r.status !== 0) return `cannot snapshot ${artifact}`;
    if (!existsSync(dest)) return `${target} snapshot of ${artifact} is missing`;
    if (target === 'desktop') {
      try {
        (await import('./vm/start-target.mjs')).readLauncherCfg(dest);
      } catch (e) {
        return `desktop artifact ${artifact}: ${e.message}`;
      }
    }
  }
  return null;
}

/** Deletes and fills the guest copy: worktree files, artifacts from the snapshot, the driver, the credentials over stdin. Returns an error line or null. */
async function copyToGuest(ctx, lane, ip, n, targets) {
  const root = ctx.root;
  const reset = await sshRun(lane, ip, `rm -rf ${guestCopy(ctx)} ${GUEST_DRIVER}; ${GUEST_RESET}`);
  if (reset.status !== 0) return 'cannot clear the guest copy';
  const credsRel = ctx.config.credentials?.file ?? null;
  const names = worktreeFiles(root);
  if (names === null) return 'cannot list the worktree files with git';
  const into = `mkdir -p ${guestCopy(ctx)} && tar -x -f - -C ${guestCopy(ctx)}`;
  const files = await tarOver(lane, ip, { cwd: root, names: names.filter((f) => f !== credsRel) }, into);
  if (files.status !== 0) return 'copying the worktree files failed';
  for (const target of targets) {
    const art = await tarOver(lane, ip, { cwd: join(slotPath(n), 'stage', target), paths: [ctx.config.vm[target].artifact] }, into);
    if (art.status !== 0) return `copying the ${target} artifact failed`;
  }
  const driverDir = dirname(fileURLToPath(import.meta.url));
  const driver = await tarOver(
    lane,
    ip,
    { cwd: driverDir, paths: ['.'], excludes: ['qa-fixtures', '*.test.mjs', 'qa-test-preload*'] },
    `mkdir -p ${GUEST_DRIVER} && tar -x -f - -C ${GUEST_DRIVER}`,
  );
  if (driver.status !== 0) return 'copying the driver failed';
  if (credsRel) {
    const file = credentialsPath(ctx);
    let bytes;
    try {
      bytes = readFileSync(file);
    } catch {
      return `cannot read the credentials file ${file}`;
    }
    const rel = credsRel.split('/').map(shq).join('/');
    const put = await sshRun(lane, ip, `umask 077 && mkdir -p "$(dirname ${guestCopy(ctx)}/${rel})" && cat > ${guestCopy(ctx)}/${rel}`, bytes);
    if (put.status !== 0) return 'copying the credentials failed';
  }
  const init = await sshRun(lane, ip, `cd ${guestCopy(ctx)} && git init -q`);
  if (init.status !== 0) return 'git init in the guest copy failed';
  return null;
}

/**
 * Starts the reverse forward of the backend port into the guest (design D5 step 7) and records it in the lease. It counts
 * as established only when the guest accepts a connection on 127.0.0.1:PORT within 10 s. Returns an error line or null.
 */
async function startForward(lane, ip, n, port, old) {
  if (old) await killPid(old.pid);
  const child = spawn(sshBin(), ['-N', '-R', `${port}:127.0.0.1:${port}`, '-o', 'ExitOnForwardFailure=yes', ...sshBase(lane, ip)], { detached: true, stdio: 'ignore' });
  child.unref();
  const record = (forward) =>
    withTable(() => {
      const slot = readSlot(n);
      if (slot.lease?.state === 'starting' && slot.lease.holder === process.pid) writeLease(n, { ...slot.lease, forward });
    });
  record({ pid: child.pid, port });
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (!alive(child.pid)) break;
    if (run(sshBin(), [...sshBase(lane, ip), `nc -z 127.0.0.1 ${port}`]).status === 0) return null;
    await pause(500);
  }
  await killPid(child.pid);
  record(null);
  return `the port forward of ${port} is not established: the guest accepts no connection on 127.0.0.1:${port}`;
}

/** Runs the guest-side start of one target (design D6); returns an error line or null. */
async function startGuestTarget(ctx, lane, ip, target, port) {
  const { artifact } = ctx.config.vm[target];
  const flags = ['--artifact', artifact];
  if (target === 'ios') flags.push('--device-type', lane.ios.deviceType);
  if (target === 'ios' && port !== null) flags.push('--port', String(port));
  const r = await sshRun(lane, ip, `cd ${guestCopy(ctx)} && node ${GUEST_DRIVER}/vm/start-target.mjs ${target} ${flags.map(shq).join(' ')}`);
  return r.status === 0 ? null : `starting ${target} in the guest failed`;
}

async function vmUp(ctx, args, lane) {
  const targets = args.positional.slice(1);
  const synopsis = 'vm up TARGET... [--port N]';
  if (targets.length === 0 || targets.some((t) => !['ios', 'desktop'].includes(t)) || new Set(targets).size !== targets.length) return usage(synopsis);
  for (const t of targets) {
    if (!ctx.config.vm[t]) {
      say(`vm up: ${ctx.path} has no vm.${t} section`);
      return 2;
    }
  }
  const flag = args.flags.port;
  if (flag !== undefined && !ctx.config.backend) {
    say(`vm up: --port needs a backend section in ${ctx.path}`);
    return 2;
  }
  if (flag !== undefined && !(/^\d+$/.test(flag) && Number(flag) >= 1 && Number(flag) <= 65535)) return usage(synopsis);
  loadRedaction(ctx);
  const version = (run(lumeBin(), ['--version']).stdout ?? '').trim().split(/\s+/).at(-1);
  if (version !== LUME_VERSION) {
    say(`vm up: lume ${version || 'not found'}, this lane is pinned to lume ${LUME_VERSION}; install it from https://github.com/trycua/cua/releases (lume-v${LUME_VERSION})`);
    return 2;
  }
  const port = ctx.config.backend ? backendPort(ctx, flag) : null;

  let admission;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await sweep())) return 2;
    admission = admitUp(ctx.worktree, lane);
    if (!admission.retry) break;
  }
  if (admission.refuse || admission.retry) {
    say(admission.refuse ?? 'vm up: the worktree lease is in a state vm status could not resolve');
    return 2;
  }
  const { n } = admission;
  let cloneExists = admission.mode === 'refresh';
  const clone = cloneName(n);
  try {
    if (admission.mode === 'orphan' || admission.mode === 'reclaim') {
      const old = admission.old;
      if (old?.forward) await killPid(old.forward.pid);
      const r = destroyClone(admission.mode === 'reclaim' ? old.clone : clone);
      if (!r.ok) {
        say(`vm up: slot-${n}: ${r.why}`);
        return 2;
      }
      withTable(() => writeLease(n, newLease(n, ctx.worktree, 'starting')));
      if (admission.mode === 'reclaim') say(`lane: reclaimed slot ${n}: ${old.worktree} (idle since ${new Date(old.lastUsed).toISOString()}); deleted ${old.clone}`);
      else say(`lane: deleted the orphan clone ${clone} before taking slot ${n}`);
    }
    const built = await runBuilds(ctx, targets, port);
    if (built.failure) {
      for (const line of built.tail) say(line);
      say(`vm up: ${built.failure}`);
      failStart(n, cloneExists);
      return 2;
    }
    const snapError = await snapshotArtifacts(ctx, n, targets);
    if (snapError) {
      say(`vm up: ${snapError}`);
      failStart(n, cloneExists);
      return 2;
    }
    const listed = lumeList();
    const vm = listed?.find((v) => v.name === clone);
    if (!vm) {
      const r = lume(['clone', lane.image, clone]);
      if (r.error || r.status !== 0) {
        say(`vm up: lume clone ${lane.image} ${clone} failed`);
        failStart(n, false);
        return 2;
      }
    }
    cloneExists = true;
    if (!cloneRunning(clone, listed)) {
      const r = lume(['run', '--detach', '--display', 'none', '--vnc', 'disabled', clone]);
      if (r.error || r.status !== 0) {
        say(`vm up: lume run ${clone} failed`);
        failStart(n, true);
        return 2;
      }
    }
    const ip = await waitForSsh(lane, clone, admission.ip ?? null);
    if (!ip) {
      say(`vm up: ${clone} did not accept an ssh connection`);
      failStart(n, true);
      return 2;
    }
    const copyError = await copyToGuest(ctx, lane, ip, n, targets);
    if (copyError) {
      say(`vm up: ${copyError}`);
      failStart(n, true);
      return 2;
    }
    rmSync(join(slotPath(n), 'stage'), { recursive: true, force: true });
    if (port !== null) {
      const forwardError = await startForward(lane, ip, n, port, admission.forward);
      if (forwardError) {
        say(`vm up: ${forwardError}`);
        failStart(n, true);
        return 2;
      }
    }
    for (const target of targets) {
      const started = await startGuestTarget(ctx, lane, ip, target, port);
      if (started) {
        say(`vm up: ${started}`);
        failStart(n, true);
        return 2;
      }
    }
    withTable(() => {
      const slot = readSlot(n);
      if (!slot.lease || slot.lease.state !== 'starting' || slot.lease.holder !== process.pid) return;
      const inputs = Object.fromEntries(targets.map((t) => [t, { port, argv: ctx.config.vm[t].build.argv }]));
      writeLease(n, { ...slot.lease, state: 'ready', holder: null, targets, inputs, ip, lastUsed: Date.now() });
    });
    say(`vm up: ${clone} holds ${targets.join(', ')}`);
    return 0;
  } catch (e) {
    failStart(n, cloneExists);
    say(`vm up: ${e.message}`);
    return 2;
  }
}

async function vmDown(ctx) {
  if (!(await sweep())) return 2;
  const plan = withTable(() => {
    const own = ownLease(ctx.worktree);
    if (!own) return { none: true };
    const { n, lease } = own;
    if (lease.state === 'ready') {
      const busy = liveBusy(n);
      if (busy.length) return { refuse: `vm down: a routed command of this worktree's lease runs (pid ${busy.join(', ')}); wait for it to finish` };
      writeLease(n, { ...lease, state: 'closing', holder: process.pid });
      return { n, lease };
    }
    return { refuse: `vm down: this worktree's lease is ${lease.state} (pid ${lease.holder}); wait for it to finish` };
  });
  if (plan.none) {
    say('vm down: this worktree holds no lease');
    return 0;
  }
  if (plan.refuse) {
    say(plan.refuse);
    return 2;
  }
  if (!(await finishTeardown(plan.n, plan.lease))) return 2;
  say(`vm down: deleted ${plan.lease.clone}, slot ${plan.n} is free`);
  return 0;
}

async function vmStatus(lane) {
  const ok = await sweep();
  const lines = withTable(() => {
    const out = [];
    for (let n = 1; n <= lane.slots; n++) {
      const slot = readSlot(n);
      if (slot.free) out.push(`slot ${n}: free`);
      else if (slot.partial) out.push(`slot ${n}: partial`);
      else {
        const l = slot.lease;
        const busy = busyPids(n).filter(alive);
        out.push(
          `slot ${n}: ${l.state} worktree=${l.worktree ?? 'none'} clone=${l.clone} targets=${l.targets.join(',') || 'none'} forward=${l.forward ? l.forward.pid : 'none'} holder=${l.holder ?? 'none'} busy=${busy.join(',') || 'none'} last used ${ago(l.lastUsed)}`,
        );
      }
    }
    return out;
  });
  for (const line of lines) say(line);
  return ok ? 0 : 2;
}

/**
 * The internal `vm pack DIR` (design D7), run in the guest: sanitizes the lease-private folder DIR with
 * `sweepCredentials` and writes it as tar to stdout, so no unsanitized byte leaves the clone. Sweep lines go to stderr.
 */
function vmPack(ctx, args) {
  const dir = args.positional[1];
  if (!dir || args.positional.length !== 2 || !isAbsolute(dir)) return usage('vm pack DIR');
  loadRedaction(ctx);
  if (!existsSync(dir)) return 0;
  for (const line of sweepCredentials(dir, redactValues)) complain(line);
  const r = spawnSync('tar', ['-c', '-f', '-', '-C', dir, '.'], { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, COPYFILE_DISABLE: '1' } });
  return r.status === 0 ? 0 : 1;
}

async function cmdVm(ctx, args) {
  const [verb] = args.positional;
  if (verb === 'pack') return vmPack(ctx, args);
  if (!['up', 'down', 'status'].includes(verb)) return usage('vm up TARGET... [--port N] | vm down | vm status');
  const loaded = loadLane();
  if (loaded.error) {
    complain(loaded.error);
    return 2;
  }
  if (loaded.absent) {
    complain(`vm: the machine lane file ${loaded.path} is missing; the lane is not set up on this machine`);
    return 2;
  }
  if (!ctx.config.vm) {
    complain(`vm: ${ctx.path} has no vm section`);
    return 2;
  }
  if (verb !== 'status' && !ctx.worktree) {
    say(`vm ${verb}: ${process.cwd()} is not in a git worktree`);
    return 2;
  }
  try {
    if (verb === 'up') return await vmUp(ctx, args, loaded.lane);
    if (verb === 'down') return await vmDown(ctx);
    return await vmStatus(loaded.lane);
  } catch (e) {
    complain(`vm ${verb}: ${e.message}`);
    return 2;
  }
}

// ---------- vm lane: routed commands ----------

/** The target a routed command needs staged: desktop commands and `preflight|flow ios|desktop` name it. */
const routeTarget = (command, args) => (command === 'desktop' ? 'desktop' : args.positional[0]);

/**
 * Admission of a routed command in one critical section (D2, D4): the lease of this worktree is complete, ready and has
 * staged the target, and `busy/PID` is registered. A lease that is missing, partial or unreadable counts as not ready.
 */
function admitRouted(worktree, target) {
  return withTable(() => {
    const own = ownLease(worktree);
    if (!own) return { refuse: 'this worktree holds no ready lease' };
    const { n, lease } = own;
    if (lease.state !== 'ready') return { refuse: `this worktree's lease is ${lease.state}` };
    if (!lease.targets.includes(target)) return { refuse: `this worktree's lease did not stage ${target}` };
    mkdirSync(busyDir(n), { recursive: true });
    writeFileSync(join(busyDir(n), String(process.pid)), '');
    writeLease(n, { ...lease, lastUsed: Date.now() });
    return { n, lease };
  });
}

/** Removes this process's busy marker and sets `lastUsed`, under the table lock. */
function releaseBusy(n) {
  withTable(() => {
    rmSync(join(busyDir(n), String(process.pid)), { force: true });
    const slot = readSlot(n);
    if (slot.lease) writeLease(n, { ...slot.lease, lastUsed: Date.now() });
  });
}

const ENV_MARK = '@@app-qa-lane-env@@';
const FORWARD_MARK = '@@app-qa-lane-forward-down@@';
const LEASE_DIR = 'app-qa-lease';

/**
 * The routed form of the command line (design D7): `--config` and `--credentials` are refused, the flow file is sent
 * relative to the working directory, `--out` becomes a lease-private guest folder, every other argument is byte-identical.
 * Returns `{ tokens, kind, out }` (tokens are `{ lit }` for quoted bytes and `{ raw }` for the guest's own folder) or `{ error }`.
 */
function translateRouted(ctx, args, command) {
  const raw = process.argv.slice(3);
  const tokens = [{ lit: command }];
  const capture = command === 'desktop' && args.positional[0] === 'capture';
  const kind = command === 'flow' ? 'flow' : capture ? 'capture' : null;
  let positional = 0;
  for (const a of raw) {
    if (a === '--config' || a === '--credentials') return { error: `lane: ${a} names a host file; run the command with --host to use it on the host` };
  }
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a.startsWith('--')) {
      if (command === 'flow' && positional === 1) {
        const abs = resolve(a);
        if (!existsSync(abs)) return { error: `flow: ${a} not found` };
        const real = realpathSync(abs);
        const inside = relative(ctx.worktree, real);
        if (inside.startsWith('..') || isAbsolute(inside)) return { error: `flow: ${a} is outside the worktree ${ctx.worktree}; the guest holds only the worktree` };
        tokens.push({ lit: relative(process.cwd(), real) });
      } else tokens.push({ lit: a });
      positional++;
      continue;
    }
    const name = a.slice(2);
    if (name === 'config' || name === 'credentials') return { error: `lane: --${name} names a host file; run the command with --host to use it on the host` };
    tokens.push({ lit: a });
    if (VALUE_FLAGS.has(name)) tokens.push(name === 'out' && kind ? { raw: kind === 'flow' ? '"$R"/out/flow' : '"$R"/out' } : { lit: raw[++i] });
    if (name === 'out' && kind) i++;
  }
  if (kind === 'flow' && args.flags.out === undefined) tokens.push({ lit: '--out' }, { raw: '"$R"/out/flow' });
  const out = args.flags.out === undefined ? null : resolve(args.flags.out);
  if (kind === 'flow' && out && existsOrLink(out)) return { error: `flow: --out ${out} exists; name a directory that does not exist yet` };
  if (kind === 'capture' && out) {
    const [, name] = args.positional;
    if (name && (existsSync(join(out, `${name}.png`)) || existsSync(join(out, `${name}.json`)))) return { error: `capture: ${name}.png or ${name}.json already exists in ${args.flags.out}` };
  }
  return { tokens, kind, out };
}

/** The guest side of a routed run: environment lines, forward probe, the run folder, the working directory, the driver. */
function remoteScript(ctx, lease, command, tokens) {
  const rel = relative(ctx.worktree, process.cwd());
  const cwd = [guestCopy(ctx), ...(rel && !rel.startsWith('..') ? rel.split('/').map(shq) : [])].join('/');
  const env = command === 'flow' ? 'QA_FLOW_ROOT_DIR="$R"/tmp MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 ' : '';
  const args = tokens.map((t) => t.raw ?? shq(t.lit)).join(' ');
  return [
    `printf '%s\\n' ${shq(ENV_MARK)} "$HOME" "\${TMPDIR:-/tmp}"`,
    ...(lease.forward ? [`nc -z 127.0.0.1 ${lease.forward.port} >/dev/null 2>&1 || { printf '%s\\n' ${shq(FORWARD_MARK)}; exit 97; }`] : []),
    runFolder(),
    'rm -rf "$R" && mkdir -p "$R"/out "$R"/tmp',
    `cd ${cwd} || exit 98`,
    `${env}node ${GUEST_DRIVER}/qa.mjs ${args}`,
  ].join('\n');
}
const runFolder = () => `R="\${TMPDIR:-/tmp}"; R="\${R%/}"/${LEASE_DIR}/run-${process.pid}`;

/** Runs the guest command; every line is redacted with the host's values and held, none is printed. */
function runHeld(lane, ip, script) {
  return new Promise((done) => {
    const held = [];
    const head = [];
    let forwardDown = false;
    const child = spawn(sshBin(), [...sshBase(lane, ip), script], { stdio: ['ignore', 'pipe', 'pipe'] });
    const sinks = [['out', child.stdout], ['err', child.stderr]].map(([name, stream]) => {
      const sink = lineSink((line) => {
        if (name === 'out' && head.length < 3 && (head.length > 0 || line === ENV_MARK)) head.push(line);
        else if (line === FORWARD_MARK) forwardDown = true;
        else held.push({ stream: name, text: redact(line, redactValues) });
      });
      stream.setEncoding('utf8');
      stream.on('data', (c) => sink.push(c));
      return [sink, stream];
    });
    child.on('error', () => done({ status: -1, held, head, forwardDown }));
    child.on('close', (code) => {
      for (const [sink] of sinks) sink.end();
      done({ status: code ?? -1, held, head, forwardDown });
    });
  });
}

/** Copies a returned folder's entries into `dest` (created when absent) without overwriting any file. */
function copyInto(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyInto(join(src, e.name), join(dest, e.name));
    else if (e.isFile()) copyFileSync(join(src, e.name), join(dest, e.name), constants.COPYFILE_EXCL);
  }
}

/**
 * Returns the files of the run (design D7): `vm pack` runs in the guest and streams the sanitized run folder as tar into
 * a 0600 archive in the slot's `return-PID/`; the host lists it, refuses an absolute path, a `..` component or any type
 * but file and folder, extracts, sweeps with its own values, copies without overwriting and deletes the folder.
 * Returns `{ lines, rewrites, failed }`.
 */
async function returnFiles(ctx, lane, ip, n, info, { kind, out }) {
  const lines = [];
  const rewrites = [];
  const dir = join(slotPath(n), `return-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const fail = (why) => {
    lines.push(`lane: the files of the run were not returned: ${why}`);
    return { lines, rewrites, failed: true };
  };
  try {
    const archive = join(dir, 'archive.tar');
    const fd = openSync(archive, 'w', 0o600);
    const packLines = [];
    const status = await new Promise((done) => {
      const child = spawn(sshBin(), [...sshBase(lane, ip), `${runFolder()}; cd ${guestCopy(ctx)} && node ${GUEST_DRIVER}/qa.mjs vm pack "$R"`], { stdio: ['ignore', 'pipe', 'pipe'] });
      const sink = lineSink((line) => packLines.push(redact(line, redactValues)));
      child.stdout.on('data', (c) => writeSync(fd, c));
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (c) => sink.push(c));
      child.on('error', () => done(-1));
      child.on('close', (code) => {
        sink.end();
        done(code ?? -1);
      });
    });
    closeSync(fd);
    lines.push(...packLines);
    if (status !== 0) return fail(`vm pack exited ${status}`);
    const names = run('tar', ['-tf', archive]);
    const types = run('tar', ['-tvf', archive]);
    if (names.status !== 0 || types.status !== 0) return fail('the archive cannot be listed');
    const nameList = names.stdout.split('\n').filter(Boolean);
    const typeList = types.stdout.split('\n').filter(Boolean);
    if (nameList.length !== typeList.length) return fail('the archive listing is inconsistent');
    for (let i = 0; i < nameList.length; i++) {
      const name = nameList[i];
      if (name.startsWith('/') || name.split('/').includes('..')) return fail('the archive holds an absolute path or a .. component; nothing was extracted');
      if (!['-', 'd'].includes(typeList[i][0])) return fail('the archive holds an entry that is neither a file nor a folder; nothing was extracted');
    }
    const root = join(dir, 'x');
    mkdirSync(root, { mode: 0o700 });
    if (run('tar', ['-xf', archive, '-C', root]).status !== 0) return fail('extraction failed');
    lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));
    const exists = (p) => existsSync(join(root, p));
    if (kind === 'flow') {
      const dest = out ?? mkdtempSync(join(tmpdir(), 'app-qa-out-'));
      if (exists('out/flow')) copyInto(join(root, 'out/flow'), dest);
      else mkdirSync(dest, { recursive: true });
      rewrites.push([`${info.runDir}/out/flow`, dest]);
      for (const e of existsSync(join(root, 'tmp')) ? readdirSync(join(root, 'tmp')) : []) {
        if (!e.startsWith('app-qa-flow-')) continue;
        const kept = mkdtempSync(join(tmpdir(), 'app-qa-root-'));
        copyInto(join(root, 'tmp', e), kept);
        rewrites.push([`${info.runDir}/tmp/${e}`, kept]);
      }
    } else if (kind === 'capture' && out) {
      if (exists('out')) copyInto(join(root, 'out'), out);
      rewrites.push([`${info.runDir}/out`, out]);
    }
    return { lines, rewrites, failed: false };
  } catch (e) {
    return fail(e.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function cmdRouted(ctx, args, command, lane) {
  const target = routeTarget(command, args);
  const restart = `run ${INVOKE} vm up ${target}`;
  loadRedaction(ctx);
  const translated = translateRouted(ctx, args, command);
  if (translated.error) {
    say(translated.error);
    return 2;
  }
  const admitted = admitRouted(ctx.worktree, target);
  if (admitted.refuse) {
    say(`lane: ${admitted.refuse}; ${restart}`);
    return 2;
  }
  const { n, lease } = admitted;
  try {
    const ip = cloneIp(lease.clone, lease.ip);
    if (!ip) {
      say(`lane: ${lease.clone} is not running; ${restart}`);
      return 2;
    }
    if (lease.forward && !alive(lease.forward.pid)) {
      say(`lane: the port forward of ${lease.clone} is not running; ${restart}`);
      return 2;
    }
    // A routed preflight checks the backend port the lease forwards (D7): the guest copy cannot resolve it, since `vm up
    // --port` and an ignored port property file never reach the guest. Another --port is refused rather than checked.
    let tokens = translated.tokens;
    if (command === 'preflight' && lease.forward) {
      const asked = args.flags.port;
      if (asked !== undefined && Number(asked) !== lease.forward.port) {
        say(`lane: ${lease.clone} forwards the backend port ${lease.forward.port}, not ${asked}; run ${INVOKE} vm up ${target} --port ${asked}`);
        return 2;
      }
      if (asked === undefined) tokens = [...tokens, { lit: '--port' }, { lit: String(lease.forward.port) }];
    }
    say(`lane: ${command} ${target} runs in ${lease.clone} (slot ${n})`);
    const result = await runHeld(lane, ip, remoteScript(ctx, lease, command, tokens));
    if (result.head.length < 3) {
      say(`lane: ${lease.clone} cannot be reached over ssh; ${restart}`);
      return 2;
    }
    if (result.forwardDown) {
      say(`lane: the port forward of ${lease.clone} accepts no connection; ${restart}`);
      return 2;
    }
    const guestHome = result.head[1];
    const guestTmp = result.head[2].replace(/\/+$/, '');
    const runDir = `${guestTmp}/${LEASE_DIR}/run-${process.pid}`;
    // Dependency checks after the run (D7): the clone, the connection and the forward.
    const ipAfter = cloneIp(lease.clone, ip);
    let lost = null;
    if (!ipAfter) lost = 'clone';
    else if (result.status === 255) lost = 'connection';
    else if (lease.forward) {
      if (!alive(lease.forward.pid)) lost = 'forward';
      else {
        const probe = run(sshBin(), [...sshBase(lane, ipAfter), `nc -z 127.0.0.1 ${lease.forward.port}`]);
        lost = probe.status === 255 ? 'connection' : probe.status !== 0 ? 'forward' : null;
      }
    }
    const returned = ipAfter ? await returnFiles(ctx, lane, ipAfter, n, { runDir }, translated) : { lines: [], rewrites: [], failed: false };
    const rewrites = [...returned.rewrites, [`${guestHome}/work/${ctx.config.name}`, ctx.worktree]]
      .sort((a, b) => b[0].length - a[0].length);
    const keptGone = new RegExp(`${runDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/tmp/app-qa-flow-[^\\s/]+`, 'g');
    const toHost = (text) => {
      let t = text;
      for (const [from, to] of rewrites) t = t.split(from).join(to);
      return t.replace(keptGone, '(not kept)');
    };
    const emit = (line, stream) => (stream === 'err' ? complain(line) : say(line));
    if (lost) {
      say(`lane: infrastructure lost during the run (${lost}); this is not an app result, ${restart}`);
      for (const h of result.held) emit(`guest (not an app result): ${toHost(h.text)}`, h.stream);
    } else for (const h of result.held) emit(toHost(h.text), h.stream);
    for (const line of returned.lines) say(toHost(line));
    if (lost || returned.failed) return 2;
    if (result.status !== 0) say(`lane: ${lease.clone}: the guest command exited ${result.status}; to restart the app, simulator or forward ${restart}`);
    return result.status;
  } finally {
    releaseBusy(n);
  }
}

// ---------- CLI ----------

const VALUE_FLAGS = new Set(['port', 'device', 'timeout', 'equals', 'out', 'account', 'expect', 'credentials', 'config', 'pid']);
const SWITCH_FLAGS = new Set(['host']);
const COMMANDS = { preflight: cmdPreflight, desktop: cmdDesktop, flow: cmdFlow, scan: cmdScan, vm: cmdVm };

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (SWITCH_FLAGS.has(name)) flags[name] = true;
      else if (!VALUE_FLAGS.has(name) || i + 1 >= argv.length) return null;
      else flags[name] = argv[++i];
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
  if (laneRoutes(command, args, ctx)) {
    const lane = loadLane();
    if (lane.error) {
      complain(lane.error);
      return 2;
    }
    if (!lane.absent) return cmdRouted(ctx, args, command, lane.lane);
  }
  return COMMANDS[command](ctx, args);
}

const invoked = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : null;
if (invoked === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = await main();
