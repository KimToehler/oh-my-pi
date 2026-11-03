# F2 wave 2 QA row 7: fix rows 4.1 and 4.2, read errors through the CLI (fresh capture)

Reviewed head: 3556de877f6f9290a54a0d11dc8b906652981043

Setup: `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv` holds `widget,19.99` and was `chmod 000` for the run (restored afterwards); `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir` is an empty directory; `/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv` does not exist.

### file with mode 000 (EACCES)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/locked.csv: permission denied`

exit: 2

### directory (EISDIR)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/adir: is a directory`

exit: 2

### nonexistent path (ENOENT, unchanged branch)

Command: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv` (cwd: review worktree, head 3556de877f6f9290a54a0d11dc8b906652981043)

stdout: ``

stderr: `error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-qa2-qwvy12ei/missing.csv`

exit: 2

Expected: mode 000 file prints `error: cannot read FILE: permission denied`, no stdout, exit 2 (row 4.1); directory prints `error: cannot read FILE: is a directory`, no stdout, exit 2 (row 4.2); nonexistent path keeps `error: cannot read FILE`, no stdout, exit 2 (unchanged neighbour branch). Observed matches all three. PASS.

Row verdict: PASS
