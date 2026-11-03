# Q6 tasks.md Verify commands (1.1, 1.2, 2.1, 4.1, 4.2; re-run: test file and tasks.md changed)

Head: b64d9652e387f2768741b29deb16c5e84e924c10 (F2 wave 2 snapshot)
Channel: the Verify commands of tasks.md run from the repo root, exit codes and output captured.

## 1.1, 1.2, 4.1, 4.2: `bun test`

exit: 0

output (stderr+stdout):
```
test/csvtotal.test.ts:
(pass) sums valid lines [0.22ms]
(pass) ten lines of 0.10 total 1.00 [0.03ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]
(pass) a total of 1,000.00 gets one separator [0.04ms]
(pass) a total of 999,999.99 gets one separator
(pass) a total of 1,000,000.00 gets a separator before every three digits
(pass) a total of 1,234,567.00 gets a separator before every three digits

 8 pass
 0 fail
 8 expect() calls
Ran 8 tests across 1 file. [4.00ms]
bun test v1.4.4 (5d9cc0f4f)
```

## 2.1: `grep -q two openspec/changes/csv-total/design.md`

exit: 0
