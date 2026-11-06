# QA row R2-record-unchanged: Requirement: Routing leaves the gate record and its evidence unchanged

Carried from F1 (captured on 8819e597b7f29b183234b85e4e92efa5cf36a7ed, the last code commit). The only later commit, a100c2c7f0, adds the F1 evidence and ticks task 5.1 in tasks.md; it changes no delivered command text, so it cannot change what these rows observed.

## Observed

In every cited row before.txt and after.txt list identical SHA-256 values for the record and every pinned file, and every pinned digest reads `match`. git-diff.patch of collect changes only docs/roadmap/widgets.md and moves the change folder.

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
- `cee85654ed0ca4847297572f2553f9d05922f5eaa6f56b3f4357d3e6fd0940db`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/before.txt`
- `db85f694ec352059fc59a397538d51cb1e4388f8cb753716c858556e12d9aed2`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/calls.md`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/dedupe.prompt.txt`
- `b5777e6b9c2f78e8e8514400d0d04a6cc12ad04b220a4645187f25a8457001c3`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/dedupe.session-output.txt`
- `d1775d2beabc7661328278fb9dc140da833bca93454da3f6459e86386d66d1c9`  `.omp/team-config/evidence/gate/follow-up-routing/f1/dedupe/git-diff.patch`
- `cee85654ed0ca4847297572f2553f9d05922f5eaa6f56b3f4357d3e6fd0940db`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/before.txt`
- `7980511c1d9fabf0537c0c9242ef9c350f9ce0f2a1dcd22bb21f8a4bb8986e0c`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/calls.md`
- `25d4f2da083e71e72392accc97da0988995b62dd6005dc9f318dc70ce79ec1b2`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/git-diff.patch`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/remove-taken.prompt.txt`
- `91b381c535749eef4565d914e6bdbc782a79eb7fb5368938c33daaa309f32ebd`  `.omp/team-config/evidence/gate/follow-up-routing/f1/remove-taken/remove-taken.session-output.txt`
- `cee85654ed0ca4847297572f2553f9d05922f5eaa6f56b3f4357d3e6fd0940db`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/after.txt`
- `b5db339a421c20d5c830b11ecf7a0639974684b115700183047d27c11f263a91`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/ask-destination.ask1.txt`
- `ed34bfbdbb56195a4647999c07ef8354cc3a20b8725aaae281f40b07cd8aaa8b`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/ask-destination.final.txt`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/ask-destination.prompt.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/before.txt`
- `1ab5330d47932cf2b2936b8e0aaeed216ee5cbe931ec8f263991629688d9baa3`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/calls.md`
- `182ebc4d04ffcead389a90e1c865599ed252c5e81f6c7696c55fcf8711b8d764`  `.omp/team-config/evidence/gate/follow-up-routing/f1/ask-destination/git-diff.patch`
- `7231b6db62e209db4531377aef209be55d72357e04a93b03ebb698d93173d1f1`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/before.txt`
- `8870b1ecc3b1986b7b40b1bb7cbb645078381d6d297695f8bbc80d9250630622`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/calls.md`
- `d7d5e289e3cc55b0e63482863334924938c7d9f7c715fb061f7944296826c595`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/entered-path.ask1.txt`
- `d1ca1b946d891a9c706f7c53cfbf98b199cd9093dfdbffcd04db7a471eb7d604`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/entered-path.final.txt`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/entered-path.prompt.txt`
- `cb176879feb4e63652059be4c9db0cd0062aa1fdc717dbb8c160565246a081a4`  `.omp/team-config/evidence/gate/follow-up-routing/f1/entered-path/git-diff.patch`
- `d184299807de8a571480566dccc9d65b8254489a13f0b085ea58b0d76fe73015`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/before.txt`
- `35fa8afc28c1c1bf75baee645c14bab566048039e624da0ad113f98b7dde7944`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/calls.md`
- `765c38838485c3dc5179790fcf97615946bd6ed32b599650a5196b168c2d4fd7`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/git-diff.patch`
- `ed9f5058ca209943aa34f5db368e907580461a3d720311ec6325f0ff6954e323`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.ask1.txt`
- `ec1220ef4c7aa8673e38a8fe30ba6bf89cff3cd846200c7544955663aafa6017`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.final.txt`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.prompt.txt`
- `55575569243885a153d85417f5224cf65ac706061f3444cc093c3616bef882f1`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/after.txt`
- `1ece3fb8efc423c360024ca7340cdbd53f275346e6d0724381650ecd9be15148`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/before.txt`
- `f89f0c4580f040f652605946d2399e45cd0c6067172701934fafeeb808e8a702`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/calls.md`
- `8fb97974ebecd4f2be38ab619b9382388d328724d048620a8e8e4a54fa575824`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/git-diff.patch`
- `f1528d697dab2ff5dd939c681d1d8ba43055b131df72b062c357f95fb6d10130`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/no-items.ask1.txt`
- `3e0852c64290b0782ed4ed596b1d8b0559396ebb25682440ec83157990e8c967`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/no-items.final.txt`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/no-items/no-items.prompt.txt`
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

Index and controls: `4ce143616cf0c213bbe818809c4f2ca4b420deb150f34ce88e984492ccafc733`  `.omp/team-config/evidence/gate/follow-up-routing/f1/README.md`; `17236c3c2a94598dbdb6fac5be6223e2bcbc1b61c411e9d1545cbc276f708a25`  `.omp/team-config/evidence/gate/follow-up-routing/f1/controls/command-source.txt`

Verdict: PASS
