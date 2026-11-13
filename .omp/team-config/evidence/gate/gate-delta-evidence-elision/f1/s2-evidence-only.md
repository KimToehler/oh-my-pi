# F1 row s2-evidence-only

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s2-evidence-only): the deployed `GC patch` on a commit that adds only
`.omp/team-config/evidence/gate/demo/f1/row.md` and the binary `.../f1/captures/shot.png`; `git show -s --format=fuller`
and `git show --format= --no-renames --patch` of that commit for comparison.

Observation: `001.patch` is the commit header (identical to `header.txt`), a blank line and the listing, with no
`diff --git` line: `1 files, +2 -0` for `.../demo/f1/` and `1 files, +0 -0` for `.../demo/f1/captures/` (the binary
file counts no lines). `001.evidence.patch` is byte-identical to the commit's whole diff (`cmp.txt`), so it holds every
hunk, the binary one included; the manifest names both files with their hashes.

Capture: captures/s2-evidence-only/patch.stdout sha256:796a6dab2cb6902b946fa7eadc0b34d16594a5f483d2bb45c48f397483edaca6
Capture: captures/s2-evidence-only/manifest.json sha256:9d93928f04756e45f6161c45eda57d72b38b892c59cc76deda3fdb85ee9bcc3f
Capture: captures/s2-evidence-only/001.patch sha256:897988af637f1acd2f48f718b99820ece5f0e27d023a1cc17dd287cae9bbeb1b
Capture: captures/s2-evidence-only/001.evidence.patch sha256:76c87caafbbb0749ac6b031c2cb88c6017431f9990b36a3f5a00d050056521ea
Capture: captures/s2-evidence-only/header.txt sha256:8f39efac78f9791b2b6b5eb1cfc85e814de7c8891236b5d047f314f6d5702076
Capture: captures/s2-evidence-only/whole-diff.txt sha256:76c87caafbbb0749ac6b031c2cb88c6017431f9990b36a3f5a00d050056521ea
Capture: captures/s2-evidence-only/cmp.txt sha256:e6fe7eae44f3a27473e9e64948adb69063ad5d0767b060f3d4db59be3a534cc7

Verdict: PASS
