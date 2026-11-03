## 1. Goal and behavioural contract

Reviewed the complete supplied diff, local source and tests, neighbouring configuration, OpenSpec artifacts, and all five F1 transcripts. Traced production callers with LSP references.

The CLI connects file loading, UTC-day calculation, fee calculation, report construction, and rendering. The `Date.UTC` correction addresses the previously observed DST defect. Sorting a mapped list preserves the input invoices.

One ordinary-input case still violates the unconditional requirement that report order not depend on input order.

## 2. Correctness, regressions, architecture, wire contracts

Blocker B1: **Medium — incomplete deterministic ordering**, `src/report.ts:20`. **Trigger:** two distinct invoices have the same due date and accrued fee, and the export changes their input order. **Preconditions:** ordinary valid invoices; for example, `INV-A` and `INV-B`, both 10000 cents, due `2026-01-10`, evaluated as of `2026-02-20`. The comparator returns zero for this pair, so stable sorting preserves their input order. **Impact:** reversing the input reverses these report lines, violating `openspec/changes/late-fee-report/specs/late-fees/spec.md:25` and the deterministic-report goal in `design.md:11`. **Damage:** reversible by regenerating the report; no money moves automatically. **Fix direction:** add a deterministic final tie-break, such as invoice ID, after fee and due date, and test both permutations through `buildReport` and rendering. **class:** `incomplete-sort-tie-break`. **sites:** `src/report.ts:20`, single instance—the repository-wide search `\.sort\(|\.toSorted\(|localeCompare|compare`, including ignored files, found no other implementation ordering site. **Closure:** class inventory complete; its sole implementation site remains open.

**Static witness, not a newly executed CLI observation:** for the invoices above, `[INV-A, INV-B]` retains that order, while `[INV-B, INV-A]` retains the reverse order. Each fee remains 200 cents and the total remains 400 cents; the defect is ordering, not fee calculation.

Across modules, responsibilities and data flow are otherwise straightforward. UTC date differences feed complete-period calculation; the percentage is capped before applying it; zero-fee entries are removed before summation; rendering places the total last. No existing consumer requires migration.

**Non-blocking note — numeric range:** `src/fee.ts:11` multiplies JavaScript numbers, and `src/report.ts:21` sums them without an exact-integer range bound. Sufficiently large values can lose cent precision. This does not block because no realistic ordinary-scale failing input was established; document the supported range or use exact arithmetic if such amounts are intended.

## 3. Security and privacy delta

No security delta meeting the brief’s definition was identified. The changed code introduces no credential, authentication, authorisation, network transmission, persistence, or protected-asset access change. The supplied fixtures contain synthetic invoice identifiers.

The CLI reads the explicitly selected local file and prints the report. Malformed-date diagnosis and broader schema validation are declared non-goals, not additional blockers.

## 4. Verification adequacy

The inspected F1 transcripts support the reported sample output, fee boundaries and rounding, cap, zero-fee exclusion, empty reports, CLI usage errors, DST independence, and seven passing unit tests. These are existing observations; I did not rerun commands.

The missing discriminator is **equal fee plus equal due date**:

- `src/report.test.ts:24-33` tests equal fees only with different due dates.
- `f1/qa4-report-ordering.txt` permutes inputs, but every listed pair is distinguished by fee or due date.

Consequently, both the unit suite and QA matrix miss B1.

**Non-blocking note — input-mutation evidence:** `f1/qa5-cli-regression.txt` checks unchanged files, not the in-memory invoice array. The implementation’s mapping step supports non-mutation by inspection, but a frozen-input regression test would protect that constraint.

**Non-blocking note — stale planning review:** the supplied validator result reports `review.md: stale`; `review.md:4` retains the earlier digest despite the added fix row in `tasks.md:17`. This is a review-record consistency issue, not another demonstrated product defect: the brief supplies a separate accepted delta review for that fix. Reconcile it before reusing the planning record as current reviewed evidence.

## 5. Final

B1 remains blocking under the supplied threshold: a realistic finance export violates an explicit ordering requirement. The existing successful QA does not exercise that case. No files were changed, and no remote lookup or sub-reviewer dispatch occurred.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: Distinct invoice IDs sharing both sort keys must receive a canonical relative order instead of inheriting their positions in the export.
  positive_witness: INV-A and INV-B, each 10000 cents due 2026-01-10 and evaluated on 2026-02-20, appear in one fixed relative order under both input permutations, each with a 2.00 fee and a 4.00 total.
  negative_control: Reversing those two input records reverses their printed lines while preserving their fees and total; this MUST fail.
  observable: Compare the ordered invoice IDs and rendered stdout from both permutations; the current comparator statically predicts different orders, but this witness was not runtime-executed during this read-only audit.
  boundary: buildReport returned lines and renderReport output consumed by the CLI.
END-REVIEW-TRAILER