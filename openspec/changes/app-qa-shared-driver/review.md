# Review

- **Verdict**: REJECT
- **Reviewed digest**: 20ce0e1abe668bf276a60941ec4425b18562bc4e10e10bdc5f3b62fe4d656b2b
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanRevDelta3_AQSD
- **Verifier**: blocker-verifier, none
- **Models**: PlanRevDelta3_AQSD onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta (PlanRevDelta3_AQSD)

1. {"area": "CHECK 2 — design D4 / task 1.4: nested-worktree ownership", "defect": "Directory containment does not establish worktree ownership when linked worktrees live below the main checkout. With only /repo/.worktrees/B/app/shell's same-class JVM running, attach from /repo accepts B's process because its working directory is below /repo. With both apps running, implicit attach from the main checkout instead becomes ambiguous, and explicit selection can still select B. This ordinary repository layout therefore still permits controlling another worktree's app. The effects are reversible, but fix entry 1 and the isolation goal remain unmet.", "evidence": "openspec/changes/app-qa-shared-driver/design.md:95 explicitly keeps processes whose real working directory is 'the worktree root or below it'; tasks.md:10 repeats that rule. design.md:36 permits invocation from anywhere inside an app repository or worktree. The required refusal when only another worktree's same-class JVM runs is at specs/app-qa-driver/spec.md:55-56. A main checkout containing .worktrees/B satisfies the new containment predicate for B despite being a different worktree.", "change": "Resolve the owning Git worktree root of each candidate's working directory and compare its canonical root exactly with the invoking worktree's root, rather than relying solely on containment. Apply that ownership check to explicit --pid selection too. Add discriminating controls for a main checkout and its nested linked worktree, both with only the linked worktree's app running and with both apps running."}
   - not triaged: the verifier has not returned

2. {"area": "Quality and verification — task 1.4: absolute lsof invocation bypasses the fake", "defect": "The new desktop verification specifies a fake lsof but the runtime design invokes /usr/sbin/lsof directly. The inherited subprocess harness installs fake binaries only on PATH, so that fake cannot intercept the specified lookup. Its synthetic Spectre PIDs will be inspected by the real host utility rather than resolved to the fixture worktree directories. As designed, the selected desktop tests cannot establish the ownership behavior and their successful-attach cases cannot reliably pass. This is a reversible verification-design defect introduced by the delta.", "evidence": "openspec/changes/app-qa-shared-driver/design.md:95 and :135 specify /usr/sbin/lsof through spawnSync; tasks.md:10 simultaneously requires 'a fake lsof in the tests'. The inherited harness at /Users/tim/git/onara/app_kmp/scripts/qa.test.mjs:241 sets PATH to L.bin, :246-248 writes fakes into that directory, and :267-269 launches the driver in a child process with that environment. The plan names no injection seam for the absolute executable.", "change": "Specify an executable test seam for the working-directory lookup while retaining the intended production executable—for example, an injected process runner used by the same ownership helper. Explain how task 1.4's existing Node test command activates the seam and how CLI-level tests still cover selection and refusal. Do not require replacing the system lsof or weaken the ownership check to make the fake tests pass."}
   - not triaged: the verifier has not returned

3. {"area": "Executability — task 3.1, F1 lock-script", "defect": "The new mandatory lock-script row runs maestro-onboarding.sh --reset-only and expects it to hold the shared lock. That mode explicitly skips lock acquisition. Changing only the lock path therefore cannot produce the required refusal naming the script's PID; an otherwise eligible Weaver flow can start instead. This makes the new real-surface proof unexecutable as written. The failure is reversible but prevents completing mandatory F1 verification.", "evidence": "openspec/changes/app-qa-shared-driver/tasks.md:59 specifies '--reset-only' with only a scratch lock-path edit, and :82 requires the lock-script evidence row. /Users/tim/git/onara/app_kmp/scripts/maestro-onboarding.sh:113-116 calls take_lock only inside `if [ \"$reset_only\" = 0 ]; then`. The lock-path edit does not change that branch.", "change": "Replace the row with an actual lock-taking execution path and a concrete way to keep its lock held while the competing flow starts, without weakening credential safeguards. Alternatively, use a disposable Bash holder exercising the documented numeric-PID writer, live-holder refusal and ownership-checked release contract, and state precisely which app-script integration that proof does and does not cover."}
   - not triaged: the verifier has not returned


## Residuals

none
