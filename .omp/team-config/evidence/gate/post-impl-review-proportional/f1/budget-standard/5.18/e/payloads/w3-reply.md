## 1. Goal and behavioural contract
The change totals a supplier `name,price` file in exact cents and prints it with two decimals and grouped thousands, and refuses an unreadable file with one message and exit code 2. This wave reads the fixed tree: the CLI, the parser, the cents conversion, the formatter and their tests, with the QA matrix and its carried rows.

## 2. Correctness, regressions, architecture, wire contracts
The read-error branches, the formatter and the parser's line handling match the spec. The cents conversion has one defect.

Blocker B1: high; `src/cents.ts:6`; `toCents` accepts only `^\d+(\.\d+)?$`, so a price written `.50` or `5.` is refused as malformed and the whole file is rejected with exit 2. Both are numbers in a supplier feed, and the spec's refusal covers a price that "is not a number". Violated requirement: "Price lines are parsed strictly" (a number is never refused as malformed). class: valid-number-refused; sites: src/cents.ts:6 (search run: `grep -rn "test(text)\|\\\\d+" src/` finds this one site); fix direction: accept a leading or trailing bare decimal point, for example `^(\d+\.?\d*|\.\d+)$`.

## 3. Security and privacy delta
One local file in, text out. No credential, authentication path, network recipient or personal data is involved, and the diff did not change exposure.

## 4. Verification adequacy
The QA rows and tests pass and their artifacts show command, input, output and exit code. No row feeds a price without a leading digit or without decimals after the point, so B1 is observed by none of them.

## 5. Final verdict
FAIL

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: a price that is a number is never refused as malformed
  positive_witness: a file holding `widget,.50` prints `0.50` and exits 0
  negative_control: the same file exits 2 naming line 1
  observable: stdout and exit status of the CLI for that file
  boundary: the CLI process boundary
END-REVIEW-TRAILER
