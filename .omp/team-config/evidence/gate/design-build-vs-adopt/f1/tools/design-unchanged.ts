import { $ } from "bun";
const S = "team-config/agent/skills/review-work/openspec/schemas/omp-gated";
const [a, b] = process.argv.slice(2);
const sha = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");
const out: string[] = [];
const vals: Record<string, string[]> = {};
for (const c of [a, b]) {
  const y = Bun.YAML.parse(await $`git show ${c}:${S}/schema.yaml`.text()) as any;
  const ins = y.artifacts.find((x: any) => x.id === "design").instruction as string;
  const tpl = await $`git show ${c}:${S}/templates/design.md`.text();
  vals[c] = [sha(ins), sha(tpl)];
  out.push(`${c} design.instruction sha256 ${vals[c][0]}`, `${c} templates/design.md sha256 ${vals[c][1]}`);
}
console.log(out.join("\n"));
console.log(vals[a].join() === vals[b].join() ? "identical" : "different");
