# Q6 tasks.md Verify commands (1.1, 1.2, 2.1)

Head: ecd418fce4a870f089788aa2102397d42c8ea37c (F2 wave 1 snapshot)
Channel: the Verify commands of tasks.md run from the repo root, exit codes and output captured.

## 1.1, 1.2: `bun test`

exit: 0

output (stderr+stdout):
```
test/csvtotal.test.ts:
(pass) sums valid lines [0.23ms]
(pass) ten lines of 0.10 total 1.00 [0.03ms]
(pass) empty input totals 0.00
(pass) malformed price throws with the line [0.03ms]

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [4.00ms]
bun test v1.4.4 (5d9cc0f4f)
```

## 2.1: `grep -q two openspec/changes/csv-total/design.md`

exit: 0
