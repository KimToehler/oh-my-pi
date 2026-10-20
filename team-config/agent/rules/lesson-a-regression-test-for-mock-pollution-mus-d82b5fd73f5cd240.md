---
description: A regression test for mock pollution must not itself register a module mock
globs:
  - "**/*.test.ts"
  - "**/test-setup.ts"
---

# Lesson: A regression test for mock pollution must not itself register a module mock

Recorded: 2026-09-05
Lesson id: a-regression-test-for-mock-pollution-mus-d82b5fd73f5cd240
Lesson hash: d82b5fd73f5cd240

## What went wrong
I fixed a cross-file `mock.module` pollution defect by adding test seams to two shared modules, then wrote a regression test to pin the immunity. To make the test realistic, it called `mock.module("./logger", ...)` followed by `mock.restore()` inside the test body, to simulate the foreign mock the seam is supposed to survive. The scoped suite was green (`hooks/` went 46 fail to 0 fail), so I moved on. The full root `bun test` then reported 58 failures against a `dev` baseline of 0. Bisecting by moving my own new test file out of the tree took the same suite from 3 fail to 0 fail: my regression test was itself the poisoner. `mock.restore()` does not unregister a module mock in Bun 1.4.0, so the mock stayed registered for every test file loaded after mine, and three `preemptive-compaction` tests that assert on a logger mock broke. The test documenting the hazard in its own comments was committing the hazard.

## Rule for next time
When writing a regression test that pins immunity to `mock.module` pollution, never call `mock.module` on the shared module inside that test - the registration outlives the file and poisons every test file loaded afterwards, so the guard test becomes a new instance of the bug it guards. Assert the seam property directly instead: install the sink or override, import the consumer module through a real import chain, and check the value arrives; then mutation-test each seam branch to prove the assertions are load-bearing. Also treat a green scoped suite as insufficient for any change to a shared module: run the full root suite and diff the failure count against the base branch before claiming the fix works, because pollution defects are invisible at the scope where you introduced them.
