// Negative controls: each broken copy of qa.mjs must make its area's tests fail (QA_UNDER_TEST).
//   node broken.mjs <qa.mjs> <qa.test.mjs> [id...]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [qaPath, testPath, ...only] = process.argv.slice(2);
const source = readFileSync(qaPath, 'utf8');

const BROKEN = [
  ['devtest-key-pattern', 'flow: credentials|scan:', [[
    `  for (const account of Object.values(config.credentials?.accounts ?? {})) {
    if (Object.hasOwn(parsed, account.user)) users.push(parsed[account.user]);
    if (Object.hasOwn(parsed, account.password)) passwords.push(parsed[account.password]);
  }`,
    `  for (const [key, value] of Object.entries(parsed)) {
    if (/^DEV_TEST_USERNAME(_\\d+)?$/.test(key)) users.push(value);
    if (/^DEV_TEST_PASSWORD(_\\d+)?$/.test(key)) passwords.push(value);
  }`]]],
  ['account-1-home-defaults', 'flow: (credentials|expect)', [
    ['args.flags.account ?? credentials.defaultAccount', "args.flags.account ?? '1'"],
    ['args.flags.expect ?? expect.default', "args.flags.expect ?? 'home'"],
  ]],
  ['redact-selected-account-only', 'flow: (credentials|redact)', [[
    'redactValues = credentialValues(ctx.config, creds.parsed);\n    say(`credentials:',
    'redactValues = { users: [creds.parsed[credentials.accounts[account].user]].filter(Boolean), passwords: [creds.parsed[credentials.accounts[account].password]].filter(Boolean) };\n    say(`credentials:',
  ]]],
  ['credentials-flag-without-section', 'flow: credentials', [["for (const flag of ['account', 'credentials'])", "for (const flag of ['account'])"]]],
  ['password-in-argv', 'flow: credentials', [[
    "'--format', 'junit', '--output', report, flow]",
    "'--format', 'junit', '--output', report, ...(env.MAESTRO_DEV_PW ? ['-e', `PW=${env.MAESTRO_DEV_PW}`] : []), flow]",
  ]]],
  ['credentials-from-script-repository', 'flow: credentials', [[
    'const main = mainCheckoutOf(process.cwd());',
    'const main = mainCheckoutOf(dirname(fileURLToPath(import.meta.url)));',
  ]]],
  ['health-status-only-when-string', 'preflight:', [[
    "const hasStatus = isObject(json) && Object.hasOwn(json, 'status');",
    "const hasStatus = isObject(json) && typeof json.status === 'string';",
  ]]],
  ['attach-by-main-class-alone', 'desktop:', [['if (worktree === ctx.worktree) own.push(p.pid);', 'if (true) own.push(p.pid);']]],
  ['attach-by-directory-containment', 'desktop:', [
    ['return dir ? worktreeOf(dir) : null;', 'return dir ? realpathSync(dir) : null;'],
    ['if (worktree === ctx.worktree) own.push(p.pid);', "if (worktree !== null && (worktree + '/').startsWith(ctx.worktree + '/')) own.push(p.pid);"],
  ]],
  ['session-compares-config-path-only', 'desktop:', [[
    'if (record.root !== ctx.worktree || record.config !== ctx.real || record.mainClass !== ctx.config.desktop.mainClass)',
    'if (record.config !== ctx.real)',
  ]]],
  ['lock-name-in-pid-file', 'lock', [["writeFileSync(join(lockDir(), 'pid'), `${process.pid}\\n`);", "writeFileSync(join(lockDir(), 'pid'), `${process.pid} ${name}\\n`);"]]],
  ['screenshot-clash-exports-one', 'flow: screenshot', [['if (sources.length > 1) {', 'if (false) {']]],
  ['screenshot-eacces-as-existing-target', 'flow: screenshot', [[
    "say(`flow: screenshot ${file} not copied: ${e.code ?? 'error'}`);",
    'say(`flow: screenshot ${file} not copied: ${target} exists`);',
  ]]],
  ['screenshots-enumerated-after-sweep', 'flow: screenshot', [[
    "const manifest = namedScreenshots(join(root, 'out'), root);\n    for (const line of sweepRoot(root, redactValues, !passed)) say(line);",
    "for (const line of sweepRoot(root, redactValues, !passed)) say(line);\n    const manifest = namedScreenshots(join(root, 'out'), root);",
  ]]],
  ['screenshot-unreadable-record-ignored', 'flow: screenshot', [['let complete = unreadable.length === 0;', 'let complete = true;']]],
  ['sweep-skips-xml-escaped-form', 'flow: (sweep|credentials|redact)', [['const xmlFlexible = (form) =>', 'const xmlFlexible = (form) => escapeRegExp(form);\nconst unusedXmlFlexible = (form) =>']]],
  ['sweep-contents-only', 'flow: (sweep|screenshot)', [['if (!pathHit(rel(e.path), names) || pathHit(rel(dirname(e.path)), names)) continue;', 'continue;']]],
  ['scan-contents-only', 'scan:', [['pathHit(relative(base, f), names) || ', '']]],
  ['scan-skips-links-silently', 'scan:', [['    skipped?.push(path);\n', '']]],
  ['scan-follows-links', 'scan:', [['  const st = lstatSync(path);\n  if (st.isFile()) {', '  const st = statSync(path);\n  if (st.isFile()) {']]],
  ['scan-paths-without-sentinels', 'scan:', [['passwords: [...values.passwords, ...sentinels] };', 'passwords: values.passwords };']]],
  ['scan-sentinels-redacted-only-with-credentials', 'scan:', [['passwords: [...values.passwords, ...sentinels] };', 'passwords: ctx.config.credentials ? [...values.passwords, ...sentinels] : values.passwords };']]],
  ['screenshots-grouped-by-source-path', 'flow: screenshot', [
    ['const name = basename(path);\n    byName.set', 'const name = relative(outRoot, path);\n    byName.set'],
    ['const target = join(out, file);', 'const target = join(out, basename(file));'],
  ]],
  ['capture-checks-png-only', 'desktop:', [['if (existsSync(png) || existsSync(json)) {', 'if (existsSync(png)) {']]],
  ['device-any-given-id', 'preflight:|flow: device', [['if (devices.some((d) => d.id === given)) return { id: given };', 'return { id: given };']]],
  ['binary-searches-short-values', 'scan:|flow: screenshot', [['const pattern = text ? patterns.text : patterns.binary;', 'const pattern = patterns.text;']]],
];

const dir = mkdtempSync(join(tmpdir(), 'qa-broken-'));
let bad = 0;
for (const [id, pattern, swaps] of BROKEN) {
  if (only.length && !only.includes(id)) continue;
  let text = source;
  for (const [from, to] of swaps) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${id}: expected one match, found ${count}: ${from.slice(0, 60)}`);
    text = text.replace(from, () => to);
  }
  const file = join(dir, `${id}.mjs`);
  writeFileSync(file, text);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', `--test-name-pattern=^(${pattern})`, testPath], {
    encoding: 'utf8',
    env: { ...process.env, QA_UNDER_TEST: file },
  });
  const failed = [...new Set(r.stdout.split('\n').filter((l) => l.startsWith('✖ ') && !l.startsWith('✖ failing')).map((l) => l.slice(2).replace(/ \([\d.]+ms\)$/, '')))];
  const verdict = r.status !== 0 && failed.length ? 'caught' : 'MISSED';
  if (verdict === 'MISSED') bad++;
  console.log(`${verdict} ${id} (exit ${r.status}, pattern ^(${pattern}))`);
  for (const name of failed) console.log(`  failed: ${name}`);
}
process.exitCode = bad ? 1 : 0;
