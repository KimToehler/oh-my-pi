# F2 fix waves and their delta reviews

Date: 2026-11-01. Four waves, each a commit of fixes plus one `plan-reviewer` delta check over
`gate-convergence.mjs patch` output, as PROCESS 4 prescribes.

| wave | rows | fix commit | delta verdict |
|---|---|---|---|
| 1 | 5.1-5.4 | `bb0116faee` (+ tick `0fae1aa462`) | REJECT, 3 blockers |
| 2 | 5.5-5.7 | `2ac52f284c` | REJECT, 2 blockers |
| 3 | 5.8-5.9 | `2706671b61` | OKAY |
| 4 | 5.10-5.11 | `916606d630` | OKAY |

Wave 3's OKAY carried a non-blocking note (task 1.1 still held the refuted condition-3 wording)
that wave 4 fixed as row 5.10, together with the strict-validation defect wave 2 had introduced.

## What the waves fixed

- **5.1** the verifier could refute a missing-verification finding by citing a requirement or
  scenario, which no task executes. Both F1-A and two F1-E runs had lost the planted defect that
  way.
- **5.2** the scope ask shared the exception asks' "keep as a residual" option, so a confirmed
  blocking finding could be dropped without the exhaustion ask's Override ban.
- **5.3** a verifier failing twice left no record, so an earlier OKAY stayed current and
  `--reviewed` kept authorizing apply over the round's blockers.
- **5.4, 5.7** F1-A and F1-E (b) re-run end to end on the fixed text; the earlier evidence had
  recorded a PASS whose planted defect was refuted.
- **5.5, 5.6, 5.10** the criteria, the design and the tasks still described the superseded
  behaviour, so a reader re-deriving the loop from them restores a fixed defect.
- **5.8, 5.9, 5.11** the plan's own Verify commands: two could not pass on correct text, one
  evidence row kept no retained tool calls, and four requirement bodies exceeded the
  500-character limit `openspec validate --strict` enforces.

## Verify sweep

Every `Verify:` command in `tasks.md` was extracted and run as written, from the worktree root,
after the wave-4 commit:

```
$ bun -e '... for each "- [x] <n> … Verify: `<cmd>`" run bash -c <cmd> ...'
ALL TASK VERIFY COMMANDS PASS      (24 rows: 1.1-1.2, 2.1-2.3, 3.1-3.2, 4.1-4.6, 5.1-5.11)
```

Task 2.1's command ends in `openspec validate plan-review-proportional --strict --no-interactive`,
which exits 0 (`Change 'plan-review-proportional' is valid`). `bun run test:team-config` was run
after every wave: `695 pass, 0 fail`.

## Open after these waves

`validate-openspec-change.mjs --reviewed` fails with
`stale: the change changed after review (reviewed a4673252…, current 3f46c576…)`: the plan review
recorded in `review.md` (Round 4, OKAY) predates all four waves. The change folder must be final
and re-reviewed before the F2 merge-gate snapshot the plan's Workflow follow-up names.
