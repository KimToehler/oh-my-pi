#!/bin/bash
# round-trip, between the two sessions: record session 1's diff, then the fixture ticks the tasks, adds review.md (OKAY)
# and a gate record without follow-ups for the proposed change. usage: rt-stage2.sh <change name>. One-off F1 helper.
set -euo pipefail
N=$1 C=openspec/changes/$1 EV=.omp/team-config/evidence/gate/$1
cd /tmp/fur-f1/round-trip
G=(-c user.name=fixture -c user.email=fixture@example.invalid)
git add -A && git diff --cached HEAD > /tmp/fur-f1/round-trip.propose-diff.patch
git "${G[@]}" commit -q -m "session 1 (/opsx-propose) output"
sed -i '' 's/^\([[:space:]]*\)- \[ \]/\1- [x]/' "$C/tasks.md"
printf '# Review\n\n- **Verdict**: OKAY\n- **Round**: 1\n\n## Blockers\n\nnone\n\n## Residuals\n\nnone\n' > "$C/review.md"
mkdir -p "$EV/f2" "$EV/f1"
printf '# F1 row A\n\nThe cache over its bound evicted the least recently used widget.\n' > "$EV/f1/a.md"
printf '### 1. Goal and behavioural contract\n\nThe bound, the eviction order and props-aware reuse hold as specified.\n\n### 2. Correctness\n\nNo blocker.\n\n### 5. Non-blocking notes\n\nnone\n\nREVIEW-TRAILER-v1\ninvocation: implementation-audit\nsections_covered: 1,2,3,4,5\nmodel_id: fixture/auditor\nsecurity_delta: no\nverdict: PASS\nblockers: none\nEND-REVIEW-TRAILER\n' > "$EV/f2/trailer-implementation-audit.txt"
jq -n --arg ev "$EV" --arg c "$C" \
	--arg t "$(shasum -a 256 "$EV/f2/trailer-implementation-audit.txt" | cut -d' ' -f1)" \
	--arg q "$(shasum -a 256 "$EV/f1/a.md" | cut -d' ' -f1)" \
	'{schema:"team-config.merge-gate/v3",plan:$c,plan_sha256:("2"*64),reviewed_sha:("2"*40),diff_base:("1"*40),reviewers_run:["implementation-audit"],decision_reason:"Mandatory class none; standard depth.",mandatory_class:"none",implementation_models:["fixture/model"],blockers:[],whole_diff:{run:false},qa:[{name:"F1 row A",passed:true,artifact:($ev+"/f1/a.md"),artifact_sha256:$q}],resolution:[{invocation:"implementation-audit",agent:"auditor",model:"fixture/auditor",independence:"cross-provider"}],verdicts:[{invocation:"implementation-audit",verdict:"PASS",trailer_artifact:($ev+"/f2/trailer-implementation-audit.txt"),trailer_sha256:$t}]}' \
	> ".omp/team-config/evidence/gate/$N.json"
git add -A && git "${G[@]}" commit -q -m "fixture: tick tasks, review OKAY, gate record without follow-ups"
DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec list --json | jq -c '.changes[] | {name,completedTasks,totalTasks}'
/tmp/fur-f1/tools/snap.sh . "$N" > /tmp/fur-f1/round-trip.before.txt
cat /tmp/fur-f1/round-trip.before.txt
