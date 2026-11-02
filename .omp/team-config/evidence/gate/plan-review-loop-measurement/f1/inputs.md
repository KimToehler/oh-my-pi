# Historical input acceptance

Observed during apply, before any new replay dispatch.

- Five original parent sessions recovered. The first reviewer dispatch selects the cutoff for each fixture. Only preceding successful write/edit events are used for functional plan sections; later fixes and review.md are excluded.
- Frozen bases: Spt `763479f9bc1535729565a009a742fd4c4a9ef9d8`; Smt/App `2fbcd38ddea0e65323aca6b6185ad66b52b79967`; Fmp `f732b52c4544d325d835d8bfb2861b1d21676217`; Rtr `814fb0a9f38b235043b6ae161060345aa17d0ad0`. Full tree IDs and per-file SHA256s are in local items.json.
- 32 restored files: Spt 6, Smt 6, App 8, Fmp 6, Rtr 6. Task-owned detached fixture worktrees exist under their respective repositories' `.worktrees/measurement-*`; no primary checkout files edited.
- Every complete historical reviewer read compared exactly after terminal-newline normalization. Spt tasks split reads `1-45` and `46-51` both match the reconstructed ranges. Fmp tasks split reads `1-45` and `46-64` both match. No expansion of truncated text was guessed.
- Every original latent quote matches the corresponding restored snapshot: Spt 32/32; Smt 14/14; App 11/11; Fmp 10/10; Rtr 18/18. Total 85/85. Original target descriptions and source child membership recovered, not inferred from target IDs alone.
- Metadata-only repair: Fmp `.openspec.yaml` was not printed in the historical reviewer reads; exact metadata recovered from its first committed change (`5e6445dcb`). It is explicitly marked metadataOnly in provenance. Functional plan content comes exclusively from pre-dispatch records.
- Local protocol/scoring contract/items, source manifest, original briefs and byte-identical S/T item briefs retained under ignored `runs/plan-review-loop-measurement-20261102/`. The initial target ledger records current severity as unresolved, not historical-label-as-current-truth. Independent blind assessment may explicitly resolve it; unresolved targets cannot contribute definitive verifier losses.

## Real CLI inspection

Command: `bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102`

Observed exit 0:

```text
ok: 78 sources, 5 items, 40 trials, 30 attempts, 110 findings
```

The 40 trials include 20 historical trials and all 20 not-yet-dispatched intended cells. Missing cells are visible, not completed. Manifest hashing checks supplied inputs plus locally available historical child logs. Original raw plans/logs remain local; none is a publication artifact.
