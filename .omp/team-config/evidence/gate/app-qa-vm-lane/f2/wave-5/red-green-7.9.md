# RED and GREEN for row 7.9

Head `71072693cc0f650f4ff974c31f164907f4b89d70` plus the uncommitted 7.9 change. GREEN runs the changed qa.test.mjs against the changed driver. RED runs the same tests with `QA_UNDER_TEST` naming the head's driver (`git archive HEAD` to `/tmp/aqvl/pre6`). Full file afterwards: `node --test team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` printed `ℹ tests 224`, `ℹ pass 224`, `ℹ fail 0` [exit 0].

```
$ node --test --test-name-pattern='route: peer-gone|route: lost' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs
✔ route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix (9665.953166ms)
✔ route: peer-gone - a clone that vanishes without closing the routed command's connection ends the command within the keepalive bound: exit 2, the infrastructure line, the busy marker released (2875.81675ms)
✔ route: lost - no guest line is printed before the guest command has ended, and the lines then appear in order (3231.815125ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
[exit 0]

$ QA_UNDER_TEST=/tmp/aqvl/pre6/team-config/agent/skills/app-qa-drivers/scripts/qa.mjs node --test --test-name-pattern='route: peer-gone|route: lost' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs
✔ route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix (8946.63875ms)
✖ route: peer-gone - a clone that vanishes without closing the routed command's connection ends the command within the keepalive bound: exit 2, the infrastructure line, the busy marker released (11103.587792ms)
✔ route: lost - no guest line is printed before the guest command has ended, and the lines then appear in order (3333.988625ms)
ℹ tests 3
ℹ pass 2
ℹ fail 1
  AssertionError [ERR_ASSERTION]: the routed command still waited on its ssh 10 s after the guest vanished
[exit 1]
```
