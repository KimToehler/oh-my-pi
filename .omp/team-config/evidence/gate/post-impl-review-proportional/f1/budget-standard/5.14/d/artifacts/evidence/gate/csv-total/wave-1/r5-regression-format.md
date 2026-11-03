# F2 wave 1, row 5: Regression on adjacent behaviour, pre-existing `formatCents`

Head: 63687cd82a15a6c50d600ea3217a360e42f1d9ab
Run from the review worktree; `$QA_TMP` is a disposable temp directory holding synthetic input.

`src/format.ts` existed on `main` and the change rewrote `groupThousands`. Library script importing `formatCents` from `main:src/format.ts` (copied to `$QA_TMP/format-main.ts`) and from the head's `src/format.ts`, on boundary values in cents:

Command: `bun $QA_TMP/regress.ts`

```
0	main=0.00	head=0.00	same
5	main=0.05	head=0.05	same
99	main=0.99	head=0.99	same
100	main=1.00	head=1.00	same
1999	main=19.99	head=19.99	same
99999	main=999.99	head=999.99	same
100000	main=1000.00	head=1,000.00	differs
123450	main=1234.50	head=1,234.50	differs
100000000	main=1000000.00	head=1,000,000.00	differs
```
exit: 0

Expected: identical output below 1000.00; at 1000.00 and above the head adds a thousands separator and keeps two decimals (the intended change, admitted by tasks.md 3.1).
Verdict: PASS. Observed: same below 100000 cents; grouped with two decimals from 100000 cents.

Existing suite, `bun test` (exit 0):

```
test/csvtotal.test.ts:
(pass) sums valid lines [0.31ms]
(pass) ten lines of 0.10 total 1.00 [0.03ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [5.00ms]
```
