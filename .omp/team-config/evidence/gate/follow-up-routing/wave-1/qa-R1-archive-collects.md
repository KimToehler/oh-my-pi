# QA row R1-archive-collects: Requirement: Archive collects the change's follow-ups from its gate record

Carried from F1 (captured on 8819e597b7f29b183234b85e4e92efa5cf36a7ed, the last code commit). The only later commit, a100c2c7f0, adds the F1 evidence and ticks task 5.1 in tasks.md; it changes no delivered command text, so it cannot change what these rows observed.

## Observed

collect: four items routed (d1 `B1`, n1 `note 1`, n2 `note 2` from the audit trailer, n3 `note 1` from the strategic trailer); n0 (unbound wave-1 trailer) and d2 (`residual`) absent. whole-diff: r1 routed with source `f3-integration-review-report.md, note 1`. no-record: nothing collected, no question, summary "none collected. There is no gate record at `.omp/team-config/evidence/gate/widget-cache.json`".

## Cited captures (tracked at the reviewed SHA)

- `cee85654ed0ca4847297572f2553f9d05922f5eaa6f56b3f4357d3e6fd0940db`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/before.txt`
- `9ea14b790e841f165e7c318762c566ae94b2079c3452e2119efe9d68fee0e77c`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/calls.md`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/collect.prompt.txt`
- `ca61064073cab02f4200b8ef81a9e04d2f70f4e7e7f439fb43c63b451b5ab5a6`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/collect.session-output.txt`
- `508b1fec6029c5ef4d220ce3eb9af7ef559e18ed2725042da333265caa65a2c3`  `.omp/team-config/evidence/gate/follow-up-routing/f1/collect/git-diff.patch`
- `3326069f0fa125e8097cf270355a280afaae3f3d505243cd0c110da34448d6e0`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/after.txt`
- `92061a2c56852c3440737da4a8a553719d6a7e5da69f26b9c17d8fcccccfd15d`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/before.txt`
- `04039b11d54e8de0b204a3d7e892e380c2511c5c6a8506584b9f27e2f96f1b4e`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/calls.md`
- `f24a26529135f932a5d1564c5b4712efb295655d64d07b066ae47354f1bc6882`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/git-diff.patch`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/whole-diff.prompt.txt`
- `d5d08470cea04fab3ef6b634ce28a18e7c643a1f9d76afdc00c597faa82c8dd4`  `.omp/team-config/evidence/gate/follow-up-routing/f1/whole-diff/whole-diff.session-output.txt`
- `1b16c05218dd0a9e08928e3e040d2b035ccb43127b2d2c40cdbe3e581f93b1e8`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/after.txt`
- `25871d0b3aee98ae5e2cc85a3742e79d75690dc2c2557ad0d17c4c66617395b1`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/before.txt`
- `bfd02590351d51e7d0868c563c4fed6818f0e78b65bbd0fe5c98f4ba25dcf5f8`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/calls.md`
- `765c38838485c3dc5179790fcf97615946bd6ed32b599650a5196b168c2d4fd7`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/git-diff.patch`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/no-record.prompt.txt`
- `5928e9bd3d1663f83fcdd0094c20d98dbf50861009d7f8c6218b3a8c77cb13e0`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-record/no-record.session-output.txt`

Index and controls: `4ce143616cf0c213bbe818809c4f2ca4b420deb150f34ce88e984492ccafc733`  `.omp/team-config/evidence/gate/follow-up-routing/f1/README.md`; `17236c3c2a94598dbdb6fac5be6223e2bcbc1b61c411e9d1545cbc276f708a25`  `.omp/team-config/evidence/gate/follow-up-routing/f1/controls/command-source.txt`

Verdict: PASS
