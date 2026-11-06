# QA row R5-skip: Requirement: Skipped follow-ups stay visible and never block the archive

Carried from F1 (captured on 8819e597b7f29b183234b85e4e92efa5cf36a7ed, the last code commit). The only later commit, a100c2c7f0, adds the F1 evidence and ticks task 5.1 in tasks.md; it changes no delivered command text, so it cannot change what these rows observed.

## Observed

Answered Skip; archive completed (folder moved); git-diff.patch writes no document; summary `Follow-ups: skipped` lists all four items in full with their sources.

## Cited captures (tracked at the reviewed SHA)

- `d184299807de8a571480566dccc9d65b8254489a13f0b085ea58b0d76fe73015`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/after.txt`
- `7e4c0357f4b830f09d47a76a902a0d33252a79e7a0418340ea24873a9de20c2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/before.txt`
- `35fa8afc28c1c1bf75baee645c14bab566048039e624da0ad113f98b7dde7944`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/calls.md`
- `765c38838485c3dc5179790fcf97615946bd6ed32b599650a5196b168c2d4fd7`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/git-diff.patch`
- `ed9f5058ca209943aa34f5db368e907580461a3d720311ec6325f0ff6954e323`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.ask1.txt`
- `ec1220ef4c7aa8673e38a8fe30ba6bf89cff3cd846200c7544955663aafa6017`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.final.txt`
- `cde4f3fe095158dc4e8f9b7b5fb47e48d589f25871f3cf4c5dac8137de6d0e2f`  `.omp/team-config/evidence/gate/follow-up-routing/f1/skip/skip.prompt.txt`

Index and controls: `4ce143616cf0c213bbe818809c4f2ca4b420deb150f34ce88e984492ccafc733`  `.omp/team-config/evidence/gate/follow-up-routing/f1/README.md`; `17236c3c2a94598dbdb6fac5be6223e2bcbc1b61c411e9d1545cbc276f708a25`  `.omp/team-config/evidence/gate/follow-up-routing/f1/controls/command-source.txt`

Verdict: PASS
