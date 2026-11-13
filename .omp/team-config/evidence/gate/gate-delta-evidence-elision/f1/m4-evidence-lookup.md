# F1 row m4-evidence-lookup

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash m4-build.sh 7867` (7867 drawn at random for this run): a scratch repository `/tmp/f1-m4-NR6V` whose
range has three commits: `a7068f9` adds `src/engine.kt` and the RED record
`.omp/team-config/evidence/gate/demo/red/1.1.txt` with `AssertionError: stop took 7867 ms, expected at most 250 ms`;
`762ff63` fixes `src/engine.kt`; `d824d6e` deletes the RED record. The deployed `GC patch` writes
`.omp/team-config/gate-deltas/F2-1.1-m4`. `python3 brief.py m4 ...` fills the shipped delta brief of the deployed
`SKILL.md` (only the `{...}` inputs); the fix entry cites the RED record without its figure and asks for the measured
stop time. A fresh `plan-reviewer` (`F1M4Reviewer`, task context "Read-only fix-delta review; the task text is the
complete brief.") received it; its session file is copied as `transcript.jsonl` and its structured reply as `reply.json`.

Observation:
- The figure is in no file of the working tree (`grep -rn 7867`, `.git` and the delta directory excluded: exit 1);
  in the delta directory only `001.evidence.patch` and `003.evidence.patch` hold it. The manifest gives commits 1 and 3
  an evidence file and commit 2 none.
- The transcript shows `read` of the manifest, of `001.patch`, `002.patch` and `003.patch`, then `read` of
  `001.evidence.patch` and `003.evidence.patch`; the tool result of the `001.evidence.patch` read is the RED record's
  added hunk.
- The structured reply (schema-valid REJECT with two blockers on the toy fix) names the figure: "The RED record
  reports an unfixed stop time of 7867 ms against a 250 ms limit", and quotes the line from `003.evidence.patch`.
- `reads.py` over the transcript (`reads.txt`): each of the three manifest patches has a read whose result equals the
  file's text; both evidence files were read.
- `brief-received.txt` is the brief as the reviewer received it; after the harness's two-line prefix it equals
  `brief.txt`.

Capture: m4-build.sh sha256:3929a50202da3fd7479f0132675529d993fd79a5d0faaf14de243d07ed30aeb9
Capture: brief.py sha256:a06ccc5c4933d36bbde0a0eecb7fab0c6bacd03277e87ad5eb1b95c40ba0eea9
Capture: reads.py sha256:84381c28fe80922614b6a11937022ae11c89d3755ad32b014993443c0f969476
Capture: captures/m4-evidence-lookup/run.txt sha256:924c41ff105e1a1bd3f8eb81bf6ee3c6fca647f4e60e5f9c8b61757223819d61
Capture: captures/m4-evidence-lookup/patch.stdout sha256:4658d0f614066f8e1fdf8f41ae5d317dbf01be99de0c4b82a2c256c72714b3cf
Capture: captures/m4-evidence-lookup/manifest.json sha256:f7bcd43d3aba1eaddbee645629eb6a76f18ee2b447d0c4b8a92c9b86756cac01
Capture: captures/m4-evidence-lookup/figure-location.txt sha256:573f8627a057848d7084667f527378b69b4b6b96fef7b29244ce6acb0ffe336e
Capture: captures/m4-evidence-lookup/brief.txt sha256:034e922c718e6c7864f505a31a901fe4102a53c689633e42bf90b7df8e328ba0
Capture: captures/m4-evidence-lookup/brief-received.txt sha256:a4b197c6d22d4f60989ee64aa436f2208b7e927b23b160feb57ce69272bb4198
Capture: captures/m4-evidence-lookup/transcript.jsonl sha256:c06aab144b12626a4e636e8827e6005ca71438c5d0a667ea014484e12c22d3cd
Capture: captures/m4-evidence-lookup/reply.json sha256:02db0b4dc033212751e241b807c46006a5b8989dccbbb189690563e76755956f
Capture: captures/m4-evidence-lookup/reads.txt sha256:91ea3e732bfc8f10d3965613a1b63b41ca7c886a953ed49aee8305e33d8d7774

Verdict: PASS
