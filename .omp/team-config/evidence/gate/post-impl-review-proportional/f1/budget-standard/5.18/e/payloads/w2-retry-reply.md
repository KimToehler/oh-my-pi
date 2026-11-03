## 1. Goal and behavioural contract
The change totals a supplier `name,price` file in exact cents and prints it with two decimals and grouped thousands, and refuses an unreadable file with one message and exit code 2. This wave reads the fixed tree: the CLI, the parser, the cents conversion, the formatter and their tests, with the QA matrix and its carried rows.

## 2. Correctness, regressions, architecture, wire contracts
I read the CLI's read-error branches, the parser, the cents conversion and the formatter against the spec scenarios and found no defect that meets the blocking threshold. The module split is consistent and I see no duplication to simplify.

## 3. Security and privacy delta
One local file in, text out. No credential, authentication path, network recipient or personal data is involved, and the diff did not change exposure.

## 4. Verification adequacy
The QA rows and tests pass and their artifacts show command, input, output and exit code. The carried rows each state a reason that holds for the diff.

## 5. Final verdict
PASS

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cc/claude-opus-5
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: a read failure never prints a cause that is not the actual one
  positive_witness: a file with mode 000 prints a message containing `permission denied`
  negative_control: the same run prints `no such file`
  observable: stderr of the CLI for a file the caller may not read
  boundary: the CLI process boundary
END-REVIEW-TRAILER
