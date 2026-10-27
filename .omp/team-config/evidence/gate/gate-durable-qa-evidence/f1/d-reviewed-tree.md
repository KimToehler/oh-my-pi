Validator sha256: 4ee89eed03e9cdd45fb641618a998098d49319e73cacd9ee5ed336b3f56001d2
Command: git init -q -b main
Command: git config user.email f1@test
Command: git config user.name F1 QA
Command: git add .gitignore src/a.txt
Command: git commit -q -m base
Command: git add src/a.txt docs/evidence/demo/f1/capture.txt
Command: git commit -q -m the change under review
Step: commit docs/evidence/demo/f1/capture.txt inside the reviewed change
Step: write record .omp/team-config/evidence/gate/demo.json citing docs/evidence/demo/f1/capture.txt
Command: git add -- .omp/team-config/evidence/gate/demo.json .omp/team-config/evidence/gate/demo/f2/trailer-implementation-audit.txt
Command: git commit -q -m gate record
Command: node validate-gate-record.mjs --record .omp/team-config/evidence/gate/demo.json --plan .omp/plans/demo.md --repo <scratch>
Exit: 0
stdout:
passed
stderr:
(empty)
Outcome: passed
RESULT PASS
