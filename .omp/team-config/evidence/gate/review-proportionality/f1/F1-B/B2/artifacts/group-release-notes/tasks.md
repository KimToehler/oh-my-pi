# Tasks

Base revision for every comparison: `27185a9` (repository HEAD when this change was planned; `skills/release-notes/SKILL.md` has lines 1-11 there, heading on line 6, blank line 7, step 1 on line 8). No README or changelog change: `README.md` does not describe individual skills and the repository has no changelog.

## 1. Skill text

- [ ] 1.1 Insert `Group release notes by package before listing changes.` as a new line 8 of `skills/release-notes/SKILL.md`, followed by one blank line, so it sits between the `# Release notes` heading and step 1 (design.md Decision 1); change no other byte. Verify: `test "$(sed -n 8p skills/release-notes/SKILL.md)" = 'Group release notes by package before listing changes.' && test "$(sed -n 9p skills/release-notes/SKILL.md)" = '' && test "$(grep -cxF 'Group release notes by package before listing changes.' skills/release-notes/SKILL.md)" = 1 && diff <(git show 27185a9:skills/release-notes/SKILL.md) <(sed '8,9d' skills/release-notes/SKILL.md)`
- [ ] 1.2 Show that the 1.1 text check discriminates (spec `Skill instructs package grouping`, Negative control): a paraphrase leaves zero exact lines, a duplicate leaves two, and an edited step 4 breaks the byte comparison. Verify: `test "$(sed 's/^Group release notes by package before listing changes\.$/Sort release notes by package./' skills/release-notes/SKILL.md | grep -cxF 'Group release notes by package before listing changes.')" = 0 && test "$(sed '8p' skills/release-notes/SKILL.md | grep -cxF 'Group release notes by package before listing changes.')" = 2 && ! diff -q <(git show 27185a9:skills/release-notes/SKILL.md) <(sed '8,9d; s/^4\. Leave out/4. Omit/' skills/release-notes/SKILL.md)`

## 2. Final verification


- [ ] 2.1 F1. Manual QA on the real surface (spec `Drafted notes are grouped by package`): confirm the release-notes skill now tells agents to group the drafted notes by package; evidence `.omp/team-config/evidence/gate/group-release-notes/f1/grouping.txt` holds the matching line. Verify: `grep -F 'Group release notes by package before listing changes.' skills/release-notes/SKILL.md > .omp/team-config/evidence/gate/group-release-notes/f1/grouping.txt`

## Workflow follow-up

- F3 whole-diff review is not run: gate.md says Whole-diff review `not needed` (one paragraph in one file).
- F2 merge gate (`review-work`), after 2.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot. Risk tier internal-tooling: one `implementation-audit`.
- Merge only after the F2 record validates.
- Archive the change after merge (`openspec archive group-release-notes`), creating `openspec/specs/release-notes/spec.md`.
