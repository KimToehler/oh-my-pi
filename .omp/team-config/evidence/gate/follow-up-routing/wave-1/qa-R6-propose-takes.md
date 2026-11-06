# QA row R6-propose-takes: Requirement: Propose takes matching follow-ups into the new change

Carried from F1 (captured on 8819e597b7f29b183234b85e4e92efa5cf36a7ed, the last code commit). The only later commit, a100c2c7f0, adds the F1 evidence and ticks task 5.1 in tasks.md; it changes no delivered command text, so it cannot change what these rows observed.

## Observed

`## Follow-ups taken` after `## Impact` with one entry: `docs/roadmap/widgets.md` and the src/cache.ts:12 bullet byte-identical to the roadmap's; the src/render.ts:3 item not taken; What Changes covers props-aware reuse "(follow-up below)"; widgets.md absent from git-diff.patch.

## Cited captures (tracked at the reviewed SHA)

- `5900e5efda2aa366dbb647d6c8f43fb69c59d35563e8fccd497d1909809cb6dd`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/before.txt`
- `53968d951a18462a21cde834cd3ee1b8de35c4400f152cdeb8257404577b4231`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/calls.md`
- `8d3b7bd084f93a9c42c2c7ea11bee46b964d533ed1d181779cfcaf8aabb8a52e`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/git-diff.patch`
- `7c172bedce7eafc17f4e7876615349e9a0cf781ca14776b86edfa47da2b3c8a9`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/propose-take.prompt.txt`
- `ce7fc374c2ef775f615dee55c3471c5c462f2c4f356ebd06b20f54a7eca102ac`  `.omp/team-config/evidence/gate/follow-up-routing/f1/propose-take/propose-take.session-output.txt`

Index and controls: `4ce143616cf0c213bbe818809c4f2ca4b420deb150f34ce88e984492ccafc733`  `.omp/team-config/evidence/gate/follow-up-routing/f1/README.md`; `17236c3c2a94598dbdb6fac5be6223e2bcbc1b61c411e9d1545cbc276f708a25`  `.omp/team-config/evidence/gate/follow-up-routing/f1/controls/command-source.txt`

Verdict: PASS
