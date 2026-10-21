# Plan size guard

## Approach
1. Add `assertPlanSize(plan)` (refuse plans over 64 KB) to the TUI plan-approval path in `packages/coding-agent/src/modes/interactive-mode.ts`.

Entry paths that approve plans: TUI, ACP.
| Path | assertPlanSize |
|---|---|
| TUI | yes |
| ACP | no |

## Verification
- `bun test packages/coding-agent/test/plan-review.test.ts`

- Merge gate: not applicable (fixture)
