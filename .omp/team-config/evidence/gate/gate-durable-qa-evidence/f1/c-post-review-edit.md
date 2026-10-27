Validator sha256: 4ee89eed03e9cdd45fb641618a998098d49319e73cacd9ee5ed336b3f56001d2
Command: git init -q -b main
Command: git config user.email f1@test
Command: git config user.name F1 QA
Command: git add .gitignore src/a.txt
Command: git commit -q -m base
Command: git add src/a.txt .omp/team-config/evidence/gate/demo/f1/capture.txt
Command: git commit -q -m the change under review
Step: commit .omp/team-config/evidence/gate/demo/f1/capture.txt inside the reviewed change
Step: edit .omp/team-config/evidence/gate/demo/f1/capture.txt after reviewed_sha
Step: write record .omp/team-config/evidence/gate/demo.json citing .omp/team-config/evidence/gate/demo/f1/capture.txt
Command: git add -- .omp/team-config/evidence/gate/demo.json .omp/team-config/evidence/gate/demo/f2/trailer-implementation-audit.txt .omp/team-config/evidence/gate/demo/f1/capture.txt
Command: git commit -q -m gate record and edited evidence
Command: node validate-gate-record.mjs --record .omp/team-config/evidence/gate/demo.json --plan .omp/plans/demo.md --repo <scratch>
Exit: 1
stdout:
blocked
stderr:
reviewed_sha: 0c9d8134d22ab98d4b7e3558ba6a1d196faec654 does not equal current HEAD 91ea29c69f7f1d13aeb95ca54a9936545beb9d33, and the commits between them change more than the gate evidence
Outcome: blocked
Finding: reviewed_sha
RESULT PASS
