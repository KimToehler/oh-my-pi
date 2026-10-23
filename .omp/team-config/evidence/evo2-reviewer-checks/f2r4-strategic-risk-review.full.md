Bottom line: Change holds architecturally: schema shape stays stable, `structured: true` enables task reuse without changing native dispatch, and domain policy remains isolated to `plan-reviewer`. No strategic blocker; main residual risks are deployment skew and feedback-size pressure, neither outside supplied acceptance boundary nor proven to break current flow.

## Action plan

1. **Architecture — holds.**  
   `packages/coding-agent/src/prompts/agents/plan-reviewer.md` owns review policy and structured-output opt-in; `planReviewSchema()` in `plan-review.ts` continues exposing same verdict shape. `sanitizeReviewField()` handles complete blocker transport, while `AgentSession` only reuses exported `sanitizeReviewText()` for cap notices. Local `agents: [plan-reviewer]` scoping avoids polluting main-agent behavior. Deleting `momus.md` removes duplicate policy rather than creating another abstraction.

2. **Structural gaps beyond line-level audit.**  
   - Repo prompt, user rule, and deleted user agent form non-atomic deployment across git and `~/.omp`; QA proves current workstation state, not rollback/version-skew safety.
   - JTD validates output shape, not semantic requirements such as every site, one blocker per defect class, valid CHECK labels, or completeness. Those remain probabilistic prompt contracts.
   - Unlimited blocker/site reporting now competes with fixed model output, planner context, renderer bounds, and two review rounds. T5-m proves 12 sites survive; it does not establish behavior near transport limits. [INFERENCE] A sufficiently large rejection could become incomplete or invalid and fall into existing `unreviewed` handling.

3. **Highest-impact production failure — reviewer disappears into fail-open behavior.**  
   Worst outcome is agent-resolution, frontmatter, or structured-output failure causing native review to produce `unreviewed`, silently removing review protection from every proposal. Supplied parser/schema tests, structured assertion, 138-test run, typecheck, and native `--plan-yolo` result address this change’s primary routes. Remaining exposure is operational skew: an active local config referencing deleted `momus`, or deploying bundled and local pieces at different revisions.

4. **False positive on unchanged behavior.**  
   Earlier round-3 finding that open blockers do not return to planner after review-round exhaustion identified real debt, but not regression from this change. Final audit correctly reclassified it as `PRE-EXISTING / OUT-OF-SCOPE`; Plan C owns that behavior. Harness-tag injection was not false positive: removing truncation expanded model-controlled blocker transport, and `escapeHarnessTags()` appropriately fixed that delta.

5. **Blockers:** none. Class/site inventory requirement not triggered. No search run because brief prohibited commands and supplied diff was sole source.

**Effort:** Quick (<1h)

**Confidence:** medium — supplied diff, plan, QA matrix, and audit support PASS; independent whole-tree and active-local-config searches were prohibited.

**Watch out for:**
- Repo/local deployment or rollback skew after deleting `momus.md`.
- Large reviewer results exhausting structured-output or planner-context capacity.
- Prompt-only semantic checks producing false positives; supplied matrix already records this accepted residual.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
adversarial_criteria:
- invariant: a large valid rejection must remain structurally complete through reviewer output transport and must leave enough planner context for a remediation turn
  positive_witness: a near-budget rejection reaches the planner with both first and last blocker-site sentinels intact, then the planner starts the next proposal round
  negative_control: increasing blocker evidence causes an invalid structured verdict, an unreviewed outcome, loss of the final sentinel, or failure to start the remediation turn
  observable: plan-review audit outcome, first/last sentinel presence in the planner's actual tool result, token usage, and the next proposal event
  boundary: `runStructuredSubagent` result through `interpretResult` and `AgentSession` rejection-result assembly
END-REVIEW-TRAILER