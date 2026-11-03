# F2 wave 1 row R2: Requirement "Totals are exact in cents"

Folded requirement row (standard depth): one row exercising the requirement's scenarios, citing the F1 captures.
Carry: carried from 03369ba: the merge of main (066253a) changes only groupThousands, which formatCents calls only when the whole part is >= 1000; this row's total is below 1000.

| Scenario | Capture | sha256 | Observed | Verdict |
|---|---|---|---|---|
| Cents add exactly / Negative control (ten lines of `x,0.10`) | `.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md` | `48a780f456710a344607acc9431c13ef8e7b24480b9f3139a54029830c67626e` | stdout `1.00` (not `0.9999999999999999`, not `1`), exit 0 | PASS |
| Cents add exactly (`a,0.10`, `b,0.20`) | new capture below (head `60d56444ecce`) | - | stdout `0.30`, exit 0 | PASS |
| Empty file | `.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md` | `b3e922b79260ba21df37471857ed6e89e8efa444b690d153a7d6e99725a7c110` | stdout `0.00`, exit 0 | PASS |

## New capture: Cents add exactly (`a,0.10`, `b,0.20`) on head `60d56444eccee97bb24e5c51c3be2653eb256229` (Bun `1.4.4`)

Command: `bun src/cli.ts total <tmp>/r2-cents-030.csv`

Input file (14 bytes):

```
a,0.10
b,0.20
```

- Exit code: `0`
- stdout: `0.30`
- stderr: ``
- Verdict: PASS (`0.30`, not `0.30000000000000004`)

Row verdict: PASS
