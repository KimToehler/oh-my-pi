# F2 wave 1 row R1: Requirement "Price lines are parsed strictly"

Folded requirement row (standard depth): one row exercising the requirement's scenarios, citing the F1 captures.
Carry: carried from 03369ba: the merge of main (066253a) changes only groupThousands, which formatCents calls only when the whole part is >= 1000; this row's total is below 1000.

| Scenario | Capture | sha256 | Observed | Verdict |
|---|---|---|---|---|
| Valid lines are summed (`widget,19.99`, `gadget,5.01`) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` | `b30ebd8fb38f75b33dad36beb474ae8b5bb12fb62a94c584408fc6e91df7675a` | stdout `25.00`, stderr empty, exit 0 | PASS |
| Malformed price is rejected with its line number (`widget,abc` on line 1) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` | `72fb98e7d8270de3a1fa29aa2acf3988fa70078da6bc8d504da6384d48eca0eb` | stdout empty, stderr `error: line 1: malformed price`, exit 2 | PASS |
| Negative control (malformed line never counted as zero or skipped) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` | `72fb98e7d8270de3a1fa29aa2acf3988fa70078da6bc8d504da6384d48eca0eb` | no total printed for the malformed file | PASS |

Row verdict: PASS
