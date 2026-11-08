# F1 exp-onb (*test*)

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: expect onboarding sets its configured tag, an unmapped screen is refused`

Broken-copy controls (`f1/broken-copies-log.txt`, command `node f1/broken-copies.mjs <qa.mjs> <qa.test.mjs>` on the head, each copy run through `QA_UNDER_TEST`; the lines below are copied from that log):

```
caught account-1-home-defaults (exit 1, pattern ^(flow: (credentials|expect)))
  failed: flow: credentials of the default account and the default screen without flags
  failed: flow: credentials with a missing key stop the run before maestro starts and name the key
  failed: flow: credentials of a linked worktree come from the main checkout file of the working directory
  failed: flow: credentials sentinel run across every sink leaves no value of either account, failing and passing
```

## Observation

`cred-acc2`'s live run on the iOS simulator used `--expect onboarding` and landed on the onboarding welcome screen. The test proves the environment: with `--expect onboarding` the fake Maestro sees `MAESTRO_EXPECT_TAG=onboarding-welcome` (the configured tag, not the screen name), the default run sees `home`, and an unmapped screen is refused before Maestro starts. The broken copy hard-coding `home` as the default fails that area.
