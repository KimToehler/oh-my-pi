# F1 row s6-old-dir

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s6-old-dir): a delta directory written by hand the way `GC patch` wrote it
before this change (one whole-commit `git show --format=fuller --no-renames --patch` per commit, read-only bits not
needed, a manifest without a `left_out` key), over a range whose second commit mixes a fix with a capture; then
`GC delta` with a REJECT verdict and `GC accept`.

Observation: the manifest has no `left_out` key; the deployed script verifies the whole-commit patches, the capture's
hunk inside them included, and records both: `delta` exit 0 with `verdict=REJECT`, `accept` exit 0 with
`verdict=accepted-risk`, two ledger lines.

Capture: captures/s6-old-dir/manifest.json sha256:3d7d065509d01cda7aaa0501e399fb2bd9a52f74fb7cb0e05caf02b3603f93b0
Capture: captures/s6-old-dir/delta.txt sha256:86025f45b706a0ac43edd60959b67cb43d3c190be94755bddb5ebb8ed060db17
Capture: captures/s6-old-dir/accept.txt sha256:52df81e23c65776b384a1a6ff3060173e5641081299c323fd93022fd72a64ccc
Capture: captures/s6-old-dir/ledger-lines.txt sha256:7509734009761a463dfb6e326a86ed7013e7d2596e737bec7fbb909ebccd3eeb

Verdict: PASS
