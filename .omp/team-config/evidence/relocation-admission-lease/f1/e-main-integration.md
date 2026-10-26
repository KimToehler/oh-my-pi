# F1 e — current main integration verification

Runtime head: `df2a0e6917602128fa20569e959265fc67acacc0` (merge commit `fe275c56c4` integrated `main` `9c075012392644690a351983316004a70b90c5f6`; later evidence/task commits do not change runtime code).

## Real surfaces

The four real-surface scenarios were rerun on this merged tree:

- `a-move.md`: real TUI move continued in `/private/tmp/ral-f1/qa-a5/.worktrees/a`; the completed Helper transcript moved with the root artifacts.
- `b-acp-peer.md`: one real ACP process held HelperA's parked revival until A's move settled, then revived from the moved transcript and delivered `pong-a`.
- `c-other-tree.md`: the same ACP process revived HelperB before A settled and delivered `pong-b`, proving unrelated-tree isolation.
- `d-refused.md`: real TUI `session_move` refused while Sleeper was running and left the session in the source checkout.

## Full coding-agent suite

Before updating the two pre-existing command-controller fixtures, `bun test` produced:

```text
19513 pass
365 skip
29 fail
1 error
98117 expect() calls
Ran 19907 tests across 1841 files.
```

Twenty-two failures were the new, branch-caused class: every `/move` and standalone-`cd` command-controller case failed because its fake session omitted `holdRelocationAdmission`. This was the RED control for task 8.3.

After both fixtures supplied an already-ready disposable relocation lease:

```text
bun test test/modes/controllers/move-command.test.ts test/modes/controllers/bash-command.test.ts
31 pass
0 fail
276 expect() calls
Ran 31 tests across 2 files.
```

The post-fix full `bun test` produced:

```text
19535 pass
365 skip
7 fail
1 error
98333 expect() calls
Ran 19907 tests across 1841 files.
```

No command-controller test failed. The remaining failures are the repository's tracked main baseline set from `.omp/team-config/evidence/gate/acp-permission-parity/f6-fix-round-verification.md`: queued-steer interrupt, disabled-provider model selection, two browser executable timeouts plus their between-test process error, Chromium submit-name, `handleSkillList`, and `/plugins` npm toggle. The previously recorded update-cli `ENOENT` did not recur.

## Static checks

`PATH="$HOME/.cargo/bin:$PATH" bun check` exited 0. The TypeScript no-excuse checker reported only the two pre-existing whole-fixture `as unknown as InteractiveModeContext` casts; the added lease members introduce no new violation.

RESULT e merged verified
