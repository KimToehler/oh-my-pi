# F1 row s3-no-evidence

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s3-no-evidence): the deployed `GC patch` on a range of a source fix, a side
branch commit and the `--no-ff` merge of that branch, none touching `.omp/team-config/evidence/`; then `cmp` of each
patch against `git show --format=fuller --no-renames --patch <sha>`.

Observation: the directory holds `001.patch` to `003.patch` and the manifest, no evidence file; every patch is
byte-identical to `git show` of its commit, the two-parent merge (`003.patch`) included, and no manifest entry has an
`evidence` field.

Capture: captures/s3-no-evidence/patch.stdout sha256:4b344e9ce26086695af5852afcc50ac9620539569f576b8e1c5008cada3dbd40
Capture: captures/s3-no-evidence/files.txt sha256:b03303dd073ea51e3eba6fad0e0800c7757829093a744a3bbd01edfaec5418df
Capture: captures/s3-no-evidence/manifest.json sha256:c8fce2ddec7037574770867c42be02fd176f75184c686f79fd3f09f121e4ffe7
Capture: captures/s3-no-evidence/cmp.txt sha256:0d6c5b953b6ba8ee6f607e07ccf1a07c19f592a1d363763c23f6aa786a688aca

Verdict: PASS
