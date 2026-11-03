import { lateFee } from "../../../../../../../../src/fee";
const cases: [number, number, number][] = [
  [10000, 30, 200], [10000, 400, 2500], [10000, 29, 0],
  [10000, 0, 0], [0, 400, 0], [10000, 59, 200], [10000, 60, 400],
  [10000, 360, 2400], [10000, 390, 2500], [12345, 30, 246], [99, 30, 1], [49, 30, 0],
];
for (const [a, d, want] of cases) {
  const got = lateFee(a, d);
  console.log(`lateFee(${a}, ${d}) = ${got} expected ${want} ${got === want ? "OK" : "MISMATCH"}`);
}
