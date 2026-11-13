# F1 row s7-edited

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s7-edited): four fresh new-form directories, each over a source-only
commit (001) and a fix-with-capture commit (002) with an OKAY verdict, each edited once after `GC patch` wrote it:
`002.patch` overwritten; `002.evidence.patch` overwritten; `002.evidence.patch` removed; an `001.evidence.patch`
added with its name and true hash in the manifest for a commit with no evidence. Then `GC delta` on each, with the
ledger's sha256 before and after.

Observation: each `delta` exits 1 naming the changed file (`002.patch`, `002.evidence.patch` twice,
`001.evidence.patch`), and the ledger's sha256 is the same before and after in all four.

Capture: captures/s7-edited/refusals.txt sha256:898bf4d7d0d73e2ce5c7628a3f41f3823d62d432565d9892eeefc233fc133f5d

Verdict: PASS
