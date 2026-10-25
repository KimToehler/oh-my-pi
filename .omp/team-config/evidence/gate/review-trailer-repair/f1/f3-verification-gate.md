# F3 verification gate (head 8f1b8f830b71ed84eea0dc9ea45d802c9bd53498; code identical to 727e46f955, later commits change only the change folder and gate evidence)

lint: oxlint does not cover team-config (`bunx oxlint <files>` -> No files found to lint); build: none for .mjs scripts. Plan checklist: every task Verify below, each extracted from `openspec/changes/review-trailer-repair/tasks.md` and run from the worktree root with the command shown.

## 1.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 1\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 84fd2017b2c87000587ed4cc628fe8f14c3d11a7e9d8715237b43280b6cbd151
Verify: bun test team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
 294 pass
 0 fail
Ran 294 tests across 1 file. [36.10s]
exit: 0
```

## 2.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 2\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 00fe4c334a848b9c9788c1bcc547fcb962d309e71e290c027372730e75f4e2b3
Verify: bun test team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs -t "trailer check"
 11 pass
 0 fail
Ran 11 tests across 1 file. [325.00ms]
exit: 0
```

## 3.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 3\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 28e9ee2f8ebde1b01e7533eedc3efe0915a9d354e508d379773e1b00144e2cf3
Verify: bun test team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
 61 pass
 0 fail
Ran 61 tests across 1 file. [19.46s]
exit: 0
```

## 4.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 4\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 356fe3f540d95f13b34e91ee8df8d7b078443d23a89cef71bd27e1c6fac3d890
exit: 0
```

## 4.2 (exit 0)

```
$ v=$(grep -E '^- \[.\] 4\.2 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 356fe3f540d95f13b34e91ee8df8d7b078443d23a89cef71bd27e1c6fac3d890
exit: 0
```

## 5.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 5\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 53b3cd2c9c7051d8581060a4f1ebc4ede7ff3623030f67990150930b41e7bc4d
exit: 0
```

## 5.2 (exit 0)

```
$ v=$(grep -E '^- \[.\] 5\.2 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 0733273e2e9e575383e538ba0d6e990e7c5cfaad7b2cc77f9d319ae6530ec9dc
Verify: bun test team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs -t "wave trailer"
 13 pass
 0 fail
Ran 13 tests across 1 file. [2.29s]
exit: 0
```

## 6.1 (exit 0)

```
$ v=$(grep -E '^- \[.\] 6\.1 ' openspec/changes/review-trailer-repair/tasks.md | sed -E 's/.*Verify: `(.*)`$/\1/'); bash -c "$v"
Verify sha256: 307352a50579e53687aeb10748eb8f2e2a283f81e5b89e7e44e8a3f7ddd65506
Verify: bun run test:team-config
 652 pass
 0 fail
Ran 652 tests across 8 files. [64.30s]
exit: 0
```

RESULT: PASS
