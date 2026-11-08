# F1 cred-sentinel (*test*)

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: credentials sentinel run across every sink leaves no value of either account, failing and passing`
- `scan: the foreign accounts and sentinel are hits, a value no account names is not`

Broken-copy controls (`f1/broken-copies-log.txt`, command `node f1/broken-copies.mjs <qa.mjs> <qa.test.mjs>` on the head, each copy run through `QA_UNDER_TEST`; the lines below are copied from that log):

```
caught devtest-key-pattern (exit 1, pattern ^(flow: credentials|scan:))
  failed: flow: credentials parsing trims, strips one pair of matching quotes and keeps the last non-empty definition
  failed: flow: credentials of a linked worktree come from the main checkout file of the working directory
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
  failed: scan: the foreign accounts and sentinel are hits, a value no account names is not
  failed: scan: a clean file whose name holds a password is a hit, printed with the value redacted
```

```
caught account-1-home-defaults (exit 1, pattern ^(flow: (credentials|expect)))
  failed: flow: credentials of the default account and the default screen without flags
  failed: flow: credentials with a missing key stop the run before maestro starts and name the key
  failed: flow: credentials of a linked worktree come from the main checkout file of the working directory
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
```

```
caught redact-selected-account-only (exit 1, pattern ^(flow: (credentials|redact)))
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
```

## Observation

The `foreign` fixture's sentinel run leaves no value of either account in any sink of design D3, failing and passing; the suite fails each of the three broken copies of design D7.
