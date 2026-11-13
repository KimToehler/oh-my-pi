# F1 row s4-negative-patch

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s4-negative-patch): `grep` on the s1 scratch `001.patch` and
`001.evidence.patch` (commands echoed in `checks.txt`).

Observation: the negative control holds. `001.patch` holds the fix line `+fun stop() = deadline()` (line 15) and no
`WebView` line of the capture (grep exit 1); `001.evidence.patch` holds the three capture lines and no line of the
source fix (grep `deadline` exit 1). A patch that kept the capture or dropped the fix would fail one of these.

Capture: captures/s4-negative-patch/checks.txt sha256:d97b890529174ea50620d5f2f824d760f350acb9f9a828b19266ea3338274481
Capture: captures/s1-mixed/001.patch sha256:49591205df17df9f88d3bde9ed6e58ac44e6d1a0d8828bb4aaa1420b7208b1f5
Capture: captures/s1-mixed/001.evidence.patch sha256:54d40dfd813b6758b84b7af06b9ea4c7ebe8f4b9b294326e7356916d758180cb

Verdict: PASS
