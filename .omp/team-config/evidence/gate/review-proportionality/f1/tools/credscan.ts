// F1 credential scan for review-proportionality (one-off evidence helper, not delivered).
// Loads every credential source an ordinary omp session can resolve, never prints a value,
// and reports per source how many values it loaded and per retained file only a hit count.
// Exit 0: zero hits. Exit 1: hits. Exit 2: a source that exists could not be read or parsed (fail closed).
//
// bun credscan.ts [--home H] [--agent-dir A] [--fixture F]... [--expect SENTINEL] <scan root>...
import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

const argv = process.argv.slice(2);
let home = process.env.HOME!;
let agentDir = "";
let expect = "";
const fixtures: string[] = [];
const roots: string[] = [];
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === "--home") home = argv[++i];
	else if (a === "--agent-dir") agentDir = argv[++i];
	else if (a === "--fixture") fixtures.push(argv[++i]);
	else if (a === "--expect") expect = argv[++i];
	else roots.push(a);
}
if (!agentDir) agentDir = path.join(home, ".omp", "agent");

const NAME = /key|token|secret|password|credential|auth/i;
const MIN = 8;
const sources: { name: string; values: Set<string> }[] = [];
let failed = false;

function add(name: string, values: Set<string>) {
	sources.push({ name, values });
}
function fail(name: string, err: unknown) {
	failed = true;
	console.log(`SOURCE ${name}: UNREADABLE (${err instanceof Error ? err.constructor.name : "error"})`);
}
function exists(p: string) {
	try {
		fs.lstatSync(p);
		return true;
	} catch {
		return false;
	}
}
function leaves(v: unknown, out: Set<string>, keyed: boolean) {
	if (typeof v === "string") {
		if (keyed && v.length >= MIN) out.add(v);
	} else if (Array.isArray(v)) for (const x of v) leaves(x, out, keyed);
	else if (v && typeof v === "object")
		for (const [k, x] of Object.entries(v)) leaves(x, out, keyed || NAME.test(k));
}

// YAML configs (models.yml, config.yml and their backups)
for (const f of exists(agentDir) ? fs.readdirSync(agentDir) : []) {
	if (!/^(models|config)\.yml/.test(f)) continue;
	const p = path.join(agentDir, f);
	try {
		const out = new Set<string>();
		leaves(Bun.YAML.parse(fs.readFileSync(p, "utf8")), out, false);
		add(`yaml:${f}`, out);
	} catch (e) {
		fail(`yaml:${f}`, e);
	}
}
// agent.db auth_credentials.data (all string leaves of the stored credential JSON)
const db = path.join(agentDir, "agent.db");
if (exists(db)) {
	try {
		const d = new Database(db, { readonly: true });
		const out = new Set<string>();
		for (const row of d.query("SELECT data FROM auth_credentials").all() as { data: string }[]) {
			try {
				leaves(JSON.parse(row.data), out, true);
			} catch {
				if (typeof row.data === "string" && row.data.length >= MIN) out.add(row.data);
			}
		}
		d.close();
		add("db:auth_credentials.data", out);
	} catch (e) {
		fail("db:auth_credentials.data", e);
	}
}
// process environment
{
	const out = new Set<string>();
	for (const [k, v] of Object.entries(process.env)) if (/KEY|TOKEN|SECRET/.test(k) && v && v.length >= MIN) out.add(v);
	add("env:process", out);
}
// .env files
for (const p of [...fixtures.map(f => path.join(f, ".env")), path.join(home, ".env")]) {
	if (!exists(p)) continue;
	try {
		const out = new Set<string>();
		for (const line of fs.readFileSync(p, "utf8").split("\n")) {
			const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
			if (!m) continue;
			const v = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
			if (v.length >= MIN) out.add(v);
		}
		add(`dotenv:${p === path.join(home, ".env") ? "~/.env" : "fixture/.env"}`, out);
	} catch (e) {
		fail(`dotenv:${p}`, e);
	}
}
// AWS SSO cache
const sso = path.join(home, ".aws", "sso", "cache");
if (exists(sso)) {
	const out = new Set<string>();
	for (const f of fs.readdirSync(sso)) {
		try {
			leaves(JSON.parse(fs.readFileSync(path.join(sso, f), "utf8")), out, false);
		} catch (e) {
			fail(`aws-sso:${f}`, e);
		}
	}
	add("aws-sso-cache", out);
}

for (const s of sources)
	console.log(
		`SOURCE ${s.name}: ${s.values.size} values${expect ? ` sentinel=${s.values.has(expect) ? "yes" : "no"}` : ""}`,
	);

const needles = [...new Set(sources.flatMap(s => [...s.values]))].map(v => Buffer.from(v));
if (expect) needles.push(Buffer.from(expect));
let hits = 0;
let files = 0;
function scan(p: string) {
	const st = fs.lstatSync(p);
	if (st.isDirectory()) {
		for (const f of fs.readdirSync(p).sort()) scan(path.join(p, f));
		return;
	}
	if (!st.isFile()) return;
	files++;
	const buf = fs.readFileSync(p);
	let n = 0;
	for (const nd of needles) {
		let at = buf.indexOf(nd);
		while (at !== -1) {
			n++;
			at = buf.indexOf(nd, at + 1);
		}
	}
	hits += n;
	console.log(`FILE ${p}: ${n} hits`);
}
for (const r of roots) scan(r);
console.log(`SCANNED ${files} files, ${needles.length} needles, ${hits} hits${failed ? ", SOURCE FAILURE" : ""}`);
process.exit(failed ? 2 : hits ? 1 : 0);
