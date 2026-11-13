# Negative control: Pin

Files read completely: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (S, `review` instruction, lines 348-798), templates/consultation.md (T, 1-16), team-config/agent/agents/architecture-oracle.md (A, 1-38). Reviewer: InstructionReviewF1F3.

## Route 1: a substitute model's report

Forbidding sentences:
- S:426-428 "run `V --consultation-report <session file> <change-dir>` on the session file the entry names. The attempt counts only when it exits 0. For this agent that check decides the model question".
- S:435-436 "a refusal for a wrong model included" (a wrong-model attempt is a failed attempt and is retried).
- S:429-431 `(no report)` appended "when it did not count"; S:444-445 "No other model's report ... stands in for the consultation."
- A:5 the pinned `model:`.
Permitting sentences considered:
- S:430 "`<id> <provider/model>` for every model its session file shows": records several models; counting still needs exit 0 (S:428). Fails.
- S:573-575 "the runtime substitutes a pinned model silently on a credential or retry fallback, and a verdict from the substitute is not the independent draw" concerns reviewers; consistent with this route. Not a permission.
Permitting sentences: none found
Verdict: forbidden

## Route 2: an expected model taken from `task.agentModelOverrides`

Forbidding sentences:
- S:428-429 "the override-first pin check after step 3's briefs is not used".
- A:5 pin; S:405 "no `model`".
- S:439-441 an override is named only as a cause "you observed" in the ask; the fix "is the user's to make".
Permitting sentences considered:
- S:565-570 "compare them ... with the agent's pin: the entry for that agent in `omp config get task.agentModelOverrides`, else the model named in its definition": scoped by S:563 "After every reviewer or verifier dispatch" and switched off for this agent by S:428-429. An architecture-oracle is neither; the explicit exclusion also removes any reading that it applies. Fails.
- S:570-572 "When neither source names a model ... tell the user to add `task.agentModelOverrides.<agent>`": same scope. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 3: an attempt counted without `--consultation-report` exiting 0

Forbidding sentences:
- S:386-390 Recovery: "otherwise run `V --consultation-report <session file> <change-dir>` ... a failed attempt, as is one whose check exits 1; an exit 0 counts the attempt and goes to Record below."
- S:424-428 Counting: "The attempt counts only when it exits 0"; a plan change makes it "failed without a check".
- S:446-448 Record names "the counted attempt" only after that.
Permitting sentences considered:
- S:384-386 "an attempt that is still a running job of this session is waited for": waiting, not counting. Fails.
- S:451-452 Record redirects the command output into the file: a second run of the same command after the counting run; it does not count anything. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 4: a skip without the user

Forbidding sentences:
- S:379-383 "when the user told you to skip the consultation and gave a reason, write consultation.md ... with Status `skipped`, the reason in their words verbatim as Skip reason ... Never write `skipped` without the user's answer."
- S:436-438 the `skipped` record only from the ask's Skip option "with the user's reason in their words".
- S:438-439 and S:441-443 Stop leaves `pending` and dispatches nothing; a session finding `pending` asks again.
Permitting sentences considered:
- S:376-378 "(a skip, or every finding rejected)": describes the user skip, adds no new path. Fails.
- S:439-441 "a fix to the installation is the user's to make, never a third option". Fails.
- A skip with no stated reason: S:379 requires the reason and S:381 "in their words verbatim". Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 5: the author's own review as a substitute

Forbidding sentences:
- S:444-445 "No other model's report and no architecture review of your own stands in for the consultation."
- S:438-439 Stop leaves the `pending` record "which `--reviewed` refuses"; S:463-467 admission keeps dispatching nothing while `pending`.
- S:456-457 "You decide every finding; no verifier triages consultation findings" (dispositions are decisions on the oracle's findings, not a review).
Permitting sentences considered:
- S:477-479 and S:612-618 verifier and reviewer dispatches: they judge plan blockers, not stand in for the consultation. Fails.
- S:454-456 `rejected: <your reason>` is the author's reasoning about a report that exists. Fails.
Permitting sentences: none found
Verdict: forbidden

## Observations (not counted)
- Exit 0 of the report check is described as deciding the model question only by S:428-429; the check's own conditions are outside this instruction (covered by the validator rows).

Overall: PASS
