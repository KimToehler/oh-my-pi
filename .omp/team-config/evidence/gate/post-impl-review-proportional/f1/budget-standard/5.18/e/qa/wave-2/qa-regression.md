# F2 wave 2 QA row 5: regression on adjacent behaviour (re-run: the fix range edits test/csvtotal.test.ts)

Reviewed head: 3556de877f6f9290a54a0d11dc8b906652981043

Adjacent behaviour: `src/format.ts` existed on `main` (fbc1cb8) before this change and the diff edits it (`groupThousands`). The check compares `formatCents` from `main:src/format.ts` with the branch's `src/format.ts` for totals below 1000.00, which must stay byte-identical, and runs the repository's test suite.

## Formatter, main vs branch
Command: `git show main:src/format.ts > /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/format-main.ts && bun /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/fmt-regress.ts` (script imports both `formatCents` functions and prints each value)

stdout:
```
0 main=0.00 branch=0.00 same
1 main=0.01 branch=0.01 same
9 main=0.09 branch=0.09 same
10 main=0.10 branch=0.10 same
99 main=0.99 branch=0.99 same
100 main=1.00 branch=1.00 same
101 main=1.01 branch=1.01 same
2500 main=25.00 branch=25.00 same
99999 main=999.99 branch=999.99 same
99998 main=999.98 branch=999.98 same
99900 main=999.00 branch=999.00 same
100000 main=1000.00 branch=1,000.00 (>= 1000.00: outside this check; the branch changed groupThousands)
123450 main=1234.50 branch=1,234.50 (>= 1000.00: outside this check; the branch changed groupThousands)
below 1000.00: 11/11 identical
```
stderr: ``

exit: 0

Expected: every value below 100000 cents identical on main and branch. Observed 11/11 identical. PASS.

## Test suite
Command: `bun test` (cwd: review worktree)

output (stdout and stderr):
```
bun test v1.4.4 (5d9cc0f4f)

test/csvtotal.test.ts:
(pass) sums valid lines [0.21ms]
(pass) ten lines of 0.10 total 1.00 [0.03ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]
(pass) an unreadable file is reported as permission denied and exits 2 [9.90ms]
(pass) a directory is refused with exit 2 [8.77ms]

 6 pass
 0 fail
 10 expect() calls
Ran 6 tests across 1 file. [25.00ms]
```
exit: 0

Expected: all tests pass. Observed 6 pass, 0 fail. PASS.

Row verdict: PASS
