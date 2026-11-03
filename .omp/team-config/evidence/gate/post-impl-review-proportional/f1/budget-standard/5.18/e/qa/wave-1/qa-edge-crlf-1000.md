# F2 wave 1 QA row 4: riskiest edge, CRLF supplier export at the 1000.00 formatting boundary (fresh capture)

Reviewed head: 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479

Why this edge: supplier exports commonly use CRLF line endings, so the `\r` reaches the price field; and `formatCents` switches to `groupThousands` exactly at 1000.00, the boundary the diff changed.

### Total crosses the boundary: 999.99 + 0.01

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-1000.csv`, bytes shown with `\r` escaped, 18 bytes):
```
a,999.99\r
b,0.01\r
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-1000.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `1,000.00`

stderr: ``

exit: 0

Expected: total whose digits are `1000.00` (grouping separators allowed, as tasks.md 3.1 s5 states), no error from the trailing `\r`, exit 0. Observed `1,000.00`, exit 0. PASS.

### Total stays below the boundary: 999.98 + 0.01

Input (`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-999.csv`, bytes shown with `\r` escaped, 18 bytes):
```
a,999.98\r
b,0.01\r
```

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa-r7iye_mm/edge-crlf-999.csv` (cwd: review worktree, head 8a1d0d6d1056a1eb92a3aae2f5a0205178d88479)

stdout: `999.99`

stderr: ``

exit: 0

Expected `999.99` without separator, exit 0. Observed matches. PASS.

Row verdict: PASS
