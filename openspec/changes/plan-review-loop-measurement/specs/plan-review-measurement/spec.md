# Spec Delta

## Purpose

Measure plan-review discovery and verifier losses on frozen historical inputs, separating missed defects, incorrect triage and legitimate residuals without treating repeats as independent evidence or historical rounds as observed savings.

## ADDED Requirements

### Requirement: Trials bind inputs and resolved execution

The measurement SHALL bind each trial to hashed plan, repository revision, brief, agent contract, rules and corpus inputs. It SHALL retain raw reviewer and verifier results, actual models and efforts, costs and dispatch-to-terminal timestamps. Wrong-model, wrong-effort, failed or incomplete attempts SHALL remain visible but excluded from completed-arm quality figures; their incurred cost SHALL remain counted.

#### Scenario: Completed and excluded attempts
- **WHEN** one intended trial completes on its pins and another falls back to a different model
- **THEN** only the first contributes quality results, both contribute incurred cost, and the second is listed with its exclusion reason

#### Scenario: Negative control
- **WHEN** an input manifest digest differs from the bytes supplied for scoring
- **THEN** scoring MUST fail with a nonzero exit rather than publish figures from that input

### Requirement: Comparisons disclose changed axes

The report SHALL identify differing model, effort, brief, reviewer contract, rules, snapshot, triage policy and sampling axes per comparison. Historical arms SHALL be labelled historical references. Multiple changed axes SHALL prohibit single-axis attribution. A model-only comparison SHALL state that three sol repeats versus one terra run is asymmetric sampling, not proof of model equivalence.

#### Scenario: Historical lens comparison
- **WHEN** fresh single-reviewer sol trials are compared with historical three-lens terra results
- **THEN** the report lists the changed axes and labels the comparison confounded

#### Scenario: Negative control
- **WHEN** arm metadata differ in model and brief
- **THEN** a generated comparison labelled loop-only MUST fail the comparison check

### Requirement: Matches require snapshot-based adjudication

A known-defect hit SHALL require a recorded finding-to-target adjudication with evidence on the reviewed snapshot. New findings SHALL NOT inherit matches from historical finding identifiers. Duplicate mechanisms SHALL count once per trial; several findings mapping to one target SHALL NOT increase recall. Unmatched or undecided findings SHALL be queued for blinded adjudication, not automatically labelled false positives.

#### Scenario: Duplicates and an additional discovery
- **WHEN** two findings match the same target and a third names a different valid defect outside the target set
- **THEN** target recall counts one hit and the third is reported separately as an additional validated mechanism

#### Scenario: Negative control
- **WHEN** a new finding reuses a historical finding ID without a new snapshot-evidenced match
- **THEN** a report inheriting the historical hit MUST fail the match-contract check; the finding remains unmatched

### Requirement: Triage losses distinguish false drops and legitimate residuals

For each completed trial, the report SHALL separate undiscovered targets, pre-triage discoveries, retained blocking targets, legitimate residuals, undecided losses and false drops. A false drop requires an independently adjudicated, currently blocking defect that was discovered but has no surviving blocking finding after triage. Verifier status alone SHALL NOT determine ground truth. Counts SHALL deduplicate by target and show their denominators.

#### Scenario: Another finding preserves the same target
- **WHEN** one matched finding is refuted but another finding for the same blocking target is retained
- **THEN** target-level recall is preserved and that target is not a false drop

#### Scenario: Negative control
- **WHEN** an arm never discovers a target, or drops a target independently judged below the current blocking threshold
- **THEN** a report counting either case as a false drop MUST fail the target-level count check

### Requirement: Trial repeats and costs retain their measurement unit

The report SHALL show per-item, per-trial and macro/micro recall, triage-retained recall and false-drop rates with numerators and denominators. Repetition union SHALL be labelled best-of-repeats coverage, not one-round recall. It SHALL report review, verifier, adjudication and failed-attempt costs separately; measured elapsed spans SHALL include waits and tools. Missing historical timing SHALL remain unavailable, never estimated from summed model durations.

#### Scenario: Repetition union is not typical recall
- **WHEN** disjoint targets are found in three repeats on one item
- **THEN** each repeat's recall and their union are separate figures, and the union is labelled three-repeat coverage

#### Scenario: Negative control
- **WHEN** a historical arm has no retained dispatch-to-terminal timestamps
- **THEN** a report synthesizing elapsed time from message durations MUST fail its timing check; elapsed remains unavailable

### Requirement: Round savings are counterfactual unless full cycles were observed

The report SHALL retain historical recorded round numbers with source revisions and workflow provenance when known. It SHALL distinguish these observations from a bounded-budget counterfactual and from fresh first-pass replay measurements. Without paired full review/fix cycles, measured rounds saved and causal full-cycle savings SHALL be reported as not measured.

#### Scenario: Final record only
- **WHEN** an archive's last review record says round 17 but intervening rounds are not reconstructed
- **THEN** the report records last round 17, not 17 verified successful rounds or a measured saving of 15

#### Scenario: Negative control
- **WHEN** the fresh dataset contains only first-pass trials
- **THEN** a report presenting an observed rounds-saved number MUST fail its measurement-unit check

### Requirement: Published results retain auditable scoring inputs

The committed result SHALL include a safe normalized scoring dataset, manifest digests, counts, per-target adjudication evidence and the deterministic report command. Raw transcripts and full historical plans SHALL remain local. Publishing SHALL exclude credentials, private code and personal data. The retained normalized dataset SHALL suffice to reproduce all published numeric tables without the ignored runs directory.

#### Scenario: Recompute without local raw sessions
- **WHEN** the scorer reads only the committed normalized dataset and its manifest
- **THEN** it reproduces the committed numeric tables and identifies local-only raw inputs by digest

#### Scenario: Negative control
- **WHEN** a published count depends on omitted normalized trial or adjudication rows
- **THEN** the published-data check MUST fail instead of accepting that result
