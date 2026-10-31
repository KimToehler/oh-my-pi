INTEGRATION-REVIEW-REPORT-v1
## Must-fix

None.

## Should-fix

**Repeated approach question after an answered decision** — `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:420-423` treats a matching REJECT digest as evidence that the approach question is unanswered, even if the user already answered Continue or Re-plan and the session was interrupted before editing an artifact. On resume, this can repeat a decision the user already made and add a user wait; it does not block because the conservative retry keeps apply blocked and the user can answer again.

**Fix:** When the prior conversation is available, distinguish an answered question from an unanswered one before using the matching digest as a fallback.

`class:` answered decision inferred as unanswered.  
`single instance:` A whole-tree `functions.grep` search for `question unanswered|digest still equals|resumes this review|Unanswered approach question` found the digest-based inference only at the schema site; the plan and specification describe unanswered questions without that inference.

## Nit

None.

## Checked

- **Previous findings:** The classification scenario now excludes delivered auth, migration, wire/API and state-machine behavior before assigning `none`. The specified early-ask scenarios, negative control and README now exclude rounds meeting the approach-question trigger.
- **Duplication across slices/files:** No instance found requiring consolidation; the repeated class wording is a reference or consumer-facing summary of the shared policy.
- **Naming inconsistency:** No instance found across the three nouns checked: *change verification*, *Mandatory class* and *approach question*.
- **Uneven API surface:** No instance found; the changes introduce instruction and specification contracts rather than sibling component APIs.
- **Mixed conventions:** No instance found apart from the resume inference noted above.
- **Missing or premature abstractions:** No instance found.
- **Dead code:** No new production helper, type, input, variable, class or translation key was introduced.
- **Doc drift:** No remaining instance found at the previously reported sites or the supplied seams.
- **Surprise scope:** Changed paths match the plan’s policy, schema, specification and documentation surfaces, plus the template-consumer fixture and execution plan. No excluded work was found implemented.
- **Plan walks:** The supplied plan’s five post-edit commands, F1-A–E, F2 and F3 are verification work still to be established; this review did not run them or find supplied execution evidence for them. The post-merge effectiveness observation remains outside the gate. No i18n keys or OpenAPI surface changed. The changed-file inventory fits the named implementation surfaces.
- **Seams:** Checked the shared definition and its consumers; approach flow against blocker disposition, specifications and README; session-auth carve-out; task template against its fixture and placeholder validator; and both config copies against the installer note.
- **Simplification pass:** No cross-slice simplification candidate found.
- **Residual risk:** Real-session behavior and the planned QA evidence remain unverified by this read-only review.

PASS
