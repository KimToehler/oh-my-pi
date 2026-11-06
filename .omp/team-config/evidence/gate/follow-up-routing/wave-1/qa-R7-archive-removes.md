# QA row R7-archive-removes: Requirement: Archiving a change removes the follow-ups it took

Carried from F1 (captured on 8819e597b7f29b183234b85e4e92efa5cf36a7ed, the last code commit). The only later commit, a100c2c7f0, adds the F1 evidence and ticks task 5.1 in tasks.md; it changes no delivered command text, so it cannot change what these rows observed.

## Observed

round-trip: roadmap named only in openspec/config.yaml context; fresh propose session took the src/cache.ts:12 item; fresh archive session removed it from docs/roadmap/w.md (git-diff.patch). remove-taken: unedited taken bullet deleted, edited one kept and named as not found in the summary.

## Cited captures (tracked at the reviewed SHA)

- `8806ea3a0e0f415ba799d774977cc9c48d9559e2d8e05ac4dc618ae91b33b776`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/before-propose-session.txt`
- `6dda19daddc47db4762ebff1b0a5c833daec16f02d32df65e0d4e439a45d67f3`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/before.txt`
- `5bb548a1d07e4f51d086521a72a444019e6d4fcf354f69d2ce87d639357c2523`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/calls.md`
- `ff76206a0b7c0397ee7e17ba517089b56e433d3d6ffc402106322b1e66dfe8a9`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/git-diff-propose-session.patch`
- `3a1dafaf44f2a9789484c4863f2743c3370eac3ed5b432efc0a86ffa9a060bfe`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/git-diff.patch`
- `4d223ee46a707f36a4916d8871cd2f3a96c2f65efdf085db935baee8716e2285`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/round-trip-archive.prompt.txt`
- `7c172bedce7eafc17f4e7876615349e9a0cf781ca14776b86edfa47da2b3c8a9`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/round-trip-propose.prompt.txt`
- `52c7232d620132631147f3273a5cabda8469817cc69ab518b8d1f137f49eb0d6`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/round-trip-propose.session-output.txt`
- `23fad7d68c3c7b086f5b3e8213c31a9df544983316731e8629df14c1f6160360`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/round-trip.ask1.txt`
- `90c081a5930ec29e09d25c29e184bf515c54f48c0637b0b46dcc76d254dc2ff8`  `.omp/team-config/evidence/gate/follow-up-routing/f1/round-trip/round-trip.final.txt`
- `cee85654ed0ca4847297572f2553f9d05922f5eaa6f56b3f4357d3e6fd0940db`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/before.txt`
- `7980511c1d9fabf0537c0c9242ef9c350f9ce0f2a1dcd22bb21f8a4bb8986e0c`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/calls.md`
- `25d4f2da083e71e72392accc97da0988995b62dd6005dc9f318dc70ce79ec1b2`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/git-diff.patch`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/remove-taken.prompt.txt`
- `91b381c535749eef4565d914e6bdbc782a79eb7fb5368938c33daaa309f32ebd`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/remove-taken.session-output.txt`

Index and controls: `4ce143616cf0c213bbe818809c4f2ca4b420deb150f34ce88e984492ccafc733`  `.omp/team-config/evidence/gate/follow-up-routing/f1/README.md`; `17236c3c2a94598dbdb6fac5be6223e2bcbc1b61c411e9d1545cbc276f708a25`  `.omp/team-config/evidence/gate/follow-up-routing/f1/controls/command-source.txt`

Verdict: PASS
