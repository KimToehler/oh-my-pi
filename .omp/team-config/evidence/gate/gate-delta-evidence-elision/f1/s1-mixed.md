# F1 row s1-mixed

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Deployed: `captures/deploy/deployed-vs-H.txt` shows `~/.local/bin/omp.deployed` at H and the deployed
`gate-convergence.mjs`, `gate-layout.mjs` and `SKILL.md` byte-identical to H.

Commands: `bash run-scenarios.sh` (section s1-mixed), which runs the deployed
`~/.omp/agent/skills/review-work/scripts/gate-convergence.mjs patch` on a scratch commit that adds `src/engine.kt` and
the capture `.omp/team-config/evidence/gate/demo/f1/logcat.txt`; then `bash s1-weaver.sh`, which runs the deployed
`GC patch --repo ~/git/weaver/.worktrees/m5-app-design-workspace --base 3e180e65 --head 32dc8c5d --out /tmp/f1-weaver-ClO5/delta`
and, in that directory, `(cat manifest.json; jq -r '.commits[].patch' manifest.json | xargs cat) | wc -c` and `du -sk .`.
The before figure is the same command in the earlier whole-commit dispatch of the same range.

Observation:
- Scratch: the directory holds `001.patch`, `001.evidence.patch` and `manifest.json`, all read-only. `001.patch` holds
  the `src/engine.kt` hunk and ends with `Left out by GC patch: ... in 001.evidence.patch beside this patch` and the
  line `1 files, +3 -0	.omp/team-config/evidence/gate/demo/f1/`; the manifest names `left_out` `.omp/team-config/evidence/`.
- Weaver range (60 commits, 25 with an evidence file): mandatory reading set 311695 bytes, under 1 MB, against
  10743031 bytes for the earlier whole-commit dispatch of the same range. Directory size, no expectation: 10720 KB.
- `678b0d00` is `045.patch`, 5736 bytes (4793936 before): one `diff --git` for `WebViewEngine.kt`, none for a file
  under `.omp/team-config/evidence/`, and its listing names the logcat directories under
  `.omp/team-config/evidence/gate/m5-app-design-workspace/f1/diagnosis/android-busy-return/`, with `045.evidence.patch` beside it; the four `logcat.txt` files of that commit are in the listed
  `attempt1-terminate-only/leave-*-return/` directories (`weaver-678b0d00-listing.txt`).

Capture: captures/deploy/deployed-vs-H.txt sha256:ed0020e47edb47a17b68ff8d397b4684af8b47979870add66d4409d9de8e9e01
Capture: captures/s1-mixed/patch.stdout sha256:d9b3877d17ebde87e4ab595cb80e131506516633a902e4d1160915d5a9253d63
Capture: captures/s1-mixed/listing.txt sha256:59253ab3e616cb69d91e53b7038c2c6b7adcb7e90b80b7fd12d4105e49e27757
Capture: captures/s1-mixed/manifest.json sha256:e7a0a3d5a8dcb8a776953d4a8607961d4993e59dd571b423b068c6d609a9d50c
Capture: captures/s1-mixed/001.patch sha256:49591205df17df9f88d3bde9ed6e58ac44e6d1a0d8828bb4aaa1420b7208b1f5
Capture: captures/s1-mixed/001.evidence.patch sha256:54d40dfd813b6758b84b7af06b9ea4c7ebe8f4b9b294326e7356916d758180cb
Capture: captures/s1-mixed/weaver-patch.stdout sha256:0719388cc6616381608aa302bee4250f32ba1035435a5b55f33311379af07736
Capture: captures/s1-mixed/weaver-manifest.json sha256:c5dabc70956ee00912aa562a7a6ba8f741dd12a564612e49f0c69625777e45f5
Capture: captures/s1-mixed/weaver-sizes.txt sha256:97174a5f4c2d836e27bb9a108defd7169ad5410cb39cac93e3bf8ecfb894e0b7
Capture: captures/s1-mixed/weaver-before.txt sha256:6cd9bd1ce4160cb92dbd7ed120df2c10737d26e3c5b6fcef124d2ebab394db0c
Capture: captures/s1-mixed/weaver-678b0d00.txt sha256:afacc2a842658270cb0f1e338004520ff3097b8580108c71d2569feb3374dce0
Capture: captures/s1-mixed/weaver-678b0d00.patch sha256:fdf0446c60839998ffd85952e2d6efb17929724181c5fea93e269688cf557553
Capture: captures/s1-mixed/weaver-678b0d00-listing.txt sha256:49f64135c61e4f68bd600adeac1c028bda1b458f911046f430d4fb0a79089156

Verdict: PASS
