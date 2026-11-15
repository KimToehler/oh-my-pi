# Head of the F1 rows

Every row file names the head it ran on: `8f119544403ccba950c33c3697143895166bf8ee`, deployed by task 5.3 at the time (`deploy-local.sh`, deployed skill, driver and scripts equal to the branch's files).

After the rows, the branch got two plan commits (`7d2e311ab9`: `target-rerun` counts the JVM by argv, settling in the `vm up` timing; `570ad83aae`: delta check round 10 OKAY) and a merge of `main` (`4a645026f7e24596e4b9c03d637931485dcc8830`). On 2026-11-15 at 19:51:34 another session deployed `main`'s team config over the lane's driver; task 5.3 was then repeated on `4a645026f7e24596e4b9c03d637931485dcc8830` and `deployed-rev.txt` records it.

`git diff --stat 8f119544403ccba950c33c3697143895166bf8ee 4a645026f7e24596e4b9c03d637931485dcc8830 -- team-config/agent/skills/app-qa-drivers` is empty: the driver, skill, image guide and guest scripts the rows exercised are byte-identical at the deployed head. `qa-test-log.txt` is the full suite's output on `4a645026f7e24596e4b9c03d637931485dcc8830`.
