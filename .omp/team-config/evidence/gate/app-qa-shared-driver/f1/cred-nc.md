# F1 cred-nc (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: credentials only in the environment, never in argv`
- `flow: credentials of a linked worktree come from the main checkout file of the working directory`

Broken-copy controls (`f1/broken-copies-log.txt`, command `node f1/broken-copies.mjs <qa.mjs> <qa.test.mjs>` on the head, each copy run through `QA_UNDER_TEST`; the lines below are copied from that log):

```
caught password-in-argv (exit 1, pattern ^(flow: credentials))
  failed: flow: credentials only in the environment, never in argv
```

```
caught credentials-from-script-repository (exit 1, pattern ^(flow: credentials))
  failed: flow: credentials of the default account and the default screen without flags
  failed: flow: credentials of --account alpha with --expect welcome
  failed: flow: credentials only in the environment, never in argv
  failed: flow: credentials of a linked worktree come from the main checkout file of the working directory
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
```

## Observation

The suite fails the copy putting the password into Maestro's argv and the copy reading the script directory's repository.
