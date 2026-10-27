Validator sha256: 4ee89eed03e9cdd45fb641618a998098d49319e73cacd9ee5ed336b3f56001d2
Command: git init -q -b main
Command: git config user.email f1@test
Command: git config user.name F1 QA
Command: git add .gitignore src/a.txt
Command: git commit -q -m base
Command: git add src/a.txt
Command: git commit -q -m the change under review
Step: write .omp/team-config/evidence/gate/demo/wave-1/capture.txt (untracked)
Command: GC baseline --sha HEAD
GC baseline stdout: BASELINE 50d17178537f recorded
Command: GC snapshot --lane F2
Step: write record .omp/team-config/evidence/gate/demo.json citing .omp/team-config/evidence/gate/demo/wave-1/capture.txt
Command: git add -- .omp/team-config/evidence/gate/demo.json .omp/team-config/evidence/gate/demo/f2/trailer-implementation-audit.txt .omp/team-config/evidence/gate/demo/wave-1/capture.txt
Command: git commit -q -m gate record and evidence
Command: node validate-gate-record.mjs --record .omp/team-config/evidence/gate/demo.json --plan .omp/plans/demo.md --repo <scratch>
Snapshot exit: 0
<scratch>/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.snapshot.json
SNAPSHOT F2 wave 1 50d17178537f
PLAN <scratch>/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.plan.md
Exit: 0
stdout:
passed
stderr:
(empty)
Outcome: passed
RESULT PASS
