# F2 wave 1 s10-usage-and-missing-file — csv-total

- **Change**: csv-total, F2 wave 1 manual QA on the real surface
- **Head**: `ab95eaf4a37afc15dfc35c40fcbcd86b605debb5` (branch `feat/csv-total`, after merging `main` 7b6e2e2)
- **Runtime**: bun 1.4.4
- **Expected**: CLI error paths: no arguments -> usage on stderr, exit 2; unreadable path -> `error: cannot read <path>` on stderr, exit 2; no stdout in either

## Observed: `bun src/cli.ts`

Exit code: `2`

stdout (`repr`): `''`

stderr (`repr`): `'usage: csvtotal total <file>\n'`

## Observed: `bun src/cli.ts total /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/does-not-exist.csv`

Exit code: `2`

stdout (`repr`): `''`

stderr (`repr`): `'error: cannot read /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/csvtotal-f2w1-ugzhexk7/does-not-exist.csv\n'`
