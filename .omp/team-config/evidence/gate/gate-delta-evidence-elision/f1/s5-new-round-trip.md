# F1 row s5-new-round-trip

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s5-new-round-trip): `GC baseline`, two commits (a fix with a capture, then
an evidence-only row), the deployed `GC patch`, a REJECT `verdict.json`, `GC delta --lane F2 --row R1`, then
`GC accept --lane F2 --by f1 --reason residual`; the ledger lines they appended filtered with `jq`.

Observation: the manifest has `left_out` `.omp/team-config/evidence/`; `delta` prints
`RECORDED fix_delta_review rows=R1 round=1 verdict=REJECT` and exits 0; `accept` prints
`RECORDED fix_delta_review verdict=accepted-risk` and exits 0; the ledger gained exactly those two
`fix_delta_review` lines, each over both commits.

Capture: captures/s5-new-round-trip/baseline.txt sha256:3c9155bb6d3d4c5195565da423722aad6be728581e05c7ee19b28326a48a8da1
Capture: captures/s5-new-round-trip/patch.stdout sha256:f7daa53eaf11fca0aa4a31974934a7d1ccdd7670b7b843f29e387c6f86b2ab69
Capture: captures/s5-new-round-trip/manifest.json sha256:55e5b994ca5785051f8b870c29508f05f3ae2efefdb06a36dfe437a47f5cc615
Capture: captures/s5-new-round-trip/delta.txt sha256:86025f45b706a0ac43edd60959b67cb43d3c190be94755bddb5ebb8ed060db17
Capture: captures/s5-new-round-trip/accept.txt sha256:52df81e23c65776b384a1a6ff3060173e5641081299c323fd93022fd72a64ccc
Capture: captures/s5-new-round-trip/ledger-lines.txt sha256:7509734009761a463dfb6e326a86ed7013e7d2596e737bec7fbb909ebccd3eeb

Verdict: PASS
