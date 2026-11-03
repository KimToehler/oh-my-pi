import { lateFee } from "../../../../../../../src/fee";
const cases: [number, number, number, string][] = [
  [10000, 30, 200, "scenario One complete period"],
  [10000, 400, 2500, "scenario Fee cap"],
  [10000, 29, 0, "scenario Negative control (29 days -> 0)"],
  [10000, 0, 0, "0 days"],
  [10000, 59, 200, "59 days = 1 complete period"],
  [10000, 60, 400, "60 days = 2 periods"],
  [10000, 360, 2400, "12 periods = 24%"],
  [10000, 390, 2500, "13 periods = 26% -> cap 25%"],
  [99, 30, 1, "1.98 cents rounds down to 1"],
  [49, 30, 0, "0.98 cents rounds down to 0"],
  [0, 400, 0, "zero amount"],
  [123456789, 400, 30864197, "cap on large amount, floor(30864197.25)"],
];
let fails = 0;
for (const [a, d, want, label] of cases) {
  const got = lateFee(a, d);
  const ok = got === want && Number.isInteger(got);
  if (!ok) fails++;
  console.log(`lateFee(${a}, ${d}) = ${got}  expected ${want}  ${ok ? "OK" : "FAIL"}  (${label})`);
}
console.log(`fails=${fails}`);
