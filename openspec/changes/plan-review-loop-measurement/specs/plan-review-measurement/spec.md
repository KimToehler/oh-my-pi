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

### Requirement: Unadjudicated rows carry no precision claim

A finding row that records a descriptive historical label rather than an independent judgment SHALL be marked as such. It MAY establish coverage of the frozen ledger, and SHALL be excluded from every precision figure and SHALL be rejected outside a historical reference trial. Repeated independent assessments of a target's severity SHALL be retained as normalized rows, and any agreement figure SHALL be derived from them rather than asserted.

#### Scenario: Historical arm without adjudicated findings
- **WHEN** an arm's findings carry only descriptive annotations
- **THEN** the arm reports its coverage and reports no false-positive rate, naming the missing judgment as the reason

#### Scenario: Negative control
- **WHEN** a report derives a false-positive rate from rows that were never independently judged, or a fresh trial carries such a row
- **THEN** the precision figure MUST fail its adjudication check and the dataset MUST fail validation

### Requirement: Partial post-triage coverage is disclosed

A post-triage figure pooled from fewer trials than the arm or item completed SHALL state the contributing trial count alongside the figure, so a subset result is never read as the full set's result. An arm or item without a single triaged trial SHALL report no post-triage figure or count at all.

#### Scenario: One triaged trial among many
- **WHEN** one of fourteen completed trials of an arm has a triage outcome
- **THEN** the arm's post-triage cells carry their one-of-fourteen coverage

#### Scenario: No triaged trial at all
- **WHEN** no completed trial of an arm has a triage outcome
- **THEN** the arm's post-triage figures and its triage counts are reported as unavailable, never as zeros

#### Scenario: Negative control
- **WHEN** a report presents such a pooled value without its coverage
- **THEN** the coverage check MUST fail

### Requirement: Triage losses distinguish false drops and legitimate residuals

For each completed trial, the report SHALL separate undiscovered targets, pre-triage discoveries, retained blocking targets, legitimate residuals, undecided losses and false drops. A false drop requires an independently adjudicated, currently blocking defect that was discovered but has no surviving blocking finding after triage. Verifier status alone SHALL NOT determine ground truth. Counts SHALL deduplicate by target and show their denominators.

#### Scenario: Another finding preserves the same target
- **WHEN** one matched finding is refuted but another finding for the same blocking target is retained
- **THEN** target-level recall is preserved and that target is not a false drop

#### Scenario: Negative control
- **WHEN** an arm never discovers a target, or drops a target independently judged below the current blocking threshold
- **THEN** a report counting either case as a false drop MUST fail the target-level count check

### Requirement: Verifier losses outside the frozen ledger are reported

Independently blocking discoveries that match no frozen target SHALL have their triage outcome reported, deduplicated by mechanism within each trial, separately from the target-level false-drop figures and without entering any target denominator. The report SHALL state that measurement unit. An arm whose triage is unavailable SHALL report no such figure.

#### Scenario: Refuted blocking discovery with no target
- **WHEN** the verifier refutes a finding the adjudicator rated valid and blocking that matches no frozen target
- **THEN** the report counts it as a dropped blocking mechanism outside the ledger, and the arm's false-drop figure stays unchanged

#### Scenario: Negative control
- **WHEN** such a loss is folded into the false-drop numerator, or omitted from the report entirely
- **THEN** the target-level count check MUST fail

### Requirement: Trial repeats and costs retain their measurement unit

The report SHALL show per-item, per-trial and macro/micro recall, triage-retained recall and false-drop rates with numerators and denominators. Repetition union SHALL be labelled best-of-repeats coverage, not one-round recall. It SHALL report review, verifier, adjudication and failed-attempt costs separately; measured elapsed spans SHALL include waits and tools. A trial span SHALL cover every attempt bound to that trial, including failed and excluded ones, and SHALL NOT be called complete while the trial's verifier stage never completed. Missing historical timing SHALL remain unavailable, never estimated from summed model durations.

#### Scenario: Repetition union is not typical recall
- **WHEN** disjoint targets are found in three repeats on one item
- **THEN** each repeat's recall and their union are separate figures, and the union is labelled three-repeat coverage

#### Scenario: Failed verifier after a completed reviewer
- **WHEN** a trial's reviewer completes and its only verifier attempt fails
- **THEN** the trial span covers both attempts and is reported incomplete, never as a reviewer-only complete span

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
