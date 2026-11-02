# F2 wave 1 q12-unreadable unreadable file (adjacent path)

Head: ecd418fce4a8, bun 1.4.4

Command: `bun src/cli.ts total /tmp/csvqa.HEsp/does-not-exist.csv`

Expected: stderr cannot read, no stdout, exit 2

stdout: ``

stderr: `error: cannot read /tmp/csvqa.HEsp/does-not-exist.csv`

exit: 2
