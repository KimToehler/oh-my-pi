# F1 sweep-nc (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: sweep redacts an XML-escaped password in the report`
- `flow: sweep removes files and folders whose names hold a credential, failing and passing`
- `scan: a clean file whose name holds a password is a hit, printed with the value redacted`

Broken-copy controls (`f1/broken-copies-log.txt`, command `node f1/broken-copies.mjs <qa.mjs> <qa.test.mjs>` on the head, each copy run through `QA_UNDER_TEST`; the lines below are copied from that log):

```
caught sweep-skips-xml-escaped-form (exit 1, pattern ^(flow: (sweep|credentials|redact)))
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
  failed: flow: redact a printed credential in the failure message and the report
  failed: flow: sweep redacts an XML-escaped password in the report
```

```
caught sweep-contents-only (exit 1, pattern ^(flow: (sweep|screenshot)))
  failed: flow: sweep removes files and folders whose names hold a credential, failing and passing
```

```
caught scan-contents-only (exit 1, pattern ^(scan:))
  failed: scan: a clean file whose name holds a password is a hit, printed with the value redacted
```

## Observation

The suite fails the copy skipping the XML-escaped form and the copies sweeping or scanning contents only (the path-name tests of design D7).
