# RED for the two depth guards of `--reviewed`

Date: 2026-11-01, task 2.6. Each new test must fail against the guard it defends, not merely
against a validator without any depth check. Two mutant copies of the whole skill directory were
built under `$TMPDIR/prp-mutants/`, each with exactly one guard weakened, and the unchanged test
file was run against each.

## Mutant A - the class limb of the depth predicate

`validate-openspec-change.mjs:418`

```
-const risky = /^risky\b/.test(depth) || (mandatory !== "" && mandatory !== "none");
+const risky = /^risky\b/.test(depth);
```

```
$ cd $TMPDIR/prp-mutants/classA && bun test scripts/validate-openspec-change.test.ts
737 |     expect(result.exitCode).toBe(1);
                                 ^
error: expect(received).toBe(expected)

Expected: 1
Received: 0

      at <anonymous> (…/prp-mutants/classA/scripts/validate-openspec-change.test.ts:737:27)
(fail) validate-openspec-change review record > refuses a class-bearing gate.md without Depth whose round 1 record names one reviewer id [49.50ms]

 138 pass
 1 fail
 330 expect() calls
```

Only the new class test fails. The `risky` Depth tests, the Round 3 control and the two-id control
still pass, so the failure isolates the class limb.

## Mutant B - the round limb

`validate-openspec-change.mjs:414`

```
-if (gate !== undefined && reviewer !== undefined && (round === "1" || round === "2")) {
+if (gate !== undefined && reviewer !== undefined && (round === "1")) {
```

```
$ cd $TMPDIR/prp-mutants/round2 && bun test scripts/validate-openspec-change.test.ts
(fail) validate-openspec-change review record > refuses a risky round 2 record with one reviewer id, naming Reviewer [53.98ms]

 138 pass
 1 fail
 330 expect() calls
```

Only the new Round 2 test fails; the Round 1 test still passes, so the failure isolates the round
limb rather than the depth check as a whole.

## GREEN on the delivered code

```
$ bun test team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts
 139 pass
 0 fail
 331 expect() calls
```

Kept controls, passing in all three runs: `accepts a risky round 3 record with one reviewer id`
and `accepts a class-bearing gate.md without Depth whose record names two reviewers`.
