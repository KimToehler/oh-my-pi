# Review

- **Verdict**: REJECT
- **Reviewed digest**: 2e27f60ff802dddc82f1567e8cb91dae63df67c839bda6b9e9d8ee46f234466b
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanRevDelta8_AQSD
- **Verifier**: blocker-verifier, none
- **Models**: PlanRevDelta8_AQSD onara/cx/gpt-6.1-sol
- **Round**: 8
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta (PlanRevDelta8_AQSD)

1. {"area": "CHECK 5 — task 2.1 / F1 agent-nc (fix entry 2)", "defect": "The fresh-agent verification never exercises refusal after a clean scan. Its only external-evidence fixture already contains a token, so the old policy—refuse hits but read after a clean scan—can satisfy the planned observation. With an ordinarily growing application log, that undetected behavior can still disclose a credential appended after scanning; transcript disclosure is not reversible.", "evidence": "openspec/changes/app-qa-shared-driver/design.md:114 explicitly says a clean scan must not admit a later read. specs/app-qa-driver/spec.md:267 forbids external-evidence reads whatever the scan returned. However, tasks.md:78 tests only an existing folder that already holds a token; tasks.md:19 adds textual grep checks, not a behavioral control for clean admission. Neither specifies the requested post-scan mutation control.", "change": "Extend agent-nc with a fresh-session control using initially clean external evidence. After the clean scan, append a synthetic token to the original and demonstrate that the session still refuses to read or list the external evidence and writes its capture elsewhere. Retain the relevant tool interactions and final report; keep the existing hit-folder control."}
   - not triaged: the verifier has not returned

2. {"area": "CHECK 1 — task 1.8 / F1 scan-nc (fix entry 4)", "defect": "The sentinel-redaction controls cover a basename only with credentials configured. They omit both the ancestor-directory case and the no-credentials branch expressly requested by fix entry 4. An implementation that adds sentinels to redaction only inside the credentials branch would pass these controls but print the sentinel during normal scanning without credentials. That breaks the scan criterion, although the synthetic-marker contamination is reversible.", "evidence": "openspec/changes/app-qa-shared-driver/tasks.md:14 places the new CANARY.log redaction test on the populated foreign fixture; its minimal-fixture controls cover tokens, links and a FIFO, not sentinel-bearing paths. tasks.md:73 likewise adds a sentinel-bearing basename only to the onara scan. Existing qa.test.mjs:2020-2035 exercises the minimal branch with a token but no configured sentinel. specs/app-qa-driver/spec.md:233,244-245 prohibit printing configured sentinels without limiting that prohibition to credential-configured scans.", "change": "Add controls for a matching file whose basename contains the configured sentinel and one whose ancestor directory contains it, each with and without a credentials section. Assert zero literal-sentinel occurrences across stdout and stderr, and require a broken copy that extends redaction only in the credentials branch to fail."}
   - not triaged: the verifier has not returned


## Residuals

none
